import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/features/manage/MemberFormScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function formFixture({ existing = null, locale = 'en', saveBarrier } = {}) {
  const states = [];
  let cursor = 0;
  let effectRan = false;
  let pendingEffect;
  const saves = [];
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useMemo: (factory) => factory(),
    useEffect(callback) { if (!effectRan) { pendingEffect = callback; effectRan = true; } },
  };
  const managementRepository = {
    async loadMember() { return existing; },
    async listMinistries() { return []; },
    async saveMemberDetails(details) { saves.push(details); if (saveBarrier) await saveBarrier; return { id: existing?.id ?? 'new', revision: 2 }; },
  };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 }, Switch: 'Switch', View: 'View' }],
    ['react-native-safe-area-context', { SafeAreaView: 'SafeAreaView' }],
    ['expo-image-picker', {}],
    ['expo-router', { Link: 'Link', useLocalSearchParams: () => ({ memberId: existing?.id }), useRouter: () => ({ canGoBack: () => true, back() {}, replace() {} }) }],
    ['@/features/platform/alert', { Alert: { alert() {} } }],
    ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => false }],
    ['@/features/accessibility/app-text', { Text: 'Text', TextInput: 'TextInput' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/forms/NativeDateTimeField', { NativeDateTimeField: 'DateField' }],
    ['@/features/forms/date-field', { acceptsDateFieldValue: () => true, localDateValue: () => '2026-09-27' }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale }) }],
    ['@/features/session/SessionProvider', { useSession: () => ({ status: 'ready', account: { role: 'admin' } }) }],
    ['@/lib/permissions', { canManageAccounts: () => true }],
    ['@/lib/phone', { formatPhoneNumber: (value) => value ?? '' }],
    ['./management-repository', { managementRepository }],
    ['./MemberAvatar', { MemberAvatar: 'Avatar' }],
    ['./route-params', { managedAccountHref: () => '/manage' }],
    ['./photo-thumbnail', { createPhotoRenditions() {} }],
  ]);
  const exports = {};
  new Function('require', 'exports', code)((id) => {
    if (!modules.has(id)) throw new Error(`Unexpected module ${id}`);
    return modules.get(id);
  }, exports);
  function render() {
    cursor = 0;
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
  return { render, button, text, saves, async load() { render(); pendingEffect?.(); await new Promise(setImmediate); } };
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

test('existing member family navigation exposes a stable link destination', async () => {
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1 } });
  await ui.load();
  const link = ui.render().find(node => node.type === 'Link' && ui.text(node) === 'Edit family');
  assert.equal(link.props.href, '/manage/member/saved/family');
  assert.equal(link.props.asChild, true);
  // Expo Router must retain ownership of the navigation handler on web.
  assert.equal(link.props.onPress, undefined);
  assert.equal(ui.button(ui.render(), 'Edit family').props.accessibilityRole, 'link');
});

test('pending member saves remove the family destination and restore it after failure', async () => {
  let finish;
  const saveBarrier = new Promise((_resolve, reject) => { finish = reject; });
  const ui = formFixture({ existing: { id: 'saved', name: 'Saved Member', gender: 'male', revision: 1 }, saveBarrier });
  await ui.load();
  ui.button(ui.render(), 'Save member').props.onPress();
  const nodes = ui.render();
  assert.equal(nodes.some(node => node.type === 'Link' && node.props.href === '/manage/member/saved/family'), false);
  assert.equal(ui.button(nodes, 'Edit family').props.disabled, true);
  finish(new Error("Save failed")); await new Promise(setImmediate);
  assert.ok(ui.render().some(node => node.type === 'Link' && node.props.href === '/manage/member/saved/family'));
});
