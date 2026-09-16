import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/app/visitation/actions.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(
  `let context;const requireActiveProfile=async()=>context;const getLocale=async()=>"en";const visitCopy=()=>({failed:"failed"});const revalidatePath=()=>{};export const setContext=value=>context=value;${source.replace(/^import .*;\r?$/gm, "")}`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { archiveVisits, pendingVisitCount, setContext } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const requests = [
  { id: "own", pastor_id: "viewer", status: "open" },
  { id: "incoming", pastor_id: "another", status: "open" },
  { id: "closed", pastor_id: "viewer", status: "cancelled" },
  { id: "answered", pastor_id: "viewer", status: "open" },
];
const recipients = [
  { request_id: "own", deacon_id: "viewer", response: "pending" },
  { request_id: "own", deacon_id: "other", response: "pending" },
  { request_id: "incoming", deacon_id: "viewer", response: "pending" },
  { request_id: "incoming", deacon_id: "other", response: "pending" },
  { request_id: "closed", deacon_id: "viewer", response: "pending" },
  { request_id: "answered", deacon_id: "viewer", response: "accepted" },
];
function fixture(roles, error = null) {
  const calls = [];
  const supabase = {
    from(table) {
      const predicates = [];
      return {
        select(fields, options) {
          assert.deepEqual(options, { count: "exact", head: true });
          assert.doesNotMatch(fields, /notes|address|reason/);
          calls.push({ table, fields });
          return this;
        },
        eq(field, value) {
          predicates.push([field, value, true]);
          return this;
        },
        neq(field, value) {
          predicates.push([field, value, false]);
          return this;
        },
        then(resolve, reject) {
          const data = table === "visit_requests" ? requests : recipients;
          const matches = data.filter((row) =>
            predicates.every(([field, value, equal]) => {
              const parts = field.split(".");
              const values =
                parts.length === 1
                  ? [row[field]]
                  : parts[0] === "visit_requests"
                    ? requests
                        .filter((r) => r.id === row.request_id)
                        .map((r) => r[parts[1]])
                    : recipients
                        .filter((r) => r.request_id === row.id)
                        .map((r) => r[parts[1]]);
              return equal ? values.includes(value) : !values.includes(value);
            }),
          );
          return Promise.resolve({
            count: error ? null : matches.length,
            error,
          }).then(resolve, reject);
        },
      };
    },
  };
  setContext({ supabase, profile: { id: "viewer", ministry_roles: roles } });
  return calls;
}
test("pastor badge counts requests once even with two pending recipients", async () => {
  fixture(["pastor"]);
  assert.equal(await pendingVisitCount(), 1);
});
test("deacon badge counts only own pending open invitations", async () => {
  fixture(["deacon"]);
  assert.equal(await pendingVisitCount(), 2);
});
test("dual-role badge does not count the same request twice", async () => {
  fixture(["pastor", "deacon"]);
  assert.equal(await pendingVisitCount(), 2);
});
test("ordinary accounts perform no visitation count queries", async () => {
  const calls = fixture([]);
  assert.equal(await pendingVisitCount(), 0);
  assert.deepEqual(calls, []);
});
test("failed count is unavailable rather than a false zero", async () => {
  fixture(["deacon"], { message: "offline" });
  assert.equal(await pendingVisitCount(), null);
});

test("bulk archive deduplicates visits and preserves expected revisions", async () => {
  const calls = [];
  setContext({
    supabase: {
      async rpc(name, input) {
        calls.push({ name, input });
        return { error: null };
      },
    },
    profile: { id: "viewer", ministry_roles: ["pastor"] },
  });
  const first = "10000000-0000-4000-8000-000000000001";
  const second = "10000000-0000-4000-8000-000000000002";
  assert.deepEqual(
    await archiveVisits([
      { id: first, revision: 2 },
      { id: second, revision: 4 },
      { id: first, revision: 2 },
    ]),
    {},
  );
  assert.deepEqual(calls, [
    {
      name: "archive_visit",
      input: { target: first, expected_revision: 2 },
    },
    {
      name: "archive_visit",
      input: { target: second, expected_revision: 4 },
    },
  ]);
});

test("bulk archive rejects malformed requests before database access", async () => {
  let called = false;
  setContext({
    supabase: {
      async rpc() {
        called = true;
        return { error: null };
      },
    },
    profile: { id: "viewer", ministry_roles: ["pastor"] },
  });
  assert.deepEqual(await archiveVisits([{ id: "not-an-id", revision: 1 }]), {
    error: "failed",
  });
  assert.equal(called, false);
});
