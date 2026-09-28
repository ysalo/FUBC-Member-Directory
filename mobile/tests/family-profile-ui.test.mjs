import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const sectionCode = await compile('../src/features/members/FamilySection.tsx');
const copyExports = {};
new Function('exports', await compile('../src/features/family/family-copy.ts'))(copyExports);
const text = (node) => node == null ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
function nodesOf(tree) {
  const nodes = [];
  function walk(node) {
    if (node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (typeof node.type === 'function') { walk(node.type(node.props)); return; }
    nodes.push(node); walk(node.props?.children);
  }
  walk(tree); return nodes;
}
const emptyFamily = () => ({ memberId: 'subject', revision: 1, parents: [], spouse: null, children: [], siblings: [] });
const member = (id, name = id, archived = false) => ({ id, name, archived, photo: { uri: `https://photos.example/${id}` } });
function fixture({ family = emptyFamily(), locale = 'en', getFamily } = {}) {
  const states = []; let cursor = 0; let focus; let changed; let scope = 'session-a'; let subject = 'subject'; let calls = 0;
  const hooks = { ...React, useCallback: (fn) => fn, useRef(initial) { const i = cursor++; return states[i] ??= { current: initial }; }, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (next) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; } };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } }],
    ['expo-router', { Link: 'Link', useFocusEffect: (callback) => { focus = callback; } }],
    ['@/features/accessibility/app-text', { Text: 'Text' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale }) }],
    ['@/features/family/family-copy', copyExports],
    ['@/lib/session-cache', { sessionCacheScope: () => { if (scope === null) throw new Error('signed out'); return scope; }, subscribeDataChanges: (callback) => { changed = callback; return () => { changed = null; }; } }],
    ['./member-repository', { memberProfileRepository: { getFamily: async (...args) => { calls++; return getFamily ? getFamily(...args) : family; } } }],
    ['./member-copy', { getMemberCopy: () => ({ profile: locale === 'uk' ? 'Профіль' : 'Profile', loading: 'Loading', retry: locale === 'uk' ? 'Спробувати ще раз' : 'Try again' }) }],
    ['./ProfileAvatar', { ProfileAvatar: 'Avatar' }],
  ]);
  const exports = {};
  new Function('require', 'exports', sectionCode)((id) => { assert.ok(modules.has(id), id); return modules.get(id); }, exports);
  const render = () => { cursor = 0; return nodesOf(exports.FamilySection({ memberId: subject })); };
  return { render, async load() { render(); focus(); await new Promise(setImmediate); }, async change() { changed(); await new Promise(setImmediate); }, setScope(value) { scope = value; }, setMember(value) { subject = value; }, get calls() { return calls; } };
}
for (const locale of ['en', 'uk']) test(`family profile exposes category labels and photo/name links in ${locale}`, async () => {
  const family = { ...emptyFamily(), parents: [member('parent', 'Parent Name')], spouse: member('spouse', 'Spouse Name'), children: [member('child', 'Child Name')], siblings: [{ ...member('sibling', 'Sibling Name'), explicit: true, supportingParents: [] }] };
  const ui = fixture({ family, locale }); await ui.load();
  const nodes = ui.render();
  const labels = locale === 'uk' ? ['Родина', 'Батьки', 'Подружжя', 'Діти', 'Брати та сестри'] : ['Family', 'Parents', 'Spouse', 'Children', 'Siblings'];
  assert.deepEqual(nodes.filter((node) => node.props.accessibilityRole === 'header').map(text), labels);
  const links = nodes.filter((node) => node.type === 'Link');
  assert.deepEqual(links.map((node) => node.props.href), ['/members/parent', '/members/spouse', '/members/child', '/members/sibling']);
  for (const [index, name] of ['Parent Name', 'Spouse Name', 'Child Name', 'Sibling Name'].entries()) {
    assert.equal(text(links[index]), name);
    const content = nodesOf(links[index]);
    assert.equal(content.find((node) => node.type === 'Avatar').props.name, name);
    assert.equal(content.find((node) => node.type === 'Pressable').props.accessibilityRole, 'link');
    assert.equal(content.find((node) => node.type === 'Text').props.numberOfLines, undefined);
  }
});
test('empty family and archived-only connections leave no panel; empty categories are hidden', async () => {
  for (const family of [emptyFamily(), { ...emptyFamily(), parents: [member('archived', 'Archived', true)] }]) {
    const ui = fixture({ family }); await ui.load(); assert.deepEqual(ui.render(), []);
  }
  const ui = fixture({ family: { ...emptyFamily(), children: [member('child')] } }); await ui.load();
  assert.deepEqual(ui.render().filter((node) => node.props.accessibilityRole === 'header').map(text), ['Family', 'Children']);
});
test('a family read failure is visible and retry recovers', async () => {
  let failed = true;
  const ui = fixture({ getFamily: async () => { if (failed) throw new Error('offline'); return { ...emptyFamily(), parents: [member('parent')] }; } });
  await ui.load();
  assert.ok(ui.render().some((node) => text(node) === 'Unable to load family.'));
  failed = false;
  ui.render().find((node) => node.type === 'Pressable' && text(node) === 'Try again').props.onPress();
  await new Promise(setImmediate);
  assert.equal(ui.calls, 2);
  assert.ok(ui.render().some((node) => node.type === 'Link' && node.props.href === '/members/parent'));
});
test('profile navigation and sign-out never expose a previous subject or session family', async () => {
  const ui = fixture({ family: { ...emptyFamily(), parents: [member('private-parent')] } }); await ui.load();
  ui.setMember('another');
  assert.ok(!ui.render().some((node) => node.type === 'Link'));
  ui.setScope(null);
  assert.deepEqual(ui.render(), []);
});
test('pending old session reads cannot publish after the session changes', async () => {
  let finish;
  const ui = fixture({ getFamily: () => new Promise((resolve) => { finish = resolve; }) });
  await ui.load(); ui.setScope('session-b');
  finish({ ...emptyFamily(), parents: [member('private-parent')] });
  await new Promise(setImmediate);
  assert.ok(!ui.render().some((node) => node.type === 'Link'));
});
test('data changes refresh the profile family after relationships or archive state change', async () => {
  let family = { ...emptyFamily(), parents: [member('parent')] };
  const ui = fixture({ getFamily: async () => family }); await ui.load();
  family = emptyFamily(); await ui.change();
  assert.equal(ui.calls, 2); assert.deepEqual(ui.render(), []);
});

