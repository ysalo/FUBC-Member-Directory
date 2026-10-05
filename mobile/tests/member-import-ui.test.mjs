import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseMemberCsv, MemberCsvError } from '../supabase/functions/_shared/member-csv.ts';
const require=createRequire(import.meta.url), React=require('react'), ts=require('typescript');
const code=ts.transpileModule(await readFile(new URL('../src/features/manage/MemberImportScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
class MemberImportError extends Error { constructor(message, outcome) { super(message); this.outcome=outcome; } }
const text=node=>node==null?'':typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):text(node.props?.children);
function fixture({role='admin',locale='en',invalid=false,failOnce=false,rejected=false,cleanup=false}={}) {
  const states=[],refs=[],requests=[];let cursor=0,refCursor=0;
  const hooks={...React,useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef(initial){const i=refCursor++;return refs[i]??={current:initial};}};
  const modules=new Map([
    ['react',hooks],['react/jsx-runtime',require('react/jsx-runtime')],
    ['react-native',{ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',ScrollView:'ScrollView',View:'View',StyleSheet:{create:s=>s}}],
    ['@/features/accessibility/app-text',{Text:'Text',TextInput:'Input'}],
    ['@/features/appearance/AppearanceProvider',{useAppearance:()=>({palette:{}})}],
    ['@/features/localization/LocalizationProvider',{useLocalization:()=>({locale})}],
    ['@/features/session/SessionProvider',{useSession:()=>({status:'ready',account:{role}})}],
    ['@/lib/permissions',{canManageAccounts:account=>account.role==='admin'}],
    ['./use-unsaved-changes',{useUnsavedChanges:()=>({})}],
    ['./pick-member-csv',{pickMemberCsv:async()=>({name:'members.csv',text:invalid?'name\nwrong':'first_name,last_name,gender\nAndrew,Smith,male'})}],
    ['./member-import',{parseMemberCsv,MemberCsvError,MemberImportError,newMemberImportId:()=> '60000000-0000-4000-8000-000000000001',async importMemberCsv(request){requests.push(request);if(rejected){rejected=false;throw new MemberImportError('Existing member','rejected');}if(failOnce){failOnce=false;throw new Error('Lost response');}return{importId:request.importId,importedCount:1,replacedCount:39,pendingPhotos:cleanup&&request.action==='import'?2:0,status:cleanup&&request.action==='import'?'cleanup-pending':'completed'};}}],
  ]);
  const exports={};new Function('require','exports',code)(id=>{assert.ok(modules.has(id),id);return modules.get(id);},exports);
  const render=()=>{cursor=0;refCursor=0;const nodes=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}if(typeof node.type==='function'){walk(node.type(node.props));return;}nodes.push(node);walk(node.props?.children);};walk(exports.MemberImportScreen());return nodes;};
  const button=label=>render().find(n=>n.type==='Pressable'&&text(n)===label);
  return{render,button,requests};
}
test('import preview shows the parsed names and replacement requires the exact phrase',async()=>{
  const f=fixture();await f.button('Choose CSV').props.onPress();
  assert.ok(f.render().some(n=>text(n)==='Andrew Smith · male'));
  await f.button('○ Replace directory').props.onPress();
  assert.equal(f.button('Import members').props.disabled,true);
  f.render().find(n=>n.type==='Input').props.onChangeText('REPLACE MEMBERS');
  assert.equal(f.button('Import members').props.disabled,false);
  await f.button('Import members').props.onPress();
  assert.equal(f.requests[0].mode,'replace');assert.equal(f.requests[0].confirmation,'REPLACE MEMBERS');
  assert.ok(f.render().some(n=>text(n)==='Import completed'));
});
test('invalid CSV and nonadministrators cannot submit imports',async()=>{
  const f=fixture({invalid:true});await f.button('Choose CSV').props.onPress();assert.equal(f.button('Import members'),undefined);assert.equal(f.requests.length,0);
  assert.equal(fixture({role:'editor'}).button('Choose CSV'),undefined);
});
test('network retry preserves operation ID and file; cleanup retry does not send another CSV import',async()=>{
  const f=fixture({failOnce:true});await f.button('Choose CSV').props.onPress();await f.button('Import members').props.onPress();
  assert.equal(f.button('Choose CSV').props.disabled,true);await f.button('Retry this import').props.onPress();assert.deepEqual(f.requests[1],f.requests[0]);
  const c=fixture({cleanup:true});await c.button('Choose CSV').props.onPress();await c.button('Import members').props.onPress();await c.button('Retry photo cleanup').props.onPress();
  assert.deepEqual(c.requests[1],{action:'retry-cleanup',importId:c.requests[0].importId});
});
test('import controls are localized in Ukrainian',async()=>{
  const f=fixture({locale:'uk'});await f.button('Обрати CSV').props.onPress();assert.ok(f.button('Імпортувати учасників'));
});

test('a confirmed rejected transaction lets the administrator correct the CSV',async()=>{
  const f=fixture({rejected:true});await f.button('Choose CSV').props.onPress();await f.button('Import members').props.onPress();
  assert.equal(f.button('Choose CSV').props.disabled,false);
  assert.ok(f.button('Import members'));
});
