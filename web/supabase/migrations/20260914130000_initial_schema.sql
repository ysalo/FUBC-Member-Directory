-- Clean test baseline. This intentionally replaces all existing application data.
-- Auth users are retained, but their application profiles are recreated as pending accounts.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.current_role() cascade;
drop function if exists public.handle_new_user() cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.profiles cascade;
drop table if exists public.people cascade;
drop type if exists public.account_status cascade;
drop type if exists public.app_role cascade;

create type public.app_role as enum ('member', 'editor', 'admin');
create type public.account_status as enum ('pending', 'active', 'denied', 'revoked');

create table public.people (
  id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
  date_of_birth date, membership_joined_at date, phone text, address_line_1 text, address_line_2 text, city text,
  state text, postal_code text, photo_path text, notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, display_name text, avatar_url text, provider text not null default 'unknown',
  role public.app_role not null default 'member', status public.account_status not null default 'pending',
  person_id uuid unique references public.people(id) on delete set null, decision_note text,
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  event_type text not null, entity_type text not null, entity_id text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index profiles_status_created_at_idx on public.profiles(status, created_at);
alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.audit_events enable row level security;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, provider) values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'unknown')
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Retained Auth users also need fresh pending profiles after a test reset.
insert into public.profiles (id, email, display_name, avatar_url, provider)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', email),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture'),
  coalesce(raw_app_meta_data ->> 'provider', 'unknown')
from auth.users
where email is not null
on conflict (id) do nothing;

create function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create function public.review_account(
  target_id uuid, new_status public.account_status, new_role public.app_role,
  new_person_id uuid default null, note text default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid(); previous public.profiles; result public.profiles; active_admins integer;
begin
  if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
  select * into previous from public.profiles where id = target_id for update;
  if not found then raise exception 'Account not found'; end if;
  if target_id = actor and (new_status <> 'active' or new_role <> 'admin') then
    raise exception 'Administrators cannot remove their own access';
  end if;
  if previous.status = 'active' and previous.role = 'admin' and (new_status <> 'active' or new_role <> 'admin') then
    select count(*) into active_admins from public.profiles where status = 'active' and role = 'admin';
    if active_admins <= 1 then raise exception 'The final administrator cannot be removed'; end if;
  end if;
  update public.profiles set status = new_status, role = new_role, person_id = new_person_id,
    decision_note = nullif(trim(note), ''), reviewed_at = now(), reviewed_by = actor, updated_at = now()
  where id = target_id returning * into result;
  insert into public.audit_events (actor_id, event_type, entity_type, entity_id, metadata) values (
    actor, 'account.reviewed', 'profile', target_id::text,
    jsonb_build_object('old_status', previous.status, 'new_status', result.status,
      'old_role', previous.role, 'new_role', result.role,
      'old_person_id', previous.person_id, 'new_person_id', result.person_id, 'note', result.decision_note)
  );
  return result;
end;
$$;

create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admins read profiles" on public.profiles for select to authenticated using (public.current_role() = 'admin');
create policy "active accounts read active people" on public.people for select to authenticated
  using (archived_at is null and public.current_role() in ('member', 'editor', 'admin'));
create policy "editors and admins read all people" on public.people for select to authenticated
  using (public.current_role() in ('editor', 'admin'));
create policy "editors and admins create people" on public.people for insert to authenticated
  with check (public.current_role() in ('editor', 'admin'));
create policy "editors and admins update people" on public.people for update to authenticated
  using (public.current_role() in ('editor', 'admin')) with check (public.current_role() in ('editor', 'admin'));
create policy "admins read audit events" on public.audit_events for select to authenticated using (public.current_role() = 'admin');

grant usage on schema public to authenticated;
grant select, insert, update on public.people to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_events to authenticated;
revoke all on function public.review_account(uuid, public.account_status, public.app_role, uuid, text) from public;
grant execute on function public.review_account(uuid, public.account_status, public.app_role, uuid, text) to authenticated;

insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', false) on conflict (id) do nothing;
create policy "approved accounts view member photos" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('member', 'editor', 'admin'));
create policy "editors and admins upload member photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));
create policy "editors and admins update member photos" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'))
  with check (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));
create policy "editors and admins delete member photos" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));
