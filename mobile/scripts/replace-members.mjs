#!/usr/bin/env node
/** Explicit, resumable maintenance. Never invokes delete-member/Auth delete or downloads photos. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseMemberCsv } from '../supabase/functions/_shared/member-csv.ts';
const run=promisify(execFile);
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const projectRef=option('--project-ref'), source=option('--csv'), stateFile=option('--operation-file');
if(!projectRef||!source||!stateFile||option('--confirm')!=='REPLACE MEMBERS')throw new Error('Usage: replace-members.mjs --project-ref <ref> --csv <file> --operation-file <receipt.json> --confirm "REPLACE MEMBERS"');
if(!/^[a-z]{20}$/.test(projectRef))throw new Error('Invalid Supabase project reference.');
const cli=process.env.SUPABASE_CLI??'supabase';
const rows=parseMemberCsv(await readFile(source,'utf8'));
const fingerprint=createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
async function query(sql){
  const folder=await mkdtemp(join(tmpdir(),'fubc-import-sql-'));
  try{
    const path=join(folder,'operation.sql');await writeFile(path,sql,{mode:0o600});
    const {stdout}=await run(cli,['db','query','--linked','--project-ref',projectRef,'--file',path,'--output','json'],{maxBuffer:4*1024*1024});
    return JSON.parse(stdout).rows;
  }catch{throw new Error('Database operation failed. Preserve the operation receipt and retry after checking the schema; do not start a new replacement.');}
  finally{await rm(folder,{recursive:true,force:true});}
}
async function snapshot(){return(await query(`select jsonb_build_object(
  'authCount',(select count(*) from auth.users),
  'authHash',(select md5(coalesce(string_agg(id::text||':'||coalesce(email,''),',' order by id),'')) from auth.users),
  'profileCount',(select count(*) from public.profiles),
  'profileHash',(select md5(coalesce(string_agg(id::text||':'||role::text||':'||status::text,',' order by id),'')) from public.profiles),
  'peopleCount',(select count(*) from public.people),
  'photoCount',(select count(*) from storage.objects where bucket_id='member-photos'),
  'adminId',(select id::text from public.profiles where status='active' and role='admin' order by created_at limit 1),
  'ready',(to_regprocedure('public.import_members_from_csv(uuid,jsonb,text,text)') is not null)
) as snapshot;`))[0].snapshot;}
let state;
try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const before=await snapshot();
if(!before.ready||!before.adminId)throw new Error('Apply the reviewed import migrations and retain an active administrator before replacement.');
if(state&&(state.projectRef!==projectRef||state.fingerprint!==fingerprint))throw new Error('The operation receipt belongs to another project or CSV.');
if(!state){
  state={projectRef,fingerprint,importId:randomUUID(),adminId:before.adminId,authHash:before.authHash,profileHash:before.profileHash,authCount:before.authCount,profileCount:before.profileCount,oldMemberCount:before.peopleCount,oldPhotoCount:before.photoCount};
  await writeFile(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600,flag:'wx'});
}
// One database transaction: all member creation must succeed before removal commits.
const jwtClaims=JSON.stringify({sub:state.adminId,role:'authenticated'});
const receipt=(await query(`begin;
select set_config('request.jwt.claim.sub',${literal(state.adminId)},true);
select set_config('request.jwt.claims',${literal(jwtClaims)},true);
set local role authenticated;
select public.import_members_from_csv(${literal(state.importId)}::uuid,${literal(JSON.stringify(rows))}::jsonb,'replace','REPLACE MEMBERS');
commit;
select public.member_import_receipt(${literal(state.importId)}::uuid) as receipt;`))[0].receipt;
if(receipt?.importedCount!==rows.length||receipt.importId!==state.importId)throw new Error('Import response was not confirmed. Retry with the same operation receipt.');
console.log(JSON.stringify({phase:'members-imported',imported:receipt.importedCount,replaced:receipt.replacedCount,pendingPhotos:receipt.pendingPhotos}));
// Retrieve keys into process memory only; never print, save, or place them in argv.
const {stdout}=await run(cli,['projects','api-keys','--project-ref',projectRef,'--output','json'],{maxBuffer:1024*1024});
const keys=JSON.parse(stdout),service=keys.find(key=>key.name==='service_role');
if(!service?.api_key)throw new Error('Members imported. Storage cleanup needs a service-role key; retry with the same receipt after restoring project access.');
const client=createClient(`https://${projectRef}.supabase.co`,service.api_key,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const method=(init?.method??(input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.pathname.startsWith('/storage/')&&method!=='DELETE')throw new Error('Storage image reads and signed URLs are prohibited during cleanup.');
  return fetch(input,init);
}}});
let removed=0;
for(let batch=0;batch<1000;batch++){
  const result=await client.rpc('member_import_cleanup_batch',{p_import_id:state.importId});
  if(result.error)throw new Error('Members imported; photo metadata query failed. Retry with the same receipt.');
  const paths=result.data.map(row=>row.path);if(!paths.length)break;
  const deleted=await client.storage.from('member-photos').remove(paths);
  if(deleted.error)throw new Error('Members imported; photo deletion failed. Retry cleanup with the same receipt. No photos were downloaded.');
  const acknowledged=await client.rpc('member_import_cleanup_completed',{p_import_id:state.importId,p_paths:paths});
  if(acknowledged.error)throw new Error('Photo deletion response was not recorded. Retry with the same receipt.');
  removed+=paths.length;
}
const after=await snapshot();
if(after.authHash!==state.authHash||after.profileHash!==state.profileHash||after.authCount!==state.authCount||after.profileCount!==state.profileCount)throw new Error('Account inventory changed. Inspect the account preservation check before continuing.');
const outstanding=await client.rpc('member_import_receipt',{p_import_id:state.importId});
if(outstanding.error||outstanding.data?.pendingPhotos!==0)throw new Error('Photo cleanup is still pending. Retry with the same receipt.');
if(after.peopleCount!==rows.length||after.photoCount!==0)throw new Error('Final member or photo counts differ from the requested replacement. Inspect before continuing.');
state.completed=true;state.result={importedCount:rows.length,preservedAccounts:after.authCount,removedPhotos:state.oldPhotoCount,remainingPhotos:after.photoCount};
await writeFile(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({phase:'completed',...state.result,imageDownloadRequests:0,storageDeletionPathsThisRun:removed}));
