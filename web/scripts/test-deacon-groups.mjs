import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const uid = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const person = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const baseline = await readFile(
  new URL(
    "../supabase/migrations/20260914130000_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20260915010000_deacon_groups.sql",
    import.meta.url,
  ),
  "utf8",
);
await db.exec(`
  create role authenticated; create role anon;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  grant usage on schema auth, storage to authenticated;
  create table storage.buckets(id text primary key, name text, public boolean);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text);
  alter table storage.objects enable row level security;
  grant select on storage.objects to authenticated;
`);
// Exercise the deployed upgrade, then the complete clean baseline below.
await db.exec(baseline.split("-- Apply after the existing migrations;")[0]);
await db.exec(migration);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20260915020000_member_status_and_single_group.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (let n = 1; n <= 7; n++)
  await db.query("insert into auth.users(id,email) values($1,$2)", [
    uid(n),
    `test${n}@example.test`,
  ]);
await db.exec(`
  update public.profiles set status='active';
  update public.profiles set role='admin' where id='${uid(1)}';
  update public.profiles set role='editor' where id='${uid(2)}';
  update public.profiles set ministry_roles=array['deacon'] where id in ('${uid(3)}','${uid(4)}','${uid(7)}');
  update public.profiles set status='pending' where id='${uid(6)}';
  insert into public.people(id,first_name,last_name) values('${person(1)}','Андрій','Бойко'),('${person(2)}','Марія','Коваль'),('${person(3)}','Петро','Петренко');
  insert into storage.objects(bucket_id) values('member-photos');
  update public.people set phone='(253) 555-0100' where id='${person(2)}';
  update public.profiles set person_id='${person(2)}' where id='${uid(4)}';
`);
async function as(n) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid(n),
  ]);
  await db.exec("set role authenticated");
}
async function scalar(sql, params = []) {
  return Object.values((await db.query(sql, params)).rows[0])[0];
}
async function fails(sql, params, pattern) {
  await assert.rejects(db.query(sql, params), pattern);
}
await as(2);
const g1 = await scalar(
  "select public.save_deacon_group(null,'Група 1',$1::uuid[])",
  [[uid(3), uid(4)]],
);
const g2 = await scalar(
  "select public.save_deacon_group(null,'Група 2',$1::uuid[])",
  [[uid(7)]],
);
await db.query("select public.assign_deacon_group_member($1,$2,null)", [
  person(1),
  g1,
]);
await db.query("select public.assign_deacon_group_member($1,$2,null)", [
  person(2),
  g2,
]);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 2);
await as(3);
const firstDeaconMembers = (
  await db.query(
    "select person_id from public.deacon_group_members order by person_id",
  )
).rows;
assert.deepEqual(firstDeaconMembers, [{ person_id: person(1) }]);
await as(4);
assert.deepEqual(
  (
    await db.query(
      "select person_id from public.deacon_group_members order by person_id",
    )
  ).rows,
  firstDeaconMembers,
);
await as(2);
assert.equal(
  await scalar("select count(*)::int from public.profiles"),
  1,
  "editors cannot list full profiles",
);
assert.equal(
  (await db.query("select * from public.list_eligible_deacons()")).rows.length,
  3,
);
await fails(
  "select public.save_deacon_group($1,'Invalid',$2::uuid[])",
  [g1, [uid(3), uid(4), uid(7)]],
  /two distinct/,
);
await fails(
  "select public.save_deacon_group($1,'Invalid',$2::uuid[])",
  [g1, [uid(3), uid(3)]],
  /two distinct/,
);
await fails(
  "select public.save_deacon_group($1,'Invalid',$2::uuid[])",
  [g1, [uid(5)]],
  /designated deacons/,
);
await fails("select public.delete_deacon_group($1)", [g1], /Remove all/);
await fails(
  "select public.save_deacon_group(null,'Second group',$1::uuid[])",
  [[uid(3)]],
  /already belongs/,
);
await fails(
  "update public.people set marital_status='divorced' where id=$1",
  [person(1)],
  /check constraint/,
);
await db.query(
  "update public.people set marital_status='widowed', is_orphan=true where id=$1",
  [person(1)],
);
assert.equal(
  await scalar("select is_orphan from public.people where id=$1", [person(1)]),
  true,
);
await fails(
  "select public.assign_deacon_group_member($1,$2,null)",
  [person(1), g2],
  /Assignment changed/,
);
await db.query("select public.assign_deacon_group_member($1,$2,$3)", [
  person(1),
  g2,
  g1,
]);
assert.equal(
  await scalar(
    "select group_id from public.deacon_group_members where person_id=$1",
    [person(1)],
  ),
  g2,
);
await as(3);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 1);
assert.equal(
  (
    await db.query(
      "select * from public.list_group_deacons() where profile_id=$1",
      [uid(4)],
    )
  ).rows[0].email,
  "test4@example.test",
);
assert.equal(
  (
    await db.query(
      "select * from public.list_group_deacons() where profile_id=$1",
      [uid(4)],
    )
  ).rows[0].phone,
  "(253) 555-0100",
);
assert.equal(
  await scalar("select count(*)::int from public.people"),
  3,
  "deacons retain full directory access",
);
assert.equal(await scalar("select count(*)::int from storage.objects"), 1);
assert.equal(
  (await db.query("select * from public.list_group_deacons()")).rows.length,
  2,
);
await fails(
  "select public.save_deacon_group(null,'Forbidden','{}')",
  [],
  /Editor access/,
);
await fails(
  "select * from public.list_eligible_deacons()",
  [],
  /Editor access/,
);
await fails(
  "insert into public.deacon_groups(name) values('Forbidden')",
  [],
  /permission denied/,
);
await as(5);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 0);
assert.ok(
  (await db.query("select * from public.list_member_groups()")).rows.length > 0,
  "approved readers see group labels without roster access",
);
assert.equal(
  (await db.query("select * from public.list_group_deacons()")).rows.length,
  0,
);
await as(6);
assert.equal(
  (await db.query("select * from public.list_member_groups()")).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from public.list_group_deacons()")).rows.length,
  0,
);
for (const table of [
  "public.people",
  "public.deacon_groups",
  "public.deacon_group_members",
  "public.deacon_group_deacons",
  "storage.objects",
])
  assert.equal(await scalar(`select count(*)::int from ${table}`), 0);
