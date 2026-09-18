begin;

-- Auth identities and Storage objects are removed by the privileged Edge
-- Function first. This transaction then removes the directory record and all
-- database-owned history without ever leaving a deleted member's login active.
create or replace function public.delete_member_record(
  p_person_id uuid,
  p_deleted_account_id uuid default null
)
returns table(deleted_person_id uuid,deleted_visit_count integer)
language plpgsql security definer set search_path='' as $$
declare
  target public.people;
  visit_count integer := 0;
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;

  select * into target from public.people where id=p_person_id for update;
  if not found then
    return query select p_person_id,0;
    return;
  end if;

  if exists(select 1 from public.profiles where id=auth.uid() and person_id=p_person_id) then
    raise exception 'You cannot delete your own member record';
  end if;
  if exists(select 1 from public.profiles where person_id=p_person_id) then
    raise exception 'Delete the linked account before deleting this member';
  end if;

  select count(*)::integer into visit_count from public.visit_requests where person_id=p_person_id;
  delete from public.visit_requests where person_id=p_person_id;
  delete from public.people where id=p_person_id;

  perform app_private.audit(
    'member.deleted',
    p_person_id,
    jsonb_build_object(
      'deleted_account_id',p_deleted_account_id,
      'deleted_visit_count',visit_count
    )
  );
  return query select p_person_id,visit_count;
end;
$$;

revoke all on function public.delete_member_record(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_member_record(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
