begin;

-- Group leadership belongs to the directory person, not to an optional login.
-- Keep account_id temporarily as a nullable compatibility column so existing
-- deployments can migrate without rebuilding the table in place.
alter table public.deacon_group_deacons add column if not exists person_id uuid;
update public.deacon_group_deacons assignment
set person_id=profile.person_id
from public.profiles profile
where profile.id=assignment.account_id and assignment.person_id is null;

do $$
begin
  if exists(select 1 from public.deacon_group_deacons where person_id is null) then
    raise exception 'Every existing group deacon must be linked to a directory person before this migration';
  end if;
end $$;

alter table public.deacon_group_deacons drop constraint if exists deacon_group_deacons_pkey;
alter table public.deacon_group_deacons drop constraint if exists deacon_one_leadership_group;
alter table public.deacon_group_deacons alter column account_id drop not null;
alter table public.deacon_group_deacons alter column person_id set not null;
alter table public.deacon_group_deacons
  add constraint deacon_group_deacons_person_id_fkey foreign key(person_id) references public.people(id) on delete cascade;
alter table public.deacon_group_deacons add primary key(group_id,person_id);
alter table public.deacon_group_deacons add constraint deacon_one_leadership_group unique(person_id);
create index if not exists group_deacon_person on public.deacon_group_deacons(person_id);

create or replace function app_private.check_group_leader_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.people where id=new.person_id and archived_at is null)
    or app_private.person_leadership(new.person_id) is distinct from 'deacon'
  then raise exception 'Choose active members in the Deacon ministry'; end if;
  if exists(select 1 from public.people where id=new.person_id and membership_group_id=new.group_id)
    or exists(select 1 from public.deacon_group_members where group_id=new.group_id and person_id=new.person_id)
  then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.check_membership_group_leader()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.membership_group_id is not null and exists(
    select 1 from public.deacon_group_deacons leader
    where leader.group_id=new.membership_group_id and leader.person_id=new.id
  ) then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.check_responsibility_group_leader()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.deacon_group_deacons leader
    where leader.group_id=new.group_id and leader.person_id=new.person_id)
  then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.check_linked_leader_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.person_id is not null and exists(
    select 1 from public.deacon_group_deacons leader where leader.person_id=new.person_id and (
      exists(select 1 from public.people where id=new.person_id and membership_group_id=leader.group_id)
      or exists(select 1 from public.deacon_group_members where person_id=new.person_id and group_id=leader.group_id)
    )
  ) then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.sync_person_leadership()
returns trigger language plpgsql security definer set search_path='' as $$
declare affected_person uuid:=coalesce(new.person_id,old.person_id); leadership text;
begin
  leadership:=app_private.person_leadership(affected_person);
  update public.profiles set designation=coalesce(leadership,'none')::public.ministry_designation,revision=revision+1
  where person_id=affected_person and designation::text is distinct from coalesce(leadership,'none');
  if leadership is distinct from 'deacon' then
    delete from public.deacon_group_deacons where person_id=affected_person;
  end if;
  return coalesce(new,old);
end $$;

-- Existing account IDs are no longer assignment identity. Clearing them makes
-- account unlinking/deletion leave the person-based assignment intact.
update public.deacon_group_deacons set account_id=null;
comment on column public.deacon_group_deacons.account_id is 'Deprecated compatibility column; group leadership is identified by person_id.';

drop policy if exists birthday_preferences_owner on public.group_birthday_notification_preferences;
create policy birthday_preferences_owner on public.group_birthday_notification_preferences
  for select to authenticated
  using(account_id=auth.uid() and exists(
    select 1 from public.deacon_group_deacons assignment
    join public.profiles profile on profile.person_id=assignment.person_id
    where profile.id=auth.uid() and assignment.group_id=group_id
  ));

