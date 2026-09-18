import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadDirectory, canManageAccounts, canManageDirectory, canCreateVisit, canReadVisit, canRespondToVisit, canReadGroupBirthdays } from '../src/lib/permissions.ts';
import { fixedPdtToIso, isoToFixedPdt, parseDateOnly, daysUntilBirthday } from '../src/lib/dates.ts';
import { createSecureSessionStorage } from '../src/lib/secure-session-storage.ts';
import { assertUsableOAuthRedirect, isNumericIpRedirect } from '../src/features/session/auth-redirect.ts';
import { formatPhoneNumber, phoneDigits } from '../src/lib/phone.ts';
import { readFile } from 'node:fs/promises';

const actor = (role = 'member', leadershipMinistry = null, status = 'active') => ({ id: 'viewer', role, leadershipMinistry, status });
const visit = { plannerId: 'pastor', status: 'open', archivedAt: null, recipients: [{ accountId: 'deacon' }, { accountId: 'pastor-participant' }] };
test('phone numbers use a numeric ten-digit value and consistent US formatting', () => {
  assert.equal(formatPhoneNumber('2533942429'), '(253) 394-2429');
  assert.equal(formatPhoneNumber('+1 (253) 394-2429'), '(253) 394-2429');
  assert.equal(formatPhoneNumber('25339'), '(253) 39');
  assert.equal(phoneDigits('(253) 394-2429'), '2533942429');
});
test('approval gates every role and leadership ministry including privileged roles', () => {
  for (const status of ['pending', 'denied', 'revoked']) for (const role of ['member', 'editor', 'admin']) for (const leadershipMinistry of [null, 'pastor', 'deacon']) {
    const user = actor(role, leadershipMinistry, status);
    assert.equal(canReadDirectory(user), false);
    assert.equal(canManageDirectory(user), false);
    assert.equal(canManageAccounts(user), false);
    assert.equal(canCreateVisit(user), false);
    assert.equal(canReadVisit(user, { ...visit, plannerId: user.id }), false);
    assert.equal(canReadGroupBirthdays(user, [user.id]), false);
  }
});
test('access roles never implicitly grant private visits or birthdays', () => {
  for (const role of ['member', 'editor', 'admin']) {
    const user = actor(role);
    assert.equal(canReadDirectory(user), true);
    assert.equal(canManageDirectory(user), role !== 'member');
    assert.equal(canManageAccounts(user), role === 'admin');
    assert.equal(canReadVisit(user, visit), false);
    assert.equal(canCreateVisit(user), false);
    assert.equal(canReadGroupBirthdays(user, [user.id]), false);
  }
});
test('pastors and deacons can plan, manage their own visits, and respond when selected', () => {
  const deacon = { ...actor('member', 'deacon'), id: 'deacon' };
  const selectedPastor = { ...actor('member', 'pastor'), id: 'pastor-participant' };
  assert.equal(canReadVisit(deacon, visit), true);
  assert.equal(canRespondToVisit(deacon, visit), true);
  assert.equal(canReadVisit(selectedPastor, visit), true);
  assert.equal(canRespondToVisit(selectedPastor, visit), true);
  assert.equal(canRespondToVisit(deacon, { ...visit, status: 'completed' }), false);
  assert.equal(canRespondToVisit(deacon, { ...visit, archivedAt: '2026-01-01' }), false);
  assert.equal(canRespondToVisit(actor('admin', 'deacon'), visit), false);
  assert.equal(canReadGroupBirthdays(deacon, ['deacon']), true);
  assert.equal(canReadGroupBirthdays(deacon, ['another']), false);
  assert.equal(canCreateVisit(actor('member', 'pastor')), true);
  assert.equal(canCreateVisit(actor('member', 'deacon')), true);
});
test('PDT remains minus seven hours in winter and summer and crosses midnight correctly', () => {
  for (const date of ['2026-01-15', '2026-07-15', '2026-11-01', '2026-03-08']) {
    assert.equal(fixedPdtToIso(date, '09:30'), `${date}T16:30:00.000Z`);
    assert.deepEqual(isoToFixedPdt(fixedPdtToIso(date, '23:45')), { date, time: '23:45' });
  }
  assert.equal(fixedPdtToIso('2026-12-31', '23:30'), '2027-01-01T06:30:00.000Z');
});
test('date-only parsing rejects overflow and birthday countdown never depends on device timezone', () => {
  for (const invalid of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-1-01', '0000-01-01']) assert.throws(() => parseDateOnly(invalid));
  assert.deepEqual(parseDateOnly('2000-02-29'), { year: 2000, month: 2, day: 29 });
  assert.equal(daysUntilBirthday(1, 1, '2026-12-31'), 1);
  assert.equal(daysUntilBirthday(2, 29, '2027-02-28'), 0);
  assert.throws(() => fixedPdtToIso('2026-01-01', '24:00'));
});
test('large Unicode sessions restore from short secure chunks and survive interrupted replacement', async () => {
  const items = new Map();
  let fail = false;
  const storage = createSecureSessionStorage({
    async getItem(key) { return items.get(key) ?? null; },
    async setItem(key, value) { assert.ok(Buffer.byteLength(value) <= 2048); if (fail && key.endsWith('.1')) throw new Error('Keychain unavailable'); items.set(key,value); },
    async removeItem(key) { items.delete(key); },
  });
  const original = JSON.stringify({ token: 'x'.repeat(7000), name: 'Марія'.repeat(300) });
  await storage.setItem('session',original);
  assert.equal(await storage.getItem('session'),original);
  fail = true;
  await assert.rejects(storage.setItem('session','y'.repeat(5000)),/Keychain/);
  assert.equal(await storage.getItem('session'),original);
  fail = false;
  await storage.setItem('session','new');
  assert.equal(await storage.getItem('session'),'new');
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'),null);
  assert.equal(items.size,0);
});

test('Expo OAuth rejects numeric-IP callbacks and accepts tunnel/custom-scheme callbacks', () => {
  const lan = 'exp://192.168.12.208:8081/--/auth/callback';
  const tunnel = 'exp://example.exp.direct/--/auth/callback';
  const installed = 'fubcdirectory://auth/callback';
  assert.equal(isNumericIpRedirect(lan), true);
  assert.throws(() => assertUsableOAuthRedirect(lan, true), /start:phone/);
  assert.equal(assertUsableOAuthRedirect(tunnel, true), tunnel);
  assert.equal(assertUsableOAuthRedirect(installed, false), installed);
});

test('appearance preferences theme browser-only visitation surfaces', async () => {
  const [appearance, visitation, gate] = await Promise.all([
    readFile(new URL('../src/features/appearance/AppearanceProvider.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/visitation/VisitationUi.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/session/AccessGate.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(appearance, /document\.documentElement\.style\.colorScheme = resolved/);
  assert.match(appearance, /--app-\$\{token\}/);
  assert.match(appearance, /DynamicColorIOS/);
  assert.match(appearance, /preference === "system" && Platform\.OS === "ios" \? systemPalette/);
  assert.match(visitation, /var\(--app-\$\{token\}\)/);
  assert.doesNotMatch(gate, /useAppearance/);
  assert.match(gate, /<StatusBar style="light"/);
});

test('pending approval screen offers a resilient sign-out action', async () => {
  const gate = await readFile(new URL('../src/features/session/AccessGate.tsx', import.meta.url), 'utf8');
  assert.match(gate, /status === "pending"[^;]+secondaryAction=\{\(\) => void submitSignOut\(\)\}/);
  assert.match(gate, /accessibilityState=\{\{ busy: secondaryActionBusy, disabled: secondaryActionBusy \}\}/);
  assert.match(gate, /secondaryActionError/);
});

test('visitation uses a nested stack and exposes both planning entry points to ministry leaders', async () => {
  const [layout, index, list, profile] = await Promise.all([
    readFile(new URL('../src/app/visitation/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/visitation/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/visitation/VisitationListScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/members/MemberProfileScreen.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(layout, /<Stack/);
  assert.match(index, /<VisitationListScreen/);
  assert.match(list, /canCreateVisit\(state\.snapshot\.actor\)/);
  assert.match(list, /router\.push\("\/visitation\/new"/);
  assert.match(profile, /canCreateVisit\(session\.account\)/);
  assert.match(profile, /pathname: "\/visitation\/new"/);
});
