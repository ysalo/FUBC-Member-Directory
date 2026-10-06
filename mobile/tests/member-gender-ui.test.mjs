import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/features/manage/MemberFormScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function formFixture({ existing = null, locale = 'en', saveBarrier, accountId, failLinkOnce = false, familyReturn, familyCandidates = [], deacon = false } = {}) {
  const states = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  const pendingEffects = [];
  const saves = [];
  const routes = [];
  const photos = [], links = [], dialogs = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useMemo: (factory) => factory(),
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useEffect(callback) { pendingEffects.push(callback); },
  };
  const managementRepository = {
    async loadMember() { return existing; },
    async listMinistries() { return []; },
    async saveMemberDetails(details) { saves.push(details); if (saveBarrier) await saveBarrier; return { id: existing?.id ?? 'new', revision: 2 }; },
    async replacePhoto(person) { photos.push(person); return { person: { revision: 3, photo_path: null }, cleanupWarning: null }; },
    async load() { return { members: familyCandidates, accounts: [] }; },
    async apply(_state, action) { links.push(action); if (failLinkOnce) { failLinkOnce = false; throw new Error('offline'); } },
  };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 }, Switch: 'Switch', View: 'View' }],
    ['react-native-safe-area-context', { SafeAreaView: 'SafeAreaView' }],
    ['expo-image-picker', {}],
    ['expo-router', { Link: ({ children, onPress, href }) => React.cloneElement(children, { onPress, href }), useLocalSearchParams: () => ({ memberId: existing?.id, accountId, familyReturn }), useRouter: () => ({ canGoBack: () => true, back() {}, replace(path) { routes.push(path); }, push(path) { routes.push(path); } }) }],
    ['@/features/platform/alert', { Alert: { alert: (...args) => dialogs.push(args) } }],
    ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => false }],
    ['@/features/accessibility/app-text', { Text: 'Text', TextInput: 'TextInput' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/forms/NativeDateTimeField', { NativeDateTimeField: 'DateField' }],
    ['@/features/forms/date-field', { acceptsDateFieldValue: () => true, localDateValue: () => '2026-09-27' }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale }) }],
    ['@/lib/member-name', { formatMemberName: (member) => [member.first_name ?? member.name.split(' ')[0], member.patronymic, member.last_name ?? member.name.split(' ').slice(1).join(' ')].filter(Boolean).join(' ') }],
    ['@/features/family/family-copy', { getFamilyCopy: () => ({ matches: 'Members with matching names' }) }],
    ['@/features/session/SessionProvider', { useSession: () => ({ status: 'ready', account: { role: 'admin' } }) }],
    ['@/lib/permissions', { canManageDirectory: () => !deacon, canManageAccounts: () => !deacon }],
    ['@/lib/phone', { formatPhoneNumber: (value) => value ?? '' }],
    ['./management-repository', { managementRepository }],
    ['./MemberAvatar', { MemberAvatar: 'Avatar' }],
    ['./route-params', { managedAccountHref: () => '/manage' }],
    ['./photo-thumbnail', { createPhotoRenditions() {} }],
    ['./use-unsaved-changes', { useUnsavedChanges: () => ({ allowLeave() {}, confirmLeave(callback) { dialogs.push(['Unsaved changes', '', [{ text: 'Keep editing' }, { text: 'Discard changes', onPress: callback }]]); } }) }],
  ]);
  const exports = {};
  new Function('require', 'exports', code)((id) => {
    if (!modules.has(id)) throw new Error(`Unexpected module ${id}`);
    return modules.get(id);
  }, exports);
  function render() {
    cursor = 0;
    refCursor = 0;
    const nodes = [];
    function walk(node) {
      if (node == null || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node.type === 'function') { walk(node.type(node.props)); return; }
      nodes.push(node);
      walk(node.props?.children);
    }
    walk(exports.MemberFormScreen());
    return nodes;
  }
  const text = (node) => node == null ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
  const button = (nodes, label) => nodes.find((node) => node.type === 'Pressable' && text(node) === label);
  return { render, button, text, saves, routes, photos, links, dialogs, async load() { render(); for (const effect of pendingEffects.splice(0)) effect(); await new Promise(setImmediate); } };
}

test('new member requires an explicit gender selection and persists the chosen radio value', async () => {
  const ui = formFixture();
  await ui.load();
  let nodes = ui.render();
  assert.equal(nodes.find((node) => node.props?.accessibilityRole === 'radiogroup').props['aria-required'], true);
  const radios = nodes.filter((node) => node.props?.accessibilityRole === 'radio');
  assert.deepEqual(radios.map((node) => [node.props.accessibilityLabel, node.props.accessibilityState.checked]), [['Male', false], ['Female', false]]);
  nodes.find((node) => node.props?.accessibilityLabel === 'First name').props.onChangeText('New');
  nodes.find((node) => node.props?.accessibilityLabel === 'Last name').props.onChangeText('Member');
  await ui.button(ui.render(), 'Save member').props.onPress();
  assert.equal(ui.saves.length, 0);
  assert.match(ui.render().map(ui.text).join(' '), /Choose Male or Female/);
  ui.button(ui.render(), 'Female').props.onPress();
  nodes = ui.render();
  assert.equal(nodes.find((node) => node.props?.accessibilityRole === 'radio' && node.props.accessibilityLabel === 'Female').props.accessibilityState.checked, true);
  await ui.button(nodes, 'Save member').props.onPress();
  await new Promise(setImmediate);
  assert.equal(ui.saves[0].gender, 'female');
  assert.ok(!nodes.some((node) => node.type === 'Pressable' && ui.text(node) === 'Clear'));
});