await as(1);
await fails(
  "select public.review_account_ministry($1,'active','member',null,null,false)",
  [uid(1)],
  /own access/,
);
await fails(
  "select public.review_account_ministry($1,'revoked','admin',null,null,false)",
  [uid(1)],
  /own access/,
);
await db.query(
  "select public.review_account_ministry($1,'revoked','member',null,null,true)",
  [uid(3)],
);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_deacons where profile_id=$1",
    [uid(3)],
  ),
  1,
  "revocation retains assignments",
);
await as(3);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 0);
assert.equal(
  (await db.query("select * from public.list_member_groups()")).rows.length,
  0,
);
assert.equal(await scalar("select count(*)::int from storage.objects"), 0);
await as(1);
await db.query(
  "select public.review_account_ministry($1,'denied','member',null,null,true)",
  [uid(3)],
);
await as(3);
assert.equal(await scalar("select count(*)::int from public.people"), 0);
assert.equal(
  (await db.query("select * from public.list_member_groups()")).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from public.list_group_deacons()")).rows.length,
  0,
);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 0);
assert.equal(await scalar("select count(*)::int from storage.objects"), 0);
await as(1);
await db.query(
  "select public.review_account_ministry($1,'active','member',null,null,true)",
  [uid(3)],
);
await as(3);
assert.equal(
  await scalar("select count(*)::int from public.deacon_groups"),
  1,
  "restoration restores assigned-group access",
);
await as(1);
await db.query(
  "select public.review_account_ministry($1,'active','member',null,null,false)",
  [uid(3)],
);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_deacons where profile_id=$1",
    [uid(3)],
  ),
  0,
);
assert.equal(
  await scalar(
    "select count(*)::int from public.audit_events where event_type='account.ministry_changed' and entity_id=$1",
    [uid(3)],
  ),
  2,
);
// Force audit failure and prove that the profile and assignment writes roll back.
await db.exec("reset role");
await db.exec(`create function public.fail_audit() returns trigger language plpgsql as $$begin raise exception 'Audit failure'; end$$;
  create trigger fail_audit before insert on public.audit_events for each row execute function public.fail_audit();`);
await as(1);
await fails(
  "select public.save_deacon_group($1,'Must roll back',$2::uuid[])",
  [g1, [uid(4)]],
  /Audit failure/,
);
assert.equal(
  await scalar("select name from public.deacon_groups where id=$1", [g1]),
  "Група 1",
);
await db.exec("reset role");
await db.exec(`create or replace function public.fail_audit() returns trigger language plpgsql as $$begin
  if new.event_type = 'account.ministry_changed' then raise exception 'Audit failure'; end if;
  return new; end$$;`);
