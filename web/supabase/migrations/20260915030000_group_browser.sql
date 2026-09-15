-- Approved members can browse groups. Membership and leadership stay independent.
begin;
create or replace function public.can_read_deacon_group(target_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() is not null
$$;
drop function public.list_group_deacons();
create function public.list_group_deacons()
returns table(group_id uuid, profile_id uuid, display_name text, status public.account_status, person_id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select d.group_id, p.id, coalesce(nullif(trim(p.display_name), ''), 'Deacon'), p.status,
    case when p.status = 'active' then person.id end,
    case when p.status = 'active' then person.phone end
  from public.deacon_group_deacons d join public.profiles p on p.id = d.profile_id
  left join public.people person on person.id = p.person_id and person.archived_at is null
  where public.can_read_deacon_group(d.group_id) order by d.group_id, d.slot
$$;
revoke all on function public.can_read_deacon_group(uuid), public.list_group_deacons() from public, anon, authenticated;
grant execute on function public.can_read_deacon_group(uuid), public.list_group_deacons() to authenticated;
commit;
