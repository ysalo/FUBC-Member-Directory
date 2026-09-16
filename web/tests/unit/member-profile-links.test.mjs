import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const id = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("account-to-member lookup exposes only requested nonarchived identities to active members", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated;
      create role anon;
      create schema auth;
      create schema storage;
      create table auth.users(id uuid primary key, email text,
        raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
      $$;
      grant usage on schema auth,storage to authenticated;
      create table storage.buckets(id text primary key,name text,public boolean);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);
      alter table storage.objects enable row level security;
      grant select on storage.objects to authenticated;
    `);
    for (const migration of [
      "20260914130000_initial_schema.sql",
      "20260915210000_member_profile_links.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    for (let n = 1; n <= 7; n++)
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id(n),
        `fixture${n}@example.test`,
      ]);
    await db.exec(`
      insert into public.people(id,first_name,last_name,archived_at) values
        ('${id(11)}','Linked','Member',null),
        ('${id(12)}','Archived','Member',now()),
        ('${id(13)}','Other','Member',null);
      update public.profiles set status='active';
      update public.profiles set person_id='${id(11)}' where id='${id(2)}';
      update public.profiles set person_id='${id(12)}' where id='${id(3)}';
      update public.profiles set person_id='${id(13)}', status='revoked' where id='${id(4)}';
      update public.profiles set status='pending' where id='${id(5)}';
      update public.profiles set status='denied' where id='${id(6)}';
      update public.profiles set role='admin' where id='${id(7)}';
    `);
    const lookup = async (ids) =>
      (
        await db.query(
          "select * from public.resolve_member_profiles($1::uuid[])",
          [ids],
        )
      ).rows;
    const as = async (user, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user ? id(user) : "",
      ]);
      await db.exec(`set role ${role}`);
    };
    await as(1);
    const requested = [id(2), id(3), id(1), id(99), id(2)];
    assert.deepEqual(await lookup(requested), [
      { profile_id: id(2), person_id: id(11) },
    ]);
    assert.deepEqual(await lookup([]), []);
    assert.deepEqual(await lookup(null), []);
    // Historical account status does not invalidate a still-active directory member.
    assert.deepEqual(await lookup([id(4)]), [
      { profile_id: id(4), person_id: id(13) },
    ]);
    assert.deepEqual(
      (await db.query("select id from public.profiles")).rows,
      [{ id: id(1) }],
      "member profile RLS remains self-only",
    );
    await as(7);
    assert.deepEqual(await lookup([id(2)]), [
      { profile_id: id(2), person_id: id(11) },
    ]);
    for (const user of [null, 4, 5, 6, 99]) {
      await as(user);
      assert.deepEqual(await lookup(requested), []);
    }
    await as(null, "anon");
    await assert.rejects(lookup(requested), /permission denied/);
    await db.exec("reset role");
    const [{ config }] = (
      await db.query(
        "select proconfig as config from pg_proc where oid='public.resolve_member_profiles(uuid[])'::regprocedure",
      )
    ).rows;
    assert.deepEqual(config, ['search_path=""']);
  } finally {
    await db.close();
  }
});
