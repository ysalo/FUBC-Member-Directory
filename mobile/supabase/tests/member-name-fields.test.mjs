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

  await migration('20261004000000_member_name_fields');
  await migration('20261005000000_member_departures');
  test('name fields backfill archived records and preserve multiword names on writes', async () => {
    const old = (await db.query('select first_name,last_name from public.people order by name')).rows;
    assert.equal(old.length, 3);
    assert.ok(old.every(row => row.first_name === 'Old' && row.last_name));
    const save = async (id, revision, data, actor = 'editor') =>
      (await as(actor, 'select * from public.save_person($1,$2,$3::jsonb)', [id, revision, JSON.stringify(data)])).rows[0];
    let person = await save(null, null, {first_name:' Mary Jane ',last_name:' van der Berg ',patronymic:' Ivanivna ',gender:'female'});
    assert.equal(person.first_name, 'Mary Jane');
    assert.equal(person.last_name, 'van der Berg');
    assert.equal(person.name, 'Mary Jane van der Berg');
    assert.equal(person.patronymic, 'Ivanivna');
    let directory = (await as('member', 'select * from public.directory_active_members()')).rows.find(row => row.id === person.id);
    assert.equal(directory.first_name, person.first_name);
    assert.equal(directory.last_name, person.last_name);
    const revision = person.revision;
    person = await save(person.id, revision, {first_name:'Mary',last_name:'Jane van der Berg',patronymic:null});
    assert.equal(person.first_name, 'Mary');
    assert.equal(person.last_name, 'Jane van der Berg');
    assert.equal(person.revision, revision + 1);
    assert.equal(person.patronymic, null);
    await assert.rejects(save(person.id, revision, {first_name:'Stale',last_name:'Write'}), /Conflict/);
    await assert.rejects(save(null,null,{first_name:'Denied',last_name:'Write',gender:'male'},'member'), /Not authorized/);
    for (const fields of [{first_name:'Only'}, {first_name:'',last_name:'Missing'}, {first_name:123,last_name:'Invalid'}]) {
      await assert.rejects(save(null,null,{...fields,gender:'male'}), /first and last/);
    }
    person = await save(person.id,person.revision,{name:person.name,phone:'1234567890'});
    assert.equal(person.first_name,'Mary');
    assert.equal(person.last_name,'Jane van der Berg');
    person = await save(person.id,person.revision,{name:'Legacy Changed'});
    assert.equal(person.first_name,'Legacy');
    assert.equal(person.last_name,'Changed');
    assert.equal(await db.query("select nullif(current_setting('app.member_name_fields',true),'') as value").then(result => result.rows[0].value),null);
  });
  test('departures save atomically with name snapshots, management-only access and repeat membership episodes', async () => {
    const save = async (id, revision, data) => (await as('editor', 'select * from public.save_person($1,$2,$3::jsonb)', [id,revision,JSON.stringify(data)])).rows[0];
    const depart = async (person, reason = 'other', detail = 'Moved overseas', date = '2026-01-01', actor = 'editor') => (await as(actor, 'select * from public.record_member_departure($1,$2,$3,$4,$5,$6)', [person.id,person.revision,date,reason,detail,'Additional context'])).rows[0];
    let person = await save(null,null,{first_name:'Anna',last_name:'Petrenko',patronymic:'Ivanivna',gender:'female',phone:'1234567890'});
    await assert.rejects(depart(person,'other',''), /Describe/);
    await assert.rejects(depart(person,'invalid'), /Choose a departure reason/);
    await assert.rejects(depart(person,'other','x'.repeat(161)), /160/);
    await assert.rejects(depart(person,'other','Two\nlines'), /160/);
    await assert.rejects(depart(person,'other','Moved','2099-01-01'), /valid departure date/);
    await assert.rejects(depart(person,'died',null,'2026-01-01','member'), /Not authorized/);
    assert.equal((await db.query('select archived_at from public.people where id=$1',[person.id])).rows[0].archived_at,null);
    const record = await depart(person);
    assert.equal(record.first_name,'Anna'); assert.equal(record.last_name,'Petrenko'); assert.equal(record.patronymic,'Ivanivna');
    assert.equal(record.reason,'other'); assert.equal(record.other_detail,'Moved overseas'); assert.equal(record.notes,'Additional context'); assert.equal(record.legacy,false);
    await assert.rejects(depart(person), /Conflict/);
    const archived = (await db.query('select * from public.people where id=$1',[person.id])).rows[0];
    assert.ok(archived.archived_at); assert.equal(archived.phone,'1234567890'); assert.equal(archived.patronymic,'Ivanivna'); assert.equal(archived.revision,person.revision + 1);
    assert.equal((await as('member','select * from public.member_departures')).rows.length,0);
    assert.equal((await as('editor','select * from public.member_departures where id=$1',[record.id])).rows.length,1);
    await assert.rejects(as('editor',"update public.member_departures set notes='Unauthorized' where id=$1",[record.id]), /permission denied/);
    person = await save(person.id,archived.revision,{first_name:'Anna',last_name:'Changed',archived:false});
    assert.ok((await db.query('select restored_at from public.member_departures where id=$1',[record.id])).rows[0].restored_at);
    const second = await depart(person,'different_church','Ignored detail');
    assert.notEqual(record.id,second.id); assert.equal(second.last_name,'Changed'); assert.equal(second.other_detail,null);
    await db.query('delete from public.people where id=$1',[person.id]);
    const history = (await db.query('select * from public.member_departures where id=any($1::uuid[])',[[record.id,second.id]])).rows;
    assert.equal(history.length,2); assert.ok(history.every(row => row.person_id === null));
    assert.equal(history.find(row => row.id === record.id).last_name,'Petrenko');
    assert.ok((await db.query('select * from public.member_departures where legacy')).rows.length > 0);
  });
} catch (error) {
  test('member name migration setup', () => { throw error; });
}
after(async () => { await db.close(); });
