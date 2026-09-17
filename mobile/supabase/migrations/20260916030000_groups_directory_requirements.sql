begin;

-- Groups now use the simple names shown by the mobile directory and expose
-- aggregate care counts without releasing private member fields to the client.
update public.deacon_groups
set name = case id::text
  when '70000000-0000-4000-8000-000000000001' then 'Група один'
  when '70000000-0000-4000-8000-000000000002' then 'Група два'
  when '70000000-0000-4000-8000-000000000003' then 'Група три'
  else name
end,
revision = revision + 1
where id in (
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003'
);

insert into public.deacon_group_deacons (group_id, account_id, slot)
select assignment.group_id, user_account.id, 1
from (values
  ('70000000-0000-4000-8000-000000000001'::uuid, 'slav.salo@gmail.com'),
  ('70000000-0000-4000-8000-000000000002'::uuid, 'alinabelashov@gmail.com'),
  ('70000000-0000-4000-8000-000000000003'::uuid, 'slav.salo@gmail.com')
) assignment(group_id, email)
join auth.users user_account on lower(user_account.email) = assignment.email
join public.profiles profile on profile.id = user_account.id and profile.status = 'active' and profile.designation = 'deacon'
on conflict (group_id, account_id) do update set slot = excluded.slot;

create or replace function public.group_birthdays(p_group_id uuid)
returns table(person_id uuid,name text,month integer,day integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.designated('pastor') and not (
    app_private.designated('deacon') and exists(
      select 1 from public.deacon_group_deacons d join public.deacon_groups g on g.id=d.group_id
      where d.group_id=p_group_id and d.account_id=auth.uid() and g.archived_at is null
    )
  ) then raise exception 'Not authorized'; end if;
  return query
    select p.id,p.name,extract(month from private.birth_date)::integer,extract(day from private.birth_date)::integer
    from public.people p
    join public.people_private private on private.person_id=p.id
    join public.deacon_groups g on g.id=p_group_id
    where p.archived_at is null and private.birth_date is not null
      and ((g.kind='membership' and p.membership_group_id=g.id)
        or (g.kind='responsibility' and exists(select 1 from public.deacon_group_members m where m.group_id=g.id and m.person_id=p.id)));
end;
$$;

create or replace function public.group_summary_counts(p_group_id uuid)
returns table(total integer, orphans integer, widows integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.active() then raise exception 'Not authorized'; end if;
  return query
  with roster as (
    select p.id
    from public.people p
    join public.deacon_groups g on g.id = p.membership_group_id
    where g.id = p_group_id and g.kind = 'membership' and p.archived_at is null
    union
    select p.id
    from public.people p
    join public.deacon_group_members m on m.person_id = p.id
    join public.deacon_groups g on g.id = m.group_id
    where g.id = p_group_id and g.kind = 'responsibility' and p.archived_at is null
  )
  select count(*)::integer,
    count(*) filter (where s.orphan_status is true)::integer,
    count(*) filter (where lower(coalesce(s.marital_status, '')) in ('widowed', 'widow', 'вдова', 'вдівець', 'вдівець/вдова'))::integer
  from roster r left join public.people_private s on s.person_id = r.id;
end;
$$;

revoke all on function public.group_summary_counts(uuid) from public, anon, authenticated;
grant execute on function public.group_summary_counts(uuid) to authenticated;

-- Give the seeded demonstration directory representative widow records so
-- care filters and counts can be verified without altering unrelated people.
update public.people_private
set marital_status = 'Widowed'
where person_id in (
  '10000000-0000-4000-8000-000000000007',
  '50000000-0000-4000-8000-000000000014'
);

commit;
