import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { auditBootstrap, auditMigrations } from './audit-fixture.mjs';
const db = new PGlite();
await db.exec(auditBootstrap);
for (const name of [...auditMigrations, '20261006040000_member_note_ownership', '20261007000000_deacon_care_notes_and_family']) await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`insert into public.deacon_groups(id,name,kind) values('${id(20)}','Care','membership'),('${id(21)}','Other','membership');
insert into public.people(id,name,gender,membership_group_id) values('${id(10)}','Deacon','male',null),('${id(11)}','Second deacon','male',null),('${id(12)}','Pastor','male','${id(20)}'),('${id(13)}','Member','male','${id(20)}'),('${id(14)}','Other member','female','${id(21)}');
insert into auth.users(id,email) values('${id(1)}','d@example.com'),('${id(2)}','d2@example.com'),('${id(3)}','p@example.com'),('${id(4)}','m@example.com');
update public.profiles set person_id=case id when '${id(1)}' then '${id(10)}'::uuid when '${id(2)}' then '${id(11)}'::uuid when '${id(3)}' then '${id(12)}'::uuid else '${id(13)}'::uuid end,status='active',role='member';
insert into public.person_ministries(person_id,ministry_id) select p.id,m.id from public.people p join public.ministries m on m.system_key=case when p.id='${id(12)}' then 'pastor' else 'deacon' end where p.id in ('${id(10)}','${id(11)}','${id(12)}');
insert into public.deacon_group_deacons(group_id,person_id,slot) values('${id(20)}','${id(10)}',1),('${id(20)}','${id(11)}',2);`);
async function as(actor,sql,params=[]) {
 await db.exec('set role authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(actor)]);
 try { return await db.query(sql,params); } finally { await db.exec('reset role'); }
}
const save=(actor,revision,body='Prayer for recovery')=>as(actor,'select public.save_deacon_member_note($1,$2,$3)',[id(13),revision,body]);
test('group deacons share notes; pastors and ordinary members cannot read or mutate them',async()=>{
 await save(1,null);
 assert.equal((await as(2,'select body from public.deacon_member_notes')).rows[0].body,'Prayer for recovery');
 for(const actor of [3,4]) {
  assert.deepEqual((await as(actor,'select person_id,body from public.deacon_member_notes')).rows,[]);
  assert.equal((await as(actor,'select public.deacon_member_note_access($1) allowed',[id(13)])).rows[0].allowed,false);
  await assert.rejects(save(actor,1),/Not authorized/);
  await assert.rejects(as(actor,'select public.remove_deacon_member_note($1,1)',[id(13)]),/Not authorized/);
 }
 await assert.rejects(as(1,'update public.deacon_member_notes set body=$1',['Bypass']),/permission denied/);
 await assert.rejects(as(1,'select public.save_deacon_member_note($1,null,$2)',[id(14),'Out of scope']),/Not authorized/);
 await save(2,1,'Follow up next week');
 await assert.rejects(save(1,1),e=>e.code==='40001');
 await assert.rejects(save(1,2,'   '),/Enter a note/);
 await assert.rejects(save(1,2,'x'.repeat(5001)),/Enter a note/);
 await db.query("update public.profiles set role='admin' where id=$1",[id(3)]);
 assert.deepEqual((await as(3,'select person_id,body from public.deacon_member_notes')).rows,[]);
 await assert.rejects(save(3,2),/Not authorized/);
 await db.exec('set role anon');
 try { await assert.rejects(db.query('select body from public.deacon_member_notes'),/permission denied/); } finally { await db.exec('reset role'); }
 await assert.rejects(as(1,'select public.remove_deacon_member_note($1,1)',[id(13)]),e=>e.code==='40001');
 await as(1,'select public.remove_deacon_member_note($1,2)',[id(13)]);
 await save(2,null,'New care need');
 await assert.rejects(save(1,2),e=>e.code==='40001');
 await assert.rejects(as(1,'select public.remove_deacon_member_note($1,2)',[id(13)]),e=>e.code==='40001');
 const fresh=(await as(2,'select revision from public.deacon_member_notes')).rows[0].revision;
 await as(2,'select public.remove_deacon_member_note($1,$2)',[id(13),fresh]);
});
test('family editing authorizes the group member subject, retains reciprocal links and conflict protection',async()=>{
 const snapshot=(await as(1,'select public.member_family($1,true) value',[id(13)])).rows[0].value;
 const sql='select public.save_member_family($1,$2,$3,$4,$5,$6) value';
 const args=[id(13),snapshot.revision,[],id(14),[],[]];
 await as(1,sql,args);
 assert.equal((await db.query("select count(*)::integer count from public.audit_events where action='save_member_family'")).rows[0].count,1);
 assert.equal((await as(4,'select public.member_family($1,false) value',[id(14)])).rows[0].value.spouse.id,id(13));
 await assert.rejects(as(2,sql,args),e=>e.code==='40001');
 await assert.rejects(as(1,'select public.member_family($1,true)',[id(14)]),/Not authorized/);
 await assert.rejects(as(1,sql,[id(14),snapshot.revision,[],null,[],[]]),/Not authorized/);
 await assert.rejects(as(4,sql,args),/Not authorized/);
});
test('revocation, group reassignment and archiving immediately remove access',async()=>{
 await save(1,null);
 await db.query("update public.profiles set status='revoked' where id=$1",[id(1)]);
 await assert.rejects(save(1,1),/Not authorized/);
 await db.query("update public.profiles set status='active' where id=$1",[id(1)]);
 await db.query('update public.people set membership_group_id=$1 where id=$2',[id(21),id(13)]);
 assert.deepEqual((await as(1,'select person_id from public.deacon_member_notes')).rows,[]);
 await assert.rejects(save(1,1),/Not authorized/);
 await db.query('update public.people set membership_group_id=$1,archived_at=now() where id=$2',[id(20),id(13)]);
 await assert.rejects(as(1,'select public.member_family($1,true)',[id(13)]),/Not authorized/);
});

after(() => db.close());
