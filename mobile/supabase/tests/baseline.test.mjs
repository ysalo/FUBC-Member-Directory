import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const ids = Object.fromEntries(['admin','editor','pastor','deacon','other','pending','person','group','submit'].map((key, index) => [key, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
async function as(account, sql, params = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[account]]);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
let visitId;
before(async () => {
  // Only Supabase-owned plumbing is mocked. The baseline, functions, permissions and RLS execute in real PostgreSQL (PGlite).
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    grant usage on schema public,auth,storage to authenticated;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  await db.exec(await readFile(new URL('../migrations/20260916000000_initial.sql', import.meta.url), 'utf8'));
  const mobileContracts = await readFile(new URL('../migrations/20260916010000_mobile_repository_contracts.sql', import.meta.url), 'utf8');
  await db.exec(mobileContracts);
  await db.exec(mobileContracts); // Additive repository migration is safely repeatable.
  await db.exec(await readFile(new URL('../migrations/20260916020000_operational_hardening.sql', import.meta.url), 'utf8'));
  for (const key of ['admin','editor','pastor','deacon','other','pending']) await db.query('insert into auth.users(id) values($1)', [ids[key]]);
  await db.exec(`update public.profiles set status='active' where id<>'${ids.pending}';
    update public.profiles set role='admin' where id='${ids.admin}';
    update public.profiles set role='editor' where id='${ids.editor}';
    update public.profiles set designation='pastor' where id='${ids.pastor}';
    update public.profiles set designation='deacon' where id in ('${ids.deacon}','${ids.other}');
    insert into public.people(id,name) values('${ids.person}','Test member');
    insert into public.people_private(person_id,birth_date,address,private_notes) values('${ids.person}','1950-02-28','Private address','Private notes');
    insert into public.deacon_groups(id,name,kind) values('${ids.group}','Care group','responsibility');
    insert into public.deacon_group_members values('${ids.group}','${ids.person}');
    insert into public.deacon_group_deacons values('${ids.group}','${ids.deacon}',1);`);
});
after(async () => { await db.close(); });

test('blank baseline applies and new auth accounts are pending with access only to self', async () => {
  assert.equal((await as('pending','select public.mobile_contract_version() as version')).rows[0].version,'expo-directory-v1');
  assert.equal((await as('pending','select * from public.people')).rows.length,0);
  assert.equal((await as('pending','select * from public.deacon_groups')).rows.length,0);
  const own = (await as('pending','select * from public.profiles')).rows;
  assert.equal(own.length,1);
  assert.equal(own[0].status,'pending');
  await assert.rejects(as('pending',"update public.profiles set status='active'"), /permission denied/);
});
test('sensitive source columns and birthday RPC cannot be accessed through admin/editor roles', async () => {
  for (const role of ['admin','editor','other','pending']) {
    await assert.rejects(as(role,'select * from public.people_private'),/permission denied/);
    await assert.rejects(as(role,'select * from public.group_birthdays($1)',[ids.group]),/Not authorized/);
  }
  const rows = (await as('deacon','select * from public.group_birthdays($1)',[ids.group])).rows;
  assert.deepEqual(rows,[{ person_id:ids.person,name:'Test member',month:2,day:28 }]);
});
test('create is deduplicated and visits remain participant-only even for administrators', async () => {
  const args = [null,null,ids.submit,ids.person,'2026-12-20T16:00:00Z','Test location','Confidential note',[ids.deacon]];
  const sql = 'select * from public.save_visit($1,$2,$3,$4,$5,$6,$7,$8)';
  const visit = (await as('pastor',sql,args)).rows[0];
  visitId = visit.id;
  assert.equal((await as('pastor',sql,args)).rows[0].id,visit.id);
  for (const role of ['admin','editor','other','pending']) {
    assert.equal((await as(role,'select * from public.visit_requests')).rows.length,0);
    assert.equal((await as(role,'select * from public.visit_recipients')).rows.length,0);
    await assert.rejects(as(role,sql,args),/Only active pastors/);
  }
  assert.equal((await as('deacon','select * from public.visit_requests')).rows.length,1);
  await assert.rejects(as('deacon',"update public.visit_recipients set response='accepted'"),/permission denied/);
});
test('responses are independent, stale writes fail and explicit completion precedes archival', async () => {
  await assert.rejects(as('deacon',"select * from public.respond_to_visit($1,null,'accepted',null)",[visitId]),/Conflict/);
  await assert.rejects(as('pastor',"select * from public.transition_visit($1,null,'complete')",[visitId]),/Conflict/);
  let visit = (await as('deacon','select * from public.respond_to_visit($1,1,$2,null)',[visitId,'accepted'])).rows[0];
  assert.equal(visit.revision,2);
  await assert.rejects(as('deacon',"select * from public.respond_to_visit($1,1,'declined',null)",[visitId]),/Conflict/);
  await assert.rejects(as('pastor',"select * from public.transition_visit($1,2,'archive')",[visitId]),/Invalid visit transition/);
  visit = (await as('pastor',"select * from public.transition_visit($1,2,'complete')",[visitId])).rows[0];
  assert.equal(visit.status,'completed');
  assert.equal(visit.archived_at,null);
  assert.ok(visit.completed_at);
  visit = (await as('pastor',"select * from public.transition_visit($1,3,'archive')",[visitId])).rows[0];
  assert.ok(visit.archived_at);
  await assert.rejects(as('deacon',"select * from public.respond_to_visit($1,4,'declined',null)",[visitId]),/Conflict/);
});
test('viewed revisions are participant-only and cannot hide a future revision', async () => {
  await assert.rejects(as('admin','select public.mark_visit_viewed($1,4)',[visitId]),/Not authorized/);
  await assert.rejects(as('deacon','select public.mark_visit_viewed($1,99)',[visitId]),/Invalid viewed revision/);
  await as('deacon','select public.mark_visit_viewed($1,4)',[visitId]);
  await as('deacon','select public.mark_visit_viewed($1,2)',[visitId]);
  const row = (await as('deacon','select last_viewed_revision from public.visit_recipients where visit_id=$1',[visitId])).rows[0];
  assert.equal(row.last_viewed_revision,4);
});
test('private photo linking validates ownership and revision before changing the directory', async () => {
  await db.query("insert into storage.objects(bucket_id,name) values('member-photos',$1)",[`${ids.person}/photo.jpg`]);
  await assert.rejects(as('deacon','select * from public.set_person_photo($1,1,$2)',[ids.person,`${ids.person}/photo.jpg`]),/Not authorized/);
  await assert.rejects(as('editor','select * from public.set_person_photo($1,1,$2)',[ids.person,'wrong-person/photo.jpg']),/Photo upload/);
  const updated = (await as('editor','select * from public.set_person_photo($1,1,$2)',[ids.person,`${ids.person}/photo.jpg`])).rows[0];
  assert.equal(updated.photo_path,`${ids.person}/photo.jpg`);
  await assert.rejects(as('editor','select * from public.set_person_photo($1,1,null)',[ids.person]),/Conflict/);
  assert.equal((await as('editor','select * from public.set_person_photo($1,2,null)',[ids.person])).rows[0].photo_path,null);
});
test('owner data cannot be read or changed by another account; last admin cannot be removed', async () => {
  await as('deacon','insert into public.favorites(account_id,person_id) values($1,$2)',[ids.deacon,ids.person]);
  assert.equal((await as('admin','select * from public.favorites')).rows.length,0);
  await assert.rejects(as('other','insert into public.favorites(account_id,person_id) values($1,$2)',[ids.deacon,ids.person]),/row-level security/);
  await assert.rejects(as('admin',"select * from public.update_account($1,1,'active','member','none',null)",[ids.admin]),/last active administrator/);
  await assert.rejects(as('admin',"select * from public.update_account($1,null,'active','member','none',null)",[ids.other]),/Conflict/);
  await assert.rejects(as('admin','select public.request_account_deletion()'),/another administrator/);
});
test('removing deacon status removes leadership, and deletion requests remove only identity-owned data', async () => {
  await as('admin',"select * from public.update_account($1,1,'active','member','none',null)",[ids.deacon]);
  assert.equal((await db.query('select * from public.deacon_group_deacons where account_id=$1',[ids.deacon])).rows.length,0);
  await assert.rejects(as('deacon','select * from public.group_birthdays($1)',[ids.group]),/Not authorized/);
  await as('deacon','select public.request_account_deletion()');
  assert.equal((await db.query('select * from public.favorites where account_id=$1',[ids.deacon])).rows.length,0);
  assert.equal((await db.query('select * from public.people where id=$1',[ids.person])).rows.length,1);
  assert.equal((await db.query('select * from public.visit_requests where id=$1',[visitId])).rows.length,1);
  assert.equal((await as('deacon','select * from public.visit_requests')).rows.length,0);
});
