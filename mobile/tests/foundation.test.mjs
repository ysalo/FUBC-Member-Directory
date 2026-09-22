import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadDirectory, canManageAccounts, canManageDirectory, canCreateVisit, canReadVisit, canRespondToVisit, canReadGroupBirthdays } from '../src/lib/permissions.ts';
import { fixedPdtToIso, isoToFixedPdt, parseDateOnly, daysUntilBirthday } from '../src/lib/dates.ts';
import { createSecureSessionStorage } from '../src/lib/secure-session-storage.ts';
import { assertUsableOAuthRedirect, isNumericIpRedirect } from '../src/features/session/auth-redirect.ts';
import { formatPhoneNumber, phoneDigits } from '../src/lib/phone.ts';
import { contactShareMessage, emailUrl, mapUrls } from '../src/features/members/contact-links.ts';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('member profiles load active responsible deacons from their membership group in slot order', async () => {
  const ts = require('typescript');
  const source = await readFile(new URL('../src/features/members/SupabaseMemberProfileRepository.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const createRepository = ({ groupId = 'group', assignments = [], deacons = [], assignmentError = null } = {}) => {
    const calls = [];
    const people = [{ id: 'member', name: 'Member', membership_group_id: groupId, photo_path: null, archived_at: null }, ...deacons];
    const tables = { people, deacon_groups: [{ id: 'group', name: 'Membership group' }], deacon_group_deacons: assignments, ministry_accounts: [], person_ministries: [] };
    const client = {
      from(table) {
        calls.push(table);
        let rows = tables[table];
        const query = {
          select() { return query; },
          eq(column, value) { rows = rows.filter((row) => row[column] === value); return query; },
          is(column, value) { rows = rows.filter((row) => row[column] === value); return query; },
          in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return query; },
          order(column) { rows = [...rows].sort((first, second) => first[column] - second[column]); return query; },
          single() { return Promise.resolve({ data: rows[0], error: null }); },
          maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
          then(resolve, reject) { return Promise.resolve({ data: rows, error: table === 'deacon_group_deacons' ? assignmentError : null }).then(resolve, reject); },
        };
        return query;
      },
      rpc() { return Promise.resolve({ data: [], error: null }); },
    };
    const exports = {};
    const helpers = {
      activeAccount() { calls.push('authorize'); },
      unwrap(result) { if (result.error) throw new Error(result.error.message); return result.data; },
      async privatePhotoSources(paths) { return new Map(paths.filter(Boolean).map((path) => [path, { uri: `signed:${path}` }])); },
    };
    new Function('require', 'exports', compiled)((id) => {
      if (id === '@/lib/repository-helpers') return helpers;
      if (id === '@/lib/supabase') return { requireSupabase: () => client };
      throw new Error(`Unexpected import: ${id}`);
    }, exports);
    return { repository: new exports.SupabaseMemberProfileRepository(), calls };
  };
  const deacon = (id, extra = {}) => ({ id, name: id, phone: null, photo_path: null, archived_at: null, ...extra });
  const assignment = (person_id, slot, group_id = 'group') => ({ person_id, slot, group_id });
  const { repository, calls } = createRepository({
    assignments: [assignment('second', 2), assignment('first', 1), assignment('archived', 3), assignment('missing', 4), assignment('first', 5), assignment('other', 1, 'other-group')],
    deacons: [deacon('second'), deacon('first', { phone: '2065550100', photo_path: 'first.jpg' }), deacon('archived', { archived_at: '2026-01-01' }), deacon('other')],
  });
  const profile = await repository.getProfile('member');
  assert.equal(calls[0], 'authorize');
  assert.deepEqual(profile.responsibleDeacons.map((person) => person.id), ['first', 'second']);
  assert.equal(profile.responsibleDeacons[0].phone, '2065550100');
  assert.deepEqual(profile.responsibleDeacons[0].avatar, { uri: 'signed:first.jpg' });
  assert.deepEqual(profile.responsibleDeacons[1].avatar, {});
  assert.ok(profile.responsibleDeacons.every((person) => person.leadershipMinistry === 'deacon'));
  assert.deepEqual((await createRepository().repository.getProfile('member')).responsibleDeacons, []);
  const ungrouped = createRepository({ groupId: null });
  assert.deepEqual((await ungrouped.repository.getProfile('member')).responsibleDeacons, []);
  assert.ok(!ungrouped.calls.includes('deacon_group_deacons'));
  assert.equal(await repository.getProfile('unavailable'), null);
  await assert.rejects(createRepository({ assignmentError: { message: 'Lookup failed' } }).repository.getProfile('member'), /Lookup failed/);
});

