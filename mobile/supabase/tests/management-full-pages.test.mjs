import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  editor: "10000000-0000-4000-8000-000000000002",
  member: "10000000-0000-4000-8000-000000000003",
};

async function as(account, sql, params = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[account]]);
  try { return await db.query(sql, params); } finally { await db.exec("reset role"); }
}

before(async () => {
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
  for (const migration of [
    "20260916000000_initial.sql", "20260916010000_mobile_repository_contracts.sql",
    "20260916020000_operational_hardening.sql", "20260917010000_member_profile_details.sql",
    "20260917020000_directory_active_members.sql", "20260917030000_management_repairs.sql",
    "20260917040000_management_full_pages.sql", "20260917050000_group_birthday_notifications.sql",
    "20260917060000_group_one_shared_deacons.sql",
    "20260917070000_pastor_ministry_name.sql",
    "20260917080000_link_group_one_deacon_profiles.sql",
    "20260917100000_manage_care_status.sql", "20260917110000_leadership_ministries.sql",
    "20260918103000_person_based_group_deacons.sql", "20260918153000_preserve_deacon_assignments_on_member_edit.sql",
  ]) await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  await db.query("insert into auth.users(id,email) values($1,'admin@example.com'),($2,'editor@example.com'),($3,'member@example.com')", [ids.admin, ids.editor, ids.member]);
  await db.exec(`update public.profiles set status='active',role='admin' where id='${ids.admin}';
    update public.profiles set status='active',role='editor' where id='${ids.editor}';`);
});
after(async () => db.close());

test("editor manages ministry catalog and complete member details without exposing private tables", async () => {
  const ministry = (await as("editor", "select * from public.save_ministry(null,null,'Music','Музика',false)")).rows[0];
  const member = (await as("editor", `select * from public.save_person(null,null,jsonb_build_object(
    'name','Олена Коваль','birth_date','1990-04-12','phone','253-555-0110','address','Tacoma, WA','ministry_ids',jsonb_build_array($1::text)))`, [ministry.id])).rows[0];
  const details = (await as("editor", "select * from public.management_member_care_details($1)", [member.id])).rows[0];
  assert.equal(new Date(details.birth_date).toISOString().slice(0, 10), "1990-04-12");
  assert.equal(details.address, "Tacoma, WA");
  assert.deepEqual(details.ministry_ids, [ministry.id]);
  await assert.rejects(as("editor", "select * from public.people_private"), /permission denied/);
  await assert.rejects(as("member", "select * from public.management_member_details($1)", [member.id]), /Not authorized/);
});

test("editor updates orphan and widow status through the managed member contract", async () => {
  const member = (await db.query("select id,revision from public.people where name='Олена Коваль'")).rows[0];
  await as("editor", "select * from public.save_person($1,$2,jsonb_build_object('name','Олена Коваль','orphan_status',true,'widow_status',true))", [member.id, member.revision]);
  const details = (await as("editor", "select * from public.management_member_care_details($1)", [member.id])).rows[0];
  assert.equal(details.orphan_status, true);
  assert.equal(details.marital_status, "widowed");

  const revision = (await db.query("select revision from public.people where id=$1", [member.id])).rows[0].revision;
  await as("editor", "select * from public.save_person($1,$2,jsonb_build_object('name','Олена Коваль','orphan_status',false,'widow_status',false))", [member.id, revision]);
  const cleared = (await as("editor", "select * from public.management_member_care_details($1)", [member.id])).rows[0];
  assert.equal(cleared.orphan_status, false);
  assert.equal(cleared.marital_status, null);
});

