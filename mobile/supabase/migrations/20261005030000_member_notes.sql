begin;
set local lock_timeout = '5s';
create function app_private.can_read_member_note(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.active() and (app_private.designated('pastor') or app_private.can_edit_group_member(p_person_id))
$$;
revoke all on function app_private.can_read_member_note(uuid) from public,anon,authenticated;
create table public.member_notes (
 person_id uuid primary key references public.people(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 5000),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.member_notes enable row level security;
revoke all on public.member_notes from public,anon,authenticated;
grant select on public.member_notes to authenticated;
create policy member_notes_read on public.member_notes for select to authenticated
 using(app_private.can_read_member_note(person_id));
grant execute on function app_private.can_read_member_note(uuid) to authenticated;
create function public.member_note_access(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.can_read_member_note(p_person_id)
$$;
create function public.save_member_note(p_person_id uuid,p_revision integer,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 perform 1 from public.people where id=p_person_id for update;
 if not app_private.can_edit_group_member(p_person_id) then raise exception 'Not authorized'; end if;
 select revision into current_revision from public.member_notes where person_id=p_person_id;
 if current_revision is distinct from p_revision then raise exception 'Conflict: note changed. Reload and try again.'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 5000 then raise exception 'Enter a note (maximum 5000 characters)'; end if;
 insert into public.member_notes(person_id,body) values(p_person_id,trim(p_body))
 on conflict(person_id) do update set body=excluded.body,revision=member_notes.revision+1,updated_at=now();
end;
$$;
revoke all on function public.member_note_access(uuid),public.save_member_note(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.member_note_access(uuid),public.save_member_note(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
