begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- A fresh token after removal/recreation prevents a stale editor from changing a new note.
create sequence public.deacon_member_note_revision as integer;
revoke all on sequence public.deacon_member_note_revision from public,anon,authenticated;
create table public.deacon_member_notes (
 person_id uuid primary key references public.people(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 5000),
 revision integer not null default nextval('public.deacon_member_note_revision'),
 updated_at timestamptz not null default now()
);
alter table public.deacon_member_notes enable row level security;
revoke all on public.deacon_member_notes from public,anon,authenticated;
grant select on public.deacon_member_notes to authenticated;
create policy deacon_member_notes_read on public.deacon_member_notes for select to authenticated
 using(public.can_edit_group_member(person_id));
create function public.deacon_member_note_access(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select app_private.can_edit_group_member(p_person_id)
$$;
create function public.save_deacon_member_note(p_person_id uuid,p_revision integer,p_body text) returns void
language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 perform 1 from public.people where id=p_person_id for update;
 if not app_private.can_edit_group_member(p_person_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 select revision into current_revision from public.deacon_member_notes where person_id=p_person_id;
 if current_revision is distinct from p_revision then raise exception 'Note changed. Reload before saving.' using errcode='40001'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 5000 then raise exception 'Enter a note (maximum 5000 characters)'; end if;
 insert into public.deacon_member_notes(person_id,body) values(p_person_id,trim(p_body))
 on conflict(person_id) do update set body=excluded.body,revision=excluded.revision,updated_at=now();
end $$;
create function public.remove_deacon_member_note(p_person_id uuid,p_revision integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.people where id=p_person_id for update;
 if not app_private.can_edit_group_member(p_person_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 delete from public.deacon_member_notes where person_id=p_person_id and revision=p_revision;
 if not found then raise exception 'Note changed. Reload before removing.' using errcode='40001'; end if;
end $$;
revoke all on function public.deacon_member_note_access(uuid),public.save_deacon_member_note(uuid,integer,text),public.remove_deacon_member_note(uuid,integer) from public,anon,authenticated;
grant execute on function public.deacon_member_note_access(uuid),public.save_deacon_member_note(uuid,integer,text),public.remove_deacon_member_note(uuid,integer) to authenticated;
-- Change authorization in the current definitions, preserving audit wrappers,
-- removed-member safeguards and graph validation added by later migrations.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.member_family(uuid,boolean)'::regprocedure) into definition;
 if position('(p_manage and not app_private.editor())' in definition)=0 then raise exception 'Unexpected family reader definition'; end if;
 definition:=replace(definition,'(p_manage and not app_private.editor())','(p_manage and not (app_private.editor() or app_private.can_edit_group_member(p_person_id)))');
 execute definition;
 select pg_get_functiondef('app_private.audit_impl_save_member_family(uuid,bigint,uuid[],uuid,uuid[],uuid[])'::regprocedure) into definition;
 if position('if not app_private.editor() then' in definition)=0 then raise exception 'Unexpected family writer definition'; end if;
 definition:=replace(definition,'if not app_private.editor() then','perform 1 from public.people where id=p_person_id for update;
  if not (app_private.editor() or app_private.can_edit_group_member(p_person_id)) then');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
