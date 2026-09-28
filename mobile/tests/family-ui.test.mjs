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
function fixture({ locale = 'en', failure = null, loadFamily } = {}) {
  const states = [], refs = []; let cursor = 0, refCursor = 0, effect, cleanup, dependencies, exits = 0, reads = 0, memberId = "0", scope = "account-a", createdId;
  const saves = [], routes = []; let handoff = null;
  const members = ['Subject Person', 'Parent Person', 'Sibling Person', 'Match Person'].map((name, index) => ({ id: String(index), name, archived: index === 1 }));
  const snapshot = { memberId: '0', revision: 5, parents: [members[1]], spouse: null, children: [], siblings: [{ ...members[2], explicit: true, supportingParents: [members[1]] }] };
  const repository = {
    async loadFamily(id) { reads++; return loadFamily ? loadFamily(id) : { ...snapshot, memberId: id }; }, async load() { return { members: [...members] }; },
    async saveFamily(...args) { saves.push(args); if (failure) throw failure; return snapshot; },
  };
  const modules = {
    react: { ...React, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; }, useRef(initial) { const i = refCursor++; return refs[i] ?? (refs[i] = { current: initial }); }, useEffect(callback, next) { if (!dependencies || next.some((value,i) => value !== dependencies[i])) { dependencies = next; effect = callback; } } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'expo-router': { useLocalSearchParams: () => ({ memberId, createdId }), useRouter: () => ({ canGoBack: () => true, back: () => exits++, replace: (path) => { routes.push(path); exits++; } }) },
    'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' },
    '@/features/accessibility/app-text': { Text: 'Text', TextInput: 'Input' },
    '@/features/appearance/AppearanceProvider': { useAppearance: () => ({ palette: {} }) },
    '@/features/localization/LocalizationProvider': { useLocalization: () => ({ locale }) },
    '@/features/family/family-copy': copy,
    '@/features/session/SessionProvider': { useSession: () => ({ status: 'ready' }) },
    '@/lib/session-cache': { sessionCacheScope: () => scope },
    './management-repository': { managementRepository: repository },
    './family-draft': { holdFamilyDraft: (draft) => { handoff = draft; }, takeFamilyDraft: (identity) => { const result = handoff?.identity === identity ? handoff : null; handoff = null; return result; }, clearFamilyDraft: () => { handoff = null; } },
    './use-unsaved-changes': { useUnsavedChanges: () => ({ allowLeave() {}, confirmLeave(callback) { callback(); } }) },
  };
  const exports = {}; new Function('require', 'exports', source)(id => { assert.ok(id in modules, id); return modules[id]; }, exports);
  const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  function render() { cursor = 0; refCursor = 0; const nodes = []; const walk = node => { if (Array.isArray(node)) return node.forEach(walk); if (!node || typeof node !== 'object') return; nodes.push(node); walk(node.props?.children); }; walk(exports.FamilyEditorScreen()); return nodes; }
  const flush = () => new Promise(setImmediate);
  async function press(label, index = 0) { const button = render().filter(n => n.type === 'Button' && n.props.accessibilityLabel === label)[index]; assert.ok(button, `Missing ${label}`); assert.ok(!button.props.disabled, `Disabled ${label}`); button.props.onPress(); await flush(); }
  function input(label, value) { const field = render().find(n => n.type === 'Input' && n.props.accessibilityLabel === label); assert.ok(field); field.props.onChangeText(value); }
  return { render, press, input, saves, routes, members, get exits() { return exits; }, get reads() { return reads; }, text: () => render().map(text).join(' '), async load() { render(); if(effect) { cleanup?.(); cleanup = effect(); effect = null; } await flush(); }, async route(id) { memberId = id; await this.load(); }, async session(id) { scope = id; await this.load(); }, async returnFromCreation(id) { if (id) members.push({ id, name: 'New Relative', archived: false }); createdId = id; dependencies = null; await this.load(); }, flush };
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

