import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/features/directory/DirectoryScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function directoryFixture() {
  const members = [
    { id: 'male-orphan', name: 'Alex Alpha', gender: 'male', isOrphan: true },
    { id: 'female-other', name: 'Beth Beta', gender: 'female', isOrphan: false },
    { id: 'male-other', name: 'Carl Gamma', gender: 'male', isOrphan: false },
    { id: 'female-orphan', name: 'Dana Delta', gender: 'female', isOrphan: true },
  ].map((member) => ({ ministry: '', ministryUk: '', avatar: {}, phone: null, leadershipMinistry: null, isWidow: false, membershipGroupId: 'group', ...member }));
  const states = [];
  let cursor = 0;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect() {},
    useMemo: (factory) => factory(),
  };
  const modules = new Map([
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { Platform: { OS: 'web' }, Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', SectionList: 'SectionList', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 }, View: 'View' }],
    ['react-native-safe-area-context', { useSafeAreaInsets: () => ({ top: 0 }) }],
    ['@react-native-vector-icons/ionicons', { Ionicons: 'Icon' }],
    ['expo-router', { Link: 'Link', useRouter: () => ({ push() {} }) }],
    ['@/features/accessibility/app-text', { Text: 'Text', TextInput: 'TextInput' }],
    ['@/lib/use-warm-resource', { useWarmResource: () => ({ data: { members, visits: 0 }, status: 'ready', refresh() {} }) }],
    ['@/features/shell/ResourceRefresh', { ResourceRefresh: 'ResourceRefresh' }],
    ['@/features/appearance/AppearanceProvider', { useAppearance: () => ({ palette: {} }) }],
    ['@/features/shell/WebTabBar', { WebTabBar: 'WebTabBar' }],
    ['@/features/shell/use-desktop-layout', { useDesktopLayout: () => false }],
    ['@/features/localization/LocalizationProvider', { useLocalization: () => ({ locale: 'en', copy: { directory: { title: 'Directory', searchLabel: 'Search members', search: 'Search', emptyTitle: 'No members', emptyDetail: 'No matches' } } }) }],
    ['@/features/members/care-status-badges', { CareStatusBadges: 'CareStatusBadges' }],
    ['@/features/members/leadership-badge', { LeadershipBadge: 'LeadershipBadge' }],
    ['@/features/members/ProfileAvatar', { ProfileAvatar: 'ProfileAvatar' }],
    ['@/lib/phone', { formatPhoneNumber: (value) => value }],
    ['@/lib/member-name', { formatMemberName: (value) => typeof value === "string" ? value : value.name }],
    ['./directory-repository', { listDirectory() {}, getDirectoryVisitCount() {} }],
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
      if (typeof node.type === 'function' && node.type !== exports.MemberRow) { walk(node.type(node.props)); return; }
      nodes.push(node);
      walk(node.props?.children);
    }
    walk(exports.DirectoryScreen());
    return nodes;
  }
  const text = (node) => node == null ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
  const ids = (nodes) => nodes.filter((node) => node.type === exports.MemberRow).map((node) => node.props.item.id);
  const checkbox = (nodes, label) => nodes.find((node) => node.props?.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === label);
  const button = (nodes, label) => nodes.find((node) => node.type === 'Pressable' && (node.props.accessibilityLabel === label || text(node) === label));
  return { render, ids, text, checkbox, button };
}

test('Directory checkbox presses keep match-any membership, clear, and update the count', () => {
  const ui = directoryFixture();
  let nodes = ui.render();
  assert.equal(ui.ids(nodes).length, 4);
  assert.doesNotMatch(nodes.map(ui.text).join(' '), /Showing \d+ of/);
  ui.button(nodes, 'Filters').props.onPress();
  nodes = ui.render();
  ui.checkbox(nodes, 'Female').props.onPress();
  nodes = ui.render();
  assert.equal(ui.checkbox(nodes, 'Female').props['aria-checked'], true);
  assert.deepEqual(ui.ids(nodes), ['female-other', 'female-orphan']);
  assert.match(nodes.map(ui.text).join(' '), /Showing 2 of 4 members/);
  ui.checkbox(nodes, 'Orphans').props.onPress();
  nodes = ui.render();
  assert.deepEqual(ui.ids(nodes), ['male-orphan', 'female-other', 'female-orphan']);
  assert.match(nodes.map(ui.text).join(' '), /Showing 3 of 4 members/);
  ui.checkbox(nodes, 'Female').props.onPress();
  nodes = ui.render();
  assert.deepEqual(ui.ids(nodes), ['male-orphan', 'female-orphan']);
  ui.button(nodes, 'Clear').props.onPress();
  nodes = ui.render();
  assert.equal(ui.ids(nodes).length, 4);
  assert.doesNotMatch(nodes.map(ui.text).join(' '), /Showing \d+ of/);
  ui.checkbox(nodes, 'Male').props.onPress();
  nodes = ui.render();
  ui.checkbox(nodes, 'Female').props.onPress();
  nodes = ui.render();
  assert.equal(ui.ids(nodes).length, 4);
  assert.match(nodes.map(ui.text).join(' '), /Showing 4 of 4 members/);
});
