-- Apply after the existing migrations; no account or directory reset.
begin;

alter table public.profiles add column ministry_roles text[] not null default '{}'
  check (ministry_roles <@ array['deacon']::text[]);

create table public.deacon_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.deacon_group_members (
  person_id uuid primary key references public.people(id) on delete cascade,
  group_id uuid not null references public.deacon_groups(id),
  created_at timestamptz not null default now()
);
create index deacon_group_members_group_idx on public.deacon_group_members(group_id);
create table public.deacon_group_deacons (
  group_id uuid not null references public.deacon_groups(id),
  slot smallint not null check (slot in (1, 2)),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, slot), unique (group_id, profile_id)
);
create index deacon_group_deacons_profile_idx on public.deacon_group_deacons(profile_id);

-- All application assignment/review writes use the same transaction lock.
create function public.can_read_deacon_group(target_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('editor', 'admin') or exists (
    select 1 from public.profiles p join public.deacon_group_deacons d on d.profile_id = p.id
    where p.id = auth.uid() and p.status = 'active' and 'deacon' = any(p.ministry_roles)
      and d.group_id = target_group
  )
$$;

alter table public.deacon_groups enable row level security;
alter table public.deacon_group_members enable row level security;
alter table public.deacon_group_deacons enable row level security;
create policy "authorized group reads" on public.deacon_groups for select to authenticated
  using (public.can_read_deacon_group(id));
create policy "authorized member assignment reads" on public.deacon_group_members for select to authenticated
  using (public.can_read_deacon_group(group_id));
create policy "authorized deacon assignment reads" on public.deacon_group_deacons for select to authenticated
  using (public.can_read_deacon_group(group_id));
revoke all on public.deacon_groups, public.deacon_group_members, public.deacon_group_deacons from anon, authenticated;
grant select on public.deacon_groups, public.deacon_group_members, public.deacon_group_deacons to authenticated;
revoke all on function public.can_read_deacon_group(uuid) from public, anon, authenticated;
grant execute on function public.can_read_deacon_group(uuid) to authenticated;

-- Return only the identity fields needed for group labels, never full profiles.
create function public.list_group_deacons()
returns table(group_id uuid, profile_id uuid, display_name text, status public.account_status)
language sql stable security definer set search_path = public as $$
  select d.group_id, p.id, coalesce(p.display_name, p.email), p.status
  from public.deacon_group_deacons d join public.profiles p on p.id = d.profile_id
  where public.can_read_deacon_group(d.group_id) order by d.group_id, d.slot
$$;
create function public.list_eligible_deacons()
returns table(id uuid, display_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  return query select p.id, coalesce(p.display_name, p.email) from public.profiles p
    where p.status = 'active' and 'deacon' = any(p.ministry_roles)
    order by coalesce(p.display_name, p.email);
end
$$;

create function public.save_deacon_group(target_group uuid, group_name text, deacon_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid; previous jsonb; next_ids uuid[] := coalesce(deacon_ids, '{}');
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if group_name is null or length(trim(group_name)) not between 1 and 100 then
    raise exception 'Group name must contain 1 to 100 characters';
  end if;
  if cardinality(next_ids) > 2 or cardinality(next_ids) <> (select count(distinct v) from unnest(next_ids) v) then
    raise exception 'Choose up to two distinct deacons';
  end if;
  -- Retained inactive assignments are allowed so editors can rename/replace them.
  if exists (select 1 from unnest(next_ids) v where not exists (
    select 1 from public.profiles p where p.id = v and 'deacon' = any(p.ministry_roles)
    and (p.status = 'active' or exists (select 1 from public.deacon_group_deacons d
      where d.group_id = target_group and d.profile_id = p.id))
  )) then raise exception 'Select active designated deacons'; end if;
  if target_group is null then
    insert into public.deacon_groups(name) values (trim(group_name)) returning id into result;
  else
    select to_jsonb(g) || jsonb_build_object('deacons', (select jsonb_agg(d.profile_id)
      from public.deacon_group_deacons d where d.group_id = g.id)) into previous
      from public.deacon_groups g where g.id = target_group for update;
    if not found then raise exception 'Group not found'; end if;
    result := target_group;
    update public.deacon_groups set name = trim(group_name), updated_at = now() where id = result;
    delete from public.deacon_group_deacons where group_id = result;
  end if;
  insert into public.deacon_group_deacons(group_id, slot, profile_id)
    select result, ordinality::smallint, v from unnest(next_ids) with ordinality as ids(v, ordinality);
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.saved', 'deacon_group', result::text,
      jsonb_build_object('before', previous, 'name', trim(group_name), 'deacons', next_ids));
  return result;
end
$$;

create function public.assign_deacon_group_member(target_person uuid, target_group uuid, expected_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare previous_group uuid;
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if not exists (select 1 from public.people where id = target_person and
    (archived_at is null or target_group is null)) then raise exception 'Active member not found'; end if;
  if target_group is not null and not exists (select 1 from public.deacon_groups where id = target_group) then
    raise exception 'Group not found';
  end if;
  select group_id into previous_group from public.deacon_group_members where person_id = target_person;
  if previous_group is distinct from expected_group then
    raise exception 'Assignment changed. Refresh before transferring this member';
  end if;
  if previous_group is not distinct from target_group then return; end if;
  delete from public.deacon_group_members where person_id = target_person;
  if target_group is not null then
    insert into public.deacon_group_members(person_id, group_id) values(target_person, target_group);
  end if;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.member_assigned', 'person', target_person::text,
      jsonb_build_object('old_group', previous_group, 'new_group', target_group));
end
$$;

create function public.delete_deacon_group(target_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare previous jsonb;
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  select to_jsonb(g) into previous from public.deacon_groups g where id = target_group;
  if not found then raise exception 'Group not found'; end if;
  if exists(select 1 from public.deacon_group_members where group_id = target_group) or
    exists(select 1 from public.deacon_group_deacons where group_id = target_group) then
    raise exception 'Remove all member and deacon assignments before deleting this group';
  end if;
  delete from public.deacon_groups where id = target_group;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.deleted', 'deacon_group', target_group::text, previous);
end
$$;

create or replace function public.review_account(
  target_id uuid, new_status public.account_status, new_role public.app_role,
  new_person_id uuid default null, note text default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid(); previous public.profiles; result public.profiles; active_admins integer;
begin
  perform pg_advisory_xact_lock(20260915, 1);
  if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
  select * into previous from public.profiles where id = target_id for update;
  if not found then raise exception 'Account not found'; end if;
  if target_id = actor and (new_status <> 'active' or new_role <> 'admin') then
    raise exception 'Administrators cannot remove their own access';
  end if;
  if previous.status = 'active' and previous.role = 'admin' and (new_status <> 'active' or new_role <> 'admin') then
    select count(*) into active_admins from public.profiles where status = 'active' and role = 'admin';
    if active_admins <= 1 then raise exception 'The final administrator cannot be removed'; end if;
  end if;
  update public.profiles set status = new_status, role = new_role, person_id = new_person_id,
    decision_note = nullif(trim(note), ''), reviewed_at = now(), reviewed_by = actor, updated_at = now()
  where id = target_id returning * into result;
  insert into public.audit_events (actor_id, event_type, entity_type, entity_id, metadata) values (
    actor, 'account.reviewed', 'profile', target_id::text,
    jsonb_build_object('old_status', previous.status, 'new_status', result.status,
      'old_role', previous.role, 'new_role', result.role,
      'old_person_id', previous.person_id, 'new_person_id', result.person_id, 'note', result.decision_note)
  );
  return result;
end;
$$;

create function public.review_account_ministry(target_id uuid, new_status public.account_status,
  new_role public.app_role, new_person_id uuid, note text, is_deacon boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(20260915, 1);
  result := public.review_account(target_id, new_status, new_role, new_person_id, note);
  update public.profiles set ministry_roles = case when is_deacon then array['deacon']::text[] else '{}'::text[] end,
    updated_at = now() where id = target_id returning * into result;
  return result;
end
$$;

create function public.audit_ministry_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare removed_groups jsonb;
begin
  if old.ministry_roles is not distinct from new.ministry_roles then return new; end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if 'deacon' = any(old.ministry_roles) and not ('deacon' = any(new.ministry_roles)) then
    select jsonb_agg(group_id) into removed_groups from public.deacon_group_deacons where profile_id = new.id;
    delete from public.deacon_group_deacons where profile_id = new.id;
  end if;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'account.ministry_changed', 'profile', new.id::text,
      jsonb_build_object('before', old.ministry_roles, 'after', new.ministry_roles, 'removed_groups', removed_groups));
  return new;
end
$$;
create trigger profile_ministry_changed after update of ministry_roles on public.profiles
  for each row execute function public.audit_ministry_change();

revoke all on function public.list_group_deacons(), public.list_eligible_deacons(),
  public.save_deacon_group(uuid, text, uuid[]), public.assign_deacon_group_member(uuid, uuid, uuid),
  public.delete_deacon_group(uuid), public.review_account_ministry(uuid, public.account_status, public.app_role, uuid, text, boolean),
  public.audit_ministry_change() from public, anon, authenticated;
grant execute on function public.list_group_deacons(), public.list_eligible_deacons(),
  public.save_deacon_group(uuid, text, uuid[]), public.assign_deacon_group_member(uuid, uuid, uuid),
  public.delete_deacon_group(uuid), public.review_account_ministry(uuid, public.account_status, public.app_role, uuid, text, boolean) to authenticated;
commit;
