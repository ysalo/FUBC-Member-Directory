import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as dates from '../src/features/forms/date-field.ts';
import { formatMemberName } from '../src/lib/member-name.ts';
const require = createRequire(import.meta.url), React = require('react'), ts = require('typescript');
const code = ts.transpileModule(await readFile(new URL('../src/features/manage/MemberDepartureScreen.tsx', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush = () => new Promise(setImmediate);
const text = n => n == null ? '' : typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : text(n.props?.children);
function fixture({allowed = true, fail = false, archived = false} = {}) {
  const states=[],refs=[],effects=[],pending=[],dialogs=[],saves=[],routes=[]; let cursor=0,rc=0,ec=0;
  const member={id:'person',name:'Anna Petrenko',first_name:'Anna',last_name:'Petrenko',patronymic:'Ivanivna',archived,revision:2};
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef(initial){const i=rc++;return refs[i]??={current:initial};},useEffect(effect,deps){const i=ec++;if(!effects[i]||deps.some((v,j)=>effects[i][j]!==v)){effects[i]=deps;pending.push(effect);}}};
  const modules=new Map([
    ['react',hooks],['react/jsx-runtime',require('react/jsx-runtime')],['expo-router',{useLocalSearchParams:()=>({memberId:'person'}),useRouter:()=>({replace:r=>routes.push(r)})}],
    ['react-native',{ActivityIndicator:'Spinner',Pressable:'Button',ScrollView:'Scroll',StyleSheet:{create:s=>s},View:'View'}],
    ['@/features/accessibility/app-text',{Text:'Text',TextInput:'Input'}],['@/features/appearance/AppearanceProvider',{useAppearance:()=>({palette:{}})}],['@/features/localization/LocalizationProvider',{useLocalization:()=>({locale:'en'})}],
    ['@/features/forms/NativeDateTimeField',{NativeDateTimeField:'Date'}],['@/features/forms/date-field',dates],['@/features/session/SessionProvider',{useSession:()=>({status:'ready',account:{}})}],['@/lib/permissions',{canManageDirectory:()=>allowed}],['@/lib/member-name',{formatMemberName}],
    ['@/features/platform/alert',{Alert:{alert:(...args)=>dialogs.push(args)}}],['./use-unsaved-changes',{useUnsavedChanges:()=>({allowLeave(){},confirmLeave:fn=>fn()})}],
    ['./management-repository',{managementRepository:{loadMember:async()=>member,listMemberDepartures:async()=>archived?[{id:'departure',first_name:'Anna',last_name:'Petrenko',patronymic:'Ivanivna',date_left:'2026-01-01',reason:'other',other_detail:'Moved overseas',notes:'Contact information retained',legacy:false}]:[],recordMemberDeparture:async(...args)=>{saves.push(args);if(fail){fail=false;throw Error('offline');}}}}]
  ]);
  const exports={};new Function('require','exports',code)(id=>{assert.ok(modules.has(id),id);return modules.get(id);},exports);
  const render=()=>{cursor=rc=ec=0;const nodes=[];const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(walk);nodes.push(n);walk(n.props?.children);};walk(exports.MemberDepartureScreen());while(pending.length)pending.shift()();return nodes;};
  const find=label=>render().find(n=>n.props?.accessibilityLabel===label||n.type==='Button'&&text(n)===label);
  return {render,find,saves,dialogs,routes,load:async()=>{render();await flush();},confirm:async()=>{find('Save departure').props.onPress();await dialogs.at(-1)[2][1].onPress();}};
}
test('departure radio choices require a short Other explanation and save only after confirmation', async()=>{
  const ui=fixture();await ui.load();assert.equal(ui.find('Save departure').props.disabled,true);
  ui.find('○  Other').props.onPress();assert.equal(ui.find('Save departure').props.disabled,true);
  ui.find('Brief reason (up to 160 characters)').props.onChangeText('Moved overseas');
  ui.find('Additional notes').props.onChangeText('Additional context');
  assert.equal(ui.find('Save departure').props.disabled,false);
  ui.find('Save departure').props.onPress();assert.equal(ui.saves.length,0);
  await ui.dialogs.at(-1)[2][1].onPress();
  assert.equal(ui.saves.length,1);assert.equal(ui.saves[0][1].otherDetail,'Moved overseas');assert.equal(ui.saves[0][1].notes,'Additional context');assert.equal(ui.routes.at(-1),'/manage');
});
test('invalid dates block saving and a failed departure preserves the draft for retry', async()=>{
  const ui=fixture({fail:true});await ui.load();ui.find('○  Died').props.onPress();ui.find('Date left').props.onChange('2099-01-01');assert.equal(ui.find('Save departure').props.disabled,true);
  ui.find('Date left').props.onChange('2026-01-01');await ui.confirm();assert.equal(ui.routes.length,0);assert.equal(ui.find('Save departure').props.disabled,false);await ui.confirm();assert.equal(ui.routes.at(-1),'/manage');
});
test('departure history displays saved names, reasons and notes; unauthorized access loads nothing',async()=>{
  const ui=fixture({archived:true});await ui.load();assert.ok(ui.render().some(n=>text(n).includes('Anna Ivanivna Petrenko')));assert.ok(ui.render().some(n=>text(n).includes('Moved overseas')));assert.equal(ui.find('Save departure'),undefined);
  const denied=fixture({allowed:false});await denied.load();assert.ok(denied.render().some(n=>text(n)==='Access unavailable'));assert.equal(denied.find('Date left'),undefined);
});

test('nested departure routes allow Member Administrators and deny ordinary members',async()=>{
  const permissions=await import('../src/lib/permissions.ts');
  const layoutCode=ts.transpileModule(await readFile(new URL('../src/app/manage/_layout.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  let role='editor';
  const modules=new Map([
    ['react/jsx-runtime',require('react/jsx-runtime')],['expo-router',{Redirect:'Redirect',Stack:Object.assign('Stack',{Screen:'Screen'}),usePathname:()=>'/manage/member/person/departure'}],
    ['@/features/appearance/AppearanceProvider',{useAppearance:()=>({palette:{}})}],['@/features/localization/LocalizationProvider',{useLocalization:()=>({locale:'en'})}],['@/features/accessibility/TextSizeProvider',{useTextSize:()=>({scale:1})}],['@/features/session/SessionProvider',{useSession:()=>({status:'ready',account:{id:'actor',status:'active',role,leadershipMinistry:null}})}],['@/lib/permissions',permissions],['@/lib/supabase',{isBackendConfigured:true}]
  ]);
  const exports={};new Function('require','exports',layoutCode)(id=>{assert.ok(modules.has(id),id);return modules.get(id);},exports);
  assert.notEqual(exports.default().type,'Redirect');role='member';assert.equal(exports.default().type,'Redirect');
});
