import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),ts=require('typescript');
const code=ts.transpileModule(await readFile(new URL('../src/features/audit/AuditScreen.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
for(const platform of ['ios','android','web-small']) test(`${platform} direct audit route redirects without loading historical data`,async()=>{
 let reads=0;const effects=[];
 const layoutCode=ts.transpileModule(await readFile(new URL('../src/features/shell/use-desktop-layout.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const layout={};new Function('require','exports',layoutCode)(()=>({Platform:{OS:platform==='web-small'?'web':platform},useWindowDimensions:()=>({width:platform==='web-small'?390:1440})}),layout);
 const modules=new Map([
  ['react',{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:current=>({current}),useEffect:callback=>effects.push(callback)}],
  ['./audit-labels',{}], ['react/jsx-runtime',require('react/jsx-runtime')],['expo-router',{Redirect:'Redirect'}],
  ['react-native',{ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',ScrollView:'ScrollView',View:'View',StyleSheet:{create:value=>value}}],
  ['@/features/accessibility/app-text',{Text:'Text',TextInput:'TextInput'}],
  ['@/features/appearance/AppearanceProvider',{useAppearance:()=>({palette:{}})}],
  ['@/features/localization/LocalizationProvider',{useLocalization:()=>({locale:'en'})}],
  ['@/features/session/SessionProvider',{useSession:()=>({status:'ready',account:{id:'admin',role:'admin',status:'active'}})}],
  ['@/features/shell/use-desktop-layout',{useDesktopLayout:layout.useDesktopLayout}],
  ['@/lib/permissions',{canManageAccounts:()=>true}],['@/lib/async-state',{withTimeout:x=>x,errorMessage:String}],
  ['./audit-repository',{auditRepository:{history:()=>{reads++;return Promise.resolve({items:[],total:0});}}}],
 ]);
 const exports={};new Function('require','exports',code)(id=>{assert.ok(modules.has(id),id);return modules.get(id);},exports);
 const result=exports.AuditScreen();assert.equal(result.type,'Redirect');assert.equal(result.props.href,'/manage');
 for(const effect of effects)effect();assert.equal(reads,0);
});

test('audit labels translate actions/entities and preserve renames, missing names and summary limits',async()=>{
 const output=ts.transpileModule(await readFile(new URL('../src/features/audit/audit-labels.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const helpers={};new Function('exports',output)(helpers);
 assert.equal(helpers.auditActionLabel('save_person','en'),'Member updated');
 assert.equal(helpers.auditActionLabel('save_person','uk'),'Дані учасника змінено');
 assert.equal(helpers.auditEntityLabel('people_private','uk'),'Дані учасника');
 assert.equal(helpers.auditActionLabel('legacy.unknown','en'),'legacy.unknown');
 assert.equal(helpers.auditRecordLabel('people',{name:'Old Name'},{name:'New Name'}),'Old Name → New Name');
 assert.equal(helpers.auditRecordLabel('people_private',null,null,{person:'Known Name'}),'Known Name');
 assert.equal(helpers.auditRecordLabel('people',null,null), '');
 assert.equal(helpers.auditSubjectSummary({person:'Known Name'},4),'Known Name · +3');
});
