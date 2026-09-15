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
const { visitTimeToIso, localVisitTime, formatVisitDate } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
test("visitation always uses fixed PDT in summer and winter", () => {
  assert.equal(visitTimeToIso("2026-09-15T12:30"), "2026-09-15T19:30:00.000Z");
  assert.equal(visitTimeToIso("2026-12-15T12:30"), "2026-12-15T19:30:00.000Z");
  assert.equal(localVisitTime("2026-09-15T19:30:00Z"), "2026-09-15T12:30");
});
test("PDT has no seasonal gaps or repeated hours and handles year boundaries", () => {
  assert.equal(visitTimeToIso("2026-03-08T02:30"), "2026-03-08T09:30:00.000Z");
  assert.equal(visitTimeToIso("2026-11-01T01:30"), "2026-11-01T08:30:00.000Z");
  assert.equal(visitTimeToIso("2026-12-31T23:30"), "2027-01-01T06:30:00.000Z");
  for (const locale of ["en", "uk"]) {
    const display = formatVisitDate("2026-12-15T19:30:00Z", locale);
    assert.match(display, /12:30/);
    assert.doesNotMatch(display, /GMT|PDT|PST|Los_Angeles/);
  }
});
test("reject invalid dates and times", () => {
  for (const value of ["2026-01-01T24:00", "2026-02-30T12:00", "invalid"])
    assert.throws(() => visitTimeToIso(value));
});
