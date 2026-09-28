import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Requires a disposable PostgreSQL server and psql; creates its own database.
const server = process.env.FAMILY_TEST_DATABASE_URL;
const safeupdate = process.env.FAMILY_TEST_SAFEUPDATE_LIBRARY;
const guard = safeupdate ? `load '${safeupdate.replaceAll("'", "''")}';` : '';
function sql(url, input, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']);
    let stdout='', stderr='';
    child.stdout.on('data', chunk => { stdout += chunk; onOutput?.(stdout); });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
    child.stdin.end(input);
  });
}
test('real competing reciprocal, spouse and ancestry saves reject stale writers', { skip: !server }, async () => {
  const name=`family_test_${process.pid}_${Date.now()}`;
  const url=new URL(server); url.pathname=`/${name}`;
  await sql(server, `create database ${name};`);
  try {
    await sql(url.href, `
      do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema auth; create schema storage;
      grant usage on schema public,auth,storage to authenticated;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
    `);
    for(const migration of ['20260916000000_initial.sql','20260928010000_member_family.sql']) {
      await sql(url.href,await readFile(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
    }
    const admin='70000000-0000-4000-8000-000000000001';
    await sql(url.href,`insert into auth.users(id,email) values('${admin}','family@test.invalid'); update public.profiles set status='active',role='admin';`);
    if (guard) await assert.rejects(sql(url.href, `${guard} update public.profiles set revision=revision+1;`), /UPDATE requires a WHERE clause/);
    const actor=`${guard} set role authenticated; set request.jwt.claim.sub='${admin}';`;
    const revision=()=>sql(url.href,`${actor} select public.member_family((select id from public.people limit 1),true)->>'revision';`);
    const save=(id,rev,{parents=[],children=[],spouse=null,siblings=[]}={})=>`select public.save_member_family('${id}',${rev},ARRAY[${parents.map(x=>`'${x}'`).join(',')}]::uuid[],${spouse?`'${spouse}'`:'null'},ARRAY[${children.map(x=>`'${x}'`).join(',')}]::uuid[],ARRAY[${siblings.map(x=>`'${x}'`).join(',')}]::uuid[]);`;
    if (guard) {
      const probe = await sql(url.href, "insert into public.people(name) values('Safeupdate upgrade probe') returning id;");
      const before = await revision();
      await assert.rejects(sql(url.href, `${actor} ${save(probe,before)}`), /21000: UPDATE requires a WHERE clause/);
      assert.equal(await revision(), before, 'rejected save must not advance the revision');
    }
    await sql(url.href,await readFile(new URL('../migrations/20260928020000_family_safeupdate.sql',import.meta.url),'utf8'));
    for(const scenario of ['reciprocal','spouse','cycle']) {
      const ids=(await sql(url.href,`insert into public.people(name) values('A'),('B'),('C') returning id;`)).split('\n');
      const [a,b,c]=ids, rev=await revision();
      const first=scenario==='spouse'?save(a,rev,{spouse:b}):save(a,rev,{children:[b]});
      const second=scenario==='spouse'?save(c,rev,{spouse:b}):scenario==='cycle'?save(b,rev,{children:[a]}):save(b,rev,{siblings:[c]});
      let announce;
      const locked=new Promise(resolve=>{announce=resolve;});
      const writer=sql(url.href,`${actor} begin; ${first}\n\\echo FAMILY_LOCKED\nselect pg_sleep(1); commit;`,output=>{if(output.includes('FAMILY_LOCKED'))announce();});
      // Writer errors must also unblock the signal wait.
      await Promise.race([locked,writer.then(()=>{throw new Error('Lock signal missing');})]);
      const competing=sql(url.href,`${actor} ${second}`);
      await assert.rejects(competing,/Family connections changed/);
      await writer;
      const after=JSON.parse(await sql(url.href,`${actor} select public.member_family('${b}',true);`));
      if(scenario==='spouse') assert.equal(after.spouse.id,a);
      else { assert.deepEqual(after.parents.map(p=>p.id),[a]); assert.deepEqual(after.children,[]); assert.deepEqual(after.siblings,[]); }
      await sql(url.href, `${guard} delete from public.people where id='${a}';`);
      const deleted = JSON.parse(await sql(url.href, `${actor} select public.member_family('${b}',true);`));
      assert.equal(deleted.spouse, null);
      assert.deepEqual(deleted.parents, []);
      assert.ok(deleted.revision > after.revision, 'cascade deletion must still invalidate family drafts');
    }
  } finally { await sql(server,`drop database ${name} with (force);`); }
});