test("the pastoral care ministry is merged into the protected Pastor ministry", async () => {
  const ministry = (await db.query("insert into public.ministries(name,name_uk) values('Pastoral Care','Пасторське служіння') returning id")).rows[0];
  const member = (await db.query("insert into public.people(name,ministry,ministry_uk) values('Pastor label member','Pastoral Care','Пасторське служіння') returning id")).rows[0];
  await db.query("insert into public.person_ministries(person_id,ministry_id) values($1,$2)", [member.id, ministry.id]);
  await db.exec(await readFile(new URL("../migrations/20260917070000_pastor_ministry_name.sql", import.meta.url), "utf8"));
  assert.equal((await db.query("select * from public.ministries where id=$1", [ministry.id])).rows.length, 0);
  assert.deepEqual((await db.query("select name,name_uk,system_key from public.ministries where system_key='pastor'")).rows[0], { name: "Pastor", name_uk: "Пастор", system_key: "pastor" });
  assert.equal((await db.query("select count(*)::integer as count from public.person_ministries pm join public.ministries m on m.id=pm.ministry_id where pm.person_id=$1 and m.system_key='pastor'", [member.id])).rows[0].count, 1);
  assert.deepEqual((await db.query("select ministry,ministry_uk from public.people where id=$1", [member.id])).rows[0], { ministry: "Pastor", ministry_uk: "Пастор" });
});

test("account approval requires a unique linked member and account email is admin-only", async () => {
  const person = (await db.query("select id from public.people where name='Олена Коваль'")).rows[0];
  const rows = (await as("admin", "select * from public.management_accounts()")).rows;
  assert.equal(rows.find((row) => row.id === ids.member).email, "member@example.com");
  await assert.rejects(as("editor", "select * from public.management_accounts()"), /Not authorized/);
  await assert.rejects(as("admin", "select * from public.update_account($1,1,'active','member',null)", [ids.member]), /Link a member/);
  const approved = (await as("admin", "select * from public.update_account($1,1,'active','member',$2)", [ids.member, person.id])).rows[0];
  assert.equal(approved.status, "active");
  await assert.rejects(as("admin", "select * from public.update_account($1,1,'active','editor',$2)", [ids.editor, person.id]), /already linked/);
});

test("only an assigned deacon can persist birthday notification preferences", async () => {
  const linked = (await db.query("insert into public.people(name) values('Linked deacon') returning id")).rows[0];
  const group = (await db.query("insert into public.deacon_groups(name,kind) values('Group test','membership') returning id")).rows[0];
  await db.query("insert into public.person_ministries(person_id,ministry_id) select $1,id from public.ministries where system_key='deacon'", [linked.id]);
  await db.query("update public.profiles set person_id=$2 where id=$1", [ids.editor, linked.id]);
  await db.query("insert into public.deacon_group_deacons(group_id,person_id,slot) values($1,$2,1)", [group.id, linked.id]);
  assert.equal((await as("editor", "select public.group_birthday_notification_setting($1) as enabled", [group.id])).rows[0].enabled, false);
  await as("editor", "select public.set_group_birthday_notifications($1,true)", [group.id]);
  assert.equal((await as("editor", "select public.group_birthday_notification_setting($1) as enabled", [group.id])).rows[0].enabled, true);
  await assert.rejects(as("member", "select public.group_birthday_notification_setting($1)", [group.id]), /Not authorized/);
});

test("group leadership accepts deacon members with or without accounts", async () => {
  const groupId = "70000000-0000-4000-8000-000000000001";
  await db.query("insert into public.deacon_groups(id,name,kind) values($1,$2,'membership')", [groupId, "група один"]);
  const slav = "10000000-0000-4000-8000-000000000011";
  const slavPerson = (await db.query("insert into public.people(name) values('Yaroslav Salo') returning id")).rows[0].id;
  await db.query("insert into auth.users(id,email) values($1,'slav.salo@gmail.com')", [slav]);
  await db.query("insert into public.person_ministries(person_id,ministry_id) select $1,id from public.ministries where system_key='deacon'", [slavPerson]);
  await db.query("update public.profiles set status='active',person_id=$2 where id=$1", [slav, slavPerson]);
  const accountlessPerson = (await db.query("insert into public.people(name) values('Accountless Deacon') returning id")).rows[0].id;
  await db.query("insert into public.person_ministries(person_id,ministry_id) select $1,id from public.ministries where system_key='deacon'", [accountlessPerson]);
  const group = (await db.query("select * from public.deacon_groups where id=$1", [groupId])).rows[0];
  await as("editor", "select * from public.save_group($1,$2,$3,'membership',false,$4,$5)", [group.id, group.revision, group.name, [slavPerson, accountlessPerson], []]);
  assert.deepEqual((await db.query("select person_id,account_id,slot from public.deacon_group_deacons where group_id=$1 order by slot", [groupId])).rows, [
    { person_id: slavPerson, account_id: null, slot: 1 },
    { person_id: accountlessPerson, account_id: null, slot: 2 },
  ]);
});

