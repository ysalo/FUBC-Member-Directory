import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../../src/lib/visitation.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { visitTimeToIso, localVisitTime } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("church wall time converts independently of browser timezone", () => {
  assert.equal(
    visitTimeToIso("2026-09-15T12:30", "America/Los_Angeles"),
    "2026-09-15T19:30:00.000Z",
  );
  assert.equal(
    visitTimeToIso("2026-12-15T12:30", "America/Los_Angeles"),
    "2026-12-15T20:30:00.000Z",
  );
  assert.equal(
    localVisitTime("2026-09-15T19:30:00Z", "America/Los_Angeles"),
    "2026-09-15T12:30",
  );
});
test("reject DST gaps, repeated hours, and invalid dates", () => {
  for (const value of [
    "2026-03-08T02:30",
    "2026-11-01T01:30",
    "2026-02-30T12:00",
    "invalid",
  ])
    assert.throws(() => visitTimeToIso(value, "America/Los_Angeles"));
});
