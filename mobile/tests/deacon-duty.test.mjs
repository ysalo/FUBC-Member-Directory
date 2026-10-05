import test from 'node:test';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildRotation,
  currentPeriod,
  fridayBeforeSunday,
  moveCandidate,
  includedCandidates,
  moveIncludedCandidate,
  nextPeriodForPerson,
  periodsByMonth,
  periodsForPerson,
  sortCandidatesByLastName,
  sundaysInYear,
  surnameKey,
  visibleSchedulePeriods,
  weekendLabel,
} from '../src/features/duty/duty-domain.ts';

test('sundaysInYear enumerates every Sunday in chronological weekly order', () => {
  for (const year of [2023, 2026, 2028]) {
    const sundays = sundaysInYear(year);
    assert.ok(sundays.length === 52 || sundays.length === 53, `expected 52 or 53 Sundays, got ${sundays.length}`);
    assert.ok(sundays.every((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0));
    for (let index = 1; index < sundays.length; index += 1) {
      const days = (Date.parse(`${sundays[index]}T00:00:00Z`) - Date.parse(`${sundays[index - 1]}T00:00:00Z`)) / 86_400_000;
      assert.equal(days, 7);
    }
  }
});

test('fridayBeforeSunday is always two calendar days earlier, across month and year boundaries', () => {
  assert.equal(fridayBeforeSunday('2026-09-20'), '2026-09-18');
  assert.equal(fridayBeforeSunday('2026-03-01'), '2026-02-27');
  assert.equal(fridayBeforeSunday('2027-01-03'), '2027-01-01');
});

test('weekendLabel capitalizes Ukrainian month names', () => {
  assert.match(weekendLabel('2026-09-18', '2026-09-20', 'uk'), /Вер\./);
  assert.match(weekendLabel('2026-09-30', '2026-10-02', 'uk'), /Вер\..*Жовт\./);
});

test('surnameKey and sortCandidatesByLastName order deacons alphabetically by surname', () => {
  assert.equal(surnameKey('Ігор Андрусенко'), 'Андрусенко');
  const sorted = sortCandidatesByLastName([
    { personId: 'a', name: 'Віталій Величко' },
    { personId: 'b', name: 'Ігор Андрусенко' },
    { personId: 'c', name: 'Володимир Борсук' },
  ], 'uk');
  assert.deepEqual(sorted.map((c) => c.personId), ['b', 'c', 'a']);
});

test('moveCandidate changes the rotation order by one position and respects boundaries', () => {
  const candidates = [
    { personId: 'a', name: 'A' },
    { personId: 'b', name: 'B' },
    { personId: 'c', name: 'C' },
  ];
  assert.deepEqual(moveCandidate(candidates, 'b', -1).map((candidate) => candidate.personId), ['b', 'a', 'c']);
  assert.deepEqual(moveCandidate(candidates, 'b', 1).map((candidate) => candidate.personId), ['a', 'c', 'b']);
  assert.deepEqual(moveCandidate(candidates, 'a', -1), candidates);
  assert.deepEqual(moveCandidate(candidates, 'c', 1), candidates);
});

test('buildRotation wraps an ordered candidate list across every Sunday of the year', () => {
  const candidates = [
    { personId: 'one', name: 'One' },
    { personId: 'two', name: 'Two' },
    { personId: 'three', name: 'Three' },
  ];
  const rotation = buildRotation(2026, candidates);
  assert.equal(rotation.length, sundaysInYear(2026).length);
  assert.equal(rotation[0].personId, 'one');
  assert.equal(rotation[1].personId, 'two');
  assert.equal(rotation[2].personId, 'three');
  assert.equal(rotation[3].personId, 'one');
  assert.ok(rotation.every((period) => period.revision === 0));
});

test('buildRotation with no candidates produces no periods', () => {
  assert.deepEqual(buildRotation(2026, []), []);
});

test('currentPeriod and nextPeriodForPerson resolve from the Friday through the Sunday', () => {
  const periods = buildRotation(2026, [
    { personId: 'a', name: 'A' },
    { personId: 'b', name: 'B' },
  ]);
  assert.equal(currentPeriod(periods, '2026-09-19')?.sundayOn, '2026-09-20');
  assert.equal(currentPeriod(periods, '2026-09-21'), null);
  const next = nextPeriodForPerson(periods, 'a', '2026-09-19');
  assert.ok(next);
  assert.ok(next.sundayOn > '2026-09-20');
});

test('periodsByMonth groups chronologically by calendar month', () => {
  const periods = buildRotation(2026, [{ personId: 'a', name: 'A' }]);
  const groups = periodsByMonth(periods);
  assert.equal(groups[0].month, '2026-01');
  assert.ok(groups.every((group, index) => index === 0 || group.month > groups[index - 1].month));
});

test('periodsForPerson filters the full schedule and preserves Everyone', () => {
  const periods = buildRotation(2026, [
    { personId: 'a', name: 'A' },
    { personId: 'b', name: 'B' },
  ]);
  const filtered = periodsForPerson(periods, 'a');
  assert.ok(filtered.length > 1);
  assert.ok(filtered.every((period) => period.personId === 'a'));
  assert.deepEqual(periodsForPerson(periods, null), periods);
});

test('visibleSchedulePeriods hides elapsed weekends but keeps the current Friday through Sunday', () => {
  const periods = [
    { sundayOn: '2026-09-06', personId: 'a', revision: 0 },
    { sundayOn: '2026-09-20', personId: 'b', revision: 0 },
    { sundayOn: '2026-09-27', personId: 'a', revision: 0 },
  ];
  assert.deepEqual(
    visibleSchedulePeriods(periods, '2026-09-18', false).map((period) => period.sundayOn),
    ['2026-09-20', '2026-09-27'],
  );
  assert.deepEqual(
    visibleSchedulePeriods(periods, '2026-09-20', false).map((period) => period.sundayOn),
    ['2026-09-20', '2026-09-27'],
  );
  assert.deepEqual(visibleSchedulePeriods(periods, '2026-09-21', false).map((period) => period.sundayOn), ['2026-09-27']);
  assert.deepEqual(visibleSchedulePeriods(periods, '2026-09-21', true), periods);
});

test('Visitation is hidden from native and web navigation', async () => {
  const [nativeLayout, webTabBar, webShell] = await Promise.all([
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebTabBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebAppShell.web.tsx', import.meta.url), 'utf8'),
  ]);
  for (const source of [nativeLayout, webTabBar, webShell]) {
    assert.doesNotMatch(source, /name="visitation"|labelKey: "visitation"|key: "visitation"|useActiveVisitationCount/);
  }
});

test('the schedule tab is registered as /schedule everywhere, not /duty', async () => {
  const [nativeLayout, webTabBar, webShell, localization] = await Promise.all([
    readFile(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebTabBar.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/shell/WebAppShell.web.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/localization/LocalizationProvider.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(nativeLayout, /name="schedule">/);
  assert.match(webTabBar, /labelKey: "schedule", path: "\/schedule"/);
  assert.match(webShell, /key: "schedule", href: "\/schedule"/);
  assert.match(localization, /schedule: "Schedule"/);
  assert.match(localization, /schedule: "Розклад"/);
  for (const source of [nativeLayout, webTabBar, webShell]) assert.doesNotMatch(source, /"\/duty"|name="duty"|labelKey: "duty"/);
});

test('schedule deacons use the shared Manage-style member card', async () => {
  const [schedule, deaconRow, directory] = await Promise.all([
    readFile(new URL('../src/features/duty/DutyScheduleScreen.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/duty/DeaconRow.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/directory/DirectoryScreen.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(schedule, /<DeaconRow avatar=\{avatar\} card locale=\{locale\}/);
  assert.doesNotMatch(schedule, /personCard:/);
  assert.match(deaconRow, /card: \{ borderCurve: "continuous", borderRadius: 14, borderWidth: StyleSheet\.hairlineWidth, gap: 11, minHeight: 70, padding: 12 \}/);
  assert.match(deaconRow, /name: \{ fontSize: 16, fontWeight: "700" \}/);
  assert.match(deaconRow, /detail: \{ fontSize: 13, lineHeight: 18, marginTop: 2 \}/);
  assert.doesNotMatch(deaconRow, /emphasizeDetail|emphasizedDetail/);
  assert.match(schedule, /yourNext: "My next duty"/);
  assert.match(schedule, /styles\.alertDate[\s\S]*weekendLabel\(fridayBeforeSunday\(viewerNext\.sundayOn\), viewerNext\.sundayOn, locale\)/);
  assert.doesNotMatch(schedule, /avatar=\{viewerMember|name=\{viewerMember|personId=\{viewerPersonId\}/);
  assert.match(schedule, /alertDate: \{ fontSize: 32, fontWeight: "800", lineHeight: 38 \}/);
  assert.doesNotMatch(schedule, /styles\.todayCard|\{copy\.today\}/);
  assert.doesNotMatch(directory, /DutySummary/);
  assert.doesNotMatch(deaconRow, /Link asChild|Platform\.OS === "web"/);
  assert.match(deaconRow, /accessibilityRole="button"\s+onPress=\{onPress\}/);
  assert.match(schedule, /monthIndex > 0 \? <View style=\{\[styles\.monthSeparator/);
  assert.match(schedule, /remainingPeriods = [\s\S]*state\.year!\.periods\.filter\(\(period\) => period\.sundayOn !== active\?\.sundayOn\)/);
  assert.match(schedule, /periodsForPerson\(remainingPeriods, filterPersonId\)/);
  assert.match(schedule, /visibleSchedulePeriods\(filteredPeriods, today, showPastDates\)/);
  assert.match(schedule, /viewerNext = .*nextPeriodForPerson\(state\.year!\.periods, viewerPersonId, today\)/);
  assert.doesNotMatch(schedule, /nextDutyFor|selectedTag/);
  assert.match(schedule, /monthSeparator: \{ height: 2, marginBottom: 16 \}/);
  assert.doesNotMatch(schedule, /View a deacon’s schedule|Переглянути розклад диякона/);
});

test('schedule management keeps regeneration available after a generated year', async () => {
  const manageSchedule = await readFile(new URL('../src/features/duty/DutyScheduleManagementScreen.tsx', import.meta.url), 'utf8');
  assert.match(manageSchedule, /regenerate: "Regenerate \{year\} schedule"/);
  assert.match(manageSchedule, /hasGeneratedSchedule = state\.status === "ready" && state\.year!\.periods\.length > 0/);
  assert.match(manageSchedule, /hasGeneratedSchedule \? copy\.regenerate : copy\.generate/);
  assert.match(manageSchedule, /accessibilityState=\{\{ busy: saving, disabled: saving \|\| orderedIds\.length === 0 \}\}/);
  assert.doesNotMatch(manageSchedule, /disabled=\{[^}]*hasGeneratedSchedule/);
});


test('generation excludes selected deacons without changing eligible candidates or their order',()=>{
 const candidates=[{personId:'a',name:'A'},{personId:'b',name:'B'},{personId:'c',name:'C'}];
 const included=includedCandidates(candidates,['b']);assert.deepEqual(included.map(p=>p.personId),['a','c']);
 assert.deepEqual(candidates.map(p=>p.personId),['a','b','c']);
 const periods=buildRotation(2026,included);assert.equal(periods.length,sundaysInYear(2026).length);
 assert.ok(periods.every(p=>p.personId!=='b'));assert.deepEqual(periods.slice(0,4).map(p=>p.personId),['a','c','a','c']);
 assert.deepEqual(includedCandidates(candidates,['a','b','c']),[]);
 assert.deepEqual(moveIncludedCandidate(candidates,['b'],'c',-1).map(p=>p.personId),['c','b','a']);
 assert.deepEqual(moveIncludedCandidate(candidates,['b'],'b',-1),candidates);
});
const require=createRequire(import.meta.url),React=require('react'),ts=require('typescript');
const managementCode=ts.transpileModule(await readFile(new URL('../src/features/duty/DutyScheduleManagementScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function rotationFixture({allowed=true}={}){
 const states=[],focus=[],calls=[];let cursor=0,dirty=false;
 const deacons=[{personId:'a',name:'Alpha'},{personId:'b',name:'Beta'},{personId:'c',name:'Charlie'}];
 const repository={loadYear:async year=>({year,eligibleDeacons:deacons,periods:[]}),saveRotation:async(year,ids)=>{calls.push({year,ids});return {year,eligibleDeacons:deacons,periods:buildRotation(year,deacons.filter(d=>ids.includes(d.personId)).sort((a,b)=>ids.indexOf(a.personId)-ids.indexOf(b.personId)))};}};
 const modules={
  react:{...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useCallback:f=>f,useMemo:f=>f()},
  'react/jsx-runtime':require('react/jsx-runtime'),'expo-router':{useFocusEffect:callback=>focus.push(callback)},
  'react-native':{ActivityIndicator:'Spinner',Pressable:'Button',ScrollView:'Scroll',View:'View',StyleSheet:{create:x=>x,hairlineWidth:1}},
  'react-native-safe-area-context':{SafeAreaView:'SafeArea'},'@react-native-vector-icons/ionicons':{Ionicons:'Icon'},
  '@/features/accessibility/app-text':{Text:'Text'},'@/features/appearance/AppearanceProvider':{useAppearance:()=>({palette:{}})},
  '@/features/directory/directory-repository':{listDirectory:async()=>[]},'@/features/localization/LocalizationProvider':{useLocalization:()=>({locale:'en'})},
  '@/lib/permissions':{canManageSettings:()=>allowed},'@/features/session/SessionProvider':{useSession:()=>({status:'ready',account:{id:'admin'}})},
  '@/lib/async-state':{errorMessage:e=>e.message},'@/features/members/ProfileAvatar':{ProfileAvatar:'Avatar'},'./DeaconPickerSheet':{DeaconPickerSheet:()=>null},
  './DutySummary':{todayFixedPdt:()=> '2026-10-04'},'./duty-domain':{fridayBeforeSunday,moveIncludedCandidate,includedCandidates,weekendLabel},'./duty-repository':{dutyRepository:repository},
  '@/features/manage/use-unsaved-changes':{useUnsavedChanges:value=>{dirty=value;}},
 };
 const exports={};new Function('require','exports',managementCode)(id=>{assert.ok(id in modules,id);return modules[id];},exports);
 const text=node=>node==null?'':typeof node!=='object'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
 function render(){cursor=0;const nodes=[];function walk(node){if(Array.isArray(node))return node.forEach(walk);if(!node||typeof node!=='object')return;if(typeof node.type==='function')return walk(node.type(node.props));nodes.push(node);walk(node.props?.children);}walk(exports.DutyScheduleManagementScreen());return nodes;}
 const find=label=>render().find(n=>n.type==='Button'&&(n.props.accessibilityLabel===label||text(n)===label));
 return {render,find,calls,deacons,get dirty(){return dirty;},text:()=>render().map(text).join(' '),async load(){render();for(const cb of focus.splice(0))cb();await new Promise(setImmediate);},async press(label){const node=find(label);assert.ok(node,label);assert.ok(!node.props.disabled,label+' disabled');node.props.onPress();await new Promise(setImmediate);}};
}
test('rotation controls exclude and reinclude deacons and send only the chosen roster',async()=>{
 const ui=rotationFixture();await ui.load();await ui.press('Include Beta in rotation');
 assert.equal(ui.find('Include Beta in rotation').props['aria-checked'],false);assert.equal(ui.dirty,true);assert.match(ui.text(),/2 of 3 deacons included/);
 await ui.press('Move Charlie up');await ui.press('Generate 2026 schedule');
 assert.deepEqual(ui.calls,[{year:2026,ids:['c','a']}]);assert.equal(ui.deacons.length,3);ui.render();assert.equal(ui.dirty,false);
 assert.equal(ui.find('Include Beta in rotation').props['aria-checked'],false,'choices stay excluded after generation');
 await ui.press('Include Beta in rotation');await ui.press('Regenerate 2026 schedule');assert.deepEqual(ui.calls[1].ids,['c','b','a']);
});
test('excluding everyone prevents generation and reset restores the saved roster',async()=>{
 const ui=rotationFixture();await ui.load();for(const name of ['Alpha','Beta','Charlie'])await ui.press(`Include ${name} in rotation`);
 assert.match(ui.text(),/Include at least one deacon/);const generate=ui.find('Generate 2026 schedule');assert.equal(generate.props.disabled,true);generate.props.onPress();await new Promise(setImmediate);assert.deepEqual(ui.calls,[]);
 await ui.press('Reset rotation choices');
 for(const name of ['Alpha','Beta','Charlie'])assert.equal(ui.find(`Include ${name} in rotation`).props['aria-checked'],true);
 ui.render();assert.equal(ui.dirty,false);
});
test('non-administrators cannot generate or access roster exclusion controls',async()=>{
 const ui=rotationFixture({allowed:false});await ui.load();assert.match(ui.text(),/permission to manage/);assert.ok(!ui.find('Include Alpha in rotation'));assert.deepEqual(ui.calls,[]);
});
