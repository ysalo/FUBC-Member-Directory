import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

let db;
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const member=uuid(1), other=uuid(2), pastor=uuid(3), deacon=uuid(4), admin=uuid(5), pending=uuid(6), editor=uuid(7), revoked=uuid(8);
const person=uuid(101), archived=uuid(102);
async function as(user, work) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  try { return await work(); }
  finally { await db.exec('reset role'); await db.exec("select set_config('request.jwt.claim.sub','',false)"); }
}
async function scalar(sql,params=[]) { const result=await db.query(sql,params); return Object.values(result.rows[0])[0]; }
async function worker(work) {
  await db.exec('set role service_role');
  try { return await work(); } finally { await db.exec('reset role'); }
}
before(async()=>{
  db=new PGlite();
  await db.exec(await readFile(new URL('./platform-fixture.sql',import.meta.url),'utf8'));
  const migrations=new URL('../../supabase/migrations/',import.meta.url);
  for(const path of (await readdir(migrations)).filter(p=>p.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(path,migrations),'utf8'));
  for(const [id,role,status,ministry] of [
    [member,'member','active',null],[other,'member','active',null],
    [pastor,'member','active','pastor'],[deacon,'member','active','deacon'],
    [admin,'admin','active',null],[pending,'member','pending',null],
    [editor,'editor','active',null],[revoked,'member','revoked',null]
  ]){
    await db.query('insert into auth.users(id,email) values($1,$2)',[id,`fictional-${id}@example.invalid`]);
    await db.query('update public.profiles set role=$2,status=$3,ministry_roles=$4 where id=$1',[id,role,status,ministry?[ministry]:[]]);
  }
  await db.query("insert into public.people(id,first_name,last_name) values($1,'Fictional','Member'),($2,'Archived','Example')",[person,archived]);
  await db.query('update public.people set archived_at=now() where id=$1',[archived]);
});
after(async()=>{await db?.close();});

