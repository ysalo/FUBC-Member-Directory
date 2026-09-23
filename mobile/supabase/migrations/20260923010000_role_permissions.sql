begin;

alter function public.save_person(uuid,integer,jsonb) set schema app_private;

revoke all on function app_private.save_person(uuid,integer,jsonb) from public,anon,authenticated;

create function public.save_person(p_id uuid,p_revision integer,p_data jsonb)
returns public.people language plpgsql security definer set search_path='' as $$
declare result public.people; current_person public.people; selected_leadership uuid[]; current_leadership uuid[];
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_id is not null then
    select * into current_person from public.people where id=p_id for update;
    if not found or current_person.revision is distinct from p_revision then
      raise exception 'Conflict: member changed. Reload and try again.';
    end if;
  end if;
  if not app_private.admin() then
    if p_data ? 'ministry_ids' then
      select coalesce(array_agg(id order by id),'{}'::uuid[]) into selected_leadership
      from public.ministries where system_key in ('pastor','deacon') and id in (
        select value::uuid from jsonb_array_elements_text(p_data->'ministry_ids')
      );
      select coalesce(array_agg(ministry.id order by ministry.id),'{}'::uuid[]) into current_leadership
      from public.person_ministries assignment join public.ministries ministry on ministry.id=assignment.ministry_id
      where assignment.person_id=p_id and ministry.system_key in ('pastor','deacon');
      if selected_leadership is distinct from current_leadership then
        raise exception 'Only administrators can change Pastor or Deacon sub-roles';
      end if;
    end if;
  end if;
  result:=app_private.save_person(p_id,p_revision,p_data);
  if result.archived_at is not null then
    update public.deacon_groups set revision=revision+1 where id=current_person.membership_group_id
      or id in (select group_id from public.deacon_group_members where person_id=result.id)
      or id in (select group_id from public.deacon_group_deacons where person_id=result.id);
    delete from public.deacon_group_members where person_id=result.id;
    delete from public.deacon_group_deacons where person_id=result.id;
    update public.people set membership_group_id=null where id=result.id returning * into result;
  end if;
  return result;
end $$;

create or replace function app_private.sync_linked_account_name()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if app_private.admin() and new.name is distinct from old.name then
    update public.profiles set display_name=new.name,revision=revision+1 where person_id=new.id and display_name is distinct from new.name;
  end if;
  return new;
end $$;

create or replace function app_private.visitation_leader()
returns boolean language sql stable security definer set search_path='' as $$
  select app_private.admin() or app_private.designated('pastor') or app_private.designated('deacon')
$$;

create or replace function app_private.visit_participant(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select app_private.admin() or (app_private.visitation_leader() and (
    exists(select 1 from public.visit_requests where id=p_id and planner_id=auth.uid())
    or exists(
      select 1 from public.visit_participants participant
      join public.profiles profile on profile.person_id=participant.person_id
      where participant.visit_id=p_id and profile.id=auth.uid() and profile.status='active'
    )
  ))
$$;

create or replace function public.save_visit(
  p_id uuid,p_revision integer,p_submission_id uuid,p_person_id uuid,p_scheduled_at timestamptz,
  p_location text,p_notes text,p_participant_ids uuid[]
) returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests; planner_person_id uuid;
begin
  if not app_private.visitation_leader() then raise exception 'Only active pastors or deacons, or administrators, can plan visits'; end if;
  if p_id is null then
    select person_id into planner_person_id from public.profiles where id=auth.uid();
  else
    select * into result from public.visit_requests where id=p_id and (planner_id=auth.uid() or app_private.admin()) for update;
    if not found then raise exception 'Not authorized'; end if;
    select person_id into planner_person_id from public.profiles where id=result.planner_id;
  end if;
  if p_participant_ids is null or cardinality(p_participant_ids)<>(select count(distinct participant_id) from unnest(p_participant_ids) participant_id)
  then raise exception 'Choose distinct participants'; end if;
  if planner_person_id=any(p_participant_ids) then raise exception 'The planner is already included in the visit'; end if;
  if exists(
    select 1 from unnest(p_participant_ids) participant_id where not exists(
      select 1 from public.people person where person.id=participant_id and person.archived_at is null
        and app_private.person_leadership(person.id) in ('pastor','deacon')
    )
  ) then raise exception 'Choose active pastor or deacon members'; end if;
  if not exists(select 1 from public.people where id=p_person_id and archived_at is null) then raise exception 'Choose an active member'; end if;
  if p_id is null then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_submission_id::text,0));
    select * into result from public.visit_requests where planner_id=auth.uid() and submission_id=p_submission_id;
    if found then return result; end if;
    insert into public.visit_requests(planner_id,person_id,scheduled_at,location,notes,submission_id)
      values(auth.uid(),p_person_id,p_scheduled_at,trim(p_location),coalesce(p_notes,''),p_submission_id) returning * into result;
  else
    update public.visit_requests
      set person_id=p_person_id,scheduled_at=p_scheduled_at,location=trim(p_location),notes=coalesce(p_notes,''),revision=revision+1
      where id=p_id and revision=p_revision and status='open' and archived_at is null returning * into result;
    if not found then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
    delete from public.visit_participants where visit_id=p_id;
  end if;
  insert into public.visit_participants(visit_id,person_id,account_id)
    select result.id,selected.person_id,profile.id from unnest(p_participant_ids) selected(person_id)
    left join public.profiles profile on profile.person_id=selected.person_id and profile.status='active';
  perform app_private.queue_visit(result,'visit.updated');
  perform app_private.audit('visit.saved',result.id);
  return result;
end $$;

create or replace function public.transition_visit(p_id uuid,p_revision integer,p_action text)
returns public.visit_requests language plpgsql security definer set search_path='' as $$
declare result public.visit_requests;
begin
  if not app_private.visitation_leader() then raise exception 'Not authorized'; end if;
  select * into result from public.visit_requests where id=p_id and (planner_id=auth.uid() or app_private.admin()) for update;
  if not found then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision then raise exception 'Conflict: visit changed. Reload and try again.'; end if;
  if p_action in ('complete','cancel') and result.status='open' and result.archived_at is null then
    update public.visit_requests set status=case when p_action='complete' then 'completed' else 'cancelled' end,
      completed_at=case when p_action='complete' then now() else null end,revision=revision+1 where id=p_id returning * into result;
  elsif p_action='archive' and result.status<>'open' and result.archived_at is null then
    update public.visit_requests set archived_at=now(),revision=revision+1 where id=p_id returning * into result;
  elsif p_action='restore' and result.archived_at is not null then
    update public.visit_requests set archived_at=null,revision=revision+1 where id=p_id returning * into result;
  else raise exception 'Invalid visit transition'; end if;
  perform app_private.queue_visit(result,'visit.' || p_action);
  perform app_private.audit('visit.' || p_action,result.id);
  return result;
end $$;

create or replace function public.directory_visible_visit_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from public.visit_requests visit
  where visit.archived_at is null and visit.status='open' and app_private.visit_participant(visit.id)
$$;

revoke all on function public.save_person(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_person(uuid,integer,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;