await as(1);
const auditCount = await scalar(
  "select count(*)::int from public.audit_events",
);
await fails(
  "select public.review_account_ministry($1,'denied','member',null,null,false)",
  [uid(4)],
  /Audit failure/,
);
assert.equal(
  await scalar("select count(*)::int from public.audit_events"),
  auditCount,
  "all account and ministry audit events roll back",
);
assert.equal(
  await scalar("select status from public.profiles where id=$1", [uid(4)]),
  "active",
);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_deacons where profile_id=$1",
    [uid(4)],
  ),
  1,
);
await db.exec(
  "reset role; drop trigger fail_audit on public.audit_events; drop function public.fail_audit()",
);
await as(2);
await db.query("select public.save_deacon_group($1,'Група 1','{}')", [g1]);
await db.query("select public.delete_deacon_group($1)", [g1]);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 1);
await db.exec("reset role");
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20260915030000_group_browser.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await as(5);
assert.equal(
  await scalar("select count(*)::int from public.deacon_groups"),
  1,
  "ordinary approved members browse groups",
);
const publicDeacons = (
  await db.query("select * from public.list_group_deacons()")
).rows;
assert.equal(publicDeacons.length, 1);
assert.ok(!("email" in publicDeacons[0]), "group RPC never exposes email");
await fails(
  "select public.save_deacon_group(null,'Forbidden','{}')",
  [],
  /Editor access/,
);
await fails(
  "select * from public.list_eligible_deacons()",
  [],
  /Editor access/,
);
for (const status of ["pending", "denied", "revoked"]) {
  await db.exec("reset role");
  await db.query("update public.profiles set status=$1 where id=$2", [
    status,
    uid(6),
  ]);
  await as(6);
  assert.equal(
    await scalar("select count(*)::int from public.deacon_groups"),
    0,
  );
  assert.equal(
    await scalar("select count(*)::int from public.deacon_group_members"),
    0,
  );
  assert.equal(
    (await db.query("select * from public.list_group_deacons()")).rows.length,
    0,
  );
}
await db.exec("reset role");
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20260915040000_ministry_badges.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20260915050000_linked_deacon_details.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(baseline);
assert.equal(await scalar("select count(*)::int from public.deacon_groups"), 0);
await db.exec(`update public.profiles set status='active' where id in ('${uid(3)}','${uid(4)}');
  update public.profiles set role='editor' where id='${uid(3)}';`);
const demoSeed = (
  await readFile(
    new URL("../supabase/seed_deacon_group.sql", import.meta.url),
    "utf8",
  )
)
  .replaceAll("FIRST_DEACON_EMAIL", "test3@example.test")
  .replaceAll("SECOND_DEACON_EMAIL", "test4@example.test");
await db.exec(demoSeed);
await db.exec(demoSeed);
assert.equal(await scalar("select count(*)::int from public.people"), 20);
assert.equal(
  await scalar("select count(*)::int from public.deacon_group_members"),
  20,
);
assert.equal(
  await scalar("select count(*)::int from public.deacon_group_deacons"),
  2,
);
assert.equal(
  await scalar("select role from public.profiles where id=$1", [uid(3)]),
  "editor",
  "demo preserves access roles",
);
await db.query(
  "update public.profiles set display_name=case when id=$1 then 'Demo First' else 'Demo Second' end where id in ($1,$2)",
  [uid(3), uid(4)],
);
const memberSeed = (
  await readFile(
    new URL("../supabase/seed_deacon_members.sql", import.meta.url),
    "utf8",
  )
)
  .replaceAll("FIRST_DEACON_EMAIL", "test3@example.test")
  .replaceAll("SECOND_DEACON_EMAIL", "test4@example.test");
