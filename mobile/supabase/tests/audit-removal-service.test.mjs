import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { auditBootstrap, auditMigrations } from './audit-fixture.mjs';
const db=new PGlite(),require=createRequire(import.meta.url),ts=require('typescript');
await db.exec(auditBootstrap);
for(const migration of auditMigrations) await db.exec(await readFile(new URL(`../migrations/${migration}.sql`,import.meta.url),'utf8'));
after(()=>db.close());
const admin=crypto.randomUUID(),account=crypto.randomUUID();
for(const id of [admin,account]) await db.query('insert into auth.users(id,email) values($1,$2)',[id,'fixture@example.com']);
await db.query("update public.profiles set status='active',role=case when id=$1 then 'admin'::public.app_role else 'member'::public.app_role end where id=any($2::uuid[])",[admin,[admin,account]]);
async function rpc(name,args) {
 await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 try {
  if(name==='remove_member') return {data:(await db.query('select public.remove_member($1,$2,$3) result',[args.p_id,args.p_revision,args.p_confirmation])).rows[0].result,error:null};
  throw Error(`Unexpected caller RPC ${name}`);
 } catch(error){return {data:null,error};} finally {await db.exec('reset role');}
}
let handler,authDeletes=0,failCleanup=false;const objects=new Map(),removals=[];
const createClient=(_url,key)=>key==='anon' ? {
 auth:{getUser:async()=>({data:{user:{id:admin}},error:null})},rpc,
} : {
 auth:{admin:{deleteUser:async()=>{authDeletes++;return {error:null};}}},
 from(table) {assert.equal(table,'profiles');return {select(){return this;},eq(_key,id){return {maybeSingle:async()=>({data:(await db.query('select id,status,role,person_id from public.profiles where id=$1',[id])).rows[0],error:null})};}};},
 async rpc(name,args){
  if(name==='member_removal_photo_cleanup') return {data:(await db.query('select * from public.member_removal_photo_cleanup($1)',[args.p_person_id])).rows,error:null};
  if(name==='member_removal_photo_cleanup_completed'){await db.query('select public.member_removal_photo_cleanup_completed($1)',[args.p_person_id]);return {data:null,error:null};}
  throw Error(`Unexpected service RPC ${name}`);
 },
 storage:{from(bucket){assert.equal(bucket,'member-photos');return {remove:async(paths)=>{removals.push(paths);if(failCleanup)return {error:{message:'storage unavailable'}};for(const path of paths)objects.delete(path);return {error:null};}};}},
};
const source=ts.transpileModule(await readFile(new URL('../functions/delete-member/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','Deno','exports',source)(()=>({createClient}),{serve:callback=>{handler=callback;},env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]}},{});
const invoke=body=>handler(new Request('https://fixture.invalid/delete-member',{method:'POST',headers:{Authorization:'Bearer existing-session','Content-Type':'application/json'},body:JSON.stringify(body)}));
test('ordinary endpoint revokes access atomically, preserves Auth/relationships, deletes photo bytes and safely retries cleanup',async()=>{
 const person=(await db.query("insert into public.people(name,first_name,last_name,gender,photo_path) values('Service Member','Service','Member','male','service/old.jpg') returning id,revision")).rows[0];
 await db.query('update public.profiles set person_id=$1 where id=$2',[person.id,account]);
 objects.set('service/old.jpg',new Uint8Array([1,2]));objects.set('service/old.jpg.avatar-256.jpg',new Uint8Array([3]));
 const request={personId:person.id,expectedRevision:person.revision,confirmation:'Service Member'};
 failCleanup=true;const pending=await (await invoke(request)).json();assert.equal(pending.status,'completed');assert.match(pending.cleanupWarning,/pending/);
 assert.equal(authDeletes,0);assert.equal(objects.size,2);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[account]);assert.equal((await db.query('select * from public.people')).rows.length,0);await db.exec('reset role');
 failCleanup=false;const completed=await (await invoke(request)).json();assert.equal(completed.status,'completed');assert.equal(authDeletes,0);assert.equal(objects.size,0);
 assert.deepEqual(removals.at(-1),['service/old.jpg','service/old.jpg.avatar-256.jpg']);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 const history=(await db.query("select public.audit_history('{}',10,0) result")).rows[0].result;assert.equal(history.total,1);
 await db.query('select public.execute_audit_rollback($1,$2,$3)',[history.items[0].id,crypto.randomUUID(),'mistaken removal']);
 const restored=(await db.query('select photo_path from public.people where id=$1',[person.id])).rows[0];assert.equal(restored.photo_path,null);assert.equal(objects.size,0);
 await db.exec('reset role');assert.equal((await db.query('select status from public.profiles where id=$1',[account])).rows[0].status,'revoked');
});
