begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

create function app_private.ministry_account_rows()
returns table(id uuid,display_name text,leadership_ministry text,person_id uuid)
language sql stable security definer set search_path='' as $$
  select profile.id,profile.display_name,ministry.system_key,profile.person_id
  from public.profiles profile
  join public.person_ministries assignment on assignment.person_id=profile.person_id
  join public.ministries ministry on ministry.id=assignment.ministry_id
  where profile.status='active' and ministry.system_key is not null
    and ministry.archived_at is null and (select app_private.active())
$$;
revoke all on function app_private.ministry_account_rows() from public,anon,authenticated;
grant execute on function app_private.ministry_account_rows() to authenticated,service_role;

create or replace view public.ministry_accounts
with (security_barrier=true,security_invoker=true) as
select id,display_name,leadership_ministry,person_id from app_private.ministry_account_rows();

alter view public.person_leadership_ministries set (security_invoker=true);

notify pgrst,'reload schema';
commit;