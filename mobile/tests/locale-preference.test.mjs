import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocaleHydration} from '../src/features/localization/locale-preference.ts';
test('a new selection wins over delayed stored language',async()=>{
 let resolve;const read=new Promise(r=>resolve=r),restored=[];
 const hydration=createLocaleHydration();const pending=hydration.restore(()=>read,value=>restored.push(value));
 hydration.cancel();resolve('uk');await pending;assert.deepEqual(restored,[]);
});
test('stored language loads, with invalid and unavailable storage ignored',async()=>{
 const restored=[];
 for(const stored of ['uk','en','invalid',null])await createLocaleHydration().restore(async()=>stored,value=>restored.push(value));
 await createLocaleHydration().restore(async()=>{throw Error('Storage unavailable')},value=>restored.push(value));
 assert.deepEqual(restored,['uk','en']);
});
