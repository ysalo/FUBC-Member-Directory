begin;

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
declare result public.visit_requests;
begin
  if not app_private.visitation_leader() then raise exception 'Only active pastors or deacons can plan visits'; end if;
  if p_participant_ids is null
    or cardinality(p_participant_ids)<>(select count(distinct x) from unnest(p_participant_ids) x)
  then raise exception 'Choose distinct participants'; end if;
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

revoke all on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]) from public,anon,authenticated;
grant execute on function public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;