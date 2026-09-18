import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const ids = {
  oldDeacon: "10000000-0000-4000-8000-000000000101",
  replacement: "10000000-0000-4000-8000-000000000102",
  person: "10000000-0000-4000-8000-000000000103",
  group: "10000000-0000-4000-8000-000000000104",
};

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
  for (const migration of ["20260916000000_initial.sql", "20260917040000_management_full_pages.sql"]) {
    await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  }
  await db.query("insert into auth.users(id,email) values($1,'old-deacon@example.com')", [ids.oldDeacon]);
  await db.query("insert into public.people(id,name) values($1,'Deacon person')", [ids.person]);
  await db.query("update public.profiles set status='active',person_id=$2,designation='deacon' where id=$1", [ids.oldDeacon, ids.person]);
  await db.query("insert into public.deacon_groups(id,name,kind) values($1,'Care','responsibility')", [ids.group]);
  await db.query("insert into public.deacon_group_deacons(group_id,account_id,slot) values($1,$2,1)", [ids.group, ids.oldDeacon]);
  await db.exec(await readFile(new URL("../migrations/20260917110000_leadership_ministries.sql", import.meta.url), "utf8"));
});
after(async () => db.close());

test("cutover preserves the person ministry while deleting the old special account", async () => {
  assert.equal((await db.query("select * from auth.users where id=$1", [ids.oldDeacon])).rows.length, 0);
  assert.equal((await db.query("select * from public.profiles where id=$1", [ids.oldDeacon])).rows.length, 0);
  assert.equal((await db.query("select * from public.deacon_group_deacons where account_id=$1", [ids.oldDeacon])).rows.length, 0);
  assert.equal((await db.query("select count(*)::integer as count from public.person_ministries pm join public.ministries m on m.id=pm.ministry_id where pm.person_id=$1 and m.system_key='deacon'", [ids.person])).rows[0].count, 1);
});

test("a replacement linked account derives leadership from the person ministry", async () => {
  await db.query("insert into auth.users(id,email) values($1,'replacement@example.com')", [ids.replacement]);
  await db.query("update public.profiles set status='active',person_id=$2 where id=$1", [ids.replacement, ids.person]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids.replacement]);
  const account = (await db.query("select * from public.current_account()")).rows[0];
  await db.exec("reset role");
  assert.equal(account.leadership_ministry, "deacon");
  await assert.rejects(db.query("update public.ministries set archived_at=now() where system_key='deacon'"), /protected ministries/);
  await assert.rejects(db.query("insert into public.person_ministries(person_id,ministry_id) select $1,id from public.ministries where system_key='pastor'", [ids.person]), /mutually exclusive/);
});
