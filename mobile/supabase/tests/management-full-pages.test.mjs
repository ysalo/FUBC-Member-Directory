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
    "20260917100000_manage_care_status.sql", "20260917110000_leadership_ministries.sql", "20260917120000_visitation_leader_planning.sql",
    "20260918103000_person_based_group_deacons.sql", "20260918153000_preserve_deacon_assignments_on_member_edit.sql",
    "20260918170000_delete_members.sql", "20260918190000_delete_groups_with_assignments.sql",
    "20260920000000_optional_visit_participants.sql", "20260920010000_person_based_visit_participants.sql",
    "20260921000000_deacon_duty_schedule.sql", "20260921040000_member_deletion_duty_cleanup.sql",
    "20260921050000_accountless_deacon_schedule.sql",
    "20260923000000_member_patronymic.sql",
  ]) await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  await db.query("insert into auth.users(id,email) values($1,'admin@example.com'),($2,'editor@example.com'),($3,'member@example.com')", [ids.admin, ids.editor, ids.member]);
  await db.exec(`update public.profiles set status='active',role='admin' where id='${ids.admin}';
    update public.profiles set status='active',role='editor' where id='${ids.editor}';`);
});
after(async () => db.close());

test("membership dates round-trip through the guarded writer and preserve older clients", async () => {
  await db.exec('begin');
  try {
    for (const migration of ['20260923010000_role_permissions.sql', '20260923020000_membership_date.sql']) {
      await db.exec((await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8')).replace(/^begin;|commit;$/gm, ''));
    }
    const save = async (id, revision, data, actor = 'editor') => (await as(actor, 'select * from public.save_person($1,$2,$3)', [id, revision, data])).rows[0];
    const person = await save(null, null, { name: 'Membership Date Test', membership_joined_at: '2004-02-29' });
    assert.equal(person.membership_joined_at.toISOString().slice(0, 10), '2004-02-29');
    const edited = await save(person.id, person.revision, { name: person.name, membership_joined_at: '2012-06-17' });
    assert.equal(edited.membership_joined_at.toISOString().slice(0, 10), '2012-06-17');
    assert.equal(edited.revision, person.revision + 1);
    const legacy = await save(person.id, edited.revision, { name: person.name });
    assert.deepEqual(legacy.membership_joined_at, edited.membership_joined_at);
    const cleared = await save(person.id, legacy.revision, { name: person.name, membership_joined_at: null }, 'admin');
    assert.equal(cleared.membership_joined_at, null);
    for (const [actor, revision, date, pattern] of [
      ['editor', cleared.revision, '2999-01-01', /not in the future/],
      ['editor', cleared.revision, '2024-02-30', /out of range/],
      ['editor', cleared.revision, 'infinity', /valid date/],
      ['editor', person.revision, '2000-01-01', /Conflict/],
      ['member', cleared.revision, '2000-01-01', /Not authorized/],
    ]) {
      await db.exec('savepoint rejected_date');
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[actor]]);
      await assert.rejects(db.query('select * from public.save_person($1,$2,$3)', [person.id, revision, { name: person.name, membership_joined_at: date }]), pattern);
      await db.exec('rollback to savepoint rejected_date; reset role');
    }
    assert.equal((await db.query('select membership_joined_at from public.people where id=$1', [person.id])).rows[0].membership_joined_at, null);
  } finally { await db.exec('rollback'); }
});

