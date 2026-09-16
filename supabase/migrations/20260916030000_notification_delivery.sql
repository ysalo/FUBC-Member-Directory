begin;
-- One outbox entry per installation makes partial multi-device delivery retryable.
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null references public.push_devices(installation_id) on delete cascade,
  kind text not null check(kind in ('visit_created','visit_updated','visit_cancelled','visit_completed','visit_response','personal_reminder','birthday')),
  entity_id uuid not null, revision integer not null,
  deduplication_key text not null,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','dispatched','discarded','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,lease_expires_at timestamptz,
  claimed_token text,claimed_environment text,
  failure_reason text,created_at timestamptz not null default now(),dispatched_at timestamptz,
  unique(installation_id,deduplication_key)
);
create index notification_jobs_ready on public.notification_jobs(next_attempt_at) where status in ('pending','processing');
alter table public.notification_jobs enable row level security;
revoke all on public.notification_jobs from public,anon,authenticated;

create function public.enqueue_native_notification(recipient uuid,notification_kind text,entity uuid,entity_revision integer,event_key text)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  insert into public.notification_jobs(owner_id,installation_id,kind,entity_id,revision,deduplication_key,payload)
  select recipient,d.installation_id,notification_kind,entity,entity_revision,event_key,
    jsonb_build_object('aps',jsonb_build_object('alert',jsonb_build_object(
      'title','Church Directory','body',case when notification_kind='personal_reminder' then 'You have a personal reminder.'
      when notification_kind='birthday' then 'You have a birthday reminder.' else 'You have a visit update.' end),
      'sound','default'),'kind',notification_kind,'entity_id',entity::text)
  from public.push_devices d join public.profiles p on p.id=d.owner_id
  join public.account_preferences pref on pref.owner_id=p.id
  where p.id=recipient and p.status='active' and
    case when notification_kind='personal_reminder' then pref.reminder_notifications
      when notification_kind='birthday' then pref.birthday_notifications else pref.visit_notifications end
  on conflict(installation_id,deduplication_key) do nothing;
  get diagnostics total=row_count;
  return total;
end $$;

create function public.queue_visit_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; event_kind text;
begin
  if TG_TABLE_NAME='visit_recipients' then
    if TG_OP='INSERT' then
      select revision into r from public.visit_requests where id=new.request_id;
      perform public.enqueue_native_notification(new.deacon_id,'visit_created',new.request_id,r.revision,'visit-created:'||new.request_id::text);
    elsif new.response is distinct from old.response or new.decline_reason is distinct from old.decline_reason then
      select pastor_id,revision into r from public.visit_requests where id=new.request_id;
      perform public.enqueue_native_notification(r.pastor_id,'visit_response',new.request_id,r.revision,
        'visit-response:'||new.request_id::text||':'||new.deacon_id::text||':'||new.responded_at::text);
    end if;
  else
    if new.status is distinct from old.status then event_kind:='visit_'||new.status;
    elsif new.revision is distinct from old.revision then event_kind:='visit_updated';
    else return new; end if;
    for r in select deacon_id from public.visit_recipients where request_id=new.id loop
      perform public.enqueue_native_notification(r.deacon_id,event_kind,new.id,new.revision,
        event_kind||':'||new.id::text||':'||new.revision::text);
    end loop;
  end if;
  return new;
end $$;
create trigger native_visit_change after update on public.visit_requests for each row execute function public.queue_visit_changes();
create trigger native_visit_response after insert or update on public.visit_recipients for each row execute function public.queue_visit_changes();

create function public.birthday_occurs_on(birth_date date,observed_date date) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    (extract(month from birth_date)=extract(month from observed_date) and extract(day from birth_date)=extract(day from observed_date))
    or (extract(month from birth_date)=2 and extract(day from birth_date)=29
      and extract(month from observed_date)=2 and extract(day from observed_date)=28
      and extract(month from observed_date+1)=3),false)
$$;
create function public.queue_due_notifications() returns integer language plpgsql security definer set search_path='' as $$
declare row_data record; total integer:=0; church_now timestamp:=now() at time zone 'America/Los_Angeles';
begin
  -- Schedulers can overlap safely because event/device keys are unique.
  for row_data in select id,owner_id,revision from public.personal_reminders where due_at<=now() and completed_at is null loop
    total:=total+public.enqueue_native_notification(row_data.owner_id,'personal_reminder',row_data.id,row_data.revision,
      'reminder:'||row_data.id::text||':'||row_data.revision::text);
  end loop;
  -- Birthdays use the church's named timezone, independently of fixed-offset visits.
  -- Preserve the prototype's Feb 28 observance for Feb 29 in non-leap years.
  if church_now::time >= time '09:00' then
    for row_data in
      select distinct leader.profile_id,person.id from public.people person
      join public.deacon_group_members membership on membership.person_id=person.id
      join public.deacon_group_deacons leader on leader.group_id=membership.group_id
      join public.profiles account on account.id=leader.profile_id
      where person.archived_at is null and account.status='active' and 'deacon'=any(account.ministry_roles)
      and public.birthday_occurs_on(person.date_of_birth,church_now::date)
    loop
      total:=total+public.enqueue_native_notification(row_data.profile_id,'birthday',row_data.id,
        (church_now::date-date '2000-01-01')::integer,'birthday:'||row_data.id::text||':'||church_now::date::text);
    end loop;
  end if;
  return total;
end $$;

