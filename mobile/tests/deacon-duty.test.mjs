import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildRotation,
  currentPeriod,
  fridayBeforeSunday,
  moveCandidate,
  nextPeriodForPerson,
  periodsByMonth,
  sortCandidatesByLastName,
  sundaysInYear,
  surnameKey,
} from '../src/features/duty/duty-domain.ts';

test('sundaysInYear enumerates every Sunday in chronological weekly order', () => {
  for (const year of [2023, 2026, 2028]) {
    const sundays = sundaysInYear(year);
    assert.ok(sundays.length === 52 || sundays.length === 53, `expected 52 or 53 Sundays, got ${sundays.length}`);
    assert.ok(sundays.every((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0));
    for (let index = 1; index < sundays.length; index += 1) {
      const days = (Date.parse(`${sundays[index]}T00:00:00Z`) - Date.parse(`${sundays[index - 1]}T00:00:00Z`)) / 86_400_000;
      assert.equal(days, 7);
    }
  }
});

test('fridayBeforeSunday is always two calendar days earlier, across month and year boundaries', () => {
  assert.equal(fridayBeforeSunday('2026-09-20'), '2026-09-18');
  assert.equal(fridayBeforeSunday('2026-03-01'), '2026-02-27');
  assert.equal(fridayBeforeSunday('2027-01-03'), '2027-01-01');
});

test('surnameKey and sortCandidatesByLastName order deacons alphabetically by surname', () => {
  assert.equal(surnameKey('Ігор Андрусенко'), 'Андрусенко');
  const sorted = sortCandidatesByLastName([
    { personId: 'a', name: 'Віталій Величко' },
    { personId: 'b', name: 'Ігор Андрусенко' },
    { personId: 'c', name: 'Володимир Борсук' },
  ], 'uk');
  assert.deepEqual(sorted.map((c) => c.personId), ['b', 'c', 'a']);
});

test('moveCandidate changes the rotation order by one position and respects boundaries', () => {
  const candidates = [
    { personId: 'a', name: 'A' },
    { personId: 'b', name: 'B' },
    { personId: 'c', name: 'C' },
  ];
  assert.deepEqual(moveCandidate(candidates, 'b', -1).map((candidate) => candidate.personId), ['b', 'a', 'c']);
  assert.deepEqual(moveCandidate(candidates, 'b', 1).map((candidate) => candidate.personId), ['a', 'c', 'b']);
  assert.deepEqual(moveCandidate(candidates, 'a', -1), candidates);
  assert.deepEqual(moveCandidate(candidates, 'c', 1), candidates);
});

test('buildRotation wraps an ordered candidate list across every Sunday of the year', () => {
  const candidates = [
    { personId: 'one', name: 'One' },
    { personId: 'two', name: 'Two' },
    { personId: 'three', name: 'Three' },
  ];
  const rotation = buildRotation(2026, candidates);
  assert.equal(rotation.length, sundaysInYear(2026).length);
  assert.equal(rotation[0].personId, 'one');
  assert.equal(rotation[1].personId, 'two');
  assert.equal(rotation[2].personId, 'three');
  assert.equal(rotation[3].personId, 'one');
  assert.ok(rotation.every((period) => period.revision === 0));
});

test('buildRotation with no candidates produces no periods', () => {
  assert.deepEqual(buildRotation(2026, []), []);
});

test('currentPeriod and nextPeriodForPerson resolve from the Friday through the Sunday', () => {
  const periods = buildRotation(2026, [
    { personId: 'a', name: 'A' },
    { personId: 'b', name: 'B' },
  ]);
  assert.equal(currentPeriod(periods, '2026-09-19')?.sundayOn, '2026-09-20');
  assert.equal(currentPeriod(periods, '2026-09-21'), null);
  const next = nextPeriodForPerson(periods, 'a', '2026-09-19');
  assert.ok(next);
  assert.ok(next.sundayOn > '2026-09-20');
});

test('periodsByMonth groups chronologically by calendar month', () => {
  const periods = buildRotation(2026, [{ personId: 'a', name: 'A' }]);
  const groups = periodsByMonth(periods);
  assert.equal(groups[0].month, '2026-01');
  assert.ok(groups.every((group, index) => index === 0 || group.month > groups[index - 1].month));
});

test('Visitation uses a house icon on native and web, never a heart', async () => {
  const [nativeLayout, webTabBar, webShell] = await Promise.all([
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebTabBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebAppShell.web.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(nativeLayout, /name="visitation">\s*<NativeTabs\.Trigger\.Icon sf=\{\{ default: "house", selected: "house\.fill" \}\}/);
  assert.match(webTabBar, /labelKey: "visitation", path: "\/visitation", icon: "home", outlineIcon: "home-outline"/);
  assert.match(webShell, /key: "visitation", href: "\/visitation", icon: "home-outline"/);
  for (const source of [nativeLayout, webTabBar, webShell]) assert.doesNotMatch(source, /heart/i);
});

test('the schedule tab is registered as /schedule everywhere, not /duty', async () => {
  const [nativeLayout, webTabBar, webShell, localization] = await Promise.all([
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebTabBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebAppShell.web.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/localization/LocalizationProvider.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(nativeLayout, /name="schedule">/);
  assert.match(webTabBar, /labelKey: "schedule", path: "\/schedule"/);
  assert.match(webShell, /key: "schedule", href: "\/schedule"/);
  assert.match(localization, /schedule: "Schedule"/);
  assert.match(localization, /schedule: "Розклад"/);
  for (const source of [nativeLayout, webTabBar, webShell]) assert.doesNotMatch(source, /"\/duty"|name="duty"|labelKey: "duty"/);
});

test('schedule deacons use the shared Manage-style member card', async () => {
  const [schedule, deaconRow] = await Promise.all([
    readFile(new URL('../src/features/duty/DutyScheduleScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/duty/DeaconRow.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(schedule, /<DeaconRow avatar=\{avatar\} card locale=\{locale\}/);
  assert.doesNotMatch(schedule, /personCard:/);
  assert.match(deaconRow, /card: \{ borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet\.hairlineWidth, gap: 11, minHeight: 70, padding: 12 \}/);
  assert.match(deaconRow, /name: \{ fontSize: 16, fontWeight: "700" \}/);
  assert.match(deaconRow, /detail: \{ fontSize: 13, lineHeight: 18, marginTop: 2 \}/);
  assert.doesNotMatch(deaconRow, /Link asChild|Platform\.OS === "web"/);
  assert.match(deaconRow, /accessibilityRole="button"\s+onPress=\{onPress\}/);
  assert.match(schedule, /monthIndex > 0 \? <View style=\{\[styles\.monthSeparator/);
  assert.match(schedule, /monthSeparator: \{ height: StyleSheet\.hairlineWidth/);
  assert.doesNotMatch(schedule, /View a deacon’s schedule|Переглянути розклад диякона/);
});