test("optional patronymics round-trip, preserve older writes, and enforce permissions and revisions", async () => {
  const save = (id, revision, data, actor = "editor") => as(actor, "select * from public.save_person($1,$2,$3::jsonb)", [id, revision, JSON.stringify(data)]).then((result) => result.rows[0]);
  const person = await save(null, null, { name: "Ivan Petrenko", patronymic: " Mykolayovych " });
  assert.equal(person.patronymic, "Mykolayovych");
  const directory = (await as("editor", "select * from public.directory_active_members() where id=$1", [person.id])).rows[0];
  assert.equal(directory.patronymic, person.patronymic);
  assert.equal(directory.name, "Ivan Petrenko");
  assert.equal((await as("member", "select * from public.directory_active_members() where id=$1", [person.id])).rows.length, 0);
  await assert.rejects(save(person.id, person.revision, { name: person.name, patronymic: "Other" }, "member"), /Not authorized/);
  const legacy = await save(person.id, person.revision, { name: person.name, phone: "123" });
  assert.equal(legacy.patronymic, person.patronymic);
  await assert.rejects(save(person.id, person.revision, { name: person.name, patronymic: "Other" }), /Conflict/);
  const cleared = await save(person.id, legacy.revision, { name: person.name, patronymic: "  " });
  assert.equal(cleared.patronymic, null);
  assert.equal((await save(null, null, { name: "No Patronymic" })).patronymic, null);
  await assert.rejects(save(null, null, { name: "Too Long", patronymic: "x".repeat(201) }), /check constraint/);
});

test("role permissions enforce member and group administration and administrator visitation through SQL", async () => {
  const migration = await readFile(new URL('../migrations/20260923010000_role_permissions.sql', import.meta.url), 'utf8');
  await db.exec('begin');
  try {
    await db.exec(migration.replace(/^begin;|commit;$/gm, ''));
    const deniedCalls = [
      "select * from public.management_accounts()",
      `select * from public.update_account('${ids.editor}',1,'active','admin',null)`,
      "select * from public.delete_member_record(gen_random_uuid(),null)",
      "select * from public.save_visit(null,null,gen_random_uuid(),gen_random_uuid(),now(),'Home','','{}')",
    ];
    const rejected = async (account, sql, params = [], pattern = /Not authorized|Only active/) => {
      await db.exec('savepoint rejected_call');
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[account]]);
      try {
        await assert.rejects(db.query(sql, params), pattern);
      } finally {
        await db.exec('rollback to savepoint rejected_call; reset role');
      }
    };
    for (const role of ['editor', 'member']) {
      await db.query("update public.profiles set status='active' where id=$1", [ids[role]]);
      for (const sql of deniedCalls) await rejected(role, sql);
    }
    await rejected('member', "select * from public.save_group(null,null,'Forbidden','membership',false,'{}','{}')");
    await rejected('member', "select public.delete_group(gen_random_uuid(),1)");
    const managementCalls = [
      "select * from public.save_ministry(null,null,'Forbidden','',false)",
      "select * from public.generate_duty_schedule(2027,'{}')",
      "select * from public.reassign_duty_period('2027-01-03',gen_random_uuid(),1)",
    ];
    for (const sql of managementCalls) await rejected('member', sql);
    for (const name of ['save_person(uuid,integer,jsonb)', 'save_ministry(uuid,integer,text,text,boolean)', 'save_group(uuid,integer,text,text,boolean,uuid[],uuid[])', 'delete_group(uuid,integer)', 'generate_duty_schedule(integer,uuid[])', 'reassign_duty_period(date,uuid,integer)']) {
      assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') allowed", [`public.${name}`])).rows[0].allowed, false);
    }
    assert.equal((await db.query("select has_function_privilege('authenticated','app_private.save_person(uuid,integer,jsonb)','execute') allowed")).rows[0].allowed, false);
    const ministry = (await as('editor', "select * from public.save_ministry(null,null,'Allowed','',false)")).rows[0];
    const person = (await as('editor', "select * from public.save_person(null,null,$1)", [{ name: 'Managed member', ministry_ids: [ministry.id], address: 'Member address' }])).rows[0];
    await rejected('member', "select * from public.save_person(null,null,'{\"name\":\"Denied\"}')");
    const leadership = (await db.query("select id from public.ministries where system_key='deacon'")).rows[0].id;
    await rejected('editor', 'select * from public.save_person($1,$2,$3)', [person.id, person.revision, { name: person.name, ministry_ids: [leadership] }], /Only administrators/);
    await rejected('editor', 'select * from public.save_person(null,null,$1)', [{ name: 'Escalation', ministry_ids: [leadership] }], /Only administrators/);
    const group = (await as('editor', "select * from public.save_group(null,null,'Allowed','membership',false,'{}',$1)", [[person.id]])).rows[0];
    await as('editor', "select * from public.save_group($1,$2,'Renamed','membership',false,'{}',$3)", [group.id, group.revision, [person.id]]);
    const revision = (await db.query('select revision from public.people where id=$1', [person.id])).rows[0].revision;
    const archived = (await as('editor', 'select * from public.save_person($1,$2,$3)', [person.id, revision, { name: person.name, archived: true }])).rows[0];
    assert.ok(archived.archived_at);
    assert.equal(archived.membership_group_id, null);
    const restored = (await as('editor', 'select * from public.save_person($1,$2,$3)', [person.id, archived.revision, { name: person.name, archived: false }])).rows[0];
    await as('admin', 'select * from public.save_person($1,$2,$3)', [person.id, restored.revision, { name: person.name, ministry_ids: [leadership] }]);
    await db.query('update public.profiles set person_id=$2 where id=$1', [ids.member, person.id]);
    const created = (await as('member', "select * from public.save_visit(null,null,gen_random_uuid(),$1,now(),'Home','','{}')", [person.id])).rows[0];
    assert.equal((await as('editor', 'select * from public.visit_requests')).rows.length, 0);
    assert.equal((await as('admin', 'select * from public.visit_requests')).rows.length, 1);
    assert.equal((await as('admin', 'select public.directory_visible_visit_count() count')).rows[0].count, 1);
    const updated = (await as('admin', "select * from public.save_visit($1,$2,$3,$4,now(),'Changed','','{}')", [created.id, created.revision, created.submission_id, person.id])).rows[0];
    assert.equal(updated.planner_id, ids.member);
    await rejected('admin', "select * from public.respond_to_visit($1,$2,'accepted',null)", [updated.id, updated.revision]);
    const completed = (await as('admin', "select * from public.transition_visit($1,$2,'complete')", [updated.id, updated.revision])).rows[0];
    assert.equal(completed.status, 'completed');
    await as('admin', "select * from public.save_visit(null,null,gen_random_uuid(),$1,now(),'Home','','{}')", [person.id]);
    await as('editor', 'select * from public.generate_duty_schedule(2027,$1)', [[person.id]]);
    await as('editor', "select * from public.reassign_duty_period('2027-01-03',$1,1)", [person.id]);
    await as('editor', 'select public.delete_group($1,(select revision from public.deacon_groups where id=$1))', [group.id]);
    for (const role of ['editor', 'admin']) {
      for (const status of ['pending', 'denied', 'revoked']) {
        await db.query('update public.profiles set status=$2::public.account_status where id=$1', [ids[role], status]);
        await rejected(role, "select * from public.save_person(null,null,'{\"name\":\"Denied\"}')");
        for (const sql of [...deniedCalls, ...managementCalls]) await rejected(role, sql);
        await rejected(role, "select * from public.save_group(null,null,'Forbidden','membership',false,'{}','{}')");
        await rejected(role, "select public.delete_group(gen_random_uuid(),1)");
        assert.equal((await as(role, 'select * from public.visit_requests')).rows.length, 0);
      }
    }
  } finally {
    await db.exec('rollback; reset role');
  }
});

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

