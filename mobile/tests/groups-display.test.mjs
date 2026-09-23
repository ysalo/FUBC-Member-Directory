import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import { partitionGroups } from "../src/features/groups/groups-display.ts";
import { createAsyncCache } from "../src/lib/query-cache.ts";

const group = (id, deacons = []) => ({ id, name: id, nameUk: id, description: "", descriptionUk: "", kind: "membership", responsibleDeaconIds: deacons, memberIds: [] });

test("the signed-in deacon's group is separated from the browse list", () => {
  const result = partitionGroups([group("one"), group("two", ["deacon"]), group("three")], "deacon");
  assert.equal(result.assigned?.id, "two");
  assert.deepEqual(result.others.map((item) => item.id), ["one", "three"]);
});

const require = createRequire(import.meta.url);
const ts = require("typescript");
const repositorySource = await readFile(new URL("../src/features/groups/SupabaseGroupsRepository.ts", import.meta.url), "utf8");
const compiledRepository = ts.transpileModule(repositorySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function remoteGroups({ memberCount = 1, authorized = true, failure = null } = {}) {
  const calls = [];
  const photos = [];
  const people = Array.from({ length: memberCount }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    name: `Member ${String(memberCount - index).padStart(4, "0")}`,
    photo_path: index === 0 ? "member.jpg" : null,
    membership_group_id: "one",
    archived_at: null,
    leadership_ministry: index === 0 ? "deacon" : null,
    is_orphan: index === 0,
    is_widow: index === 1,
  }));
  const excluded = [
    { id: "archived", name: "Archived", membership_group_id: "one", archived_at: "2026-09-01" },
    { id: "unrelated", name: "Unrelated", membership_group_id: "other", archived_at: null },
  ];
  const tables = {
    deacon_groups: [{ id: "one", name: "One", kind: "membership", archived_at: null }],
    people: [...people, ...excluded],
    deacon_group_members: [],
    deacon_group_deacons: people.length ? [{ group_id: "one", person_id: people[0].id, slot: 1 }] : [],
    ministry_accounts: people.length ? [{ id: "deacon-account", person_id: people[0].id, leadership_ministry: "deacon" }] : [],
    person_leadership_ministries: people.length ? [{ person_id: people[0].id, leadership_ministry: "deacon" }] : [],
  };
  function query(source, initialRows) {
    assert.ok(initialRows, `Unexpected query: ${source}`);
    const call = { source, columns: "*", ids: null };
    calls.push(call);
    let rows = [...initialRows];
    const builder = {
      select(columns) { call.columns = columns; return builder; },
      eq(column, value) { rows = rows.filter((row) => row[column] === value); return builder; },
      is(column, value) { rows = rows.filter((row) => row[column] === value); return builder; },
      in(column, values) { call.ids = values; rows = rows.filter((row) => values.includes(row[column])); return builder; },
      order(column) { rows.sort((first, second) => String(first[column]).localeCompare(String(second[column]))); return builder; },
      then(resolve, reject) {
        const data = rows.map((row) => call.columns === "*" ? row : Object.fromEntries(call.columns.split(",").map((column) => [column, row[column]])));
        return Promise.resolve({ data, error: failure === source ? { message: "Read failed" } : null }).then(resolve, reject);
      },
    };
    return builder;
  }
  const client = {
    from(table) { return query(table, tables[table]); },
    rpc(name, parameters) {
      if (name === "member_profile_details") {
        const person = people.find((item) => item.id === parameters.p_person_id);
        return query(name, person ? [{ orphan_status: person.is_orphan, marital_status: person.is_widow ? "widowed" : null }] : []);
      }
      if (name === "directory_active_members") return query(name, [...people, excluded[1]]);
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const exports = {};
  new Function("require", "exports", compiledRepository)((id) => {
    if (id === "@/lib/session-cache") return { createSessionCache: () => {
      const cache = createAsyncCache();
      return { load: (key, loader, fresh) => { if (fresh) cache.clear(key); return cache.getOrLoad(key, loader, 300_000); } };
    } };
    if (id === "@/lib/supabase") return { requireSupabase: () => client };
    if (id === "@/lib/repository-helpers") return {
      activeAccount() { if (!authorized) throw new Error("Not authorized"); return { id: "deacon-account" }; },
      unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data; },
      async privatePhotoSources(paths) {
        const unique = [...new Set(paths.filter(Boolean))];
        if (unique.length) photos.push(unique);
        return new Map(unique.map((path) => [path, { uri: `signed:${path}` }]));
      },
    };
    throw new Error(`Unexpected import: ${id}`);
  }, exports);
  return { repository: new exports.SupabaseGroupsRepository(), calls, photos, people };
}

for (const memberCount of [0, 1, 50, 100, 101, 500, 999, 1000]) {
  test(`remote group detail preserves members and measures requests for ${memberCount} members`, async (context) => {
    const { repository, calls, photos, people } = remoteGroups({ memberCount });
    const result = await repository.getGroup("one");
    assert.equal(result.members.length, memberCount);
    assert.deepEqual(result.members.map((member) => member.id), [...people].reverse().map((person) => person.id));
    for (const person of people) {
      const member = result.members.find((item) => item.id === person.id);
      assert.equal(member.name, person.name);
      assert.equal(member.isOrphan, person.is_orphan);
      assert.equal(member.isWidow, person.is_widow);
      assert.equal(member.leadershipMinistry, person.leadership_ministry ?? undefined);
      assert.deepEqual(member.photo, person.photo_path ? { uri: "signed:member.jpg" } : undefined);
    }
    assert.deepEqual(result.responsibleDeaconIds, memberCount ? ["deacon-account"] : []);
    assert.deepEqual(result.responsibleDeacons.map((person) => person.id), memberCount ? [people[0].id] : []);
    const summaries = calls.filter((call) => call.source === "directory_active_members");
    assert.equal(summaries.length, Math.ceil(memberCount / 100));
    assert.ok(summaries.every((call) => call.ids.length <= 100));
    assert.ok(summaries.every((call) => call.columns === "id,leadership_ministry,is_orphan,is_widow"));
    assert.deepEqual(summaries.flatMap((call) => call.ids), result.members.map((member) => member.id));
    assert.equal(calls.filter((call) => call.source === "member_profile_details").length, 0);
    assert.equal(calls.filter((call) => call.source === "person_leadership_ministries").length, 0);
    assert.equal(calls.length, memberCount ? 6 + Math.ceil(memberCount / 100) : 5);
    context.diagnostic(`members=${memberCount}; data requests=${calls.length}; photo signing batches=${photos.length}`);
  });
}

test("group tab cycles reuse the five-query dataset and explicit refresh reloads it", async () => {
  const { repository, calls } = remoteGroups();
  for (let cycle = 0; cycle < 10; cycle++) assert.equal((await repository.listGroups()).length, 1);
  assert.equal(calls.length, 5);
  await repository.listGroups({ fresh: true });
  assert.equal(calls.length, 10);
});

test("remote group detail stops at authorization, missing groups, and failed reads", async () => {
  const denied = remoteGroups({ authorized: false });
  await assert.rejects(denied.repository.getGroup("one"), /Not authorized/);
  assert.equal(denied.calls.length, 0);
  const missing = remoteGroups();
  assert.equal(await missing.repository.getGroup("missing"), null);
  assert.equal(missing.calls.length, 5);
  await assert.rejects(remoteGroups({ failure: "directory_active_members" }).repository.getGroup("one"), /Read failed/);
});
