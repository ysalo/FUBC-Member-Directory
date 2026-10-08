import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/features/groups/use-birthday-date.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
for (const platform of ['web', 'ios']) test(`${platform}: midnight, resume and focus refresh without polling`, () => {
  let now = Date.parse('2026-12-31T06:59:59Z'), value, updates = 0, focus, cleanup, appListener, visibilityListener = null;
  const timers = new Map(); let nextId = 0;
  const app = {currentState:'active',addEventListener:(_, fn) => {appListener=fn;return {remove(){appListener=null;}};}};
  const document = {visibilityState:'visible',addEventListener:(_, fn)=>visibilityListener=fn,removeEventListener:()=>visibilityListener=null};
  class Clock extends Date {constructor(...args){super(...(args.length ? args : [now]));}}
  const exports = {};
  vm.runInNewContext(compiled, {exports, Date:Clock, document,
    setTimeout:(fn, delay)=>{const id=++nextId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    require:name=>{
      if(name==='react') return {useCallback:fn=>fn,useState:initial=>{value=initial();return [value,fn=>{const next=fn(value);if(next!==value)updates++;value=next;}];}};
      if(name==='expo-router') return {useFocusEffect:fn=>{focus=fn;cleanup=fn();}};
      if(name==='react-native') return {AppState:app,Platform:{OS:platform}};
      if(name==='@/lib/dates') return {isoToFixedPdt:iso=>({date:new Date(Date.parse(iso)-7*3600000).toISOString().slice(0,10)})};
      throw Error(`Unexpected dependency ${name}`);
    }});
  exports.useBirthdayDate();
  assert.equal(value,'2026-12-30'); assert.equal(timers.size,1); assert.equal([...timers.values()][0].delay,1000);
  appListener(); assert.equal(updates,0); assert.equal(timers.size,1);
  now+=1000; [...timers.values()][0].fn();
  assert.equal(value,'2026-12-31'); assert.equal(updates,1); assert.equal([...timers.values()][0].delay,86400000);
  app.currentState='background';document.visibilityState='hidden';appListener(); assert.equal(timers.size,0);
  now+=3*86400000;app.currentState='active';document.visibilityState='visible';appListener();
  assert.equal(value,'2027-01-03'); assert.equal(updates,2);assert.equal(timers.size,1);
  if(visibilityListener)visibilityListener();assert.equal(updates,2);
  cleanup();assert.equal(timers.size,0);assert.equal(appListener,null);assert.equal(visibilityListener,null);
  now+=86400000;cleanup=focus();assert.equal(value,'2027-01-04');cleanup();
});
