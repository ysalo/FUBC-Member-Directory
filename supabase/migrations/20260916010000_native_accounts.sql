-- New native features. Owner-specific data is inaccessible after access revocation.
begin;

create table public.favorites (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(owner_id,person_id)
);
create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  title text not null check(length(trim(title)) between 1 and 200),
  due_at timestamptz not null, completed_at timestamptz,
  revision integer not null default 1 check(revision>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index personal_reminders_due on public.personal_reminders(owner_id,due_at) where completed_at is null;
create table public.account_preferences (
  owner_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  language text not null default 'en' check(language in ('en','uk')),
  appearance text not null default 'system' check(appearance in ('system','light','dark')),
  visit_notifications boolean not null default false,
  birthday_notifications boolean not null default false,
  reminder_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.push_devices (
  installation_id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  token text not null check(token ~ '^[0-9a-f]{64,200}$'),
  environment text not null check(environment in ('sandbox','production')),
  updated_at timestamptz not null default now(), unique(token,environment)
);
alter table public.favorites enable row level security;
alter table public.personal_reminders enable row level security;
alter table public.account_preferences enable row level security;
alter table public.push_devices enable row level security;
create policy favorites_owner on public.favorites for select to authenticated
  using(owner_id=auth.uid() and public.current_role() is not null);
create policy reminders_owner on public.personal_reminders for select to authenticated
  using(owner_id=auth.uid() and public.current_role() is not null);
create policy preferences_owner on public.account_preferences for all to authenticated
  using(owner_id=auth.uid() and public.current_role() is not null)
  with check(owner_id=auth.uid() and public.current_role() is not null);
revoke all on public.favorites,public.personal_reminders,public.account_preferences,public.push_devices from public,anon,authenticated;
grant select on public.favorites,public.personal_reminders to authenticated;
grant select,insert,update on public.account_preferences to authenticated;

create function public.set_favorite(target_person uuid,is_favorite boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if public.current_role() is null then raise exception 'Active account required'; end if;
  if is_favorite is null then raise exception 'Favorite selection required'; end if;
  if is_favorite then
    if not exists(select 1 from public.people where id=target_person and archived_at is null) then
      raise exception 'Member unavailable';
    end if;
    insert into public.favorites(owner_id,person_id) values(auth.uid(),target_person) on conflict do nothing;
  else delete from public.favorites where owner_id=auth.uid() and person_id=target_person;
  end if;
end $$;

create function public.save_reminder(target uuid,expected_revision integer,target_person uuid,reminder_title text,reminder_due_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if public.current_role() is null then raise exception 'Active account required'; end if;
  if reminder_title is null or length(trim(reminder_title)) not between 1 and 200 or reminder_due_at is null then
    raise exception 'A title and due date are required'; end if;
  if reminder_due_at<=now() then raise exception 'Choose a future reminder time'; end if;
  if target_person is not null and not exists(select 1 from public.people where id=target_person and archived_at is null) then
    raise exception 'Member unavailable'; end if;
  if target is null then
    insert into public.personal_reminders(owner_id,person_id,title,due_at)
    values(auth.uid(),target_person,trim(reminder_title),reminder_due_at) returning id into result;
  else
    update public.personal_reminders set person_id=target_person,title=trim(reminder_title),due_at=reminder_due_at,
      revision=revision+1,updated_at=now()
    where id=target and owner_id=auth.uid() and revision=expected_revision returning id into result;
    if result is null then raise exception 'Reminder unavailable or changed; refresh and retry'; end if;
  end if;
  return result;
end $$;

create function public.complete_reminder(target uuid,expected_revision integer,is_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if public.current_role() is null then raise exception 'Active account required'; end if;
  if is_completed is null then raise exception 'Completion selection required'; end if;
  update public.personal_reminders set completed_at=case when is_completed then now() else null end,
    revision=revision+1,updated_at=now()
    where id=target and owner_id=auth.uid() and revision=expected_revision;
  if not found then raise exception 'Reminder unavailable or changed; refresh and retry'; end if;
end $$;
create function public.delete_reminder(target uuid,expected_revision integer) returns void
language plpgsql security definer set search_path='' as $$
begin
  if public.current_role() is null then raise exception 'Active account required'; end if;
  delete from public.personal_reminders where id=target and owner_id=auth.uid() and revision=expected_revision;
  if not found then raise exception 'Reminder unavailable or changed; refresh and retry'; end if;
end $$;

create function public.register_push_device(installation uuid,device_token text,apns_environment text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if public.current_role() is null then raise exception 'Active account required'; end if;
  if installation is null or device_token is null or device_token !~ '^[0-9a-fA-F]{64,200}$'
    or apns_environment is null or apns_environment not in ('sandbox','production') then
    raise exception 'Invalid device registration'; end if;
  -- A token/installation cannot be reassigned by a different account. Sign out unregisters first.
  insert into public.push_devices(installation_id,owner_id,token,environment)
    values(installation,auth.uid(),lower(device_token),apns_environment)
    on conflict(installation_id) do update set token=excluded.token,environment=excluded.environment,updated_at=now()
    where public.push_devices.owner_id=auth.uid();
  if not found then raise exception 'Installation belongs to another account'; end if;
end $$;
create function public.unregister_push_device(installation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  -- Revoked/pending accounts may remove their own device association.
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.push_devices where installation_id=installation and owner_id=auth.uid();
end $$;

revoke all on function public.set_favorite(uuid,boolean),public.save_reminder(uuid,integer,uuid,text,timestamptz),
  public.complete_reminder(uuid,integer,boolean),public.delete_reminder(uuid,integer),
  public.register_push_device(uuid,text,text),public.unregister_push_device(uuid) from public,anon,authenticated;
grant execute on function public.set_favorite(uuid,boolean),public.save_reminder(uuid,integer,uuid,text,timestamptz),
  public.complete_reminder(uuid,integer,boolean),public.delete_reminder(uuid,integer),
  public.register_push_device(uuid,text,text),public.unregister_push_device(uuid) to authenticated;
commit;