test('editing loads and can change the saved gender', async () => {
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1 } });
  await ui.load();
  let nodes = ui.render();
  assert.equal(nodes.find((node) => node.props?.accessibilityRole === 'radio' && node.props.accessibilityLabel === 'Male').props.accessibilityState.checked, true);
  ui.button(nodes, 'Female').props.onPress();
  nodes = ui.render();
  await ui.button(nodes, 'Save member').props.onPress();
  await new Promise(setImmediate);
  assert.equal(ui.saves[0].gender, 'female');
  assert.equal(ui.saves[0].id, 'saved');
});

test('existing member family navigation opens the stable route', async () => {
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1 } });
  await ui.load();
  const link = ui.button(ui.render(), 'Edit family');
  assert.equal(link.props.accessibilityRole, 'link');
  assert.equal(link.props.href, '/manage/member/saved/family');
});

test('pending member saves remove the family destination and restore it after failure', async () => {
  let finish;
  const saveBarrier = new Promise((_resolve, reject) => { finish = reject; });
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1 }, saveBarrier });
  await ui.load();
  ui.button(ui.render(), 'Save member').props.onPress();
  const nodes = ui.render();
  assert.equal(ui.button(nodes, 'Edit family').props.disabled, true);
  finish(new Error("Save failed")); await new Promise(setImmediate);
  assert.equal(ui.button(ui.render(), 'Edit family').props.disabled, undefined);
});

test('a failed account link retries without repeating a successful photo removal', async () => {
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1, photoPath: 'old/photo.jpg', photo: { uri: 'old' } }, accountId: 'account', failLinkOnce: true });
  await ui.load();
  ui.button(ui.render(), 'Remove photo').props.onPress();
  ui.button(ui.render(), 'Save member').props.onPress();
  await new Promise(setImmediate);
  assert.equal(ui.photos.length, 1);
  assert.match(ui.render().map(ui.text).join(' '), /account was not linked/);
  ui.button(ui.render(), 'Save member').props.onPress();
  await new Promise(setImmediate);
  assert.equal(ui.photos.length, 1);
  assert.equal(ui.saves[1].revision, 3);
  assert.equal(ui.links.length, 2);
});

test('selecting an existing relative offers to keep or discard the entered details', async () => {
  const ui = formFixture({ familyReturn: 'subject', familyCandidates: [{ id: 'match', name: 'Match Person' }] });
  await ui.load();
  ui.render().find(node => node.props?.accessibilityLabel === 'First name').props.onChangeText('Match');
  ui.render().find(node => node.props?.accessibilityLabel === 'Last name').props.onChangeText('Person');
  ui.button(ui.render(), 'Match Person').props.onPress();
  assert.deepEqual(ui.routes, []);
  assert.equal(ui.dialogs.at(-1)[2][0].text, 'Keep editing');
  ui.dialogs.at(-1)[2][1].onPress();
  assert.deepEqual(ui.routes, ['/manage/member/subject/family?createdId=match']);
});

test('creating a family relative distinguishes existing matches by patronymic',async()=>{
 const ui=formFixture({familyReturn:'subject',familyCandidates:[{id:'first',name:'Match Person',patronymic:'One'},{id:'second',name:'Match Person',patronymic:'Two'}]});
 await ui.load();ui.render().find(n=>n.props?.accessibilityLabel==='First name').props.onChangeText('Match');ui.render().find(n=>n.props?.accessibilityLabel==='Last name').props.onChangeText('Person');
 const names=ui.render().filter(n=>n.type==='Pressable').map(n=>ui.text(n));
 assert.ok(names.includes('Match One Person'));assert.ok(names.includes('Match Two Person'));
});

test('deacon editing hides administrative and photo controls and returns to the profile', async () => {
  const ui = formFixture({ deacon: true, existing: { id: 'member', name: 'Anna Member', first_name: 'Anna', last_name: 'Member', gender: 'female', revision: 1 } });
  await ui.load();
  const nodes = ui.render();
  for (const label of ['Edit family', 'Departure history', 'Mark as left membership', 'Delete member', 'Change photo']) assert.equal(ui.button(nodes, label), undefined);
  nodes.find(node => node.props?.accessibilityLabel === 'First name').props.onChangeText('Updated');
  await ui.button(ui.render(), 'Save member').props.onPress();
  assert.equal(ui.saves[0].first_name, 'Updated');
  assert.deepEqual(ui.routes, ['/members/member']);
  assert.equal(ui.photos.length, 0);
});
