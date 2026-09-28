import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const source = await compile('../src/features/manage/FamilyEditorScreen.tsx');
const copy = {}; new Function('exports', await compile('../src/features/family/family-copy.ts'))(copy);
function fixture({ locale = 'en', failure = null } = {}) {
  const states = []; let cursor = 0, effect, loaded = false, exits = 0, reads = 0;
  const saves = [], creates = [];
  const members = ['Subject Person', 'Parent Person', 'Sibling Person', 'Match Person'].map((name, index) => ({ id: String(index), name, archived: index === 1 }));
  const snapshot = { memberId: '0', revision: 5, parents: [members[1]], spouse: null, children: [], siblings: [{ ...members[2], explicit: true, supportingParents: [members[1]] }] };
  const repository = {
    async loadFamily() { reads++; return snapshot; }, async load() { return { members: [...members] }; },
    async saveFamily(...args) { saves.push(args); if (failure) throw failure; return snapshot; },
    async saveMemberDetails(data) { creates.push(data); const saved = { ...data, id: 'new', archived: false }; members.push(saved); return saved; },
  };
  const modules = {
    react: { ...React, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useEffect(callback) { if (!loaded) { loaded = true; effect = callback; } } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'expo-router': { useLocalSearchParams: () => ({ memberId: '0' }), useRouter: () => ({ canGoBack: () => true, back: () => exits++ }) },
    'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '@/features/accessibility/app-text': { Text: 'Text', TextInput: 'Input' },
    '@/features/appearance/AppearanceProvider': { useAppearance: () => ({ palette: {} }) },
    '@/features/localization/LocalizationProvider': { useLocalization: () => ({ locale }) },
    '@/features/family/family-copy': copy,
    './management-repository': { managementRepository: repository },
  };
  const exports = {}; new Function('require', 'exports', source)(id => { assert.ok(id in modules, id); return modules[id]; }, exports);
  const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  function render() { cursor = 0; const nodes = []; const walk = node => { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); }; walk(exports.FamilyEditorScreen()); return nodes; }
  const flush = () => new Promise(setImmediate);
  async function press(label, index = 0) { const button = render().filter(n => n.type === 'Button' && n.props.accessibilityLabel === label)[index]; assert.ok(button, `Missing ${label}`); assert.ok(!button.props.disabled, `Disabled ${label}`); button.props.onPress(); await flush(); }
  function input(label, value) { const field = render().find(n => n.type === 'Input' && n.props.accessibilityLabel === label); assert.ok(field); field.props.onChangeText(value); }
  return { render, press, input, saves, creates, get exits() { return exits; }, get reads() { return reads; }, text: () => render().map(text).join(' '), async load() { render(); effect(); await flush(); } };
}

test('all categories select relatives and save one complete change set; explicit removal retains inference', async () => {
  const ui = fixture(); await ui.load();
  assert.match(ui.text(), /Archived/); assert.match(ui.text(), /Shared parents\s*:\s*Parent Person/);
  await ui.press('Remove: Sibling Person (Siblings)');
  assert.match(ui.text(), /Shared parents/);
  for (const category of ['Parents', 'Spouse', 'Children', 'Siblings']) { await ui.press(`Add: ${category}`); await ui.press('Match Person'); }
  await ui.press('Save family');
  assert.deepEqual(ui.saves, [['0', 5, { parentIds: ['1', '3'], spouseId: '3', childIds: ['3'], siblingIds: ['3'] }]]);
  assert.equal(ui.exits, 1);
});

test('inline creation validates fields, suggests same names, permits creating anyway and preserves original edits', async () => {
  const ui = fixture(); await ui.load(); await ui.press('Add: Spouse'); await ui.press('Create member');
  await ui.press('Create and select'); assert.equal(ui.creates.length, 0); assert.match(ui.text(), /Enter first name/);
  ui.input('First name', 'Match'); ui.input('Last name', 'Person');
  assert.match(ui.text(), /Members with matching names/);
  await ui.press('Female'); await ui.press('Create and select');
  assert.deepEqual(ui.creates, [{ name: 'Match Person', gender: 'female' }]);
  await ui.press('Save family');
  assert.deepEqual(ui.saves[0][2], { parentIds: ['1'], spouseId: 'new', childIds: [], siblingIds: ['2'] });
});

test('choosing matching existing record avoids creation, and cancel never writes relationships', async () => {
  const ui = fixture(); await ui.load(); await ui.press('Add: Children'); await ui.press('Create member');
  ui.input('First name', 'Match'); ui.input('Last name', 'Person'); await ui.press('Match Person');
  assert.equal(ui.creates.length, 0); await ui.press('Cancel'); assert.equal(ui.saves.length, 0);
  const created = fixture(); await created.load(); await created.press('Add: Siblings'); await created.press('Create member');
  created.input('First name', 'New'); created.input('Last name', 'Person'); await created.press('Male'); await created.press('Create and select');
  await created.press('Cancel'); assert.equal(created.creates.length, 1); assert.equal(created.saves.length, 0);
});

test('conflict requires refresh; ordinary failures retain changes for retry', async () => {
  const ui = fixture({ failure: { code: '40001' } }); await ui.load(); await ui.press('Remove: Parent Person (Archived) (Parents)'); await ui.press('Save family');
  assert.match(ui.text(), /Family relationships changed/);
  assert.equal(ui.render().find(n => n.props?.accessibilityLabel === 'Save family').props.disabled, true);
  await ui.press('Refresh and discard edits'); assert.equal(ui.reads, 2); assert.match(ui.text(), /Remove: Parent Person/);
  const retry = fixture({ failure: new Error('offline') }); await retry.load(); await retry.press('Remove: Parent Person (Archived) (Parents)'); await retry.press('Save family'); await retry.press('Save family');
  assert.equal(retry.saves.length, 2); assert.deepEqual(retry.saves[1][2].parentIds, []);
});

test('Ukrainian editor exposes neutral categories and archived labels', async () => {
  const ui = fixture({ locale: 'uk' }); await ui.load();
  for (const label of ['Батьки', 'Подружжя', 'Діти', 'Брати та сестри', 'Архівний запис']) assert.ok(ui.text().includes(label));
});

test('inline creation is available in every category', async () => {
  for (const [category, key] of [['Parents', 'parentIds'], ['Spouse', 'spouseId'], ['Children', 'childIds'], ['Siblings', 'siblingIds']]) {
    const ui = fixture(); await ui.load(); await ui.press(`Add: ${category}`); await ui.press('Create member');
    ui.input('First name', 'New'); ui.input('Last name', 'Relative'); await ui.press('Female'); await ui.press('Create and select'); await ui.press('Save family');
    assert.ok(key === 'spouseId' ? ui.saves[0][2][key] === 'new' : ui.saves[0][2][key].includes('new'));
  }
});

test('relationship validation identifies correction and preserves selections', async () => {
  for (const [message, expected] of [['Selected member already has a spouse', /Remove the existing spouse connection first/], ['Parent connections cannot create an ancestry cycle', /Correct the selected parents or children/]]) {
    const ui = fixture({ failure: new Error(message) }); await ui.load(); await ui.press('Save family');
    assert.match(ui.text(), expected); assert.equal(ui.exits, 0);
  }
});