test('every public application table enforces RLS and anon has no public RPC privileges',async()=>{
  assert.deepEqual((await db.query("select relname from pg_class join pg_namespace on relnamespace=pg_namespace.oid where nspname='public' and relkind='r' and not relrowsecurity")).rows,[]);
  assert.deepEqual((await db.query("select proname from pg_proc join pg_namespace on pronamespace=pg_namespace.oid where nspname='public' and has_function_privilege('anon',pg_proc.oid,'EXECUTE')")).rows,[]);
});
test('approval gate filters directory and keeps other account details private',async()=>{
  for(const user of [pending,revoked]) await as(user,async()=>{
    assert.equal(await scalar('select count(*)::int from public.people'),0);
    assert.equal(await scalar('select count(*)::int from public.profiles'),1);
    await assert.rejects(()=>db.query('select public.set_favorite($1,true)',[person]),/Active account required/);
  });
  await as(member,async()=>{
    assert.equal(await scalar('select count(*)::int from public.people'),1);
    assert.equal(await scalar('select count(*)::int from public.profiles'),1);
    await assert.rejects(()=>db.exec("update public.profiles set role='admin'"),/permission denied/);
    await assert.rejects(()=>db.exec("insert into public.people(first_name,last_name) values('Blocked','Write')"),/row-level security/);
  });
});
test('favorites are idempotent, owner-private and reject archived members',async()=>{
  await as(member,async()=>{
    await db.query('select public.set_favorite($1,true)',[person]);
    await db.query('select public.set_favorite($1,true)',[person]);
    assert.equal(await scalar('select count(*)::int from public.favorites'),1);
    await assert.rejects(()=>db.query('select public.set_favorite($1,true)',[archived]),/Member unavailable/);
  });
  await as(other,async()=>assert.equal(await scalar('select count(*)::int from public.favorites'),0));
  await as(admin,async()=>assert.equal(await scalar('select count(*)::int from public.favorites'),0));
});
test('reminders enforce ownership and revision conflicts across edits/completion/deletion',async()=>{
  let reminder;
  await as(member,async()=>{
    reminder=await scalar("select public.save_reminder(null,null,$1,'Call this week',now()+interval '2 days')",[person]);
    await db.query("select public.save_reminder($1,1,$2,'Call tomorrow',now()+interval '1 day')",[reminder,person]);
    await assert.rejects(()=>db.query('select public.complete_reminder($1,1,true)',[reminder]),/changed/);
  });
  await as(other,async()=>{
    assert.equal(await scalar('select count(*)::int from public.personal_reminders'),0);
    await assert.rejects(()=>db.query('select public.delete_reminder($1,2)',[reminder]),/unavailable/);
  });
  await as(member,async()=>{
    await db.query('select public.complete_reminder($1,2,true)',[reminder]);
    assert.equal(await scalar('select revision from public.personal_reminders where id=$1',[reminder]),3);
    await db.query('select public.delete_reminder($1,3)',[reminder]);
    assert.equal(await scalar('select count(*)::int from public.personal_reminders'),0);
  });
});
test('preferences cannot be inserted for another account',async()=>{
  await as(member,async()=>{
    await db.exec('insert into public.account_preferences default values');
    await assert.rejects(()=>db.query('insert into public.account_preferences(owner_id) values($1)',[other]),/row-level security/);
  });
});
test('member validation and timestamps are enforced on direct editor writes',async()=>{
  await as(editor,async()=>{
    await assert.rejects(()=>db.exec("insert into public.people(first_name,last_name) values('  ','Example')"),/names must contain/);
    await assert.rejects(()=>db.exec("insert into public.people(first_name,last_name,date_of_birth) values('Future','Example',current_date+1)"),/cannot be in the future/);
    const original=await scalar('select updated_at::text from public.people where id=$1',[person]);
    await db.query("update public.people set phone='555-0100',updated_at='2000-01-01' where id=$1 and updated_at=$2",[person,original]);
    const changed=await scalar('select updated_at::text from public.people where id=$1',[person]);
    assert.notEqual(changed,original);
    assert.equal((await db.query("update public.people set phone='stale' where id=$1 and updated_at=$2 returning id",[person,original])).rows.length,0);
  });
});
test('reminder scheduling rejects past time while overdue completion remains supported',async()=>{
  await as(member,async()=>{
    await assert.rejects(()=>db.query("select public.save_reminder(null,null,$1,'Too late',now()-interval '1 day')",[person]),/future reminder/);
  });
  const reminder=await scalar("insert into public.personal_reminders(owner_id,title,due_at) values($1,'Overdue',now()-interval '1 day') returning id",[member]);
  await as(member,()=>db.query('select public.complete_reminder($1,1,true)',[reminder]));
});
test('revoked users can initiate idempotent deletion intake without claiming completion',async()=>{
  await as(revoked,async()=>{
    const first=await scalar('select public.request_account_deletion()');
    const second=await scalar('select public.request_account_deletion()');
    assert.equal(first,second);
    assert.equal(await scalar('select status from public.account_deletion_requests'),'requested');
    await assert.rejects(()=>db.exec("update public.account_deletion_requests set status='completed'"),/permission denied/);
  });
  await as(admin,async()=>assert.equal(await scalar('select count(*)::int from public.account_deletion_requests'),0));
});
test('Apple first-consent names fill only the caller initial fallback even while pending',async()=>{
  await as(pending,async()=>{
    await db.query('select public.set_initial_display_name($1)',['  Fictional Apple Name  ']);
    assert.equal(await scalar('select display_name from public.profiles'),'Fictional Apple Name');
    await db.query('select public.set_initial_display_name($1)',['Overwrite attempt']);
    assert.equal(await scalar('select display_name from public.profiles'),'Fictional Apple Name');
    await assert.rejects(()=>db.query('select public.set_initial_display_name($1)',[' ']),/1 to 200/);
    assert.equal(await scalar('select status::text from public.profiles'),'pending');
    assert.equal(await scalar('select role::text from public.profiles'),'member');
  });
  assert.notEqual(await scalar('select display_name from public.profiles where id=$1',[other]),'Fictional Apple Name');
});
test('device tokens are not client-readable or transferable between users',async()=>{
  const installation=uuid(200), token='a'.repeat(64);
  await as(member,async()=>{
    await db.query("select public.register_push_device($1,$2,'sandbox')",[installation,token]);
    await assert.rejects(()=>db.exec('select * from public.push_devices'),/permission denied/);
  });
  await as(other,async()=>{
    await assert.rejects(()=>db.query("select public.register_push_device($1,$2,'sandbox')",[installation,'b'.repeat(64)]),/another account/);
    await db.query('select public.unregister_push_device($1)',[installation]);
  });
  assert.equal(await scalar('select count(*)::int from public.push_devices'),1);
  await as(member,()=>db.query('select public.unregister_push_device($1)',[installation]));
});
test('visit access excludes unassigned members, editors and admins; stale decisions fail',async()=>{
  let visit;
  const submission=uuid(301);
  await as(pastor,async()=>{
    visit=await scalar("select public.save_visit(null,null,$1,'Church office',now()+interval '2 days','Private care note',$2,$3)",[person,[deacon],submission]);
    assert.equal(await scalar("select public.save_visit(null,null,$1,'Church office',now()+interval '2 days','Private care note',$2,$3)",[person,[deacon],submission]),visit);
    await db.query("select public.save_visit($1,1,$2,'Meeting room',now()+interval '3 days','Updated care note',$3,$4)",[visit,person,[deacon],submission]);
  });
  for(const user of [member,other,admin,editor,pending,revoked]) await as(user,async()=>{
    assert.equal(await scalar('select count(*)::int from public.visit_requests'),0);
    assert.equal(await scalar('select count(*)::int from public.visit_recipients'),0);
    await assert.rejects(()=>db.query("select public.respond_visit($1,'accepted','',2)",[visit]),/Deacon access required/);
  });
  await as(deacon,async()=>{
    assert.equal(await scalar('select count(*)::int from public.visit_requests'),1);
    await assert.rejects(()=>db.query("select public.respond_visit($1,'accepted','',1)",[visit]),/changed/);
    await db.query("select public.respond_visit($1,'accepted','',2)",[visit]);
  });
  await as(pastor,async()=>{
    await db.query('select public.archive_visit($1,2)',[visit]);
    assert.equal(await scalar('select status from public.visit_requests where id=$1',[visit]),'completed');
    assert.notEqual(await scalar('select archived_at from public.visit_requests where id=$1',[visit]),null);
  });
});
test('account review cannot remove the acting administrator or combine ministries',async()=>{
  await as(admin,async()=>{
    await assert.rejects(()=>db.query("select public.review_account($1,'revoked','member',null,null)",[admin]),/own access/);
    await assert.rejects(()=>db.query("select public.review_account_designations($1,'active','member',null,null,true,true)",[other]),/either pastor or deacon/);
  });
});
test('notification queue deduplicates, hides personal text, rechecks permissions and retries with leases',async()=>{
  const installation=uuid(410);
  await as(member,async()=>{
    await db.exec('update public.account_preferences set reminder_notifications=true');
    await db.query("select public.register_push_device($1,$2,'sandbox')",[installation,'c'.repeat(64)]);
    await assert.rejects(()=>db.exec('select public.claim_notification_jobs(10)'),/permission denied/);
    await assert.rejects(()=>db.exec('select * from public.notification_jobs'),/permission denied/);
  });
  const reminder=await scalar("insert into public.personal_reminders(owner_id,title,due_at) values($1,'PRIVATE CONTENT MUST NEVER APPEAR',now()-interval '1 minute') returning id",[member]);
  await worker(async()=>{
    assert.equal(await scalar('select public.queue_due_notifications()'),1);
    assert.equal(await scalar('select public.queue_due_notifications()'),0);
  });
  let claimed;
  await worker(async()=>{
    claimed=(await db.query('select * from public.claim_notification_jobs(10)')).rows[0];
    assert.equal(claimed.entity_id,reminder);
    assert.equal(claimed.device_token,'c'.repeat(64));
    assert.equal(JSON.stringify(claimed.payload).includes('PRIVATE'),false);
    assert.equal(await scalar('select public.revalidate_notification_job($1,$2)',[claimed.job_id,claimed.lease_token]),true);
    assert.equal((await db.query('select * from public.claim_notification_jobs(10)')).rows.length,0);
    await assert.rejects(()=>db.query("select public.finish_notification_job($1,$2,'dispatched',null)",[claimed.job_id,uuid(999)]),/lease expired/);
    await db.query("select public.finish_notification_job($1,$2,'retry','ServiceUnavailable')",[claimed.job_id,claimed.lease_token]);
    assert.equal((await db.query('select * from public.claim_notification_jobs(10)')).rows.length,0);
  });
  await db.query("update public.notification_jobs set next_attempt_at=now()-interval '1 minute' where id=$1",[claimed.job_id]);
  await worker(async()=>{claimed=(await db.query('select * from public.claim_notification_jobs(10)')).rows[0];});
  await db.query("update public.profiles set status='revoked' where id=$1",[member]);
  await worker(async()=>{
    assert.equal(await scalar('select public.revalidate_notification_job($1,$2)',[claimed.job_id,claimed.lease_token]),false);
    await db.query("select public.finish_notification_job($1,$2,'discarded',null)",[claimed.job_id,claimed.lease_token]);
  });
  await db.query("update public.profiles set status='active' where id=$1",[member]);
  await as(member,()=>db.query('select public.complete_reminder($1,1,true)',[reminder]));
});
test('visit change triggers enqueue generic invitation, response and cancellation events',async()=>{
  for(const [user,installation,token] of [[pastor,uuid(501),'d'.repeat(64)],[deacon,uuid(502),'e'.repeat(64)]])
    await as(user,async()=>{
      await db.exec('insert into public.account_preferences(visit_notifications) values(true)');
      await db.query("select public.register_push_device($1,$2,'sandbox')",[installation,token]);
    });
  let visit;
  await as(pastor,async()=>{visit=await scalar("select public.save_visit(null,null,$1,'Private address',now()+interval '1 day','Private note',$2,$3)",[person,[deacon],uuid(550)]);});
  assert.equal(await scalar("select count(*)::int from public.notification_jobs where entity_id=$1 and kind='visit_created'",[visit]),1);
  await as(deacon,()=>db.query("select public.respond_visit($1,'accepted','',1)",[visit]));
  assert.equal(await scalar("select count(*)::int from public.notification_jobs where entity_id=$1 and kind='visit_response'",[visit]),1);
  await as(pastor,()=>db.query("select public.close_visit($1,'cancelled',1)",[visit]));
  assert.equal(await scalar("select count(*)::int from public.notification_jobs where entity_id=$1 and kind='visit_cancelled'",[visit]),1);
  await worker(async()=>{
    const jobs=(await db.query('select * from public.claim_notification_jobs(100)')).rows;
    assert.equal(jobs.length,1);
    assert.equal(jobs[0].kind,'visit_cancelled');
    assert.equal(JSON.stringify(jobs[0].payload).includes('Private'),false);
    await db.query("select public.finish_notification_job($1,$2,'invalid_token','Unregistered')",[jobs[0].job_id,jobs[0].lease_token]);
  });
  assert.equal(await scalar('select count(*)::int from public.push_devices where installation_id=$1',[uuid(502)]),0);
});
test('birthdays preserve date-only and leap-day semantics across century boundaries',async()=>{
  for(const [birth,day,expected] of [
    ['1980-02-29','2025-02-28',true],['1980-02-29','2024-02-28',false],
    ['1980-02-29','2024-02-29',true],['1980-02-29','2100-02-28',true],
    ['1980-02-29','2000-02-28',false],['1970-12-31','2026-12-31',true],
    ['1970-12-31','2027-01-01',false],[null,'2026-09-16',false]
  ]) assert.equal(await scalar('select public.birthday_occurs_on($1,$2)',[birth,day]),expected);
});
test('six-hour automatic visit completion and archive remain separate operations',async()=>{
  const visit=await scalar("insert into public.visit_requests(pastor_id,person_id,pastor_name,member_name,member_address,location,scheduled_at,submission_key) values($1,$2,'Fictional pastor','Fictional member','Private','Office',now()-interval '7 hours',$3) returning id",[pastor,person,uuid(601)]);
  assert.equal(await scalar('select public.auto_complete_visits()'),1);
  assert.equal(await scalar('select status from public.visit_requests where id=$1',[visit]),'completed');
  assert.equal(await scalar('select archived_at from public.visit_requests where id=$1',[visit]),null);
  await db.query("update public.visit_requests set updated_at=now()-interval '7 hours' where id=$1",[visit]);
  assert.equal(await scalar('select public.auto_archive_visits()'),1);
  assert.notEqual(await scalar('select archived_at from public.visit_requests where id=$1',[visit]),null);
});
test('rotated device survives an invalid-token response for its predecessor',async()=>{
  await as(member,()=>db.exec("update public.account_preferences set language='uk'"));
  const reminder=await scalar("insert into public.personal_reminders(owner_id,title,due_at) values($1,'Rotation test',now()-interval '1 minute') returning id",[member]);
  let job;
  await worker(async()=>{
    await db.exec('select public.queue_due_notifications()');
    job=(await db.query('select * from public.claim_notification_jobs(50)')).rows.find(j=>j.entity_id===reminder);
    assert.equal(job.payload.language,'uk');
  });
  await as(member,()=>db.query("select public.register_push_device($1,$2,'sandbox')",[uuid(410),'f'.repeat(64)]));
  await worker(async()=>{
    assert.equal(await scalar('select public.revalidate_notification_job($1,$2)',[job.job_id,job.lease_token]),false);
    await db.query("select public.finish_notification_job($1,$2,'invalid_token','Unregistered')",[job.job_id,job.lease_token]);
  });
  assert.equal(await scalar('select token from public.push_devices where installation_id=$1',[uuid(410)]),'f'.repeat(64));
  await as(member,()=>db.query('select public.complete_reminder($1,1,true)',[reminder]));
});
test('birthday authorization drops yesterday jobs and notices corrected birth dates',async()=>{
  await as(deacon,async()=>{
    await db.exec('update public.account_preferences set birthday_notifications=true');
    await db.query("select public.register_push_device($1,$2,'sandbox')",[uuid(710),'1'.repeat(64)]);
  });
  await as(editor,async()=>{
    const group=await scalar("select public.save_deacon_group(null,'Fictional care group',$1)",[[deacon]]);
    await db.query('select public.assign_deacon_group_member($1,$2,null)',[person,group]);
  });
  await db.query("update public.people set date_of_birth=make_date(1980,extract(month from now() at time zone 'America/Los_Angeles')::int,extract(day from now() at time zone 'America/Los_Angeles')::int) where id=$1",[person]);
  const today=await scalar("select ((now() at time zone 'America/Los_Angeles')::date-date '2000-01-01')::int");
  await db.query("select public.enqueue_native_notification($1,'birthday',$2,$3,'test-yesterday')",[deacon,person,today-1]);
  const stale=await scalar("select id from public.notification_jobs where deduplication_key='test-yesterday'");
  assert.equal(await scalar('select public.notification_job_allowed($1)',[stale]),false);
  await db.query("select public.enqueue_native_notification($1,'birthday',$2,$3,'test-today')",[deacon,person,today]);
  const current=await scalar("select id from public.notification_jobs where deduplication_key='test-today'");
  assert.equal(await scalar('select public.notification_job_allowed($1)',[current]),true);
  await db.query('update public.people set date_of_birth=null where id=$1',[person]);
  assert.equal(await scalar('select public.notification_job_allowed($1)',[current]),false);
  assert.equal(await scalar("select ('2026-01-01 07:30:00+00'::timestamptz at time zone 'America/Los_Angeles')::date::text"),'2025-12-31');
});
test('native directory/group projections expose compatible fields without opening profiles',async()=>{
  const linkedPerson=uuid(801);
  await db.query("insert into public.people(id,first_name,last_name,phone) values($1,'Fictional','Deacon','555-0102')",[linkedPerson]);
  await db.query('update public.profiles set person_id=$1 where id=$2',[linkedPerson,deacon]);
  await as(member,async()=>{
    const row=(await db.query('select * from public.people where id=$1',[linkedPerson])).rows[0];
    assert.equal(row.first_name,'Fictional');
    assert.equal(row.date_of_birth,null);
    assert.equal(row.membership_joined_at,null);
    assert.equal(row.marital_status,null);
    assert.equal(row.is_orphan,false);
    const leaders=(await db.query('select * from public.list_group_deacons()')).rows;
    assert.equal(leaders.length,1);
    assert.equal(leaders[0].profile_id,deacon);
    assert.equal(leaders[0].person_id,linkedPerson);
    assert.equal(leaders[0].display_name,'Fictional Deacon');
    assert.equal(leaders[0].status,'active');
    assert.equal(leaders[0].phone,'555-0102');
    assert.equal('email' in leaders[0],false);
    const membership=(await db.query('select person_id,group_id from public.deacon_group_members where person_id=$1',[person])).rows[0];
    assert.equal(membership.group_id,leaders[0].group_id);
    const ministry=(await db.query('select * from public.list_member_ministries() where person_id=$1',[linkedPerson])).rows[0];
    assert.deepEqual(ministry.ministry_roles,['deacon']);
    assert.equal(await scalar('select count(*)::int from public.profiles where id=$1',[deacon]),0);
    await assert.rejects(()=>db.exec('select * from public.list_eligible_deacons()'),/Editor access required/);
  });
  await as(editor,async()=>{
    const rows=(await db.query('select * from public.list_eligible_deacons()')).rows;
    assert.equal(rows[0].id,deacon);
    assert.equal(rows[0].display_name,'Fictional Deacon');
    assert.ok(rows[0].group_id);
  });
  await as(pastor,async()=>{
    const rows=(await db.query('select * from public.list_visit_deacons()')).rows;
    assert.equal(rows[0].id,deacon);
    assert.equal(rows[0].name,'Fictional Deacon');
    assert.ok(rows[0].group_id);
  });
});
test('group transfers reject stale source and cannot delete assigned groups',async()=>{
  await as(editor,async()=>{
    const previous=await scalar('select group_id from public.deacon_group_members where person_id=$1',[person]);
    const next=await scalar("select public.save_deacon_group(null,'Second fictional group','{}')");
    await assert.rejects(()=>db.query('select public.assign_deacon_group_member($1,$2,null)',[person,next]),/Assignment changed/);
    await assert.rejects(()=>db.query('select public.delete_deacon_group($1)',[previous]),/Remove all member and deacon assignments/);
    await assert.rejects(()=>db.query("select public.save_deacon_group(null,'Duplicate leader group',$1)",[[deacon]]),/already belongs/);
    await db.query('select public.assign_deacon_group_member($1,$2,$3)',[person,next,previous]);
    assert.equal(await scalar('select group_id from public.deacon_group_members where person_id=$1',[person]),next);
  });
});
