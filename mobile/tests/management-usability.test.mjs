import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/features/manage/AccountDetailScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const flush = () => new Promise(setImmediate);
const text = (node) => node == null ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);

function accountFixture({ failRoleOnce = false } = {}) {
  const states = [], refs = [], actions = [];
  let cursor = 0, refCursor = 0, focus;
  const account = { id: 'account', name: 'Account Person', email: 'a@example.test', status: 'pending', role: 'member', personId: null };
  const repository = {
    async loadAccount() { return { accounts: [account], members: [] }; },
    async apply(state, action) {
      actions.push(action);
      if (failRoleOnce && action.type === 'set-account-role') { failRoleOnce = false; throw new Error('offline'); }
      const next = { ...state, accounts: [{ ...state.accounts[0], [action.type === 'set-account-status' ? 'status' : 'role']: action.status ?? action.role }] };
      return next;
    },
  };
  const hooks = { ...React,
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useCallback: (callback) => callback,
  };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { ActivityIndicator: 'Spinner', Pressable: 'Button', ScrollView: 'Scroll', View: 'View', StyleSheet: { create: (styles) => styles } }],
    ['expo-router', { useFocusEffect: (callback) => { focus = callback; }, useLocalSearchParams: () => ({ accountId: 'account' }), usePathname: () => '/manage/account/account', useRouter: () => ({ replace() {}, push() {} }) }],
    ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => false }],
    ['@/features/platform/alert', { Alert: { alert() {} } }],
    ['@/features/accessibility/app-text', { Text: 'Text' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale: 'en' }) }],
    ['@/features/account/account-deletion', { adminDeleteHref: () => '/delete' }],
    ['@/features/members/ProfileAvatar', { ProfileAvatar: 'Avatar' }],
    ['./management-repository', { managementRepository: repository }],
    ['./route-params', { managedAccountHref: () => '/manage/account/account', resolveAccountId: (id) => id }],
    ['./LastSeen', { LastSeen: 'LastSeen' }],
    ['./use-unsaved-changes', { useUnsavedChanges: () => ({ allowLeave() {}, confirmLeave(callback) { callback(); } }) }],
  ]);
  const exports = {};
  new Function('require', 'exports', code)((id) => { assert.ok(modules.has(id), id); return modules.get(id); }, exports);
  function render() { cursor = 0; refCursor = 0; const nodes = []; const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); nodes.push(node); walk(node.props?.children); }; walk(exports.AccountDetailScreen()); return nodes; }
  const press = (label) => { const button = render().find((node) => node.type === 'Button' && text(node) === label); assert.ok(button, label); assert.equal(button.props.disabled, false); button.props.onPress(); };
  return { render, press, actions, async load() { render(); focus(); await flush(); } };
}

test('account choices remain drafts until Save, then both changes persist once', async () => {
  const ui = accountFixture(); await ui.load();
  ui.press('Active'); ui.press('Administrator');
  assert.deepEqual(ui.actions, []);
  ui.press('Save account'); await flush();
  assert.deepEqual(ui.actions.map((action) => action.type), ['set-account-status', 'set-account-role']);
  assert.ok(ui.render().some((node) => text(node) === 'Account saved.'));
  assert.equal(ui.render().find((node) => node.type === 'Button' && text(node) === 'Save account').props.disabled, true);
});

test('a partial account save reports which choices still need a retry', async () => {
  const ui = accountFixture({ failRoleOnce: true }); await ui.load();
  ui.press('Active'); ui.press('Administrator'); ui.press('Save account'); await flush();
  assert.ok(ui.render().some((node) => text(node).includes('Some account changes were saved')));
  ui.press('Save account'); await flush();
  assert.deepEqual(ui.actions.map((action) => action.type), ['set-account-status', 'set-account-role', 'set-account-role']);
  assert.ok(ui.render().some((node) => text(node) === 'Account saved.'));
});

