import test from "node:test";
import assert from "node:assert/strict";
import { ManagementPager } from "../src/features/manage/management-pager.ts";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const row = (id) => ({ id, name: id });
const page = (items, total, offset = 0) => ({
  items: items.map(row),
  total,
  offset,
  limit: 50,
});

test("list generations discard old search/session responses and cancel on route exit", async () => {
  const pager = new ManagementPager(),
    old = deferred(),
    fresh = deferred();
  pager.configure("admin:first", () => old.promise, { query: "first" });
  const first = pager.refresh();
  pager.configure("admin:new", () => fresh.promise, { query: "new" });
  const second = pager.refresh();
  fresh.resolve(page(["new"], 1));
  await second;
  old.resolve(page(["old"], 1));
  await first;
  assert.deepEqual(
    pager.state.items.map((p) => p.id),
    ["new"],
  );
  const pending = deferred();
  pager.configure("other-account:new", () => pending.promise, {});
  const switched = pager.refresh();
  assert.deepEqual(pager.state.items, []);
  pager.cancel();
  pending.resolve(page(["private-old"], 1));
  await switched;
  assert.deepEqual(pager.state.items, []);
});
test("append is single flight, suppresses duplicates, retains rows on failure and retries exact backend offset", async () => {
  const pager = new ManagementPager(),
    requests = [];
  let later = deferred();
  pager.configure(
    "members",
    (request) => {
      requests.push(request.offset);
      return request.offset === 0
        ? Promise.resolve(page(["a", "b"], 5))
        : later.promise;
    },
    {},
  );
  await pager.refresh();
  const first = pager.append();
  await pager.append();
  assert.deepEqual(requests, [0, 2]);
  later.reject(new Error("offline"));
  await first;
  assert.deepEqual(
    pager.state.items.map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(pager.state.failedOperation, "append");
  await pager.append();
  assert.deepEqual(
    requests,
    [0, 2],
    "automatic end callbacks do not retry errors",
  );
  later = deferred();
  const retry = pager.retry();
  later.resolve(page(["b", "c", "d"], 5, 2));
  await retry;
  assert.deepEqual(requests, [0, 2, 2]);
  assert.deepEqual(
    pager.state.items.map((p) => p.id),
    ["a", "b", "c", "d"],
  );
  assert.equal(pager.state.nextOffset, 5);
  await pager.append();
  assert.equal(requests.length, 3);
});
test("refresh failure retains visible records; changed filters clear and restart", async () => {
  const pager = new ManagementPager();
  let fail = false;
  pager.configure(
    "active",
    async () => {
      if (fail) throw Error("refresh offline");
      return page(["a"], 1);
    },
    {},
  );
  await pager.refresh();
  fail = true;
  await pager.refresh();
  assert.equal(pager.state.failedOperation, "refresh");
  assert.deepEqual(
    pager.state.items.map((p) => p.id),
    ["a"],
  );
  pager.configure(
    "former",
    async (request) => {
      assert.equal(request.offset, 0);
      return page([], 0);
    },
    { filters: { archived: true } },
  );
  assert.deepEqual(pager.state.items, []);
  await pager.refresh();
  assert.equal(pager.state.total, 0);
  assert.equal(pager.state.error, null);
});
test("empty page before the reported end is recoverable and never auto-loops", async () => {
  const pager = new ManagementPager();
  pager.configure(
    "members",
    async (request) => (request.offset === 0 ? page(["a"], 4) : page([], 4, 1)),
    {},
  );
  await pager.refresh();
  await pager.append();
  assert.equal(pager.state.failedOperation, "append");
  assert.match(pager.state.error, /results changed/);
  assert.deepEqual(
    pager.state.items.map((p) => p.id),
    ["a"],
  );
});

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { searchMembers } from "../src/lib/member-search.ts";
import { orderedAccounts } from "../src/features/manage/model.ts";
const require = createRequire(import.meta.url),
  ts = require("typescript");
const readCode = ts.transpileModule(
  await readFile(
    new URL("../src/features/manage/management-reads.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function readFixture() {
  const calls = [],
    photoRequests = [];
  let allowed = true;
  const catalog = Array.from({ length: 1205 }, (_, index) => ({
    id: `person-${index}`,
    name: `Person ${index}`,
    first_name: "Person",
    last_name: String(index),
    patronymic: "Senior",
    photoPath: `${index}/photo.jpg`,
    archived: false,
    birthDate: null,
    currentMembershipGroupId: null,
    currentResponsibilityGroupId: null,
    currentDeaconGroupId: null,
  }));
  const modules = new Map([
    [
      "@/lib/supabase",
      {
        requireSupabase: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            if (name === "management_summary")
              return { data: { members: 1205, pendingAccounts: 2 } };
            const source =
              args.p_resource === "candidates"
                ? args.p_filters.deacons
                  ? catalog.slice(0, 2)
                  : catalog
                : catalog;
            return {
              data: {
                items: source.slice(
                  args.p_offset,
                  args.p_offset + args.p_limit,
                ),
                total: source.length,
                offset: args.p_offset,
                limit: args.p_limit,
              },
            };
          },
        }),
      },
    ],
    [
      "@/lib/permissions",
      { canManageAccounts: () => allowed, canManageDirectory: () => allowed },
    ],
    [
      "@/lib/repository-helpers",
      {
        activeAccount: () => ({}),
        unwrap: (r) => r.data,
        privatePhotoSources: async (paths) => {
          photoRequests.push(paths);
          return new Map();
        },
      },
    ],
    ["@/lib/member-search", { searchMembers }],
    ["./model", { orderedAccounts }],
    ["./management-read-model", { MANAGEMENT_PAGE_SIZE: 50 }],
  ]);
  const exports = {};
  new Function("require", "exports", readCode)((id) => {
    assert.ok(modules.has(id), id);
    return modules.get(id);
  }, exports);
  return {
    repository: new exports.SupabaseManagementReads(),
    calls,
    photoRequests,
    deny: () => {
      allowed = false;
    },
  };
}
test("interactive read requests remain bounded and only member/candidate page photos are signed", async () => {
  const fixture = readFixture(),
    repo = fixture.repository;
  const first = await repo.loadMembersPage({
    query: " Петрович ",
    filters: { archived: false },
  });
  assert.equal(first.items.length, 50);
  assert.deepEqual(fixture.calls[0].args, {
    p_resource: "members",
    p_query: "Петрович",
    p_filters: { archived: false },
    p_limit: 50,
    p_offset: 0,
  });
  assert.equal(fixture.photoRequests[0].length, 50);
  await repo.loadMembersPage({ offset: 50, limit: 9999 });
  assert.equal(fixture.calls[1].args.p_limit, 100);
  assert.equal(fixture.photoRequests[1].length, 100);
  const before = fixture.photoRequests.length;
  await repo.loadAccountsPage({ filters: { id: "account" }, limit: 1 });
  await repo.loadGroupsPage();
  await repo.loadSummary();
  assert.equal(fixture.photoRequests.length, before);
  assert.equal(fixture.calls[2].args.p_filters.id, "account");
  fixture.deny();
  await assert.rejects(repo.loadMembersPage(), /Not authorized/);
  await assert.rejects(repo.loadAccountsPage(), /Not authorized/);
  await assert.rejects(repo.loadGroupImportCatalog(), /Not authorized/);
});
test("explicit import batches the complete >1000 metadata catalog and signs no private photos", async () => {
  const fixture = readFixture(),
    catalog = await fixture.repository.loadGroupImportCatalog();
  assert.equal(catalog.members.length, 1205);
  assert.equal(catalog.deacons.length, 2);
  assert.equal(new Set(catalog.members.map((p) => p.personId)).size, 1205);
  assert.equal(fixture.photoRequests.length, 0);
  assert.ok(fixture.calls.every((call) => call.args.p_limit === 100));
  assert.ok(fixture.calls.some((call) => call.args.p_offset === 1200));
  assert.equal(catalog.members[1204].importName, "1204 Person Senior");
});

test("deselecting on page one keeps the server selection snapshot so page two cannot skip a member", async () => {
  const allIds = Array.from({ length: 125 }, (_, index) => `member-${index}`),
    requests = [];
  const selected = new Set(allIds),
    pager = new ManagementPager();
  pager.configure(
    "group:selected",
    async (request) => {
      requests.push(request);
      const source = allIds.filter((id) =>
        request.filters.selectedIds.includes(id),
      );
      return page(
        source.slice(request.offset, request.offset + 50),
        source.length,
        request.offset,
      );
    },
    { filters: { selectedOnly: true, selectedIds: [...allIds] } },
  );
  await pager.refresh();
  selected.delete("member-0");
  assert.equal(
    pager.state.items.filter((item) => selected.has(item.id)).length,
    49,
  );
  await pager.append();
  await pager.append();
  const visible = pager.state.items
    .filter((item) => selected.has(item.id))
    .map((item) => item.id);
  assert.equal(visible.length, 124);
  assert.deepEqual(visible, allIds.slice(1));
  assert.deepEqual(
    requests.map((request) => request.offset),
    [0, 50, 100],
  );
  assert.ok(
    requests.every((request) => request.filters.selectedIds.length === 125),
    "stable backend offsets use the original query roster",
  );
});
