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

  await migration('20260928010000_member_family');
  await migration('20260928020000_family_safeupdate');
  await migration('20261004010000_member_csv_import');
  const operation = '60000000-0000-4000-8000-000000000001';
  const rows = [{first_name:'Andrew',last_name:'Smith',patronymic:null,gender:'male',email:null,phone:'2535551234',birth_date:'1990-04-05',membership_joined_at:'2010-01-01',address:'123 Main St'}];
  const runImport = async (data = rows, actor = 'admin', mode = 'replace', confirmation = 'REPLACE MEMBERS', id = operation) =>
    (await as(actor,'select public.import_members_from_csv($1,$2::jsonb,$3,$4) as result',[id,JSON.stringify(data),mode,confirmation])).rows[0].result;
  await db.query("update public.profiles set person_id=$1 where id=$2",[existing[0].id,ids.admin]);
  await db.query("insert into public.member_family_edges(kind,from_id,to_id) values('parent',$1,$2)",[existing[0].id,existing[1].id]);
  await db.query("insert into public.favorites(account_id,person_id) values($1,$2)",[ids.member,existing[0].id]);
  await db.query("insert into public.personal_reminders(account_id,person_id,title,remind_at) values($1,$2,'Reminder',now())",[ids.member,existing[0].id]);
  await db.query("insert into public.deacon_duty_periods(sunday_on,person_id) values('2026-10-04',$1)",[existing[0].id]);
  await db.query("insert into public.deacon_groups(name,kind) values('Old group','membership')");
  await db.query("insert into public.preferences(account_id) values($1)",[ids.member]);
  await db.query("insert into public.device_tokens(account_id,token) values($1,'old-token')",[ids.member]);
  await db.query("insert into public.account_deletion_requests(account_id) values($1)",[ids.member]);
  await db.exec("insert into storage.objects(bucket_id,name) values('member-photos','old.jpg'),('member-photos','old.jpg.avatar-256.jpg'),('member-photos','orphan.jpg')");
  const accountsBefore = (await db.query('select id,role,status from public.profiles order by id')).rows;
  test('unauthorized, unconfirmed, or invalid CSV resets make no data changes', async () => {
    for (const role of ['member','editor']) await assert.rejects(runImport(rows,role), /administrators/);
    await assert.rejects(runImport(rows,'admin','replace','WRONG'), /REPLACE MEMBERS/);
    for (const data of [[{...rows[0],birth_date:'2020-02-30'}],[{...rows[0],gender:'other'}],[{...rows[0],first_name:''}],[{...rows[0],photo_path:'injected.jpg'}], [rows[0],rows[0]]]) await assert.rejects(runImport(data));
    assert.equal((await db.query('select count(*)::int as n from public.people')).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int as n from public.member_csv_imports')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.member_import_photo_cleanup')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,3);
  });
  test('a writer failure after deletion rolls back the complete replacement', async () => {
    await db.exec(`create function public.reject_import_test() returns trigger language plpgsql as $$ begin if new.first_name='Fail' then raise exception 'Late writer failure'; end if; return new; end $$;
      create trigger reject_import_test after insert on public.people for each row execute function public.reject_import_test();`);
    await assert.rejects(runImport([rows[0],{...rows[0],first_name:'Fail'}]), /Late writer failure/);
    assert.equal((await db.query('select count(*)::int as n from public.people')).rows[0].n,3);
    assert.equal((await db.query('select count(*)::int as n from public.member_csv_imports')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.member_import_photo_cleanup')).rows[0].n,0);
    assert.deepEqual((await db.query('select id,role,status from public.profiles order by id')).rows,accountsBefore);
    await db.exec('drop trigger reject_import_test on public.people; drop function public.reject_import_test();');
  });
  test('replacement preserves auth accounts and access, removes directory history, and imports separate fields/private details', async () => {
    const result = await runImport();
    assert.equal(result.importedCount,1); assert.equal(result.replacedCount,3); assert.equal(result.pendingPhotos,3);
    assert.deepEqual((await db.query('select id,role,status from public.profiles order by id')).rows,accountsBefore);
    assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n,3);
    assert.ok((await db.query('select person_id,designation from public.profiles')).rows.every(row => row.person_id===null && row.designation==='none'));
    for (const table of ['member_family_edges','favorites','personal_reminders','deacon_duty_periods','deacon_groups','preferences','device_tokens','account_deletion_requests','visit_requests','visit_participants','visit_notification_events','person_ministries','deacon_group_members','deacon_group_deacons','group_birthday_notification_preferences']) {
      assert.equal((await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n,0,table);
    }
    const person=(await db.query('select * from public.people')).rows[0];
    assert.equal(person.first_name,'Andrew'); assert.equal(person.last_name,'Smith'); assert.equal(person.gender,'male'); assert.equal(person.photo_path,null);
    const details=(await db.query('select birth_date::text,address from public.people_private')).rows[0];
    assert.equal(details.birth_date,'1990-04-05');assert.equal(details.address,'123 Main St');
    assert.equal((await db.query('select membership_joined_at::text from public.people')).rows[0].membership_joined_at,'2010-01-01');
    // Storage metadata is retained until the API physically deletes each object.
    assert.equal((await db.query('select count(*)::int as n from storage.objects')).rows[0].n,3);
  });
  test('lost-response retries are idempotent and changed operation payloads fail', async () => {
    const personId=(await db.query('select id from public.people')).rows[0].id;
    const result=await runImport();assert.equal(result.replacedCount,3);
    assert.equal((await db.query('select id from public.people')).rows[0].id,personId);
    await assert.rejects(runImport([{...rows[0],first_name:'Changed'}]), /already used/);
    await assert.rejects(runImport(rows,'admin','add','','60000000-0000-4000-8000-000000000002'), /already exists/);
  });
  test('cleanup receipts are service-only and photo writes return only metadata', async () => {
    await assert.rejects(as('admin','select * from public.member_import_cleanup_batch($1)',[operation]), /permission denied/);
    await assert.rejects(as('member','select * from public.member_csv_imports'), /permission denied/);
    await db.exec('set role service_role');
    const batch=(await db.query('select * from public.member_import_cleanup_batch($1)',[operation])).rows;
    assert.equal(batch.length,3);
    assert.equal((await db.query('select public.member_import_cleanup_completed($1,$2::text[]) as n',[operation,batch.map(row=>row.path)])).rows[0].n,0);
    await db.exec('reset role');
    const person=(await db.query('select id,revision from public.people')).rows[0];
    const result=(await as('admin','select * from public.set_person_photo_metadata($1,$2,null)',[person.id,person.revision])).rows[0];
    assert.deepEqual(Object.keys(result).sort(),['id','photo_path','revision']);
  });
} catch (error) {
  test('member CSV migration setup', () => { throw error; });
}
after(async () => { await db.close(); });
