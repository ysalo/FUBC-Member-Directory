begin;

-- Scheduling follows directory ministry membership, not account ownership.
-- Deacons without an Auth account remain valid rotation candidates.
create or replace function app_private.eligible_deacon(p_person_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1
    from public.people p
    join public.person_ministries pm on pm.person_id = p.id
    join public.ministries m on m.id = pm.ministry_id
    where p.id = p_person_id
      and p.archived_at is null
      and m.system_key = 'deacon'
      and m.archived_at is null
  );
$$;

commit;
