begin;

alter table public.visit_requests
  add column if not exists archived_at timestamptz;

create index if not exists visit_archive_idx
  on public.visit_requests(archived_at,scheduled_at desc);

create or replace function public.archive_visit(target uuid,expected_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
  perform pg_advisory_xact_lock(20260915,1);
  if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
  select * into v from public.visit_requests where id=target for update;
  if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
  if v.status='open' then raise exception 'Complete or cancel the visit before archiving'; end if;
  if v.archived_at is not null then return; end if;
  if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
  update public.visit_requests set archived_at=now() where id=target;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'visit.archived','visit',target::text,jsonb_build_object('automatic',false));
end $$;

create or replace function public.auto_archive_visits() returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform pg_advisory_xact_lock(20260915,1);
  with archived as (
    update public.visit_requests set archived_at=now()
    where archived_at is null and status='completed' and updated_at<=now()-interval '6 hours'
    returning id
  ), audited as (
    insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
      select null,'visit.auto_archived','visit',id::text,jsonb_build_object('automatic',true)
      from archived returning id
  ) select count(*) into total from audited;
  return total;
end $$;

revoke all on function public.archive_visit(uuid,integer),public.auto_archive_visits()
  from public,anon,authenticated;
grant execute on function public.archive_visit(uuid,integer) to authenticated;

commit;

-- Hosted scheduler (not available in the embedded PostgreSQL test runtime).
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname='visitation-auto-archive';
select cron.schedule('visitation-auto-archive','* * * * *','select public.auto_archive_visits();');
select public.auto_archive_visits();
commit;
