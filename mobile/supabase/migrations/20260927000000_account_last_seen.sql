alter table public.profiles
  add column last_seen_at timestamptz;

drop function public.management_accounts();
create function public.management_accounts()
returns table(
  id uuid,
  person_id uuid,
  display_name text,
  email text,
  status public.account_status,
  role public.app_role,
  revision integer,
  created_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  return query
    select p.id,p.person_id,p.display_name,u.email::text,p.status,p.role,
           p.revision,p.created_at,p.last_seen_at
    from public.profiles p
    join auth.users u on u.id=p.id
    order by p.created_at;
end $$;
revoke all on function public.management_accounts() from public,anon,authenticated;
grant execute on function public.management_accounts() to authenticated;

create or replace function public.record_account_use()
returns timestamptz
language plpgsql volatile security definer set search_path='' as $$
declare recorded_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles
    set last_seen_at = greatest(coalesce(last_seen_at, '-infinity'::timestamptz), clock_timestamp())
    where id = auth.uid()
    returning last_seen_at into recorded_at;
  if not found then raise exception 'Account not found'; end if;
  return recorded_at;
end $$;
revoke all on function public.record_account_use() from public,anon,authenticated;
grant execute on function public.record_account_use() to authenticated;
