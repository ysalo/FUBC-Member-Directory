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

try {
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
  const existing = (await db.query("insert into public.people(name,archived_at) values('Old active with saved value',null),('Old archived',now()),('Old active without value',null) returning id")).rows;
  await db.exec('alter table public.people add column gender text');
  await db.query("update public.people set gender='female' where id=$1", [existing[0].id]);
  await migration('20260928000000_member_gender');

  test('backfill assigns Male to every unset active and archived Member while preserving a preexisting value', async () => {
    const rows = (await db.query('select id,gender from public.people')).rows;
    assert.equal(rows.length, 3);
    assert.equal(rows.find((row) => row.id === existing[0].id).gender, 'female');
    assert.equal(rows.find((row) => row.id === existing[1].id).gender, 'male');
    assert.equal(rows.find((row) => row.id === existing[2].id).gender, 'male');
  });
  test('management requires gender for creation and rejects invalid or cleared values', async () => {
    const save = 'select id,gender,revision from public.save_person($1,$2,$3::jsonb)';
    await assert.rejects(as('admin', save, [null,null,JSON.stringify({name:'Missing'})]), /gender/i);
    await assert.rejects(as('admin', save, [null,null,JSON.stringify({name:'Invalid',gender:'other'})]), /Male or Female/);
    const created = (await as('editor', save, [null,null,JSON.stringify({name:'New male',gender:'male'})])).rows[0];
    assert.equal(created.gender, 'male');
    const changed = (await as('editor', save, [created.id,created.revision,JSON.stringify({name:'New female',gender:'female'})])).rows[0];
    assert.equal(changed.gender, 'female');
    const older = (await as('admin', save, [created.id,changed.revision,JSON.stringify({name:'Older client edit'})])).rows[0];
    assert.equal(older.gender, 'female');
    await assert.rejects(as('admin', save, [created.id,older.revision,JSON.stringify({name:'Clear',gender:null})]), /Male or Female/);
    assert.equal((await db.query('select gender from public.people where id=$1',[created.id])).rows[0].gender, 'female');
    await assert.rejects(as('member', save, [null,null,JSON.stringify({name:'Denied',gender:'male'})]), /Not authorized/);
  });
  test('directory returns gender only within its active visibility and authorization boundary', async () => {
    const rows = (await as('member','select id,gender from public.directory_active_members()')).rows;
    assert.ok(rows.some((row) => row.id === existing[0].id && row.gender === 'female'));
    assert.ok(!rows.some((row) => row.id === existing[1].id));
    await db.query("update public.profiles set status='pending' where id=$1",[ids.member]);
    assert.equal((await as('member','select * from public.directory_active_members()')).rows.length,0);
  });
} catch (error) {
  test('member gender migration setup', () => { throw error; });
}
after(async () => { await db.close(); });