await db.exec(memberSeed);
await db.exec(memberSeed);
assert.equal(await scalar("select count(*)::int from public.people"), 22);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_members where group_id='60000000-0000-4000-8000-000000000001'",
  ),
  20,
);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_members where group_id='60000000-0000-4000-8000-000000000002'",
  ),
  2,
);
assert.equal(
  await scalar(
    "select count(*)::int from public.deacon_group_deacons where group_id='60000000-0000-4000-8000-000000000002'",
  ),
  0,
);
assert.equal(
  await scalar(
    "select d.group_id <> m.group_id from public.profiles p join public.deacon_group_deacons d on d.profile_id=p.id join public.deacon_group_members m on m.person_id=p.person_id where p.id=$1",
    [uid(3)],
  ),
  true,
);
await db.query("update public.profiles set status='active' where id=$1", [
  uid(5),
]);
await as(5);
const linkedDeacon = (
  await db.query(
    "select * from public.list_group_deacons() where profile_id=$1",
    [uid(3)],
  )
).rows[0];
assert.equal(linkedDeacon.phone, "(253) 555-0121");
assert.ok(linkedDeacon.person_id);
assert.equal(
  await scalar("select count(*)::int from public.profiles"),
  1,
  "public browsing does not reveal full account profiles",
);
await db.exec("reset role");
const statusSeed = await readFile(
  new URL("../supabase/seed_member_statuses.sql", import.meta.url),
  "utf8",
);
await db.query(
  "insert into public.people(id,first_name,last_name,marital_status) values($1,'Untouched','Member','single')",
  [person(99)],
);
await db.exec(statusSeed);
await db.exec(statusSeed);
assert.equal(
  await scalar(
    "select count(*)::int from public.people where marital_status='married'",
  ),
  8,
);
assert.equal(
  await scalar(
    "select count(*)::int from public.people where marital_status='widowed'",
  ),
  4,
);
assert.equal(
  await scalar("select count(*)::int from public.people where is_orphan"),
  4,
);
assert.equal(
  await scalar("select marital_status from public.people where id=$1", [
    person(99),
  ]),
  "single",
);
// The new ministry projection never exposes account fields or inactive identities.
await db.exec("reset role");
await db.exec(`
  update public.profiles set status='active', role='admin' where id='${uid(1)}';
  insert into public.people(id,first_name,last_name) values('${person(100)}','Test','Pastor');
  update public.profiles set status='active', person_id='${person(100)}' where id='${uid(5)}';
`);
await as(1);
await db.query(
  "select public.review_account_designations($1,'active','member',$2,null,true,true)",
  [uid(5), person(100)],
);
let ministryRows = (
  await db.query(
    "select * from public.list_member_ministries() where person_id=$1",
    [person(100)],
  )
).rows;
assert.deepEqual(ministryRows[0].ministry_roles, ["deacon", "pastor"]);
assert.deepEqual(Object.keys(ministryRows[0]).sort(), [
  "ministry_roles",
  "person_id",
]);
await db.query(
  "select public.review_account_ministry($1,'active','member',$2,null,false)",
  [uid(5), person(100)],
);
assert.deepEqual(
  (
    await db.query(
      "select * from public.list_member_ministries() where person_id=$1",
      [person(100)],
    )
  ).rows[0].ministry_roles,
  ["pastor"],
);
await as(5);
await fails(
  "select public.review_account_designations($1,'active','member',$2,null,true,true)",
  [uid(5), person(100)],
  /Administrator/,
);
await db.exec("reset role");
await db.exec(
  `update public.profiles set status='pending' where id='${uid(5)}'`,
);
await as(5);
assert.equal(
  await scalar("select count(*) from public.list_member_ministries()"),
  0,
);
await as(1);
assert.equal(
  await scalar(
    "select count(*) from public.list_member_ministries() where person_id=$1",
    [person(100)],
  ),
  0,
);
await db.exec("reset role");
const linkedDeaconPerson = await scalar(
  "select person_id from public.profiles where id=$1",
  [uid(4)],
);
await db.query(
  "update public.people set first_name='Оновлене', last_name='Прізвище', phone='(253) 555-0199' where id=$1",
  [linkedDeaconPerson],
);
await as(1);
const updatedDeacon = (
  await db.query(
    "select * from public.list_group_deacons() where profile_id=$1",
    [uid(4)],
  )
).rows[0];
assert.equal(updatedDeacon.display_name, "Оновлене Прізвище");
assert.equal(updatedDeacon.phone, "(253) 555-0199");
assert.equal(
  (
    await db.query("select * from public.list_eligible_deacons() where id=$1", [
      uid(4),
    ])
  ).rows[0].display_name,
  "Оновлене Прізвище",
);
await db.exec("reset role");
await db.query("update public.profiles set status='revoked' where id=$1", [
  uid(4),
]);
await as(1);
const revokedDeacon = (
  await db.query(
    "select * from public.list_group_deacons() where profile_id=$1",
    [uid(4)],
  )
).rows[0];
assert.notEqual(revokedDeacon.display_name, "Оновлене Прізвище");
assert.equal(revokedDeacon.person_id, null);
assert.equal(revokedDeacon.phone, null);
await db.close();
console.log(
  "Deacon Group migration, RPC, RLS, transitions, safeguards, and atomic-audit checks passed.",
);
