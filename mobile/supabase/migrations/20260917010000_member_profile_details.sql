begin;

alter table public.people
  add column if not exists membership_joined_at date;

create or replace function public.member_profile_details(p_person_id uuid)
returns table (
  person_id uuid,
  birth_date date,
  address text,
  marital_status text,
  orphan_status boolean,
  membership_joined_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, private.birth_date, private.address, private.marital_status,
    private.orphan_status, p.membership_joined_at
  from public.people p
  left join public.people_private private on private.person_id = p.id
  where p.id = p_person_id
    and p.archived_at is null
    and app_private.active();
$$;

create or replace function public.visit_person_defaults()
returns table (person_id uuid, address text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, private.address
  from public.people p
  left join public.people_private private on private.person_id = p.id
  where p.archived_at is null
    and app_private.designated('pastor');
$$;

revoke all on function public.member_profile_details(uuid) from public;
revoke all on function public.visit_person_defaults() from public;
grant execute on function public.member_profile_details(uuid) to authenticated;
grant execute on function public.visit_person_defaults() to authenticated;

commit;