test('dirty navigation offers keep editing or discard, and web unload uses the browser warning', async () => {
  const guardSource = await readFile(new URL('../src/features/manage/use-unsaved-changes.ts', import.meta.url), 'utf8');
  const guardCode = ts.transpileModule(guardSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const webSource = await readFile(new URL('../src/features/manage/use-browser-exit-warning.web.ts', import.meta.url), 'utf8');
  const webCode = ts.transpileModule(webSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dialogs = [], listeners = new Map(), dispatched = [], restored = [];
  let preventRemove;
  const exports = {};
  const modules = new Map([
    ['react', { useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}], useEffect: (effect) => { effect(); } }],
    ['expo-router', { useNavigation: () => ({ dispatch: (action) => dispatched.push(action) }) }],
    ['expo-router/react-navigation', { usePreventRemove: (enabled, callback) => { preventRemove = enabled ? callback : null; } }],
    ['./use-browser-exit-warning', { useBrowserExitWarning: (dirty, allowed) => webExports.useBrowserExitWarning(dirty, allowed) }],
    ['@/features/platform/alert', { Alert: { alert: (...args) => dialogs.push(args) } }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale: 'en' }) }],
  ]);
  const webExports = {};
  const browser = { location: { href: 'https://example.test/manage/member/new' }, history: { state: {}, pushState: (...args) => restored.push(args) }, addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name) => listeners.delete(name) };
  new Function('require', 'exports', 'window', webCode)((id) => modules.get(id), webExports, browser);
  new Function('require', 'exports', 'window', guardCode)((id) => modules.get(id), exports, { location: { href: 'https://example.test/manage/member/new' }, history: { state: {}, pushState: (...args) => restored.push(args) }, addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: (name) => listeners.delete(name) });
  exports.useUnsavedChanges(true);
  assert.ok(listeners.has('beforeunload'));
  let prevented = false;
  listeners.get('beforeunload')({ preventDefault() { prevented = true; }, returnValue: null });
  assert.equal(prevented, true);
  listeners.get('popstate')();
  assert.equal(restored[0][2], 'https://example.test/manage/member/new');
  preventRemove({ data: { action: { type: 'GO_BACK' } } });
  dialogs[0][2][0].onPress?.();
  assert.deepEqual(dispatched, []);
  dialogs[0][2][1].onPress();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(dispatched, [{ type: 'GO_BACK' }]);
});

test('account linking requires a selected member and an explicit Save', async () => {
  const linkSource = await readFile(new URL('../src/features/manage/MemberLinkScreen.tsx', import.meta.url), 'utf8');
  const linkCode = ts.transpileModule(linkSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const states = [], refs = [], actions = []; let cursor = 0, refCursor = 0, effect;
  const member = { id: 'member', name: 'Member Person', archived: false };
  const hooks = { ...React, useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; }, useMemo: (factory) => factory(), useRef: initial => refs[refCursor++] ??= { current: initial }, useEffect: (callback) => { effect = callback; } };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native-safe-area-context', { useSafeAreaInsets: () => ({ bottom: 0 }) }],
    ['react-native', { Platform: { OS: 'web' }, KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'Spinner', FlatList: ({ data, renderItem }) => React.createElement('List', {}, data.map((item) => renderItem({ item }))), Pressable: 'Button', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 }, View: 'View' }],
    ['expo-router', { useLocalSearchParams: () => ({ accountId: 'account' }), useRouter: () => ({ replace() {} }) }],
    ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => false }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale: 'en' }) }],
    ['@/features/accessibility/app-text', { Text: 'Text', TextInput: 'Input' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/members/ProfileAvatar', { ProfileAvatar: 'Avatar' }],
    ['@react-native-vector-icons/ionicons', { Ionicons: 'Icon' }],
    ['@/features/session/SessionProvider', { useSession: () => ({ status: 'ready', account: { id: 'admin', role: 'admin', status: 'active' } }) }],
    ['@/lib/permissions', { canManageAccounts: () => true }],
    ['@/lib/supabase', { isBackendConfigured: true }],
    ['@/lib/member-name', { formatMemberName: member => member.name }],
    ['@/lib/async-state', { errorMessage: String, withTimeout: promise => promise }],
    ['./use-management-search', { useManagementSearch: () => ({ query: '', committedQuery: '', setQuery() {} }) }],
    ['./use-management-list', { useManagementList: () => ({ items: [member], total: 1, error: null, loading: null }) }],
    ['./ManagementListParts', { ui: {}, ManagementSearch: 'Search', ManagementFeedback: 'Feedback', ManagementListFooter: 'Footer' }],
    ['./management-repository', { managementRepository: { loadAccount: async () => ({ members: [], accounts: [{ id: 'account', email: 'a@example.test' }] }), apply: async (_state, action) => { actions.push(action); } } }],
    ['./route-params', { managedAccountHref: () => '/manage/account/account', normalizeAccountId: (id) => id }],
    ['./use-unsaved-changes', { useUnsavedChanges: () => ({ allowLeave() {}, confirmLeave(callback) { callback(); } }) }],
  ]);
  const exports = {};
  new Function('require', 'exports', linkCode)((id) => { assert.ok(modules.has(id), id); return modules.get(id); }, exports);
  function render() { cursor = 0; refCursor = 0; const nodes = []; const walk = (node) => { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(walk); if (typeof node.type === 'function') return walk(node.type(node.props)); nodes.push(node); walk(node.props?.children); }; walk(exports.MemberLinkScreen()); return nodes; }
  render(); effect(); await flush();
  let nodes = render();
  assert.equal(nodes.find((node) => node.type === 'Button' && text(node) === 'Save link').props.disabled, true);
  nodes.find((node) => node.type === 'Button' && node.props.accessibilityRole === 'radio').props.onPress();
  assert.deepEqual(actions, []);
  nodes = render();
  nodes.find((node) => node.type === 'Button' && text(node) === 'Save link').props.onPress();
  await flush();
  assert.deepEqual(actions, [{ type: 'link-account', accountId: 'account', personId: 'member' }]);
});
