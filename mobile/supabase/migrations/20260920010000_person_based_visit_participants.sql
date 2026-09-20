begin;

alter table public.visit_participants add column if not exists person_id uuid;
update public.visit_participants participant
set person_id=profile.person_id
from public.profiles profile
where profile.id=participant.account_id and participant.person_id is null;

do $$
begin
  if exists(select 1 from public.visit_participants where person_id is null) then
    raise exception 'Every existing visit participant must be linked to a directory person before this migration';
  end if;
end $$;

alter table public.visit_participants drop constraint if exists visit_recipients_pkey;
alter table public.visit_participants drop constraint if exists visit_participants_pkey;
alter table public.visit_participants drop constraint if exists visit_recipients_account_id_fkey;
alter table public.visit_participants alter column account_id drop not null;
alter table public.visit_participants alter column person_id set not null;
alter table public.visit_participants
  add constraint visit_participants_person_id_fkey foreign key(person_id) references public.people(id) on delete cascade;
alter table public.visit_participants
  add constraint visit_participants_account_id_fkey foreign key(account_id) references public.profiles(id) on delete set null;
alter table public.visit_participants add primary key(visit_id,person_id);
create index if not exists participants_person on public.visit_participants(person_id,visit_id);
comment on column public.visit_participants.account_id is 'Optional compatibility link; participant identity is person_id.';

create or replace function app_private.visit_participant(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select app_private.visitation_leader() and (
    exists(select 1 from public.visit_requests where id=p_id and planner_id=auth.uid())
    or exists(
      select 1 from public.visit_participants participant
      join public.profiles profile on profile.person_id=participant.person_id
      where participant.visit_id=p_id and profile.id=auth.uid() and profile.status='active'
    )
  )
$$;

create or replace function app_private.queue_visit(p_visit public.visit_requests,p_kind text)
returns void language sql security definer set search_path='' as $$
  insert into public.visit_notification_events(visit_id,account_id,revision,kind)
    select p_visit.id,profile.id,p_visit.revision,p_kind
    from public.visit_participants participant
    join public.profiles profile on profile.person_id=participant.person_id and profile.status='active'
    where participant.visit_id=p_visit.id
    union select p_visit.id,p_visit.planner_id,p_visit.revision,p_kind where p_visit.planner_id is not null
    on conflict(visit_id,account_id,revision,kind) do nothing
$$;

create or replace function public.save_visit(
  p_id uuid,
  p_revision integer,
  p_submission_id uuid,
  p_person_id uuid,
  p_scheduled_at timestamptz,
  p_location text,
  p_notes text,
  p_participant_ids uuid[]
) returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests; actor_person_id uuid;
begin
  if not app_private.visitation_leader() then raise exception 'Only active pastors or deacons can plan visits'; end if;
  select person_id into actor_person_id from public.profiles where id=auth.uid() and status='active';
  if p_participant_ids is null or cardinality(p_participant_ids)<>(select count(distinct x) from unnest(p_participant_ids) x)
  then raise exception 'Choose distinct participants'; end if;
  if actor_person_id=any(p_participant_ids) then raise exception 'The planner is already included in the visit'; end if;
  if exists(
    select 1 from unnest(p_participant_ids) x
    where not exists(
      select 1 from public.people person
      where person.id=x and person.archived_at is null
        and app_private.person_leadership(person.id) in ('pastor','deacon')
    )
  ) then raise exception 'Choose active pastor or deacon members'; end if;
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

  insert into public.visit_participants(visit_id,person_id,account_id)
    select result.id,selected.person_id,profile.id
    from unnest(p_participant_ids) selected(person_id)
    left join public.profiles profile on profile.person_id=selected.person_id and profile.status='active';
  perform app_private.queue_visit(result,'visit.updated');
  perform app_private.audit('visit.saved',result.id);
  return result;
end $$;

create or replace function public.respond_to_visit(p_id uuid,p_revision integer,p_response text,p_reason text)
returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests; actor_person_id uuid;
begin
  if not app_private.visitation_leader() then raise exception 'Only active invited pastors or deacons can respond'; end if;
  if p_response not in ('accepted','declined') or p_response is null then raise exception 'Choose accept or decline'; end if;
  select person_id into actor_person_id from public.profiles where id=auth.uid() and status='active';
  select * into result from public.visit_requests where id=p_id for update;
  if not found or not exists(select 1 from public.visit_participants where visit_id=p_id and person_id=actor_person_id) then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision or result.status<>'open' or result.archived_at is not null then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
  update public.visit_participants set account_id=auth.uid(),response=p_response,reason=nullif(trim(p_reason),''),responded_at=now()
    where visit_id=p_id and person_id=actor_person_id;
  update public.visit_requests set revision=revision+1 where id=p_id returning * into result;
  perform app_private.queue_visit(result,'visit.response');
  perform app_private.audit('visit.responded',result.id);
  return result;
end $$;

create or replace function public.mark_visit_viewed(p_id uuid,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare current_revision integer; actor_person_id uuid;
begin
  if not app_private.visit_participant(p_id) then raise exception 'Not authorized'; end if;
  select person_id into actor_person_id from public.profiles where id=auth.uid() and status='active';
  select revision into current_revision from public.visit_requests where id=p_id;
  if p_revision is null or p_revision<1 or p_revision>current_revision then raise exception 'Invalid viewed revision'; end if;
  update public.visit_participants set account_id=auth.uid(),last_viewed_revision=greatest(last_viewed_revision,p_revision)
    where visit_id=p_id and person_id=actor_person_id;
end $$;

create or replace function public.directory_visible_visit_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from public.visit_requests visit
  where visit.archived_at is null and visit.status='open' and app_private.visitation_leader()
    and (visit.planner_id=auth.uid() or exists(
      select 1 from public.visit_participants participant
      join public.profiles profile on profile.person_id=participant.person_id
      where participant.visit_id=visit.id and profile.id=auth.uid() and profile.status='active'
    ))
$$;

revoke all on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]),public.respond_to_visit(uuid,integer,text,text),public.mark_visit_viewed(uuid,integer) from public,anon,authenticated;
grant execute on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]),public.respond_to_visit(uuid,integer,text,text),public.mark_visit_viewed(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;