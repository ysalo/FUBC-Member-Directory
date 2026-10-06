import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { auditBootstrap, auditMigrations } from './audit-fixture.mjs';
const server=process.env.AUDIT_TEST_DATABASE_URL ?? process.env.FAMILY_TEST_DATABASE_URL;
const safeupdate=process.env.FAMILY_TEST_SAFEUPDATE_LIBRARY;
const guard=safeupdate ? `load '${safeupdate.replaceAll("'","''")}';` : '';
function sql(url,input,onOutput) {
 return new Promise((resolve,reject)=>{
  const child=spawn('psql',[url,'-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']);
  let stdout='',stderr=''; child.stdout.on('data',chunk=>{stdout+=chunk;onOutput?.(stdout);}); child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('error',reject); child.on('close',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr))); child.stdin.end(input);
 });
}
test('real PostgreSQL rechecks stale previews, serializes inverses and deduplicates competing retries', {skip:!server},async()=>{
 const name=`audit_test_${process.pid}_${Date.now()}`, url=new URL(server);url.pathname=`/${name}`;
 await sql(server,`create database ${name};`);
 try {
  await sql(url.href,auditBootstrap.replaceAll('create role anon;',()=>"do $$ begin create role anon; exception when duplicate_object then null; end $$;").replaceAll('create role authenticated;',()=>"do $$ begin create role authenticated; exception when duplicate_object then null; end $$;").replaceAll('create role service_role;',()=>"do $$ begin create role service_role; exception when duplicate_object then null; end $$;"));
  for(const migration of auditMigrations) await sql(url.href,await readFile(new URL(`../migrations/${migration}.sql`,import.meta.url),'utf8'));
  const admin='70000000-0000-4000-8000-000000000001';
  await sql(url.href,`insert into auth.users(id,email) values('${admin}','audit@test.invalid'); update public.profiles set status='active',role='admin' where id='${admin}';`);
  const actor=`${guard} set role authenticated; set request.jwt.claim.sub='${admin}';`;
  const member=await sql(url.href,`${actor} select (public.save_person(null,null,'{"first_name":"Concurrent","last_name":"Member","gender":"male","phone":"2535551000"}')).id;`);
  const save=phone=>`select public.save_person('${member}',(select revision from public.people where id='${member}'),'{"name":"Concurrent Member","phone":"${phone}"}');`;
  const latest=async()=>JSON.parse(await sql(url.href,`${actor} select public.audit_history('{}',1,0);`)).items[0].id;
  await sql(url.href,`${actor} ${save('2535552000')}`); const action=await latest();
  assert.equal(JSON.parse(await sql(url.href,`${actor} select public.preview_audit_rollback('${action}');`)).available,true);
  let announce; const locked=new Promise(resolve=>{announce=resolve;});
  const writer=sql(url.href,`${actor} begin; ${save('2535553000')}\n\\echo AUDIT_LOCKED\nselect pg_sleep(1); commit;`,output=>{if(output.includes('AUDIT_LOCKED'))announce();});
  await Promise.race([locked,writer.then(()=>{throw new Error('Lock signal missing');})]);
  await assert.rejects(sql(url.href,`${actor} select public.execute_audit_rollback('${action}','${crypto.randomUUID()}','stale preview');`),/Conflicting later changes/); await writer;
  assert.equal(await sql(url.href,`${actor} select phone from public.people where id='${member}';`),'2535553000');
  const selected=await latest(),operation=crypto.randomUUID();
  let announceUndo; const undoLocked=new Promise(resolve=>{announceUndo=resolve;});
  const first=sql(url.href,`${actor} begin; select public.execute_audit_rollback('${selected}','${operation}','competing retry');\n\\echo UNDO_LOCKED\nselect pg_sleep(1); commit;`,output=>{if(output.includes('UNDO_LOCKED'))announceUndo();});
  await Promise.race([undoLocked,first.then(()=>{throw new Error('Lock signal missing');})]);
  const retry=JSON.parse(await sql(url.href,`${actor} select public.execute_audit_rollback('${selected}','${operation}','competing retry');`)); await first;
  assert.equal((await latest()),retry.actionId);
  assert.equal(await sql(url.href,`${actor} select phone from public.people where id='${member}';`),'2535552000');
  const history=JSON.parse(await sql(url.href,`${actor} select public.audit_history('{"action":"audit.rollback"}',100,0);`)); assert.equal(history.total,1);
 } finally { await sql(server,`drop database ${name} with (force);`); }
});