test('member profiles show linked deacon avatars above Contact in both layouts only when deacons exist', async () => {
  const profile = await readFile(new URL('../src/features/members/MemberProfileScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(profile, /MemberRow/);
  assert.match(profile, /const deaconsSection = profile\.responsibleDeacons\?\.length \?/);
  assert.match(profile, /Responsible deacons/);
  assert.match(profile, /Відповідальні диякони/);
  assert.match(profile, /<Link href=\{`\/members\/\$\{deacon\.id\}`\} key=\{deacon\.id\} asChild>/);
  assert.match(profile, /accessibilityLabel=\{`\$\{deacon\.name\}, \$\{copy\.profile\}`\}/);
  assert.match(profile, /<ProfileAvatar name=\{deacon\.name\} size=\{64\} source=\{deacon\.avatar\}/);
  assert.match(profile, /deaconAvatars: \{ flexDirection: "row", flexWrap: "wrap"/);
  assert.equal([...profile.matchAll(/\{deaconsSection\}\s*\{contactSection\}/g)].length, 2);
});

const actor = (role = 'member', leadershipMinistry = null, status = 'active') => ({ id: 'viewer', role, leadershipMinistry, status });
const visit = { plannerId: 'pastor', status: 'open', archivedAt: null, recipients: [{ accountId: 'deacon' }, { accountId: 'pastor-participant' }] };
test('Expo config derives the app version from package metadata', async () => {
  const [appJson, packageMetadata] = await Promise.all([
    readFile(new URL('../app.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const resolveConfig = require('../app.config.js');
  const resolvedConfig = resolveConfig({ config: appJson.expo });
  assert.equal(Object.hasOwn(appJson.expo, 'version'), false);
  assert.equal(resolvedConfig.version, packageMetadata.version);
  assert.equal(resolvedConfig.name, appJson.expo.name);
});
test('phone numbers use a numeric ten-digit value and consistent US formatting', () => {
  assert.equal(formatPhoneNumber('2533942429'), '(253) 394-2429');
  assert.equal(formatPhoneNumber('+1 (253) 394-2429'), '(253) 394-2429');
  assert.equal(formatPhoneNumber('25339'), '(253) 39');
  assert.equal(phoneDigits('(253) 394-2429'), '2533942429');
});
test('member contact actions target the platform mail and maps apps', () => {
  assert.equal(emailUrl(' pastor+visits@example.org '), 'mailto:pastor%2Bvisits%40example.org');
  assert.deepEqual(mapUrls('101 Main St, Sacramento, CA', 'ios'), {
    primary: 'maps:?q=101%20Main%20St%2C%20Sacramento%2C%20CA',
    fallback: 'https://www.google.com/maps/search/?api=1&query=101%20Main%20St%2C%20Sacramento%2C%20CA',
  });
  assert.deepEqual(mapUrls('101 Main St, Sacramento, CA', 'android'), {
    primary: 'geo:0,0?q=101%20Main%20St%2C%20Sacramento%2C%20CA',
    fallback: 'https://www.google.com/maps/search/?api=1&query=101%20Main%20St%2C%20Sacramento%2C%20CA',
  });
});
test('member contact sharing includes available contact fields without blank rows', () => {
  const labels = { phone: 'Phone', email: 'Email', address: 'Address' };
  assert.equal(contactShareMessage({ name: 'Jane Doe', phone: '(253) 555-0100', email: 'jane@example.org', address: '101 Main St' }, labels), 'Jane Doe\nPhone: (253) 555-0100\nEmail: jane@example.org\nAddress: 101 Main St');
  assert.equal(contactShareMessage({ name: 'Jane Doe', phone: '(253) 555-0100' }, labels), 'Jane Doe\nPhone: (253) 555-0100');
});
test('directory is the first tab on native and fallback tab bars', async () => {
  const [nativeLayout, fallbackTabs] = await Promise.all([
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebTabBar.tsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(nativeLayout.indexOf('<NativeTabs.Trigger name="(directory)"') < nativeLayout.indexOf('<NativeTabs.Trigger name="groups"'));
  assert.ok(fallbackTabs.indexOf('{ labelKey: "directory"') < fallbackTabs.indexOf('{ labelKey: "groups"'));
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
  const [appearance, visitation, gate, globalCss, layout] = await Promise.all([
    readFile(new URL('../src/features/appearance/AppearanceProvider.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/visitation/VisitationUi.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/session/AccessGate.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/global.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(appearance, /document\.documentElement\.style\.colorScheme = resolved/);
  assert.match(appearance, /--app-\$\{token\}/);
  assert.match(appearance, /DynamicColorIOS/);
  assert.match(appearance, /preference === "system" && Platform\.OS === "ios" \? systemPalette/);
  assert.match(visitation, /var\(--app-\$\{token\}\)/);
  assert.match(appearance, /accent: "#EF5A24", accentSoft: "#FCE6DD"/);
  assert.match(appearance, /accent: "#FF8052", accentSoft: "#4A2820"/);
  assert.match(visitation, /accent: adaptive\("#EF5A24", "#FF8052", "accent"\)/);
  assert.match(globalCss, /--app-accent: #ef5a24;/);
  assert.match(globalCss, /--app-accent: #ff8052;/);
  assert.match(layout, /tintColor=\{palette\.accent\}/);
  assert.doesNotMatch(`${appearance}\n${visitation}\n${globalCss}\n${layout}`, /#(?:765B3B|D8C3A5|EFE3D2|382F27)/i);
  assert.doesNotMatch(gate, /useAppearance/);
  assert.match(gate, /<StatusBar style="light"/);
});

test('pending approval screen offers a resilient sign-out action', async () => {
  const gate = await readFile(new URL('../src/features/session/AccessGate.tsx', import.meta.url), 'utf8');
  assert.match(gate, /status === "pending"[^;]+secondaryAction=\{\(\) => void submitSignOut\(\)\}/);
  assert.match(gate, /accessibilityState=\{\{[\s\S]*?busy: secondaryActionBusy,[\s\S]*?disabled: secondaryActionBusy[\s\S]*?\}\}/);
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