test("editors can rename a group without changing its members or deacons", async () => {
  const groupId = "70000000-0000-4000-8000-000000000001";
  const group = (await db.query("select * from public.deacon_groups where id=$1", [groupId])).rows[0];
  const deaconIds = (await db.query("select person_id from public.deacon_group_deacons where group_id=$1 order by slot", [groupId])).rows.map((row) => row.person_id);
  const memberIds = (await db.query("select id from public.people where membership_group_id=$1 order by id", [groupId])).rows.map((row) => row.id);
  await as("editor", "select * from public.save_group($1,$2,$3,'membership',false,$4,$5)", [group.id, group.revision, "  Renamed group  ", deaconIds, memberIds]);
  assert.equal((await db.query("select name from public.deacon_groups where id=$1", [groupId])).rows[0].name, "Renamed group");
  assert.deepEqual((await db.query("select person_id from public.deacon_group_deacons where group_id=$1 order by slot", [groupId])).rows.map((row) => row.person_id), deaconIds);
  assert.deepEqual((await db.query("select id from public.people where membership_group_id=$1 order by id", [groupId])).rows.map((row) => row.id), memberIds);
});

test("editors can create a group and add multiple existing members at once", async () => {
  const first = (await db.query("insert into public.people(name) values('New Group Member One') returning id")).rows[0].id;
  const second = (await db.query("insert into public.people(name) values('New Group Member Two') returning id")).rows[0].id;
  const created = (await as("editor", "select * from public.save_group(null,null,'New Membership Group','membership',false,$1,$2)", [[], [first, second]])).rows[0];
  assert.equal(created.name, "New Membership Group");
  assert.equal(created.kind, "membership");
  assert.deepEqual((await db.query("select id from public.people where membership_group_id=$1 order by id", [created.id])).rows.map((row) => row.id), [first, second].sort());
});