test('member creation uses the full form and restores the family draft with a selected relative', async () => {
  const ui = fixture(); await ui.load(); await ui.press('Remove: Sibling Person (Siblings)'); await ui.press('Add: Spouse');
  assert.ok(ui.text().includes('Save the new member on the next page'));
  await ui.press('Create member');
  assert.deepEqual(ui.routes, ['/manage/member/new?familyReturn=0']);
  await ui.returnFromCreation('new');
  await ui.press('Save family');
  assert.deepEqual(ui.saves[0][2], { parentIds: ['1'], spouseId: 'new', childIds: [], siblingIds: [] });
});

test('canceling member creation preserves the family draft without saving relationships', async () => {
  const ui = fixture(); await ui.load(); await ui.press('Add: Children'); await ui.press('Match Person');
  await ui.press('Add: Siblings'); await ui.press('Create member');
  await ui.returnFromCreation();
  assert.ok(ui.text().includes('Match Person'));
  assert.equal(ui.saves.length, 0);
  await ui.press('Cancel');
  assert.equal(ui.saves.length, 0);
});

test('canceling family edits after member creation leaves the created member in the directory', async () => {
  const ui = fixture(); await ui.load(); await ui.press('Add: Parents'); await ui.press('Create member');
  await ui.returnFromCreation('new');
  await ui.press('Cancel');
  assert.ok(ui.members.some((member) => member.id === 'new'));
  assert.equal(ui.saves.length, 0);
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

test('full member creation returns with the new member selected in every category', async () => {
  for (const [category, key] of [['Parents', 'parentIds'], ['Spouse', 'spouseId'], ['Children', 'childIds'], ['Siblings', 'siblingIds']]) {
    const ui = fixture(); await ui.load(); await ui.press(`Add: ${category}`); await ui.press('Create member');
    await ui.returnFromCreation('new'); await ui.press('Save family');
    assert.ok(key === 'spouseId' ? ui.saves[0][2][key] === 'new' : ui.saves[0][2][key].includes('new'));
  }
});

test('relationship validation identifies correction and preserves selections', async () => {
  for (const [kind, expected] of [['spouse', /Remove the existing spouse connection first/], ['cycle', /Correct the selected parents or children/], ['self', /cannot be their own relative/]]) {
    const ui = fixture({ failure: Object.assign(new Error('Arbitrary server wording'), { kind }) }); await ui.load(); await ui.press('Save family');
    assert.match(ui.text(), expected); assert.equal(ui.exits, 0);
  }
});

const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve=yes; reject=no; }); return { promise, resolve, reject }; };
const emptySnapshot = memberId => ({memberId,revision:5,parents:[],spouse:null,children:[],siblings:[]});
test('failed member transitions clear prior relationships and cannot save the old snapshot', async()=>{
 const ui=fixture({ loadFamily: async id => { if(id==='1') throw new Error('Unavailable'); return emptySnapshot(id); } });
 await ui.load(); await ui.route('1');
 assert.match(ui.text(),/Unable to load family/); assert.doesNotMatch(ui.text(),/Save family/); assert.deepEqual(ui.saves,[]);
});
test('out-of-order member loads cannot change the current editor',async()=>{
 const old=deferred();
 const ui=fixture({loadFamily: id=>id==='0'?old.promise:Promise.resolve(emptySnapshot(id))});
 await ui.load(); await ui.route('1'); old.resolve(emptySnapshot('0')); await ui.flush();
 await ui.press('Save family'); assert.equal(ui.saves[0][0],'1');
 await ui.route('2'); await ui.flush();
 await ui.press('Save family'); assert.equal(ui.saves[1][0],'2'); assert.equal(ui.saves[1][2].spouseId,null);
});
test('account changes discard an outstanding member response',async()=>{
 const old=deferred(); let calls=0;
 const ui=fixture({loadFamily:()=>++calls===1?old.promise:Promise.resolve(emptySnapshot('0'))});
 await ui.load(); await ui.session('account-b'); old.resolve({...emptySnapshot('0'),spouse:{id:'private',name:'Previous account relative'}}); await ui.flush();
 assert.doesNotMatch(ui.text(),/Previous account relative/); await ui.press('Save family'); assert.equal(ui.saves[0][2].spouseId,null);
});
