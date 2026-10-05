import assert from "node:assert/strict";
import test from "node:test";
import { parseGroupFile, matchGroupFile } from "../src/features/manage/group-import.ts";
const file = { version: 1, name: "Group 3", kind: "membership", deacons: ["Leader One", "Leader Two"], members: ["Мар’яна Дожук", "Missing Person"] };
test("group files validate schema, limits, BOM and duplicate people", () => {
  assert.deepEqual(parseGroupFile('\uFEFF' + JSON.stringify(file)), file);
  for (const bad of [null, {}, { ...file, version: 2 }, { ...file, kind: "bad" }, { ...file, deacons: [] }, { ...file, members: [""] }, { ...file, members: ["leader one"] }, { ...file, name: "x".repeat(121) }]) assert.throws(() => parseGroupFile(JSON.stringify(bad)));
  assert.throws(() => parseGroupFile("{"));
  assert.throws(() => parseGroupFile(" ".repeat(262145)));
});
test("matching requires unique full names and eligible deacons, without guessing abbreviations", () => {
  const data = { groups: [], deacons: [{ name: "Leader One", personId: "one" }], members: [{ name: "Leader Two", personId: "two" }, { name: "Мар'яна Дожук", personId: "three" }, { name: "Missing Person Jr", personId: "four" }] };
  assert.deepEqual(matchGroupFile(file, data), ["one", null, "three", null]);
  data.members.push({ name: "Мар’яна Дожук", personId: "five" });
  assert.deepEqual(matchGroupFile(file, data), ["one", null, null, null]);
});
test("matching uses the full import identity rather than the abbreviated display name", () => {
  const data = { groups: [], deacons: [{ name: "One Leader", importName: "Leader One Senior", personId: "one" }, { name: "Two Leader", importName: "Leader Two Senior", personId: "two" }], members: [{ name: "Three Member", importName: "Member Three Senior", personId: "three" }] };
  const full = { ...file, deacons: ["Leader One Senior", "Leader Two Senior"], members: ["Member Three Senior"] };
  assert.deepEqual(matchGroupFile(full, data), ["one", "two", "three"]);
});

test("upload accepts only absent or empty verify sections and never silently drops unresolved people", () => {
  assert.deepEqual(parseGroupFile(JSON.stringify({ ...file, verify: [] })), file);
  for (const verify of [["Missing Person"], [{ role: "member", name: "Uncertain", suggested_name: "Existing Person" }], [null], null, {}, "", false, 0]) {
    assert.throws(() => parseGroupFile(JSON.stringify({ ...file, verify })), /verify/);
  }
});
