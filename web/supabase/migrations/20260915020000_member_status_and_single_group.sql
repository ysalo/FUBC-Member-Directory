-- Member statuses and one group per deacon. Run after 20260915010000.
begin;
alter table public.people add column marital_status text
  check (marital_status in ('single', 'married', 'widowed'));
alter table public.people add column is_orphan boolean not null default false;
do $$ begin
  if exists (select 1 from public.deacon_group_deacons group by profile_id having count(*) > 1) then
    raise exception 'Resolve deacons assigned to multiple groups before applying this migration';
  end if;
end $$;
alter table public.deacon_group_deacons add constraint deacon_one_group unique(profile_id);

drop function public.list_group_deacons();
create function public.list_group_deacons()
returns table(group_id uuid, profile_id uuid, display_name text, status public.account_status, email text, phone text)
language sql stable security definer set search_path = public as $$
  select d.group_id, p.id, coalesce(p.display_name, p.email), p.status,
    case when p.status = 'active' then p.email end,
    case when p.status = 'active' then person.phone end
  from public.deacon_group_deacons d join public.profiles p on p.id = d.profile_id
  left join public.people person on person.id = p.person_id and person.archived_at is null
  where public.can_read_deacon_group(d.group_id) order by d.group_id, d.slot
$$;
drop function public.list_eligible_deacons();
create function public.list_eligible_deacons()
returns table(id uuid, display_name text, group_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  return query select p.id, coalesce(p.display_name, p.email), d.group_id
    from public.profiles p left join public.deacon_group_deacons d on d.profile_id = p.id
    where p.status = 'active' and 'deacon' = any(p.ministry_roles)
    order by coalesce(p.display_name, p.email);
end
$$;
-- Approved directory readers see the member's group label, not group rosters or deacon identities.
create function public.list_member_groups()
returns table(person_id uuid, group_name text)
language sql stable security definer set search_path = public as $$
  select m.person_id, g.name from public.deacon_group_members m
  join public.deacon_groups g on g.id = m.group_id
  join public.people p on p.id = m.person_id
  where public.current_role() is not null and p.archived_at is null
$$;
revoke all on function public.list_group_deacons(), public.list_eligible_deacons(), public.list_member_groups() from public, anon, authenticated;
grant execute on function public.list_group_deacons(), public.list_eligible_deacons(), public.list_member_groups() to authenticated;
create or replace function public.save_deacon_group(target_group uuid, group_name text, deacon_ids uuid[])
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
  if exists (select 1 from public.deacon_group_deacons d where d.profile_id = any(next_ids)
    and d.group_id is distinct from target_group) then
    raise exception 'This deacon already belongs to another group';
  end if;
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

commit;

