-- Linked member records are authoritative for deacon names and contact details.
begin;
create or replace function public.list_group_deacons()
returns table(group_id uuid, profile_id uuid, display_name text, status public.account_status, person_id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select d.group_id, p.id,
    coalesce(case when p.status = 'active' then nullif(trim(concat_ws(' ', person.first_name, person.last_name)), '') end,
      nullif(trim(p.display_name), ''), 'Deacon'), p.status,
    case when p.status = 'active' then person.id end,
    case when p.status = 'active' then person.phone end
  from public.deacon_group_deacons d join public.profiles p on p.id = d.profile_id
  left join public.people person on person.id = p.person_id and person.archived_at is null
  where public.can_read_deacon_group(d.group_id) order by d.group_id, d.slot
$$;
create or replace function public.list_eligible_deacons()
returns table(id uuid, display_name text, group_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  return query select p.id,
    coalesce(nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), nullif(trim(p.display_name), ''), p.email),
    d.group_id
  from public.profiles p
  left join public.people person on person.id = p.person_id and person.archived_at is null
  left join public.deacon_group_deacons d on d.profile_id = p.id
  where p.status = 'active' and 'deacon' = any(p.ministry_roles)
  order by 2;
end $$;
revoke all on function public.list_group_deacons(), public.list_eligible_deacons() from public, anon, authenticated;
grant execute on function public.list_group_deacons(), public.list_eligible_deacons() to authenticated;
commit;

