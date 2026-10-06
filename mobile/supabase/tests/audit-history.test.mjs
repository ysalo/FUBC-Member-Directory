import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { auditBootstrap, auditMigrations } from './audit-fixture.mjs';

const db = new PGlite();
const ids = {
  admin: '40000000-0000-4000-8000-000000000001',
  editor: '40000000-0000-4000-8000-000000000002',
  member: '40000000-0000-4000-8000-000000000003',
};
async function as(account, sql, params = []) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [ids[account]]);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function migration(name) {
  try { await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8')); } catch(e) { throw new Error(`${name}: ${e.message} ${e.where ?? ''}`); }
}

await db.exec(auditBootstrap);
for (const name of auditMigrations) await migration(name);
for (const [name,id] of Object.entries(ids)) await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@example.com`]);
await db.query("update public.profiles set display_name=case when id=$1 then 'Audit Admin' else 'Audit Editor' end,status='active',role=case when id=$1 then 'admin'::public.app_role when id=$2 then 'editor'::public.app_role else 'member'::public.app_role end",[ids.admin,ids.editor]);
after(async () => db.close());
const command = async (sql, params=[], actor='admin') => (await as(actor,sql,params)).rows[0];
const save = async (id=null, data={}, actor='admin') => {
  const current=id ? await command('select p.*,d.address,d.birth_date from public.people p left join public.management_member_care_details($1) d on d.person_id=p.id where p.id=$1',[id]) : {first_name:'Audit',last_name:'Person',gender:'male'};
  return (await command('select to_jsonb(public.save_person($1,$2,$3)) member',[id,current.revision??null,JSON.stringify({...current,...data})],actor)).member;
};
const history = async () => (await command("select public.audit_history('{}',50,0) result")).result;
test('one member save captures private details, preserves actor identity and excludes notes',async()=>{
  const member=await save(null,{address:'First address',birth_date:'1990-01-02',private_notes:'SECRET'});
  const rows=await history();
  assert.equal(rows.items.length,1);
  assert.equal(rows.items[0].actor_id,ids.admin);
  const detail=(await command('select public.audit_action_details($1,100,0) result',[rows.items[0].id])).result;
  assert.equal(detail.items.find(x=>x.entity==='people').after_data.id,member.id);
  assert.equal(detail.items.find(x=>x.entity==='people_private').after_data.address,'First address');
  assert.ok(!JSON.stringify(detail).includes('SECRET'));
});
const latest = async () => (await history()).items[0];
const preview = async id => (await command('select public.preview_audit_rollback($1) result',[id])).result;
const undo = async (id,operation=crypto.randomUUID(),reason='Correct mistaken change') => (await command('select public.execute_audit_rollback($1,$2,$3) result',[id,operation,reason])).result;
test('rollback restores only changed fields, records reason/link and retries safely',async()=>{
  let member=await save(null,{phone:'2535551234',address:'Original'});
  member=await save(member.id,{phone:'2535554321'}); const action=await latest();
  await save(member.id,{email:'later@example.com'});
  assert.equal((await preview(action.id)).available,true);
  const op=crypto.randomUUID(); const result=await undo(action.id,op);
  assert.deepEqual(await undo(action.id,op),result);
  const restored=await command('select phone,email,revision from public.people where id=$1',[member.id]);
  assert.equal(restored.phone,'2535551234'); assert.equal(restored.email,'later@example.com'); assert.ok(restored.revision>member.revision);
  const reversal=await latest(); assert.equal(reversal.original_action_id,action.id); assert.equal(reversal.reason,'Correct mistaken change');
  await assert.rejects(undo(action.id,crypto.randomUUID(),'  '),/reason/i);
});
test('same-field changes after preview block the whole rollback and failed commands create no action',async()=>{
  const member=await save(null,{phone:'2535551000',address:'Old'});
  await save(member.id,{phone:'2535552000',address:'New'}); const action=await latest();
  assert.equal((await preview(action.id)).available,true);
  await save(member.id,{phone:'2535553000'}); const before=await history();
  const plan=await preview(action.id); assert.equal(plan.available,false); assert.ok(plan.conflicts.some(c=>c.field==='phone'));
  await assert.rejects(undo(action.id),e=>e.code==='40001');
  assert.deepEqual(await history(),before);
  const detail=await command('select * from public.management_member_care_details($1)',[member.id]); assert.equal(detail.address,'New');
  await assert.rejects(command('select public.save_person($1,0,$2)',[member.id,JSON.stringify({name:'Bad'})])); assert.deepEqual(await history(),before);
});
test('ordinary removal hides data, retains family/group links and revokes an existing session without re-enabling on undo',async()=>{
  const member=await save(null,{first_name:'Removed',last_name:'Member'}); const relative=await save(null,{first_name:'Relative',last_name:'Member'});
  const family=(await command('select public.member_family($1,true) family',[member.id])).family;
  await command('select public.save_member_family($1,$2,$3,null,$4,$5)',[member.id,family.revision,[],[relative.id],[]]);
  await db.query('update public.profiles set person_id=$1 where id=$2',[member.id,ids.member]);
  const current=await command('select revision from public.people where id=$1',[member.id]);
  await command('select public.remove_member($1,$2,$3)',[member.id,current.revision,'Removed Member']); const action=await latest();
  assert.equal((await as('member','select * from public.people')).rows.length,0);
  assert.equal((await command('select * from public.people where id=$1',[member.id])),undefined);
  const hiddenFamily=(await command('select public.member_family($1,true) family',[relative.id])).family; assert.deepEqual(hiddenFamily.parents,[]);
  const linked=(await command('select * from public.profiles where id=$1',[ids.member]));
  await assert.rejects(command('select public.update_account($1,$2,$3,$4,$5)',[ids.member,linked.revision,'active','member',member.id]),/active member|Restore the directory member/);
  assert.equal((await preview(action.id)).available,true); await undo(action.id);
  assert.equal((await command('select * from public.people where id=$1',[member.id])).name,'Removed Member');
  const restoredFamily=(await command('select public.member_family($1,true) family',[relative.id])).family; assert.equal(restoredFamily.parents[0].id,member.id);
  assert.equal((await as('member','select * from public.people')).rows.length,0);
  assert.equal((await command('select status from public.profiles where id=$1',[ids.member])).status,'revoked');
});
test('audit reads and rollback deny editors, inactive accounts and forged history',async()=>{
  const action=await latest();
  for(const actor of ['editor','member']) {
    await assert.rejects(command("select public.audit_history('{}',10,0)",[],actor),e=>e.code==='42501');
    await assert.rejects(command('select public.preview_audit_rollback($1)',[action.id],actor),e=>e.code==='42501');
    await assert.rejects(command('select public.execute_audit_rollback($1,$2,$3)',[action.id,crypto.randomUUID(),'test'],actor),e=>e.code==='42501');
  }
  await assert.rejects(command("insert into public.audit_events(action) values('forged')"));
  await assert.rejects(command('delete from public.audit_events where id=$1',[action.id]));
  await assert.rejects(command("select app_private.audit_begin('forged')"));
  await assert.rejects(command("select app_private.audit('forged',null,'{}')"));
});
const group = async (name,members=[],id=null) => (await command('select to_jsonb(public.save_group($1,$2,$3,$4,false,$5,$6)) result',[id,id?(await command('select revision from public.deacon_groups where id=$1',[id])).revision:null,name,'membership',[],members])).result;
const details = async id => (await command('select public.audit_action_details($1,100,0) result',[id])).result;
test('cross-group member moves are one action and restore source/destination assignments together',async()=>{
  const member=await save(null,{first_name:'Group',last_name:'Member'});
  const source=await group('Audit Source',[member.id]); const destination=await group('Audit Destination');
  const before=(await history()).total;
  await group('Audit Destination',[member.id],destination.id); const action=await latest();
  assert.equal((await history()).total,before+1);
  const change=(await details(action.id)).items.find(c=>c.entity==='people');
  assert.equal(change.before_data.membership_group_id,source.id); assert.equal(change.after_data.membership_group_id,destination.id);
  assert.equal((await preview(action.id)).available,true); await undo(action.id);
  assert.equal((await command('select membership_group_id from public.people where id=$1',[member.id])).membership_group_id,source.id);
  await command('select public.delete_group($1,$2)',[source.id,(await command('select revision from public.deacon_groups where id=$1',[source.id])).revision]); const deletion=await latest();
  assert.equal((await preview(deletion.id)).available,true); await undo(deletion.id);
  assert.equal((await command('select membership_group_id from public.people where id=$1',[member.id])).membership_group_id,source.id);
});
test('family relationships undo atomically and later relationships cannot break domain invariants',async()=>{
 const a=await save(null,{first_name:'Family',last_name:'A'}), b=await save(null,{first_name:'Family',last_name:'B'}), c=await save(null,{first_name:'Family',last_name:'C'});
 const version=(await command('select public.member_family($1,true) result',[a.id])).result.revision;
 await command('select public.save_member_family($1,$2,$3,$4,$5,$6)',[a.id,version,[],b.id,[c.id],[]]); const action=await latest();
 assert.equal((await preview(action.id)).available,true); await undo(action.id);
 const family=(await command('select public.member_family($1,true) result',[b.id])).result; assert.equal(family.spouse,null); assert.deepEqual(family.children,[]);
});
test('departure snapshots exclude notes and departure rollback restores active membership',async()=>{
 const member=await save(null,{first_name:'Departed',last_name:'Member'});
 await command('select public.record_member_departure($1,$2,$3,$4,null,$5)',[member.id,member.revision,'2026-01-01','different_church','SECRET departure note']); const action=await latest();
 assert.ok(!JSON.stringify(await details(action.id)).includes('SECRET'));
 assert.equal((await preview(action.id)).available,true); await undo(action.id);
 assert.equal((await command('select archived_at from public.people where id=$1',[member.id])).archived_at,null);
});
test('additive import is one reversible batch; creation with subsequent dependencies is blocked',async()=>{
 const operation=crypto.randomUUID(), input=[{first_name:'Imported',last_name:'One',gender:'male'},{first_name:'Imported',last_name:'Two',gender:'female'}];
 const before=(await history()).total;
 await command('select public.import_members_from_csv($1,$2,$3,$4)',[operation,JSON.stringify(input),'add','']); const action=await latest();
 assert.equal((await history()).total,before+1);
 await command('select public.import_members_from_csv($1,$2,$3,$4)',[operation,JSON.stringify(input),'add','']); assert.equal((await history()).total,before+1);
 assert.equal((await preview(action.id)).available,true); await undo(action.id);
 assert.equal((await as('admin',"select * from public.people where first_name='Imported'")).rows.length,0);
 const member=await save(null,{first_name:'Dependent',last_name:'Member'}); const creation=await latest();
 await group('Dependency Group',[member.id]); assert.equal((await preview(creation.id)).available,false); await assert.rejects(undo(creation.id));
});
test('scoped deacon writes and leadership/ministry changes capture attributed group effects',async()=>{
 const subject=await save(null,{first_name:'Scoped',last_name:'Subject'});
 const ministry=(await command("select id from public.ministries where system_key='deacon'")).id;
 const leader=await save(null,{first_name:'Responsible',last_name:'Deacon',ministry_ids:[ministry]});
 await db.query('update public.profiles set person_id=$1,status=$2 where id=$3',[leader.id,'active',ids.member]);
 const g=(await command('select to_jsonb(public.save_group(null,null,$1,$2,false,$3,$4)) result',['Scoped Group','membership',[leader.id],[subject.id]])).result;
 const before=(await history()).total;
 await command('select public.deacon_save_member($1,$2,$3)',[subject.id, (await command('select revision from public.people where id=$1',[subject.id])).revision,JSON.stringify({first_name:'Scoped',last_name:'Subject',gender:'male',phone:'2535559999',address:'Scoped address'})],'member');
 const deacon=await latest(); assert.equal(deacon.actor_id,ids.member); assert.equal(deacon.action,'deacon_save_member'); assert.equal((await history()).total,before+1);
 assert.equal((await details(deacon.id)).items.find(c=>c.entity==='people_private').after_data.address,'Scoped address');
 const destination=await group('Leader Destination');
 await command('select public.save_group($1,$2,$3,$4,false,$5,$6)',[destination.id,destination.revision,destination.name,'membership',[leader.id],[]]); const move=await latest();
 const rows=(await details(move.id)).items.filter(c=>c.entity==='deacon_group_deacons'); assert.equal(rows.length,2);
 assert.equal((await preview(move.id)).available,true); await undo(move.id);
 assert.equal((await as('admin','select group_id from public.deacon_group_deacons where person_id=$1',[leader.id])).rows[0].group_id,g.id);
 await save(leader.id,{ministry_ids:[]}); const assignment=await latest(); assert.ok((await details(assignment.id)).items.some(c=>c.entity==='person_ministries'));
 assert.equal((await preview(assignment.id)).available,true); await undo(assignment.id);
 assert.equal((await command('select * from public.management_member_care_details($1)',[leader.id])).ministry_ids[0],ministry);
});
test('group deletion rollback cannot reassign a member who left membership later',async()=>{
 const member=await save(null,{first_name:'Later',last_name:'Departure'});const g=await group('Later Departure Group',[member.id]);
 await command('select public.delete_group($1,$2)',[g.id,g.revision]);const deletion=await latest();
 await save(member.id,{archived:true});
 assert.equal((await preview(deletion.id)).available,false);await assert.rejects(undo(deletion.id));
 assert.equal((await command('select membership_group_id from public.people where id=$1',[member.id])).membership_group_id,null);
});
test('photo-only actions disclose unavailable restoration and mixed changes never resurrect photo references',async()=>{
 const member=await save(null,{first_name:'Photo',last_name:'Member'});
 await db.query("insert into storage.objects(bucket_id,name) values('member-photos',$1)",[`${member.id}/old.jpg`]);
 await command('select public.set_person_photo_metadata($1,$2,$3)',[member.id,member.revision,`${member.id}/old.jpg`]);
 const photo=await latest(); assert.equal((await preview(photo.id)).available,false); assert.equal((await preview(photo.id)).photoLimitations,true);
 const current=await command('select revision from public.people where id=$1',[member.id]);
 await command('select public.remove_member($1,$2,$3)',[member.id,current.revision,'Photo Member']); const removal=await latest();
 assert.equal((await preview(removal.id)).photoLimitations,true); await undo(removal.id);
 assert.equal((await command('select photo_path from public.people where id=$1',[member.id])).photo_path,null);
});
test('an inactive admin cannot use a previously successful preview',async()=>{
 const member=await save(null,{first_name:'Access',last_name:'Check',phone:'2535551000'});
 await save(member.id,{phone:'2535552000'});const action=await latest();assert.equal((await preview(action.id)).available,true);
 await db.query("update public.profiles set status='revoked' where id=$1",[ids.admin]);
 try {await assert.rejects(undo(action.id),e=>e.code==='42501');await assert.rejects(history(),e=>e.code==='42501');assert.equal((await as('admin','select * from public.audit_events')).rows.length,0);}
 finally {await db.query("update public.profiles set status='active' where id=$1",[ids.admin]);}
 assert.equal((await command('select phone from public.people where id=$1',[member.id])).phone,'2535552000');
});
test('one conflicting imported member blocks removal of the entire batch',async()=>{
 const input=[{first_name:'Atomic',last_name:'One',gender:'male'},{first_name:'Atomic',last_name:'Two',gender:'female'}];
 await command('select public.import_members_from_csv($1,$2,$3,$4)',[crypto.randomUUID(),JSON.stringify(input),'add','']);const action=await latest();
 const members=(await as('admin',"select id,name from public.people where first_name='Atomic' order by name")).rows;
 await save(members[0].id,{phone:'2535555000'});assert.equal((await preview(action.id)).available,false);await assert.rejects(undo(action.id));
 assert.equal((await as('admin',"select * from public.people where first_name='Atomic'")).rows.length,2);
});
test('actor deletion, permanent deletion and replacement preserve history; legacy entries stay explicit',async()=>{
 const member=await save(null,{first_name:'Durable',last_name:'Actor'},'editor'); const authored=await latest();
 await db.query('delete from auth.users where id=$1',[ids.editor]);
 const durable=(await details(authored.id)).action; assert.equal(durable.actor_id,ids.editor); assert.equal(durable.actor_name,'Audit Editor');
 await command('select public.delete_member_record($1,null)',[member.id]); const deleted=await latest(); assert.equal(deleted.restoration,'irreversible'); assert.equal((await preview(deleted.id)).available,false);
 const legacy=(await db.query("insert into public.audit_events(action) values('legacy.fixture') returning id")).rows[0];
 assert.equal((await preview(legacy.id)).available,false); assert.equal((await details(legacy.id)).items.length,0);
 const before=(await history()).total;
 await command('select public.import_members_from_csv($1,$2,$3,$4)',[crypto.randomUUID(),JSON.stringify([{first_name:'Replacement',last_name:'Member',gender:'male'}]),'replace','REPLACE MEMBERS']);
 assert.equal((await history()).total,before+1); assert.equal((await latest()).restoration,'irreversible');
 assert.equal((await details(authored.id)).action.actor_id,ids.editor);
 const page=(await command("select public.audit_history('{}',2,1) result")).result; assert.equal(page.items.length,2); assert.equal(page.total,before+1);
 const filtered=(await command('select public.audit_history($1,50,0) result',[JSON.stringify({subject:member.id})])).result; assert.ok(filtered.items.some(x=>x.id===authored.id));
});