test("linking an account later preserves the person's group assignment", async () => {
  const groupId = "70000000-0000-4000-8000-000000000001";
  const accountId = "10000000-0000-4000-8000-000000000012";
  const personId = (await db.query("select id from public.people where name='Accountless Deacon'")).rows[0].id;
  await db.query("insert into auth.users(id,email) values($1,'accountless-now-linked@example.com')", [accountId]);
  await db.query("update public.profiles set status='active',person_id=$2 where id=$1", [accountId, personId]);
  assert.deepEqual((await db.query("select person_id,slot from public.deacon_group_deacons where group_id=$1 and person_id=$2", [groupId, personId])).rows, [{ person_id: personId, slot: 2 }]);
});

test("editing a deacon preserves an unchanged group assignment", async () => {
  const groupId = "70000000-0000-4000-8000-000000000001";
  const person = (await db.query("select p.id,p.revision,array_agg(pm.ministry_id) as ministry_ids from public.people p join public.person_ministries pm on pm.person_id=p.id where p.name='Accountless Deacon' group by p.id,p.revision")).rows[0];
  await as("editor", "select * from public.save_person($1,$2,jsonb_build_object('name','Accountless Deacon','phone','(253) 555-0199','address','Updated address','ministry_ids',to_jsonb($3::uuid[])))", [person.id, person.revision, person.ministry_ids]);
  assert.deepEqual((await db.query("select group_id from public.deacon_group_deacons where person_id=$1", [person.id])).rows, [{ group_id: groupId }]);
});

test("a leader may belong elsewhere but cannot duplicate inside the led group", async () => {
  const groupId = "70000000-0000-4000-8000-000000000002";
  await db.query("insert into public.deacon_groups(id,name,kind) values($1,'Group invariant','membership')", [groupId]);
  const slav = "10000000-0000-4000-8000-000000000011";
  const personId = (await db.query("select person_id from public.profiles where id=$1", [slav])).rows[0].person_id;
  await db.query("update public.people set membership_group_id=$2 where id=$1", [personId, groupId]);
  assert.equal((await db.query("select membership_group_id from public.people where id=$1", [personId])).rows[0].membership_group_id, groupId);
  await assert.rejects(
    db.query("update public.people set membership_group_id='70000000-0000-4000-8000-000000000001' where id=$1", [personId]),
    /cannot also be an ordinary member/,
  );
  await assert.rejects(
    db.query("insert into public.deacon_group_members(group_id,person_id) values('70000000-0000-4000-8000-000000000001',$1)", [personId]),
    /cannot also be an ordinary member/,
  );
});

test("saving a group atomically moves its selected deacon from the prior group", async () => {
  const target = (await db.query("insert into public.deacon_groups(name,kind) values('Move target','membership') returning *")).rows[0];
  const editorPerson = (await db.query("select person_id from public.profiles where id=$1", [ids.editor])).rows[0].person_id;
  assert.ok(editorPerson);
  await as("editor", "select * from public.save_group($1,$2,$3,'membership',false,$4,$5)", [target.id, target.revision, target.name, [editorPerson], []]);
  const assignments = (await db.query("select group_id from public.deacon_group_deacons where person_id=$1", [editorPerson])).rows;
  assert.deepEqual(assignments, [{ group_id: target.id }]);
});
