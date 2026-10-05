begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Immutable name snapshots survive later member edits and deletion. Restoring
-- membership closes an episode; a subsequent departure creates a new episode.
create table public.member_departures (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  first_name text not null,
  last_name text not null,
  patronymic text,
  date_left date not null check (isfinite(date_left) and date_left <= current_date),
  reason text not null check (reason in ('different_church','died','excommunicated','other')),
  other_detail text check (length(other_detail) <= 160 and other_detail !~ E'[\n\r]'),
  notes text not null default '' check (length(notes) <= 5000),
  recorded_by uuid,
  created_at timestamptz not null default now(),
  restored_at timestamptz,
  legacy boolean not null default false,
  constraint departure_other_detail check (
    (reason = 'other' and length(trim(other_detail)) > 0 and other_detail is not null)
    or (reason <> 'other' and other_detail is null)
  )
);
create unique index member_departures_open_episode on public.member_departures(person_id) where restored_at is null;
create index member_departures_names on public.member_departures(last_name,first_name);
alter table public.member_departures enable row level security;
revoke all on public.member_departures from public,anon,authenticated;
grant select on public.member_departures to authenticated;
create policy departures_management_read on public.member_departures for select to authenticated using ((select app_private.editor()));

-- Preserve old clients' archive/restore operations without losing departure
-- history. Historical reasons/dates were not collected; identify this explicitly.
create function app_private.record_membership_transition() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    insert into public.member_departures(person_id,first_name,last_name,patronymic,date_left,reason,other_detail,recorded_by,legacy)
    values(new.id,new.first_name,new.last_name,new.patronymic,new.archived_at::date,'other','Reason not recorded in previous system.',auth.uid(),true);
  elsif old.archived_at is not null and new.archived_at is null then
    update public.member_departures set restored_at=now() where person_id=new.id and restored_at is null;
  end if;
  return new;
end $$;
revoke all on function app_private.record_membership_transition() from public,anon,authenticated;
create trigger record_membership_transition after update of archived_at on public.people
for each row execute function app_private.record_membership_transition();
insert into public.member_departures(person_id,first_name,last_name,patronymic,date_left,reason,other_detail,legacy)
select id,first_name,last_name,patronymic,archived_at::date,'other','Reason not recorded in previous system.',true
from public.people where archived_at is not null;

create function public.record_member_departure(p_person_id uuid,p_revision integer,p_date_left date,p_reason text,p_other_detail text,p_notes text)
returns public.member_departures language plpgsql security definer set search_path='' as $$
declare person public.people; result public.member_departures;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_date_left is null or not isfinite(p_date_left) or p_date_left > current_date then raise exception 'Choose a valid departure date, not in the future'; end if;
  if p_reason is null or p_reason not in ('different_church','died','excommunicated','other') then raise exception 'Choose a departure reason'; end if;
  if p_reason='other' and (nullif(trim(p_other_detail),'') is null or length(trim(p_other_detail)) > 160 or p_other_detail ~ E'[\n\r]') then raise exception 'Describe the other reason in 160 characters or fewer'; end if;
  if length(coalesce(p_notes,'')) > 5000 then raise exception 'Notes must be 5000 characters or fewer'; end if;
  select * into person from public.people where id=p_person_id for update;
  if not found or person.revision is distinct from p_revision or person.archived_at is not null then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  -- Reuse the existing writer for group cleanup, permissions, revisions and audit.
  perform public.save_person(person.id,p_revision,jsonb_build_object('name',person.name,'archived',true,'membership_group_id',null));
  update public.member_departures set date_left=p_date_left,reason=p_reason,
    other_detail=case when p_reason='other' then trim(p_other_detail) else null end,
    notes=trim(coalesce(p_notes,'')),legacy=false
  where person_id=person.id and restored_at is null returning * into result;
  perform app_private.audit('member.departed',person.id,jsonb_build_object('departure_id',result.id,'reason',p_reason,'date_left',p_date_left));
  return result;
end $$;
revoke all on function public.record_member_departure(uuid,integer,date,text,text,text) from public,anon,authenticated;
grant execute on function public.record_member_departure(uuid,integer,date,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
