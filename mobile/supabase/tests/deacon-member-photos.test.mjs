import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { auditBootstrap, auditMigrations } from './audit-fixture.mjs';
const db = new PGlite();
await db.exec(auditBootstrap);
for (const name of [...auditMigrations, '20261006040000_member_note_ownership', '20261007000000_deacon_care_notes_and_family', '20261007010000_deacon_member_photos']) await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
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
const path=`${id(13)}/portrait.jpg`, thumb=`${path}.avatar-256.jpg`;
const upload=(actor,name,bucket='member-photos')=>as(actor,'insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,name]);
const publish=(actor,revision,name)=>as(actor,'select * from public.set_person_photo_metadata($1,$2,$3)',[id(13),revision,name]);
test('assigned deacons publish and remove photos through audited revisions; storage cannot bypass metadata',async()=>{
 const revision=(await db.query('select revision from public.people where id=$1',[id(13)])).rows[0].revision;
 await upload(1,path);await upload(1,thumb);
 const result=await publish(1,revision,path);
 assert.equal(result.rows[0].photo_path,path);assert.equal(result.rows[0].revision,revision+1);
 for(const name of [path,thumb]) assert.equal((await as(2,'delete from storage.objects where name=$1 returning name',[name])).rows.length,0);
 assert.equal((await as(2,'update storage.objects set name=$1 where name=$2 returning name',[`${id(13)}/overwrite.jpg`,path])).rows.length,0);
 await assert.rejects(publish(2,revision,null),/Conflict/);
 await assert.rejects(publish(2,revision+1,`${id(13)}/missing.jpg`),/missing/);
 for(const actor of [3,4]) await assert.rejects(publish(actor,revision+1,null),/Not authorized/);
 await assert.rejects(as(1,'update public.people set photo_path=null where id=$1',[id(13)]),/permission denied|row-level security/);
 await publish(2,revision+1,null);
 assert.equal((await as(1,'delete from storage.objects where name in ($1,$2) returning name',[path,thumb])).rows.length,2);
 assert.equal((await db.query("select count(*)::integer count from public.audit_events where action='set_person_photo_metadata'")).rows[0].count,2);
});
test('storage scope rejects other groups, malformed paths, other buckets, and non-deacons',async()=>{
 for(const name of [`${id(14)}/outside.jpg`,'invalid/file.jpg','file.jpg']) await assert.rejects(upload(1,name),/row-level security/);
 await assert.rejects(upload(1,`${id(13)}/file.jpg`,'other-bucket'),/row-level security/);
 for(const actor of [3,4]) await assert.rejects(upload(actor,path),/row-level security/);
 await upload(1,`${id(13)}/temp.jpg`);
 assert.equal((await as(1,'delete from storage.objects where name=$1 returning name',[`${id(13)}/temp.jpg`])).rows.length,1);
});
test('revocation, reassignment and archiving withdraw photo access immediately; managers retain access',async()=>{
 for(const [change,restore] of [
  [`update public.profiles set status='revoked' where id='${id(1)}'`,`update public.profiles set status='active' where id='${id(1)}'`],
  [`update public.people set membership_group_id='${id(21)}' where id='${id(13)}'`,`update public.people set membership_group_id='${id(20)}' where id='${id(13)}'`],
  [`update public.people set archived_at=now() where id='${id(13)}'`,`update public.people set archived_at=null where id='${id(13)}'`],
  [`update public.deacon_groups set archived_at=now() where id='${id(20)}'`,`update public.deacon_groups set archived_at=null where id='${id(20)}'`],
 ]) {
  await db.exec(change);
  try {await assert.rejects(upload(1,path),/row-level security/);await assert.rejects(publish(1,999,null),/Not authorized/);}
  finally {await db.exec(restore);}
 }
 await db.query("update public.profiles set role='editor' where id=$1",[id(3)]);
 await upload(3,`${id(14)}/manager.jpg`);
 const revision=(await db.query('select revision from public.people where id=$1',[id(13)])).rows[0].revision;
 await publish(3,revision,null);
});
after(()=>db.close());
