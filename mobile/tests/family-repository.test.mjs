import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url), ts=require('typescript');
const source=await readFile(new URL('../src/features/family/family-repository.ts',import.meta.url),'utf8');
function fixture() {
 const calls=[], invalidations=[];
 const row={id:'relative',name:'Relative',archived:true,photoPath:'relative.jpg'};
 let response={data:{memberId:'subject',revision:9,parents:[row],spouse:null,children:[],siblings:[{...row,explicit:true,supportingParents:[row]}]},error:null};
 const exports={};
 new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)((id)=>{
  if(id==='@/lib/repository-helpers')return {activeAccount:()=>({status:'active'}),privatePhotoSources:async()=>new Map([['relative.jpg',{uri:'signed-avatar'}]])};
  if(id==='@/lib/supabase')return {requireSupabase:()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}})};
  if(id==='@/lib/session-cache')return {invalidateData:(...keys)=>invalidations.push(keys)};
  throw new Error(id);
 },exports);
 return {api:exports,calls,invalidations,fail:(code='40001')=>{response={data:null,error:{message:'Server wording is independent',code}};}};
}
test('family read exposes signed avatars, archived and inference explanations',async()=>{
 const {api,calls}=fixture(); const value=await api.loadFamily('subject');
 assert.equal(value.revision,9); assert.equal(value.parents[0].archived,true);
 assert.deepEqual(value.siblings[0].supportingParents[0].photo,{uri:'signed-avatar'});
 assert.equal(value.siblings[0].explicit,true); assert.equal(calls[0].args.p_manage,true);
 await api.loadProfileFamily('subject'); assert.equal(calls[1].args.p_manage,false);
});
test('family save preserves whole explicit intent and stale errors for refresh UI',async()=>{
 const {api,calls,invalidations,fail}=fixture();
 await api.saveFamily('subject',9,{parentIds:['p'],spouseId:'s',childIds:['c'],siblingIds:['b']});
 assert.deepEqual(calls[0],{name:'save_member_family',args:{p_person_id:'subject',p_revision:9,p_parent_ids:['p'],p_spouse_id:'s',p_child_ids:['c'],p_sibling_ids:['b']}});
 assert.deepEqual(invalidations,[['directory']]); fail();
 await assert.rejects(api.saveFamily('subject',9,{parentIds:[],spouseId:null,childIds:[],siblingIds:[]}),error=>error.code==='40001');
 assert.equal(invalidations.length,1);
});

test('stable server codes normalize validation errors independently of English wording',async()=>{
 for(const [code,kind] of [['FM001','spouse'],['FM002','cycle'],['FM003','self'],['40001','conflict']]) {
  const {api,fail}=fixture(); fail(code);
  await assert.rejects(api.saveFamily('subject',9,{parentIds:[],spouseId:null,childIds:[],siblingIds:[]}),error=>error.kind===kind && error.code===code);
 }
});
