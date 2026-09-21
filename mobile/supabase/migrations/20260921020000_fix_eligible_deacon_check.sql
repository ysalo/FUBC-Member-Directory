begin;

-- eligible_deacon incorrectly required an active login profile linked to the person, which most
-- deacons don't have. Duty periods key off person_id specifically so an activated account is never
-- required; eligibility must follow the same person_ministries/system_key leadership signal the
-- rest of the app already uses (app_private.person_leadership), not the profiles table.
create or replace function app_private.eligible_deacon(p_person_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.people where id = p_person_id and archived_at is null)
    and app_private.person_leadership(p_person_id) = 'deacon';
$$;

commit;
