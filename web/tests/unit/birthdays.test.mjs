import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageOn,
  churchToday,
  upcomingBirthdays,
} from "../../src/lib/birthdays.ts";

test("age changes on birthdays, handles leap days, and omits unknown/future dates", () => {
  assert.equal(ageOn("1990-09-15", "2026-09-14"), 35);
  assert.equal(ageOn("1990-09-15", "2026-09-15"), 36);
  assert.equal(ageOn("2000-02-29", "2027-02-28"), 27);
  assert.equal(ageOn("2000-02-29", "2028-02-28"), 27);
  assert.equal(ageOn("", "2026-09-14"), null);
  assert.equal(ageOn("2027-01-01", "2026-09-14"), null);
});

test("includes today and cross-year birthdays, excludes unknown and outside dates", () => {
  assert.deepEqual(
    upcomingBirthdays(
      [
        { id: "today", dateOfBirth: "1980-12-20" },
        { id: "next-year", dateOfBirth: "1990-01-05" },
        { id: "outside", dateOfBirth: "1980-01-19" },
        { id: "unknown", dateOfBirth: "" },
      ],
      "2026-12-20",
    ),
    [
      { id: "today", date: "2026-12-20", daysAway: 0 },
      { id: "next-year", date: "2027-01-05", daysAway: 16 },
    ],
  );
});
test("February 29 falls on February 28 only in non-leap years", () => {
  const people = [{ id: "leap", dateOfBirth: "2000-02-29" }];
  assert.equal(upcomingBirthdays(people, "2027-02-28")[0].date, "2027-02-28");
  assert.equal(upcomingBirthdays(people, "2028-02-28")[0].date, "2028-02-29");
});
test("church date uses the configured timezone", () => {
  assert.equal(
    churchToday(new Date("2026-09-15T02:00:00Z"), "America/Los_Angeles"),
    "2026-09-14",
  );
});