for (const locale of ['en', 'uk']) test(`single and bulk deletion confirmations explain lost inferred family in ${locale}`, async () => {
  for (const [filename, exported] of [['MemberDeletionScreen', 'MemberDeletionScreen'], ['BulkMemberDeletion', 'BulkMemberDeletion']]) {
    let cursor = 0;
    const saved = { id: 'subject', name: 'Subject Name', revision: 1 };
    const hooks = { ...React, useEffect() {}, useMemo: (fn) => fn(), useRef: (current) => ({ current }), useState: (initial) => [filename === 'MemberDeletionScreen' ? (cursor++ === 0 ? 'ready' : cursor === 2 ? saved : initial) : initial, () => {}] };
    const modules = new Map([
      ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
      ['react-native', { ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', View: 'View', Platform: { OS: 'web' }, StyleSheet: { create: (styles) => styles, hairlineWidth: 1 } }],
      ['@expo/ui', { Button: 'Button', Host: 'Host' }], ['@react-native-vector-icons/ionicons', { Ionicons: 'Icon' }],
      ['expo-router', { useLocalSearchParams: () => ({ memberId: 'subject' }), useRouter: () => ({}) }],
      ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => true }],
      ['@/features/accessibility/app-text', { Text: 'Text', TextInput: 'TextInput' }],
      ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
      ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale }) }],
      ['@/features/session/SessionProvider', { useSession: () => ({ status: 'ready', account: { role: 'admin', personId: 'actor' } }) }],
      ['@/lib/permissions', { canManageAccounts: () => true }],
      ['./member-deletion', {}], ['./management-repository', {}], ['./MemberAvatar', { MemberAvatar: 'Avatar' }],
    ]);
    const exports = {};
    new Function('require', 'exports', await compile(`../src/features/manage/${filename}.tsx`))((id) => { assert.ok(modules.has(id), id); return modules.get(id); }, exports);
    const nodes = nodesOf(exports[exported]({ members: [saved], onClose() {} }));
    const warnings = nodes.filter((node) => node.type === 'Text').map(text).join(' ');
    assert.match(warnings, locale === 'uk' ? /родинні зв’язки буде видалено/ : /family connections will be removed/);
    assert.match(warnings, locale === 'uk' ? /автоматично.*також можуть зникнути/ : /Inferred connections.*may also disappear/);
    const deleteButton = nodes.find((node) => node.type === 'Button' || (node.type === 'Pressable' && text(node) === (locale === 'uk' ? 'Видалити назавжди' : 'Delete permanently')));
    assert.equal(deleteButton.props.disabled, true, 'Warning precedes confirmation; deletion remains disabled');
  }
});
