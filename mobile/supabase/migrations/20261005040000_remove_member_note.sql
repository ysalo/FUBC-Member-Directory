begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Recreated notes must not reuse a deleted note's revision.
create sequence app_private.member_note_revision_seq;
select setval('app_private.member_note_revision_seq', coalesce((select max(revision)::bigint from public.member_notes), 0) + 1, false);
revoke all on sequence app_private.member_note_revision_seq from public,anon,authenticated;
create function app_private.assign_member_note_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.revision := nextval('app_private.member_note_revision_seq')::integer;
  return new;
end;
$$;
revoke all on function app_private.assign_member_note_revision() from public,anon,authenticated;
create trigger member_note_revision before insert or update on public.member_notes
for each row execute function app_private.assign_member_note_revision();

create function public.remove_member_note(p_person_id uuid, p_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
  -- Use the same lock and scope as the note writer.
  perform 1 from public.people where id = p_person_id for update;
  if not app_private.can_edit_group_member(p_person_id) then raise exception 'Not authorized'; end if;
  select revision into current_revision from public.member_notes where person_id = p_person_id;
  if current_revision is null or current_revision is distinct from p_revision then
    raise exception 'Conflict: note changed. Reload and try again.';
  end if;
  delete from public.member_notes where person_id = p_person_id and revision = p_revision;
end;
$$;
revoke all on function public.remove_member_note(uuid,integer) from public,anon,authenticated;
grant execute on function public.remove_member_note(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
