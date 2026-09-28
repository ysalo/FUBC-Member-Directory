import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ids = {
  admin: '40000000-0000-4000-8000-000000000001',
  editor: '40000000-0000-4000-8000-000000000002',
  member: '40000000-0000-4000-8000-000000000003',
};
async function as(account, sql, params = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[account]]);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function migration(name) {
  await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
}

{
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    grant usage on schema public,auth,storage to authenticated;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  for (const name of [
    '20260916000000_initial', '20260916010000_mobile_repository_contracts',
    '20260916020000_operational_hardening', '20260917010000_member_profile_details',
    '20260917020000_directory_active_members', '20260917030000_management_repairs',
    '20260917040000_management_full_pages', '20260917050000_group_birthday_notifications',
    '20260917060000_group_one_shared_deacons', '20260917070000_pastor_ministry_name',
    '20260917080000_link_group_one_deacon_profiles', '20260917100000_manage_care_status',
    '20260917110000_leadership_ministries', '20260917120000_visitation_leader_planning',
    '20260918103000_person_based_group_deacons', '20260918153000_preserve_deacon_assignments_on_member_edit',
    '20260918170000_delete_members', '20260918190000_delete_groups_with_assignments',
    '20260920000000_optional_visit_participants', '20260920010000_person_based_visit_participants',
    '20260921000000_deacon_duty_schedule', '20260921040000_member_deletion_duty_cleanup',
    '20260921050000_accountless_deacon_schedule', '20260923000000_member_patronymic',
    '20260923010000_role_permissions', '20260923020000_membership_date',
  ]) await migration(name);
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}@example.com`]);
  }
  await db.query("update public.profiles set status='active', role=case when id=$1 then 'admin'::public.app_role when id=$2 then 'editor'::public.app_role else 'member'::public.app_role end", [ids.admin, ids.editor]);
  await migration('20260928000000_member_gender');
  await migration('20260928010000_member_family');
}
after(async () => db.close());
const read = async (id, actor='admin', manage=true) => (await as(actor,'select public.member_family($1,$2) family',[id,manage])).rows[0].family;
const save = async (id, changes={}, revision, actor='admin') => (await as(actor,'select public.save_member_family($1,$2,$3,$4,$5,$6) family',[id,revision??(await read(id)).revision,changes.parents??[],changes.spouse??null,changes.children??[],changes.siblings??[]])).rows[0].family;
const people = async (...names) => (await db.query("insert into public.people(name,gender) select name,'male' from unnest($1::text[]) name returning id",[names])).rows.map(row=>row.id);
test('facts invert, infer half siblings, deduplicate and never propagate explicit siblings', async () => {
 const [p,a,b,c]=await people('Parent','A','B','C'); await save(p,{children:[a,b]});
 assert.deepEqual((await read(a)).parents.map(x=>x.id),[p]);
 assert.deepEqual((await read(a)).siblings[0].supportingParents.map(x=>x.id),[p]);
 await save(a,{parents:[p],siblings:[b,c]});
 assert.equal((await read(a)).siblings.length,2); assert.equal((await read(a)).siblings.find(x=>x.id===b).explicit,true);
 assert.deepEqual((await read(c)).parents,[]); assert.deepEqual((await read(c)).siblings.map(x=>x.id),[a]);
 await save(a,{parents:[p]}); assert.equal((await read(a)).siblings[0].explicit,false); assert.deepEqual((await read(c)).siblings,[]);
});
test('spouse reciprocity and constraints; cycles and failed saves are atomic',async()=>{
 const [a,b,c,d]=await people('D','E','F','G'); await save(a,{spouse:b}); assert.equal((await read(b)).spouse.id,a);
 await assert.rejects(save(c,{spouse:b}),error=>error.code==='FM001'); await save(a); assert.equal((await read(b)).spouse,null);
 await save(a,{children:[b]}); await save(b,{parents:[a],children:[c]}); const before=await read(c);
 await assert.rejects(save(c,{parents:[b],children:[a],siblings:[d]}),error=>error.code==='FM002'); assert.deepEqual(await read(c),before);
 for(const changes of [{parents:[a]},{children:[a]},{spouse:a},{siblings:[a]}]) await assert.rejects(save(a,changes),error=>error.code==='FM003');
});
test('stale reciprocal and shared-parent snapshots require refresh',async()=>{
 const [a,b,c]=await people('H','I','J'); const before=await read(b); await save(a,{children:[b,c]});
 await assert.rejects(save(b,{siblings:[c]},before.revision),e=>e.code==='40001');
});
test('archive, restoration and cascade deletion preserve visibility and remove inference',async()=>{
 const [p,a,b]=await people('K','L','M'); await save(p,{children:[a,b]});
 await db.query('update public.people set archived_at=now() where id=$1',[b]); assert.equal((await read(a)).siblings[0].archived,true);
 assert.deepEqual((await read(a,'member',false)).siblings,[]); await db.query('update public.people set archived_at=null where id=$1',[b]);
 assert.equal((await read(a,'member',false)).siblings[0].id,b); const before=await read(a);
 await db.query('delete from public.people where id=$1',[p]); assert.deepEqual((await read(a)).siblings,[]); assert.deepEqual((await read(a)).parents,[]);
 await assert.rejects(save(a,{},before.revision),e=>e.code==='40001');
});
test('RPC permissions permit both managers and deny ordinary/inactive/direct writes',async()=>{
 const [a,b]=await people('N','O'); await save(a,{siblings:[b]},undefined,'editor'); assert.equal((await read(b,'member',false)).siblings[0].id,a);
 await assert.rejects(save(a,{},undefined,'member'),/Not authorized/); await assert.rejects(read(a,'member',true),/Not authorized/);
 await assert.rejects(as('admin','delete from public.member_family_edges'),/permission denied/);
 for(const status of ['pending','denied','revoked']) { await db.query('update public.profiles set status=$1 where id=$2',[status,ids.editor]); await assert.rejects(save(a,{},undefined,'editor'),/Not authorized/); await assert.rejects(read(a,'editor',false),/Not authorized/); }
 await db.exec('set role anon'); try { await assert.rejects(db.query('select public.member_family($1,false)',[a]),/permission denied/); } finally { await db.exec('reset role'); }
});
