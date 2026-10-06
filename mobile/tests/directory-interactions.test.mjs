import * as memberSearch from "../src/lib/member-search.ts";
import * as directoryOrder from "../src/features/directory/directory-order.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const ts = require('typescript');
const source = await readFile(new URL('../src/features/directory/DirectoryScreen.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function directoryFixture(platform = "web", people, leadershipMinistry = null) {
  const members = (people ?? [
    { id: 'male-orphan', name: 'Alex Alpha', gender: 'male', isOrphan: true },
    { id: 'female-other', name: 'Beth Beta', gender: 'female', isOrphan: false },
    { id: 'male-other', name: 'Carl Gamma', gender: 'male', isOrphan: false },
    { id: 'female-orphan', name: 'Dana Delta', gender: 'female', isOrphan: true },
  ]).map((member) => ({ ministry: '', ministryUk: '', avatar: {}, phone: null, leadershipMinistry: null, isWidow: false, membershipGroupId: 'group', ...member }));
  const states = [];
  let cursor = 0;
  const hooks = { ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect() {},
    useRef: (value) => ({ current: value }),
    useMemo: (factory) => factory(),
  };
  const modules = new Map([
    ["@/features/session/SessionProvider", { useSession: () => ({ status: "ready", account: { status: "active", leadershipMinistry } }) }],
    ["@/lib/member-search", memberSearch],
    ['react', hooks], ['react/jsx-runtime', require('react/jsx-runtime')],
    ['react-native', { Platform: { OS: platform }, Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', SectionList: 'SectionList', StyleSheet: { create: (styles) => styles, flatten: styles=>Object.assign({},...styles), hairlineWidth: 1 }, View: 'View' }],
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
    ['./directory-order', directoryOrder],
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
  return { render, ids, text, checkbox, button, row: (props) => exports.MemberRow(props), search: (query) => { states[0] = query; states[1] = query; } };
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

test('Directory uses explicit surnames, Cyrillic lookalikes and Latin sections after Ukrainian names',()=>{
  const names=[{name:'Andrew Waltmen',last_name:'Waltmen'},{name:'Микола Cавчук',last_name:'Cавчук'},{name:'Олег Pощук',last_name:'Pощук'},{name:'Анна Романюк',last_name:'Романюк'},{name:'Олена Савчук',last_name:'Савчук'},{name:'Іван Яремчук',last_name:'Яремчук'},{name:'Mary Van Buren',last_name:'Van Buren'}];
  const ordered=names.map(member=>({member,surname:directoryOrder.directorySurname(member)})).sort(directoryOrder.compareDirectoryNames);
  assert.deepEqual(ordered.map(row=>row.surname),['Романюк','Рощук','Савчук','Савчук','Яремчук','Van Buren','Waltmen']);
  assert.equal(directoryOrder.directorySurname({name:'Mary Van Buren',last_name:'Van Buren'}),'Van Buren');
  assert.equal(directoryOrder.directorySurname({name:'Andrew Waltmen'}),'Waltmen');
});

test('shared member row uses selection controls without navigating to a profile',()=>{
 const ui=directoryFixture();let presses=0;
 const item={id:'selected',name:'Full Member Name',avatar:{},ministry:'',ministryUk:'',phone:null,leadershipMinistry:null,isOrphan:false,isWidow:false};
 const row=ui.row({item,locale:'en',ministry:'',fullName:true,compact:true,selection:{checked:true,label:'Select full member',mode:'checkbox'},onPress:()=>presses++});
 assert.equal(row.type,'Pressable');assert.equal(row.props.accessibilityRole,'checkbox');assert.equal(row.props.accessibilityState.checked,true);assert.equal(row.props['aria-checked'],true);
 assert.equal(row.props.accessibilityLabel,'Select full member');row.props.onPress();assert.equal(presses,1);
 const profile=ui.row({item,locale:'en',ministry:'',onPress:()=>{}});assert.equal(profile.type,'Link');assert.equal(profile.props.href,'/members/selected');
 const remove=ui.row({item,locale:'en',ministry:'',selection:{checked:true,label:'Remove relative',mode:'remove',disabled:true},onPress:()=>{}});
 assert.equal(remove.props.accessibilityRole,'button');assert.equal(remove.props.disabled,true);
});

test('surname index jumps the roster to the measured section without opening a member',()=>{
  const ui=directoryFixture(),nodes=ui.render(),scrolls=[];
  const roster=nodes.find(node=>node.props?.testID==='directory-scroll');
  roster.props.ref.current={scrollTo:args=>scrolls.push(args)};
  const sections=nodes.filter(node=>node.props?.onLayout && node.key !== null);
  sections.forEach((node,index)=>node.props.onLayout({nativeEvent:{layout:{y:index*100}}}));
  ui.button(nodes,'Jump to last names starting with G').props.onPress();
  assert.deepEqual(scrolls,[{y:300,animated:false}]);
});


test('native surname index jumps to the requested section and retries an unmeasured section',async()=>{
  const ui=directoryFixture('ios'),nodes=ui.render(),jumps=[],estimates=[];
  const list=nodes.find(node=>node.type==='SectionList');
  list.props.ref.current={scrollToLocation:args=>jumps.push(args),getScrollResponder:()=>({scrollTo:args=>estimates.push(args)})};
  ui.button(nodes,'Jump to last names starting with G').props.onPress();
  assert.deepEqual(jumps,[{sectionIndex:3,itemIndex:0,viewPosition:0,animated:false}]);
  list.props.onScrollToIndexFailed({averageItemLength:80,index:100});
  assert.deepEqual(estimates,[{y:8000,animated:false}]);
  await new Promise(resolve=>setTimeout(resolve,180));
  assert.deepEqual(jumps[1],{sectionIndex:3,itemIndex:0,animated:true});
});

 test('dragging the surname index scrubs the roster without animated queues',()=>{
  const ui=directoryFixture(),nodes=ui.render(),scrolls=[];
  nodes.find(node=>node.props?.testID==='directory-scroll').props.ref.current={scrollTo:args=>scrolls.push(args)};
  nodes.filter(node=>node.props?.onLayout && node.key !== null).forEach((node,index)=>node.props.onLayout({nativeEvent:{layout:{y:index*100}}}));
  const rail=nodes.find(node=>node.props?.testID==='directory-alphabet-index');
  rail.props.ref.current={measureInWindow:callback=>callback(0,100,30,80)};
  rail.props.onResponderGrant({nativeEvent:{pageY:101}});
  rail.props.onResponderMove({nativeEvent:{pageY:179}});
  rail.props.onResponderMove({nativeEvent:{pageY:178}});
  rail.props.onResponderMove({nativeEvent:{pageY:121}});
  assert.deepEqual(scrolls,[{y:0,animated:false},{y:300,animated:false},{y:100,animated:false}]);
 });

test('exact name matches and prefixes form subtle search sections without a surname index',()=>{
 const people=[{id:'prefix',name:'Alexi Alpha'},{id:'exact',name:'Alex Zulu'},{id:'inside',name:'Calex Beta'}];
 for(const platform of ['web','ios']) {
  const ui=directoryFixture(platform,people);ui.search('Alex');let nodes=ui.render();
  assert.deepEqual(ui.ids(nodes),platform==='web'?['exact','prefix']:[]);
  assert.equal(nodes.some(node=>node.props?.testID==='directory-alphabet-index'),false);
  const list=nodes.find(node=>node.type==='SectionList');
  if(list) assert.deepEqual(list.props.sections.map(section=>[section.title,section.data.map(person=>person.id)]),[['Top matches',['exact']],['Other results',['prefix']]]);
  else assert.deepEqual(nodes.filter(node=>node.type==='Text'&&['Top matches','Other results'].includes(ui.text(node))).map(ui.text),['Top matches','Other results']);
  ui.search('Al');nodes=ui.render();
  if(platform==='ios') assert.deepEqual(nodes.find(node=>node.type==='SectionList').props.sections.map(section=>section.title),['Top matches']);
  else assert.equal(nodes.some(node=>ui.text(node)==='Other results'),false);
  ui.search('NoMatch');nodes=ui.render();
  assert.equal(nodes.some(node=>ui.text(node)==='Top matches'),false);
 }
});

test('totals are inside the scrollable footer and remain full width',()=>{
 const ui=directoryFixture(),nodes=ui.render();
 const scroll=nodes.find(node=>node.props?.testID==='directory-scroll');
 assert.equal(scroll.props.contentContainerStyle.paddingRight,undefined);
 assert.equal(scroll.props.children.at(-1).props.children.props.testID,'directory-summary');
 const native=directoryFixture('ios').render().find(node=>node.type==='SectionList');
 assert.equal(native.props.ListFooterComponent.props.children.props.testID,'directory-summary');
});

test('totals disappear immediately on any search input and return after clearing',()=>{
 for(const platform of ['web','ios']) {
  const ui=directoryFixture(platform);ui.render();
  for(const query of ['Alex','NoMatch','!']) {
   ui.search(query);const nodes=ui.render();
   if(platform==='web') assert.equal(nodes.some(node=>node.props?.testID==='directory-summary'),false);
   else assert.equal(nodes.find(node=>node.type==='SectionList').props.ListFooterComponent,null);
  }
  ui.search('');const nodes=ui.render();
  if(platform==='web') assert.ok(nodes.some(node=>node.props?.testID==='directory-summary'));
  else assert.ok(nodes.find(node=>node.type==='SectionList').props.ListFooterComponent);
 }
});

test('clear search restores the full directory and totals in one press',()=>{
 const ui=directoryFixture();ui.search('Alex');let nodes=ui.render();
 assert.deepEqual(ui.ids(nodes),['male-orphan']);
 ui.button(nodes,'Clear search').props.onPress();nodes=ui.render();
 assert.equal(ui.ids(nodes).length,4);
 assert.ok(nodes.some(node=>node.props?.testID==='directory-summary'));
 assert.equal(ui.button(nodes,'Clear search'),undefined);
 assert.equal(nodes.find(node=>node.type==='TextInput').props.value,'');
});

 test('notes filter and row indicator are available for leaders and only match visible notes', () => {
   const people = [{ id: 'note', name: 'With Note', hasNote: true }, { id: 'plain', name: 'Without Note' }];
   const ui = directoryFixture('web', people, 'deacon');
   let nodes = ui.render();
   ui.button(nodes, 'Filters').props.onPress();
   nodes = ui.render();
   ui.checkbox(nodes, 'Has a note').props.onPress();
   assert.deepEqual(ui.ids(ui.render()), ['note']);
   const row = ui.row({ item: { ...people[0], name: 'Member', avatar: {} }, locale: 'en', ministry: '', onPress() {} });
   assert.doesNotMatch(ui.text(row), /Note/);
   const rowContent = row.type === 'Link' ? row.props.children : row;
   const indicator = rowContent.props.children.find(node => node?.props?.testID === 'member-note-indicator');
   assert.equal(indicator.props.accessibilityLabel, 'Has a note');
   assert.equal(indicator.props.children.props.name, 'document-text-outline');
   assert.equal(indicator.props.children.props.size, 18);
   assert.equal(rowContent.props.children.at(-2), indicator);
   const member = directoryFixture();
   member.button(member.render(), 'Filters').props.onPress();
   assert.equal(member.checkbox(member.render(), 'Has a note'), undefined);
 });
