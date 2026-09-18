-- Pastors and deacons can plan visits. The planner is an implicit attendee;
-- selected active leaders are additional participants who respond independently.
begin;

alter table public.visit_requests rename column pastor_id to planner_id;
alter table public.visit_recipients rename to visit_participants;
alter index public.visits_pastor_date rename to visits_planner_date;
alter index public.recipients_account rename to participants_account;

create or replace function app_private.visitation_leader()
returns boolean language sql stable security definer set search_path='' as $$
  select app_private.designated('pastor') or app_private.designated('deacon')
$$;
revoke all on function app_private.visitation_leader() from public,anon,authenticated;

create or replace function app_private.visit_participant(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select app_private.visitation_leader() and (
    exists(select 1 from public.visit_requests where id=p_id and planner_id=auth.uid())
    or exists(select 1 from public.visit_participants where visit_id=p_id and account_id=auth.uid())
  )
$$;

create or replace function app_private.queue_visit(p_visit public.visit_requests,p_kind text)
returns void language sql security definer set search_path='' as $$
  insert into public.visit_notification_events(visit_id,account_id,revision,kind)
    select p_visit.id,account_id,p_visit.revision,p_kind from public.visit_participants where visit_id=p_visit.id
    union select p_visit.id,p_visit.planner_id,p_visit.revision,p_kind where p_visit.planner_id is not null
    on conflict(visit_id,account_id,revision,kind) do nothing
$$;

drop function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]);
create function public.save_visit(
  p_id uuid,
  p_revision integer,
  p_submission_id uuid,
  p_person_id uuid,
  p_scheduled_at timestamptz,
  p_location text,
  p_notes text,
  p_participant_ids uuid[]
) returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests;
begin
  if not app_private.visitation_leader() then raise exception 'Only active pastors or deacons can plan visits'; end if;
  if p_participant_ids is null or cardinality(p_participant_ids)<1
    or cardinality(p_participant_ids)<>(select count(distinct x) from unnest(p_participant_ids) x)
  then raise exception 'Choose at least one distinct participant'; end if;
  if auth.uid()=any(p_participant_ids) then raise exception 'The planner is already included in the visit'; end if;
  if exists(
    select 1 from unnest(p_participant_ids) x
    where not exists(
      select 1 from public.profiles p
      where p.id=x and p.status='active'
        and app_private.person_leadership(p.person_id) in ('pastor','deacon')
    )
  ) then raise exception 'Choose active pastors or deacons'; end if;
  if not exists(select 1 from public.people where id=p_person_id and archived_at is null) then raise exception 'Choose an active member'; end if;

  if p_id is null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_submission_id::text,0));
    select * into result from public.visit_requests where planner_id=auth.uid() and submission_id=p_submission_id;
    if found then return result; end if;
    insert into public.visit_requests(planner_id,person_id,scheduled_at,location,notes,submission_id)
      values(auth.uid(),p_person_id,p_scheduled_at,trim(p_location),coalesce(p_notes,''),p_submission_id)
      returning * into result;
  else
    update public.visit_requests
      set person_id=p_person_id,scheduled_at=p_scheduled_at,location=trim(p_location),notes=coalesce(p_notes,''),revision=revision+1
      where id=p_id and planner_id=auth.uid() and revision=p_revision and status='open' and archived_at is null
      returning * into result;
    if not found then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
    delete from public.visit_participants where visit_id=p_id;
  end if;

  insert into public.visit_participants(visit_id,account_id)
    select result.id,unnest(p_participant_ids);
  perform app_private.queue_visit(result,'visit.updated');
  perform app_private.audit('visit.saved',result.id);
  return result;
end $$;

create or replace function public.respond_to_visit(p_id uuid,p_revision integer,p_response text,p_reason text)
returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests;
begin
  if not app_private.visitation_leader() then raise exception 'Only active invited pastors or deacons can respond'; end if;
  if p_response not in ('accepted','declined') or p_response is null then raise exception 'Choose accept or decline'; end if;
  select * into result from public.visit_requests where id=p_id for update;
  if not found or not exists(select 1 from public.visit_participants where visit_id=p_id and account_id=auth.uid()) then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision or result.status<>'open' or result.archived_at is not null then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
  update public.visit_participants set response=p_response,reason=nullif(trim(p_reason),''),responded_at=now()
    where visit_id=p_id and account_id=auth.uid();
  update public.visit_requests set revision=revision+1 where id=p_id returning * into result;
  perform app_private.queue_visit(result,'visit.response');
  perform app_private.audit('visit.responded',result.id);
  return result;
end $$;

create or replace function public.transition_visit(p_id uuid,p_revision integer,p_action text)
returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests;
begin
  if not app_private.visitation_leader() then raise exception 'Not authorized'; end if;
  select * into result from public.visit_requests where id=p_id and planner_id=auth.uid() for update;
  if not found then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision then raise exception 'Conflict: visit changed. Reload and try again.'; end if;
  if p_action in ('complete','cancel') and result.status='open' and result.archived_at is null then
    update public.visit_requests set status=case when p_action='complete' then 'completed' else 'cancelled' end,
      completed_at=case when p_action='complete' then now() else null end,revision=revision+1
      where id=p_id returning * into result;
  elsif p_action='archive' and result.status<>'open' and result.archived_at is null then
    update public.visit_requests set archived_at=now(),revision=revision+1 where id=p_id returning * into result;
  elsif p_action='restore' and result.archived_at is not null then
    update public.visit_requests set archived_at=null,revision=revision+1 where id=p_id returning * into result;
  else raise exception 'Invalid visit transition'; end if;
  perform app_private.queue_visit(result,'visit.' || p_action);
  perform app_private.audit('visit.' || p_action,result.id);
  return result;
end $$;

create or replace function public.mark_visit_viewed(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
  if not app_private.visit_participant(p_id) then raise exception 'Not authorized'; end if;
  select revision into current_revision from public.visit_requests where id=p_id;
  if p_revision is null or p_revision<1 or p_revision>current_revision then raise exception 'Invalid viewed revision'; end if;
  update public.visit_participants set last_viewed_revision=greatest(last_viewed_revision,p_revision)
    where visit_id=p_id and account_id=auth.uid();
end $$;

create or replace function public.directory_visible_visit_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from public.visit_requests visit
  where visit.archived_at is null and visit.status='open' and app_private.visitation_leader()
    and (visit.planner_id=auth.uid() or exists(
      select 1 from public.visit_participants participant
      where participant.visit_id=visit.id and participant.account_id=auth.uid()
    ))
$$;

create or replace function public.visit_person_defaults()
returns table(person_id uuid,address text) language sql stable security definer set search_path='' as $$
  select p.id,private.address
  from public.people p left join public.people_private private on private.person_id=p.id
  where p.archived_at is null and app_private.visitation_leader()
$$;

revoke all on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]) to authenticated;
revoke all on function public.visit_person_defaults() from public,anon,authenticated;
grant execute on function public.visit_person_defaults() to authenticated;

create or replace function public.mobile_contract_version() returns text language sql immutable set search_path='' as $$
  select 'expo-directory-v3'::text
$$;

notify pgrst,'reload schema';
commit;
