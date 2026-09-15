-- Ministry badges: minimal approved-reader projection and pastor designation.
begin;
do $$ declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%ministry_roles%'
  loop execute format('alter table public.profiles drop constraint %I', constraint_name); end loop;
end $$;
alter table public.profiles add constraint profiles_ministry_roles_check
  check (ministry_roles <@ array['deacon','pastor']::text[]);

create or replace function public.list_member_ministries()
returns table(person_id uuid, ministry_roles text[])
language sql stable security definer set search_path = public as $$
  select p.person_id, p.ministry_roles from public.profiles p
  join public.people person on person.id = p.person_id
  where public.current_role() is not null and p.status = 'active'
    and person.archived_at is null and cardinality(p.ministry_roles) > 0
$$;

create or replace function public.review_account_designations(target_id uuid, new_status public.account_status,
  new_role public.app_role, new_person_id uuid, note text, is_deacon boolean, is_pastor boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles;
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(20260915, 1);
  result := public.review_account(target_id, new_status, new_role, new_person_id, note);
  update public.profiles set ministry_roles =
    (case when is_deacon then array['deacon']::text[] else '{}'::text[] end) ||
    (case when is_pastor then array['pastor']::text[] else '{}'::text[] end),
    updated_at = now() where id = target_id returning * into result;
  return result;
end $$;

-- Older deacon-only callers must not clear the independent pastor designation.
create or replace function public.review_account_ministry(target_id uuid, new_status public.account_status,
  new_role public.app_role, new_person_id uuid, note text, is_deacon boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare result public.profiles; was_pastor boolean;
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
  perform pg_advisory_xact_lock(20260915, 1);
  select 'pastor' = any(p.ministry_roles) into was_pastor from public.profiles p where p.id = target_id;
  result := public.review_account_designations(target_id, new_status, new_role, new_person_id, note, is_deacon, coalesce(was_pastor,false));
  return result;
end $$;
revoke all on function public.list_member_ministries(),
  public.review_account_designations(uuid, public.account_status, public.app_role, uuid, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.list_member_ministries(),
  public.review_account_designations(uuid, public.account_status, public.app_role, uuid, text, boolean, boolean)
  to authenticated;
commit;