create or replace function public.group_birthday_notification_setting(p_group_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.designated('deacon') or not exists(
    select 1 from public.deacon_group_deacons assignment
    join public.profiles profile on profile.person_id=assignment.person_id
    join public.deacon_groups group_record on group_record.id=assignment.group_id
    where assignment.group_id=p_group_id and profile.id=auth.uid() and group_record.archived_at is null
  ) then raise exception 'Not authorized'; end if;
  return coalesce((select enabled from public.group_birthday_notification_preferences
    where account_id=auth.uid() and group_id=p_group_id),false);
end $$;

create or replace function public.set_group_birthday_notifications(p_group_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.designated('deacon') or not exists(
    select 1 from public.deacon_group_deacons assignment
    join public.profiles profile on profile.person_id=assignment.person_id
    join public.deacon_groups group_record on group_record.id=assignment.group_id
    where assignment.group_id=p_group_id and profile.id=auth.uid() and group_record.archived_at is null
  ) then raise exception 'Not authorized'; end if;
  insert into public.group_birthday_notification_preferences(account_id,group_id,enabled,updated_at)
  values(auth.uid(),p_group_id,p_enabled,now())
  on conflict(account_id,group_id) do update set enabled=excluded.enabled,updated_at=excluded.updated_at;
  perform app_private.audit('group.birthday_notifications',p_group_id,jsonb_build_object('enabled',p_enabled));
end $$;

create or replace function public.group_birthdays(p_group_id uuid)
returns table(person_id uuid,name text,month integer,day integer)
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.designated('pastor') and not (
    app_private.designated('deacon') and exists(
      select 1 from public.deacon_group_deacons assignment
      join public.profiles profile on profile.person_id=assignment.person_id
      join public.deacon_groups group_record on group_record.id=assignment.group_id
      where assignment.group_id=p_group_id and profile.id=auth.uid() and group_record.archived_at is null
    )
  ) then raise exception 'Not authorized'; end if;
  return query
    select person.id,person.name,extract(month from private.birth_date)::integer,extract(day from private.birth_date)::integer
    from public.people person
    join public.people_private private on private.person_id=person.id
    join public.deacon_groups group_record on group_record.id=p_group_id
    where person.archived_at is null and private.birth_date is not null
      and ((group_record.kind='membership' and person.membership_group_id=group_record.id)
        or (group_record.kind='responsibility' and exists(select 1 from public.deacon_group_members member where member.group_id=group_record.id and member.person_id=person.id)));
end $$;

create or replace function public.save_group(p_id uuid,p_revision integer,p_name text,p_kind text,p_archived boolean,p_deacon_ids uuid[],p_member_ids uuid[])
returns public.deacon_groups language plpgsql security definer set search_path='' as $$
declare result public.deacon_groups; v_person uuid; v_slot smallint := 0;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_kind not in ('membership','responsibility') or p_kind is null then raise exception 'Invalid group kind'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Enter a group name'; end if;
  if p_deacon_ids is null or p_member_ids is null then raise exception 'Provide membership and leadership selections'; end if;
  if cardinality(p_deacon_ids)>2 or cardinality(p_deacon_ids)<>(select count(distinct x) from unnest(p_deacon_ids) x) then raise exception 'Choose up to two distinct deacons'; end if;
  if exists(select 1 from unnest(p_deacon_ids) as selected(person_id) where not exists(
    select 1 from public.people person
    where person.id=selected.person_id and person.archived_at is null and app_private.person_leadership(person.id)='deacon'
  )) then raise exception 'Choose active members in the Deacon ministry'; end if;
  if exists(select 1 from unnest(p_member_ids) as selected(person_id) where not exists(select 1 from public.people where id=selected.person_id and archived_at is null)) then raise exception 'Choose active members'; end if;
  if exists(select 1 from unnest(p_deacon_ids) as selected(person_id) where selected.person_id=any(p_member_ids)) then
    raise exception 'A group leader cannot also be an ordinary member of the same group';
  end if;
  perform pg_advisory_xact_lock(41001);
  if p_id is null then
    insert into public.deacon_groups(name,kind,archived_at) values(trim(p_name),p_kind,case when p_archived then now() else null end) returning * into result;
  else
    update public.deacon_groups set name=trim(p_name),archived_at=case when p_archived then coalesce(archived_at,now()) else null end,revision=revision+1
    where id=p_id and revision=p_revision and kind=p_kind returning * into result;
    if not found then raise exception 'Conflict: group changed. Reload and try again.'; end if;
  end if;
  if p_kind='membership' then
    update public.deacon_groups set revision=revision+1 where id in(select membership_group_id from public.people where id=any(p_member_ids)) and id<>result.id;
    update public.people set membership_group_id=null,revision=revision+1 where membership_group_id=result.id and not(id=any(p_member_ids));
    update public.people set membership_group_id=result.id,revision=revision+1 where id=any(p_member_ids) and membership_group_id is distinct from result.id;
  else
    update public.deacon_groups set revision=revision+1 where id in(select group_id from public.deacon_group_members where person_id=any(p_member_ids)) and id<>result.id;
    delete from public.deacon_group_members where group_id=result.id or person_id=any(p_member_ids);
    insert into public.deacon_group_members(group_id,person_id) select result.id,x from(select distinct unnest(p_member_ids) x) members;
  end if;
  delete from public.deacon_group_deacons where group_id=result.id or person_id=any(p_deacon_ids);
  foreach v_person in array p_deacon_ids loop
    v_slot:=v_slot+1;
    insert into public.deacon_group_deacons(group_id,person_id,account_id,slot) values(result.id,v_person,null,v_slot);
  end loop;
  perform app_private.audit('group.saved',result.id,jsonb_build_object('deacon_person_ids',p_deacon_ids));
  return result;
end $$;

notify pgrst,'reload schema';
commit;
