import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const baseline = await readFile(
  new URL(
    "../supabase/migrations/20260914130000_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../supabase/migrations/20260915060000_visitation.sql",
    import.meta.url,
  ),
  "utf8",
);
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lifecycle = (
  await readFile(
    new URL(
      "../supabase/migrations/20260915181500_visitation_lifecycle.sql",
      import.meta.url,
    ),
    "utf8",
  )
).split("-- Hosted scheduler")[0];
const archive = (
  await readFile(
    new URL(
      "../supabase/migrations/20260915220000_visitation_archive.sql",
      import.meta.url,
    ),
    "utf8",
  )
).split("-- Hosted scheduler")[0];
for (const upgrade of [true, false]) {
  const db = new PGlite();
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated;`);
  await db.exec(
    upgrade ? baseline.split("-- Visitation foundation.")[0] : baseline,
  );
  if (upgrade) await db.exec(migration);
  await db.exec(lifecycle);
  await db.exec(archive);
  for (let n = 1; n <= 6; n++)
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      id(n),
      `fixture${n}@example.test`,
    ]);
  await db.exec(
    `update public.profiles set status='active';update public.profiles set ministry_roles=array['pastor'] where id='${id(1)}';update public.profiles set ministry_roles=array['deacon'] where id in ('${id(2)}','${id(3)}','${id(4)}');update public.profiles set role='admin' where id='${id(5)}';insert into public.people(id,first_name,last_name,address_line_1) values('${id(10)}','Test','Member','123 Example St');`,
  );
  async function as(n) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id(n),
    ]);
    await db.exec("set role authenticated");
  }
  async function scalar(sql, p = []) {
    return Object.values((await db.query(sql, p)).rows[0])[0];
  }
  const save = "select public.save_visit($1,$2,$3,$4,$5,$6,$7::uuid[],$8)";
  const args = [
    null,
    null,
    id(10),
    "Home",
    "2099-01-01T12:00:00Z",
    "Sensitive note",
    [id(2), id(3)],
    id(20),
  ];
  await as(6);
  await assert.rejects(db.query(save, args), /Pastor/);
  await as(1);
  const v = await scalar(save, args);
  assert.equal(await scalar(save, args), v);
  assert.equal(
    await scalar("select count(*)::int from public.visit_recipients"),
    2,
  );
  await assert.rejects(
    db.query(save, [...args.slice(0, 6), [id(2), id(2)], id(21)]),
    /distinct/,
  );
  await assert.rejects(
    db.query(save, [...args.slice(0, 6), [id(6)], id(21)]),
    /active/,
  );
  for (const n of [4, 5, 6]) {
    await as(n);
    assert.equal(
      await scalar("select count(*)::int from public.visit_requests"),
      0,
    );
    await assert.rejects(
      db.query("select * from public.visit_notification_events"),
      /permission/,
    );
  }
  await as(2);
  await db.query("select public.respond_visit($1,$2,$3,$4)", [
    v,
    "accepted",
    "",
    1,
  ]);
  await db.query("select public.respond_visit($1,$2,$3,$4)", [
    v,
    "declined",
    "Unavailable",
    1,
  ]);
  assert.equal(
    await scalar(
      "select response from public.visit_recipients where deacon_id=$1",
      [id(2)],
    ),
    "declined",
  );
  await db.query("select public.respond_visit($1,$2,$3,$4)", [
    v,
    "accepted",
    "old reason",
    1,
  ]);
  assert.equal(
    await scalar(
      "select decline_reason from public.visit_recipients where deacon_id=$1",
      [id(2)],
    ),
    "",
  );
  await as(1);
  await scalar(save, [
    v,
    1,
    null,
    "New location",
    "2099-01-02T12:00:00Z",
    "Updated note",
    [],
    null,
  ]);
  assert.equal(await scalar("select revision from public.visit_requests"), 2);
  assert.equal(
    await scalar(
      "select response from public.visit_recipients where deacon_id=$1",
      [id(2)],
    ),
    "accepted",
  );
  await db.exec("reset role");
  assert.equal(
    await scalar("select count(*)::int from public.visit_notification_events"),
    4,
  );
  await db.exec(
    `create function public.reject_visit_audit() returns trigger language plpgsql as $$begin if new.event_type='visit.updated' then raise exception 'audit rejected';end if;return new;end$$;create trigger reject_visit before insert on public.audit_events for each row execute function public.reject_visit_audit();`,
  );
  await as(1);
  await assert.rejects(
    db.query(save, [
      v,
      2,
      null,
      "Rollback",
      "2099-01-03T12:00:00Z",
      "",
      [],
      null,
    ]),
    /audit rejected/,
  );
  assert.equal(await scalar("select revision from public.visit_requests"), 2);
  await db.exec("reset role");
  assert.equal(
    await scalar("select count(*)::int from public.visit_notification_events"),
    4,
  );
  await db.exec("drop trigger reject_visit on public.audit_events");
  await as(2);
  await assert.rejects(
    db.query("select public.respond_visit($1,$2,$3,$4)", [
      v,
      "declined",
      "",
      1,
    ]),
    /changed/,
  );
  await db.query("select public.view_visit($1,2)", [v]);
  assert.equal(
    await scalar(
      "select last_viewed_revision from public.visit_recipients where deacon_id=$1",
      [id(2)],
    ),
    2,
  );
  await db.exec("reset role");
  await db.query("update public.profiles set status='revoked' where id=$1", [
    id(3),
  ]);
  await as(3);
  assert.equal(
    await scalar("select count(*)::int from public.visit_requests"),
    0,
  );
  await assert.rejects(
    db.query("select public.respond_visit($1,$2,$3,$4)", [
      v,
      "accepted",
      "",
      2,
    ]),
    /Deacon/,
  );
  await as(1);
  await db.query("select public.close_visit($1,$2,$3)", [v, "completed", 2]);
  await as(2);
  await assert.rejects(
    db.query("select public.respond_visit($1,$2,$3,$4)", [
      v,
      "declined",
      "",
      2,
    ]),
    /closed/,
  );
  await as(1);
  await assert.rejects(
    db.query(save, [
      v,
      2,
      null,
      "Closed",
      "2099-01-03T12:00:00Z",
      "",
      [],
      null,
    ]),
    /closed/,
  );
  await db.exec("reset role");
  await db.query(
    "update public.visit_requests set scheduled_at=now()-interval '1 hour',status='open' where id=$1",
    [v],
  );
  await as(1);
  await db.query("select public.close_visit($1,$2,$3)", [v, "completed", 2]);
  assert.equal(
    await scalar("select status from public.visit_requests where id=$1", [v]),
    "completed",
  );
  await db.query("select public.archive_visit($1,$2)", [v, 2]);
  assert.equal(
    await scalar(
      "select archived_at is not null from public.visit_requests where id=$1",
      [v],
    ),
    true,
  );
  await as(2);
  await assert.rejects(
    db.query("select public.archive_visit($1,$2)", [v, 2]),
    /Pastor/,
  );
  await as(4);
  await assert.rejects(
    db.query("select public.respond_visit($1,$2,$3,$4)", [
      v,
      "accepted",
      "",
      2,
    ]),
    /unavailable/,
  );
  await db.exec("reset role");
  await assert.rejects(
    db.query(
      "update public.profiles set ministry_roles=array['pastor','deacon'] where id=$1",
      [id(1)],
    ),
    /profiles_ministry_roles_check/,
  );
  await db.query(
    "update public.visit_requests set scheduled_at=now()-interval '5 hours 59 minutes',status='open',archived_at=null where id=$1",
    [v],
  );
  assert.equal(await scalar("select public.auto_complete_visits()"), 0);
  await db.query(
    "update public.visit_requests set scheduled_at=now()-interval '6 hours' where id=$1",
    [v],
  );
  await as(2);
  await assert.rejects(
    db.query("select public.auto_complete_visits()"),
    /permission denied/,
  );
  await db.exec("reset role");
  assert.equal(await scalar("select public.auto_complete_visits()"), 1);
  assert.equal(await scalar("select public.auto_complete_visits()"), 0);
  assert.equal(
    await scalar(
      "select count(*)::int from public.audit_events where event_type='visit.auto_completed'",
    ),
    1,
  );
  await db.query(
    "update public.visit_requests set updated_at=now()-interval '5 hours 59 minutes' where id=$1",
    [v],
  );
  assert.equal(await scalar("select public.auto_archive_visits()"), 0);
  await db.query(
    "update public.visit_requests set updated_at=now()-interval '6 hours' where id=$1",
    [v],
  );
  await as(2);
  await assert.rejects(
    db.query("select public.auto_archive_visits()"),
    /permission denied/,
  );
  await db.exec("reset role");
  assert.equal(await scalar("select public.auto_archive_visits()"), 1);
  assert.equal(await scalar("select public.auto_archive_visits()"), 0);
  assert.equal(
    await scalar(
      "select count(*)::int from public.audit_events where event_type='visit.auto_archived'",
    ),
    1,
  );
  await db.exec(baseline);
  await db.close();
  console.log(
    upgrade
      ? "Visitation upgrade/security passed"
      : "Visitation baseline/security passed",
  );
}