create function public.notification_job_allowed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.notification_jobs j
    join public.profiles p on p.id=j.owner_id and p.status='active'
    join public.push_devices d on d.installation_id=j.installation_id and d.owner_id=j.owner_id
    join public.account_preferences pref on pref.owner_id=j.owner_id
    where j.id=target and (j.claimed_token is null or (j.claimed_token=d.token and j.claimed_environment=d.environment))
    and case
      when j.kind='personal_reminder' then pref.reminder_notifications and exists(
        select 1 from public.personal_reminders reminder where reminder.id=j.entity_id and reminder.owner_id=j.owner_id
        and reminder.revision=j.revision and reminder.completed_at is null and reminder.due_at<=now())
      when j.kind='birthday' then pref.birthday_notifications and 'deacon'=any(p.ministry_roles)
        and j.revision=((now() at time zone 'America/Los_Angeles')::date-date '2000-01-01')::integer
        and exists(select 1 from public.people person
          join public.deacon_group_members m on m.person_id=person.id
          join public.deacon_group_deacons leader on leader.group_id=m.group_id
          where person.id=j.entity_id and person.archived_at is null and leader.profile_id=j.owner_id
          and public.birthday_occurs_on(person.date_of_birth,(now() at time zone 'America/Los_Angeles')::date))
      else pref.visit_notifications and exists(
        select 1 from public.visit_requests v where v.id=j.entity_id and v.revision=j.revision
        and (v.archived_at is null or j.kind='visit_completed')
        and ((v.pastor_id=j.owner_id and 'pastor'=any(p.ministry_roles)) or
          ('deacon'=any(p.ministry_roles) and exists(select 1 from public.visit_recipients r where r.request_id=v.id and r.deacon_id=j.owner_id)))
        and case when j.kind in ('visit_created','visit_updated','visit_response') then v.status='open'
          when j.kind='visit_cancelled' then v.status='cancelled' when j.kind='visit_completed' then v.status='completed' else false end)
    end
  )
$$;

create function public.claim_notification_jobs(batch_size integer default 50)
returns table(job_id uuid,lease_token uuid,kind text,entity_id uuid,revision integer,installation_id uuid,device_token text,apns_environment text,payload jsonb)
language plpgsql security definer set search_path='' as $$
declare j public.notification_jobs; d public.push_devices;
begin
  if batch_size is null or batch_size not between 1 and 100 then raise exception 'Batch size must be between 1 and 100'; end if;
  for j in select * from public.notification_jobs q
    where (q.status='pending' and q.next_attempt_at<=now()) or (q.status='processing' and q.lease_expires_at<now())
    order by q.created_at limit batch_size for update skip locked
  loop
    if j.attempts>=8 then
      update public.notification_jobs set status='failed',failure_reason='Retry limit reached' where id=j.id;
    elsif not public.notification_job_allowed(j.id) then
      update public.notification_jobs set status='discarded' where id=j.id;
    else
      select * into d from public.push_devices where push_devices.installation_id=j.installation_id;
      update public.notification_jobs set status='processing',attempts=attempts+1,
        lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',claimed_token=d.token,claimed_environment=d.environment
        where id=j.id returning * into j;
      job_id:=j.id;lease_token:=j.lease_token;kind:=j.kind;entity_id:=j.entity_id;revision:=j.revision;
      installation_id:=j.installation_id;device_token:=d.token;apns_environment:=d.environment;
      payload:=j.payload||jsonb_build_object('language',(select pref.language from public.account_preferences pref where pref.owner_id=j.owner_id));
      return next;
    end if;
  end loop;
end $$;

create function public.revalidate_notification_job(target uuid,lease uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.notification_jobs j where j.id=target and j.lease_token=lease
    and j.status='processing' and j.lease_expires_at>now() and public.notification_job_allowed(j.id))
$$;
create function public.finish_notification_job(target uuid,lease uuid,outcome text,failure_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
declare j public.notification_jobs;
begin
  if outcome is null or outcome not in ('dispatched','retry','discarded','invalid_token') then raise exception 'Invalid delivery outcome'; end if;
  select * into j from public.notification_jobs where id=target and lease_token=lease
    and status='processing' and lease_expires_at>now() for update;
  if not found then raise exception 'Notification lease expired or unavailable'; end if;
  if outcome='invalid_token' then
    -- Do not remove a rotated token based on the result for its predecessor.
    delete from public.push_devices where installation_id=j.installation_id and token=j.claimed_token and environment=j.claimed_environment;
    update public.notification_jobs set status='discarded',lease_token=null,lease_expires_at=null where id=target;
    return;
  end if;
  update public.notification_jobs set status=case when outcome='retry' then case when attempts>=8 then 'failed' else 'pending' end else outcome end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),
    dispatched_at=case when outcome='dispatched' then now() else dispatched_at end,
    failure_reason=left(finish_notification_job.failure_reason,200),lease_token=null,lease_expires_at=null
    where id=target;
end $$;

revoke all on function public.enqueue_native_notification(uuid,text,uuid,integer,text),public.queue_visit_changes(),public.birthday_occurs_on(date,date),
  public.queue_due_notifications(),public.notification_job_allowed(uuid),public.claim_notification_jobs(integer),
  public.revalidate_notification_job(uuid,uuid),public.finish_notification_job(uuid,uuid,text,text) from public,anon,authenticated;
grant usage on schema public to service_role;
grant execute on function public.queue_due_notifications(),public.claim_notification_jobs(integer),
  public.revalidate_notification_job(uuid,uuid),public.finish_notification_job(uuid,uuid,text,text) to service_role;
commit;
