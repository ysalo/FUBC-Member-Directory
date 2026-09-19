begin;

create or replace function public.delete_group(p_id uuid, p_revision integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision integer;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(41001);

  select revision into current_revision
  from public.deacon_groups
  where id = p_id
  for update;

  if not found or current_revision is distinct from p_revision then
    raise exception 'Conflict: group changed. Reload and try again.';
  end if;

  -- Deleting a group never deletes a person. Membership assignments become
  -- unassigned; responsibility membership and leader rows cascade with the group.
  update public.people
  set membership_group_id = null,
      revision = revision + 1
  where membership_group_id = p_id;

  delete from public.deacon_groups where id = p_id;
  perform app_private.audit('group.deleted', p_id);
end;
$$;

commit;