test("deleting either kind of group removes assignments without deleting members", async () => {
  const membershipMember = (await db.query("insert into public.people(name) values('Membership Group Survivor') returning id")).rows[0].id;
  const careMember = (await db.query("insert into public.people(name) values('Care Group Survivor') returning id")).rows[0].id;
  const membershipGroup = (await as("editor", "select * from public.save_group(null,null,'Temporary Membership Group','membership',false,$1,$2)", [[], [membershipMember]])).rows[0];
  const careGroup = (await as("editor", "select * from public.save_group(null,null,'Temporary Care Group','responsibility',false,$1,$2)", [[], [careMember]])).rows[0];

  await as("editor", "select public.delete_group($1,$2)", [membershipGroup.id, membershipGroup.revision]);
  await as("editor", "select public.delete_group($1,$2)", [careGroup.id, careGroup.revision]);

  assert.equal((await db.query("select count(*)::integer as count from public.deacon_groups where id in ($1,$2)", [membershipGroup.id, careGroup.id])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::integer as count from public.people where id in ($1,$2)", [membershipMember, careMember])).rows[0].count, 2);
  assert.equal((await db.query("select membership_group_id from public.people where id=$1", [membershipMember])).rows[0].membership_group_id, null);
  assert.equal((await db.query("select count(*)::integer as count from public.deacon_group_members where person_id=$1", [careMember])).rows[0].count, 0);
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

test("only administrators can hard-delete an unlinked member and all person-owned history", async () => {
  const person = (await db.query("insert into public.people(name,phone) values('Delete Test Member','253-555-0100') returning id")).rows[0];
  const group = (await db.query("insert into public.deacon_groups(name,kind) values('Delete test group','responsibility') returning id")).rows[0];
  const ministry = (await db.query("insert into public.ministries(name) values('Delete test ministry') returning id")).rows[0];
  await db.query("insert into public.people_private(person_id,address) values($1,'Private address')", [person.id]);
  await db.query("insert into public.deacon_group_members(group_id,person_id) values($1,$2)", [group.id, person.id]);
  await db.query("insert into public.person_ministries(person_id,ministry_id) values($1,$2)", [person.id, ministry.id]);
  await db.query("insert into public.favorites(account_id,person_id) values($1,$2)", [ids.admin, person.id]);
  await db.query("insert into public.personal_reminders(account_id,person_id,title,remind_at) values($1,$2,'Follow up',now())", [ids.admin, person.id]);
  const visit = (await db.query("insert into public.visit_requests(planner_id,person_id,scheduled_at,location,submission_id) values($1,$2,now(),'Church',gen_random_uuid()) returning id", [ids.admin, person.id])).rows[0];
  await db.query("insert into public.visit_participants(visit_id,account_id,person_id) select $1,id,person_id from public.profiles where id=$2", [visit.id, ids.editor]);
  await db.query("insert into public.visit_notification_events(visit_id,account_id,revision,kind) values($1,$2,1,'visit.updated')", [visit.id, ids.editor]);

  await assert.rejects(as("editor", "select * from public.delete_member_record($1,null)", [person.id]), /Not authorized/);
  const deleted = (await as("admin", "select * from public.delete_member_record($1,null)", [person.id])).rows[0];
  assert.equal(deleted.deleted_person_id, person.id);
  assert.equal(deleted.deleted_visit_count, 1);
  for (const query of [
    "select 1 from public.people where id=$1", "select 1 from public.people_private where person_id=$1",
    "select 1 from public.deacon_group_members where person_id=$1", "select 1 from public.person_ministries where person_id=$1",
    "select 1 from public.favorites where person_id=$1", "select 1 from public.personal_reminders where person_id=$1",
    "select 1 from public.visit_requests where person_id=$1",
  ]) assert.equal((await db.query(query, [person.id])).rows.length, 0);
  const audit = (await db.query("select metadata from public.audit_events where action='member.deleted' and entity_id=$1", [person.id])).rows[0];
  assert.equal(audit.metadata.deleted_visit_count, 1);
  assert.equal(JSON.stringify(audit.metadata).includes("Delete Test Member"), false);
});

test("member deletion clears duty assignments that would otherwise restrict the member row", async () => {
  const person = (await db.query("insert into public.people(name) values('Scheduled Delete Target') returning id")).rows[0];
  await db.query("insert into public.deacon_duty_periods(sunday_on,person_id) values('2027-01-03',$1)", [person.id]);

  await as("admin", "select * from public.delete_member_record($1,null)", [person.id]);

  assert.equal((await db.query("select 1 from public.people where id=$1", [person.id])).rows.length, 0);
  assert.equal((await db.query("select 1 from public.deacon_duty_periods where person_id=$1", [person.id])).rows.length, 0);
});

test("schedule generation replaces the same year on every invocation", async () => {
  const firstPerson = (await db.query("insert into public.people(name) values('First Rotation Deacon') returning id")).rows[0].id;
  const secondPerson = (await db.query("insert into public.people(name) values('Second Rotation Deacon') returning id")).rows[0].id;
  await db.query("insert into public.person_ministries(person_id,ministry_id) select person_id,id from unnest($1::uuid[]) person_id cross join public.ministries where system_key='deacon'", [[firstPerson, secondPerson]]);

  await as("editor", "select * from public.generate_duty_schedule(2028,$1)", [[firstPerson]]);
  const firstRun = (await db.query("select person_id from public.deacon_duty_periods where extract(year from sunday_on)=2028")).rows;
  await as("editor", "select * from public.generate_duty_schedule(2028,$1)", [[secondPerson]]);
  const secondRun = (await db.query("select person_id from public.deacon_duty_periods where extract(year from sunday_on)=2028")).rows;

  assert.ok(firstRun.length === 52 || firstRun.length === 53);
  assert.ok(firstRun.every((row) => row.person_id === firstPerson));
  assert.equal(secondRun.length, firstRun.length);
  assert.ok(secondRun.every((row) => row.person_id === secondPerson));
});

test("member deletion refuses linked accounts and the signed-in administrator's own member", async () => {
  const linkedAccountId = "10000000-0000-4000-8000-000000000020";
  const linkedPerson = (await db.query("insert into public.people(name) values('Linked delete target') returning id")).rows[0];
  await db.query("insert into auth.users(id,email) values($1,'linked-delete@example.com')", [linkedAccountId]);
  await db.query("update public.profiles set status='active',person_id=$2 where id=$1", [linkedAccountId, linkedPerson.id]);
  await assert.rejects(as("admin", "select * from public.delete_member_record($1,$2)", [linkedPerson.id, linkedAccountId]), /linked account/i);
  assert.equal((await db.query("select 1 from public.people where id=$1", [linkedPerson.id])).rows.length, 1);

  const ownPerson = (await db.query("insert into public.people(name) values('Current administrator') returning id")).rows[0];
  await db.query("update public.profiles set person_id=$2 where id=$1", [ids.admin, ownPerson.id]);
  await assert.rejects(as("admin", "select * from public.delete_member_record($1,null)", [ownPerson.id]), /own member record/i);
  await db.query("update public.profiles set person_id=null where id=$1", [ids.admin]);
});
