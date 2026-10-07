import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

import {
  auditBootstrap,
  auditMigrations,
} from "../supabase/tests/audit-fixture.mjs";
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  editor: "10000000-0000-4000-8000-000000000002",
  member: "10000000-0000-4000-8000-000000000003",
  pending: "10000000-0000-4000-8000-000000000004",
};
async function database() {
  const db = new PGlite();
  try {
    await db.exec(auditBootstrap);
    for (const name of [
      ...auditMigrations,
      "20261006030000_management_pagination",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${name}.sql`, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      `insert into auth.users(id,email) select value::uuid,key||'@example.com' from jsonb_each_text($1)`,
      [ids],
    );
    await db.exec(`update public.profiles set status='active',role='admin' where id='${ids.admin}';update public.profiles set status='active',role='editor' where id='${ids.editor}';update public.profiles set status='active' where id='${ids.member}';
 insert into public.people(first_name,last_name,name,gender) select 'Person','Surname'||lpad(n::text,4,'0'),'Person Surname'||lpad(n::text,4,'0'),'male' from generate_series(1,1205)n;`);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
async function as(db, actor, sql, args = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[actor],
  ]);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
const page = async (
  db,
  actor,
  resource,
  query = "",
  filters = {},
  limit = 50,
  offset = 0,
) =>
  (
    await as(
      db,
      actor,
      "select public.management_page($1,$2,$3,$4,$5) as page",
      [resource, query, filters, limit, offset],
    )
  ).rows[0].page;

test("server management pages search before limit, preserve complete assignment IDs and enforce roles", async () => {
  const db = await database();
  try {
    const first = await page(db, "editor", "members");
    assert.equal(first.items.length, 50);
    assert.equal(first.total, 1205);
    const second = await page(db, "editor", "members", "", {}, 50, 50);
    assert.equal(second.items.length, 50);
    assert.equal(
      new Set([...first.items, ...second.items].map((p) => p.id)).size,
      100,
    );
    const last = await page(db, "editor", "members", "", {}, 50, 1200);
    assert.equal(last.items.length, 5);
    assert.equal(last.total, 1205);
    assert.equal(
      (await page(db, "editor", "members", "", {}, 9999)).items.length,
      100,
    );
    const found = await page(db, "editor", "members", "Surname1205");
    assert.equal(found.total, 1);
    assert.equal(found.items[0].last_name, "Surname1205");
    const special = (
      await db.query(
        "insert into public.people(first_name,last_name,name,patronymic,email,gender) values('Іван','Лук’яненко','Іван Лук’яненко','Петрович','ivan+exact@example.com','male') returning id",
      )
    ).rows[0].id;
    for (const query of [
      "петров іван",
      "Лукян Ів",
      "  Петрович   Лук’яненко ",
      "Івaн",
      "ivan+exact@example.com",
    ])
      assert.equal(
        (await page(db, "editor", "members", query)).items[0]?.id,
        special,
        query,
      );
    assert.equal((await page(db, "editor", "members", "Іван Іван")).total, 0);
    assert.equal(
      (await page(db, "editor", "members", "%")).total,
      0,
      "literal backend metacharacter",
    );
    const group = (
      await db.query(
        "insert into public.deacon_groups(name,kind) values('Paged group','membership') returning id",
      )
    ).rows[0].id;
    await db.query(
      "update public.people set membership_group_id=$1 where id in (select id from public.people order by id limit 1105)",
      [group],
    );
    const context = (
      await as(
        db,
        "editor",
        "select public.management_group_context($1) as value",
        [group],
      )
    ).rows[0].value;
    assert.equal(context.group.memberIds.length, 1105);
    const selectedPage = await page(db, "editor", "candidates", "", {
      selectedOnly: true,
      selectedIds: context.group.memberIds,
    });
    assert.equal(selectedPage.items.length, 50);
    assert.equal(selectedPage.total, 1105);
    assert.equal(
      (await page(db, "editor", "groups")).items.find((g) => g.id === group)
        .memberCount,
      1105,
    );
    assert.equal(
      (
        await as(
          db,
          "editor",
          "select public.management_group_move_preview(null,'membership',$1,'{}') as count",
          [context.group.memberIds],
        )
      ).rows[0].count,
      1105,
    );
    await db.query("update public.people set removed_at=now() where id=$1", [
      special,
    ]);
    assert.equal((await page(db, "editor", "members", "Петрович")).total, 0);
    const editorSummary = (
      await as(db, "editor", "select public.management_summary() as value")
    ).rows[0].value;
    assert.equal(editorSummary.pendingAccounts, null);
    const adminSummary = (
      await as(db, "admin", "select public.management_summary() as value")
    ).rows[0].value;
    assert.equal(adminSummary.pendingAccounts, 1);
    const accounts = await page(db, "admin", "accounts", "", {
      id: ids.pending,
    });
    assert.equal(accounts.total, 1);
    assert.equal(accounts.items[0].status, "pending");
    for (const actor of ["member", "pending"])
      for (const resource of ["members", "accounts", "groups", "candidates"])
        await assert.rejects(page(db, actor, resource), /Not authorized/);
    await assert.rejects(page(db, "editor", "accounts"), /Not authorized/);
    const leader = (
      await db.query(
        "select id,name,revision from public.people where membership_group_id is null and removed_at is null limit 1",
      )
    ).rows[0];
    await db.query(
      "insert into public.person_ministries(person_id,ministry_id) select $1,id from public.ministries where system_key='deacon'",
      [leader.id],
    );
    await db.query(
      "insert into public.deacon_group_deacons(group_id,person_id,slot) values($1,$2,1)",
      [group, leader.id],
    );
    const currentLeader = (
      await db.query("select revision from public.people where id=$1", [
        leader.id,
      ])
    ).rows[0];
    await as(db, "admin", "select public.remove_member($1,$2,$3)", [
      leader.id,
      currentLeader.revision,
      leader.name,
    ]);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from public.deacon_group_deacons where person_id=$1",
          [leader.id],
        )
      ).rows[0].count,
      1,
      "audit soft removal retains relationships",
    );
    const clean = (
      await as(
        db,
        "editor",
        "select public.management_group_context($1) as value",
        [group],
      )
    ).rows[0].value.group;
    assert.deepEqual(clean.deaconIds, []);
    assert.equal(
      (await page(db, "editor", "groups")).items.find((g) => g.id === group)
        .deaconCount,
      0,
    );
    await as(
      db,
      "editor",
      "select public.save_group($1,$2,'Renamed paged group','membership',false,$3,$4)",
      [group, clean.revision, clean.deaconIds, clean.memberIds],
    );
    await db.query("update public.profiles set status='revoked' where id=$1", [
      ids.editor,
    ]);
    for (const sql of [
      "select public.management_summary()",
      "select public.management_group_context(null)",
      "select public.management_group_move_preview(null,'membership','{}','{}')",
    ])
      await assert.rejects(as(db, "editor", sql), /Not authorized/);
    await assert.rejects(page(db, "editor", "members"), /Not authorized/);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.management_page('members')"),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
