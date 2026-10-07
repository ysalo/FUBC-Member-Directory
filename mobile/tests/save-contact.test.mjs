import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const imports = new Map([
  ['react/jsx-runtime', pathToFileURL(require.resolve('react/jsx-runtime')).href],
  ['react', dataModule('export const useRef=x=>({current:x}); export const useState=x=>[x,v=>globalThis.fixture.states.push(v)];')],
  ['react-native', dataModule("export const Pressable='Pressable',ActivityIndicator='ActivityIndicator'; export const StyleSheet={create:x=>x};")],
  ['expo-contacts', dataModule('export const Contact={presentCreateForm:record=>globalThis.fixture.present(record)};')],
  ['@react-native-vector-icons/ionicons', dataModule("export const Ionicons='Ionicons';")],
  ['@/features/accessibility/app-text', dataModule("export const Text='Text';")],
  ['@/features/platform/alert', dataModule('export const Alert={alert:(...args)=>globalThis.fixture.alerts.push(args)};')],
  ['@/features/appearance/AppearanceProvider', dataModule('export const useAppearance=()=>({palette:{}});')],
  ['@/features/localization/LocalizationProvider', dataModule('export const useLocalization=()=>({locale:globalThis.fixture.locale});')],
]);
async function load(file) {
  const source=await readFile(new URL(`../src/features/members/${file}`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const resolved=compiled.replace(/from (["'])(.*?)\1/g,(_,q,s)=>{assert.ok(imports.has(s),s);return `from ${JSON.stringify(imports.get(s))}`;});
  const url=dataModule(resolved);
  return {url,exports:await import(url)};
}
const record=await load('contact-record.ts'); imports.set('./contact-record',record.url);
const copy=await load('member-copy.ts'); imports.set('./member-copy',copy.url);
const {SaveContactButton}= (await load('SaveContactButton.tsx')).exports;
const web=(await load('SaveContactButton.web.tsx')).exports;
const profile={first_name:' Іван ',last_name:' Сало ',patronymic:' Іванович ',phone:' +12065550143 ',email:' member@example.org ',address:' 123 Main St\nSeattle, WA ',leadershipMinistry:'deacon'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('exports full structured names and contact fields without private care information',()=>{
  assert.deepEqual(record.exports.memberContactRecord({...profile,note:'private',birthDate:'1970-01-01'},'display'),{
    givenName:'Іван',familyName:'Сало',middleName:'Іванович',phones:[{label:'mobile',number:'+12065550143'}],emails:[{label:'work',address:'member@example.org'}],addresses:[{label:'home',street:'123 Main St\nSeattle, WA'}],
  });
  assert.deepEqual(record.exports.memberContactRecord({name:'Legacy Name',email:'hidden',leadershipMinistry:null,phone:' ',address:' '},' Legacy Name '),{givenName:'Legacy Name'});
  assert.equal(record.exports.memberContactRecord({...profile,leadershipMinistry:null},'display').emails,undefined);
});
for (const locale of ['en','uk']) {
  test(`native contact form handles save, cancel, rapid taps, error and retry (${locale})`,async()=>{
    const calls=[]; let finish;
    globalThis.fixture={locale,states:[],alerts:[],present:r=>{calls.push(r);return new Promise(resolve=>{finish=resolve;});}};
    const button=SaveContactButton({profile,name:'display'});
    assert.equal(button.props.children[1].props.children,copy.exports.memberCopy[locale].saveContact);
    button.props.onPress();button.props.onPress();
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0],record.exports.memberContactRecord(profile,'display'));
    finish(false);await tick();
    assert.deepEqual(fixture.alerts,[]);
    fixture.present=async()=>{throw new Error('No contact app');};
    button.props.onPress();await tick();
    assert.deepEqual(fixture.alerts,[[copy.exports.memberCopy[locale].saveContactError,copy.exports.memberCopy[locale].saveContactUnavailable]]);
    fixture.present=async()=>true;
    button.props.onPress();await tick();
    assert.deepEqual(fixture.states,[true,false,true,false,true,false]);
    assert.equal(fixture.alerts.length,1);
  });
}
test('browser adapter does not offer a native contact action',()=>{
  assert.equal(web.SaveContactButton({profile,name:'display'}),null);
});
