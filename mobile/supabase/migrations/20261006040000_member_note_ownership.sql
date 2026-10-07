begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Historical authors were not recorded. Leave those notes unattributed.
alter table public.member_notes add column created_by uuid references public.profiles(id) on delete set null;

create function app_private.can_write_member_note(p_person_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select app_private.can_read_member_note(p_person_id)
   and exists(select 1 from public.people where id=p_person_id and archived_at is null)
   and not exists(select 1 from public.member_notes where person_id=p_person_id
                  and created_by is distinct from auth.uid())
$$;
revoke all on function app_private.can_write_member_note(uuid) from public,anon,authenticated;

create function public.can_write_member_note(p_person_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select app_private.can_write_member_note(p_person_id)
$$;
revoke all on function public.can_write_member_note(uuid) from public,anon,authenticated;
grant execute on function public.can_write_member_note(uuid) to authenticated;

create or replace function public.save_member_note(p_person_id uuid,p_revision integer,p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
 perform 1 from public.people where id=p_person_id for update;
 if not app_private.can_write_member_note(p_person_id) then raise exception 'Not authorized'; end if;
 select revision into current_revision from public.member_notes where person_id=p_person_id;
 if current_revision is distinct from p_revision then raise exception 'Conflict: note changed. Reload and try again.'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 5000 then raise exception 'Enter a note (maximum 5000 characters)'; end if;
 insert into public.member_notes(person_id,body,created_by) values(p_person_id,trim(p_body),auth.uid())
 on conflict(person_id) do update set body=excluded.body,revision=member_notes.revision+1,updated_at=now();
end;
$$;

create or replace function public.remove_member_note(p_person_id uuid,p_revision integer) returns void
language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
 perform 1 from public.people where id=p_person_id for update;
 if not app_private.can_write_member_note(p_person_id) then raise exception 'Not authorized'; end if;
 select revision into current_revision from public.member_notes where person_id=p_person_id;
 if current_revision is null or current_revision is distinct from p_revision then
   raise exception 'Conflict: note changed. Reload and try again.';
 end if;
 delete from public.member_notes where person_id=p_person_id and revision=p_revision;
end;
$$;
notify pgrst,'reload schema';
commit;
