begin;

create table public.group_birthday_notification_preferences (
  account_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.deacon_groups(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(account_id,group_id)
);

alter table public.group_birthday_notification_preferences enable row level security;
create policy birthday_preferences_owner on public.group_birthday_notification_preferences
  for select to authenticated
  using(account_id=auth.uid() and exists(
    select 1 from public.deacon_group_deacons d
    where d.account_id=auth.uid() and d.group_id=group_id
  ));

revoke all on public.group_birthday_notification_preferences from public,anon,authenticated;
grant select on public.group_birthday_notification_preferences to authenticated;
grant all on public.group_birthday_notification_preferences to service_role;

create or replace function public.group_birthday_notification_setting(p_group_id uuid)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.designated('deacon') or not exists(
    select 1 from public.deacon_group_deacons d join public.deacon_groups g on g.id=d.group_id
    where d.group_id=p_group_id and d.account_id=auth.uid() and g.archived_at is null
  ) then raise exception 'Not authorized'; end if;
  return coalesce((select enabled from public.group_birthday_notification_preferences
    where account_id=auth.uid() and group_id=p_group_id),false);
end;
$$;

create or replace function public.set_group_birthday_notifications(p_group_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not app_private.designated('deacon') or not exists(
    select 1 from public.deacon_group_deacons d join public.deacon_groups g on g.id=d.group_id
    where d.group_id=p_group_id and d.account_id=auth.uid() and g.archived_at is null
  ) then raise exception 'Not authorized'; end if;
  insert into public.group_birthday_notification_preferences(account_id,group_id,enabled,updated_at)
  values(auth.uid(),p_group_id,p_enabled,now())
  on conflict(account_id,group_id) do update set enabled=excluded.enabled,updated_at=excluded.updated_at;
  perform app_private.audit('group.birthday_notifications',p_group_id,jsonb_build_object('enabled',p_enabled));
end;
$$;

revoke all on function public.group_birthday_notification_setting(uuid),public.set_group_birthday_notifications(uuid,boolean) from public,anon,authenticated;
grant execute on function public.group_birthday_notification_setting(uuid),public.set_group_birthday_notifications(uuid,boolean) to authenticated;

-- Zero, one, or two responsible deacons are valid. Only Group One is seeded
-- with both requested accounts; the database slot constraint keeps the maximum at two.
insert into public.deacon_group_deacons(group_id,account_id,slot)
select g.id,u.id,2
from public.deacon_groups g
join auth.users u on lower(u.email)='alinabelashov@gmail.com'
join public.profiles p on p.id=u.id and p.status='active' and p.designation='deacon'
where g.name='Група один' and g.kind='membership' and g.archived_at is null
on conflict do nothing;

notify pgrst,'reload schema';
commit;
