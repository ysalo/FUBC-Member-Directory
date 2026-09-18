begin;

alter table public.ministries add column if not exists system_key text;
alter table public.ministries drop constraint if exists ministries_system_key_check;
alter table public.ministries add constraint ministries_system_key_check check(system_key is null or system_key in ('pastor','deacon'));
create unique index if not exists ministries_system_key_unique on public.ministries(system_key) where system_key is not null;

do $$
declare canonical_id uuid; duplicate_id uuid;
begin
  select id into canonical_id from public.ministries
  where lower(trim(name)) in ('pastor','пастор') or lower(trim(name_uk)) in ('pastor','пастор')
  order by archived_at nulls first,created_at limit 1;
  if canonical_id is null then
    insert into public.ministries(id,name,name_uk,system_key)
    values('91000000-0000-4000-8000-000000000001','Pastor','Пастор','pastor') returning id into canonical_id;
  else
    for duplicate_id in select id from public.ministries where id<>canonical_id and
      (lower(trim(name)) in ('pastor','пастор') or lower(trim(name_uk)) in ('pastor','пастор'))
    loop
      insert into public.person_ministries(person_id,ministry_id)
      select person_id,canonical_id from public.person_ministries where ministry_id=duplicate_id on conflict do nothing;
      delete from public.person_ministries where ministry_id=duplicate_id;
      update public.ministries set archived_at=coalesce(archived_at,now()) where id=duplicate_id;
    end loop;
    update public.ministries set name='Pastor',name_uk='Пастор',system_key='pastor',archived_at=null,revision=revision+1 where id=canonical_id;
  end if;

  select id into canonical_id from public.ministries
  where lower(trim(name)) in ('deacon','диякон') or lower(trim(name_uk)) in ('deacon','диякон')
  order by archived_at nulls first,created_at limit 1;
  if canonical_id is null then
    insert into public.ministries(id,name,name_uk,system_key)
    values('91000000-0000-4000-8000-000000000002','Deacon','Диякон','deacon') returning id into canonical_id;
  else
    for duplicate_id in select id from public.ministries where id<>canonical_id and
      (lower(trim(name)) in ('deacon','диякон') or lower(trim(name_uk)) in ('deacon','диякон'))
    loop
      insert into public.person_ministries(person_id,ministry_id)
      select person_id,canonical_id from public.person_ministries where ministry_id=duplicate_id on conflict do nothing;
      delete from public.person_ministries where ministry_id=duplicate_id;
      update public.ministries set archived_at=coalesce(archived_at,now()) where id=duplicate_id;
    end loop;
    update public.ministries set name='Deacon',name_uk='Диякон',system_key='deacon',archived_at=null,revision=revision+1 where id=canonical_id;
  end if;
end $$;

-- The old account setting is converted to person ministry membership before
-- those identities are removed. A person remains a directory record.
delete from public.person_ministries pm
using public.profiles p,public.ministries m
where p.person_id=pm.person_id and p.designation in ('pastor','deacon')
  and m.id=pm.ministry_id and m.system_key is not null and m.system_key<>p.designation::text;
insert into public.person_ministries(person_id,ministry_id)
select p.person_id,m.id from public.profiles p join public.ministries m on m.system_key=p.designation::text
where p.person_id is not null and p.designation in ('pastor','deacon') on conflict do nothing;

create or replace function app_private.person_leadership(p_person_id uuid)
returns text language sql stable security definer set search_path='' as $$
  select m.system_key from public.person_ministries pm join public.ministries m on m.id=pm.ministry_id
  where pm.person_id=p_person_id and m.system_key is not null and m.archived_at is null limit 1
$$;

create or replace function app_private.designated(p_designation public.ministry_designation)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.status='active'
      and app_private.person_leadership(p.person_id)=p_designation::text
  )
$$;

create or replace function app_private.validate_person_leadership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.ministries where id=new.ministry_id and system_key is not null)
    and exists(
      select 1 from public.person_ministries pm join public.ministries m on m.id=pm.ministry_id
      where pm.person_id=new.person_id and m.system_key is not null and pm.ministry_id<>new.ministry_id
    ) then raise exception 'Pastor and Deacon ministries are mutually exclusive';
  end if;
  return new;
end $$;
drop trigger if exists validate_person_leadership on public.person_ministries;
create trigger validate_person_leadership before insert or update on public.person_ministries
for each row execute function app_private.validate_person_leadership();

create or replace function app_private.sync_person_leadership()
returns trigger language plpgsql security definer set search_path='' as $$
declare affected_person uuid:=coalesce(new.person_id,old.person_id); leadership text;
begin
  leadership:=app_private.person_leadership(affected_person);
  update public.profiles set designation=coalesce(leadership,'none')::public.ministry_designation,revision=revision+1
  where person_id=affected_person and designation::text is distinct from coalesce(leadership,'none');
  return coalesce(new,old);
end $$;
drop trigger if exists sync_person_leadership on public.person_ministries;
create trigger sync_person_leadership after insert or update or delete on public.person_ministries
for each row execute function app_private.sync_person_leadership();

create or replace function app_private.sync_linked_profile_leadership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.designation:=coalesce(app_private.person_leadership(new.person_id),'none')::public.ministry_designation;
  return new;
end $$;
drop trigger if exists sync_linked_profile_leadership on public.profiles;
create trigger sync_linked_profile_leadership before insert or update of person_id on public.profiles
for each row execute function app_private.sync_linked_profile_leadership();

create or replace function app_private.protect_system_ministry()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.system_key is not null and (new.name is distinct from old.name or new.name_uk is distinct from old.name_uk
    or new.archived_at is distinct from old.archived_at or new.system_key is distinct from old.system_key)
  then raise exception 'Pastor and Deacon are protected ministries'; end if;
  return new;
end $$;
drop trigger if exists protect_system_ministry on public.ministries;
create trigger protect_system_ministry before update on public.ministries
for each row execute function app_private.protect_system_ministry();

drop view if exists public.ministry_accounts;
create view public.ministry_accounts with (security_barrier=true) as
select p.id,p.display_name,m.system_key leadership_ministry,p.person_id
from public.profiles p
join public.person_ministries pm on pm.person_id=p.person_id
join public.ministries m on m.id=pm.ministry_id and m.system_key is not null and m.archived_at is null
where p.status='active' and app_private.active();
revoke all on public.ministry_accounts from public,anon,authenticated;
grant select on public.ministry_accounts to authenticated;

create or replace view public.person_leadership_ministries with (security_barrier=true) as
select pm.person_id,m.system_key leadership_ministry
from public.person_ministries pm join public.ministries m on m.id=pm.ministry_id
where m.system_key is not null and m.archived_at is null and app_private.active();
revoke all on public.person_leadership_ministries from public,anon,authenticated;
grant select on public.person_leadership_ministries to authenticated;

create or replace function public.current_account()
returns table(id uuid,person_id uuid,display_name text,status public.account_status,role public.app_role,leadership_ministry text,revision integer)
language sql stable security definer set search_path='' as $$
  select p.id,p.person_id,p.display_name,p.status,p.role,app_private.person_leadership(p.person_id),p.revision
  from public.profiles p where p.id=auth.uid()
$$;
revoke all on function public.current_account() from public,anon,authenticated;
grant execute on function public.current_account() to authenticated;

drop function if exists public.management_accounts();
create function public.management_accounts()
returns table(id uuid,person_id uuid,display_name text,email text,status public.account_status,role public.app_role,revision integer,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  return query select p.id,p.person_id,p.display_name,u.email::text,p.status,p.role,p.revision,p.created_at
  from public.profiles p join auth.users u on u.id=p.id order by p.created_at;
end $$;
revoke all on function public.management_accounts() from public,anon,authenticated;
grant execute on function public.management_accounts() to authenticated;

drop function if exists public.update_account(uuid,integer,public.account_status,public.app_role,uuid);
create function public.update_account(p_id uuid,p_revision integer,p_status public.account_status,p_role public.app_role,p_person_id uuid)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare result public.profiles;
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(41002);
  if p_status='active' and p_person_id is null then raise exception 'Link a member before approval'; end if;
  if p_person_id is not null then
    if not exists(select 1 from public.people where id=p_person_id and archived_at is null) then raise exception 'Choose an active member'; end if;
    if exists(select 1 from public.profiles where person_id=p_person_id and id<>p_id) then raise exception 'That member is already linked to another account'; end if;
  end if;
  select * into result from public.profiles where id=p_id for update;
  if not found or result.revision is distinct from p_revision then raise exception 'Conflict: account changed. Reload and try again.'; end if;
  if result.status='active' and result.role='admin' and (p_status<>'active' or p_role<>'admin')
    and not exists(select 1 from public.profiles where id<>p_id and status='active' and role='admin')
  then raise exception 'The last active administrator cannot be removed'; end if;
  update public.profiles set status=p_status,role=p_role,person_id=p_person_id,revision=revision+1 where id=p_id returning * into result;
  perform app_private.audit('account.updated',p_id,jsonb_build_object('status',p_status,'role',p_role,'person_id',p_person_id));
  return result;
end $$;
revoke all on function public.update_account(uuid,integer,public.account_status,public.app_role,uuid) from public,anon,authenticated;
grant execute on function public.update_account(uuid,integer,public.account_status,public.app_role,uuid) to authenticated;
drop function if exists public.update_account(uuid,integer,public.account_status,public.app_role,public.ministry_designation,uuid);

drop function if exists public.directory_active_members();
create function public.directory_active_members()
returns table(id uuid,name text,ministry text,ministry_uk text,phone text,photo_path text,leadership_ministry text,is_orphan boolean,is_widow boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.name,p.ministry,p.ministry_uk,p.phone,p.photo_path,app_private.person_leadership(p.id),
    coalesce(private.orphan_status,false),lower(coalesce(private.marital_status,'')) in ('widowed','widow','вдова','вдівець','вдівець/вдова')
  from public.people p left join public.people_private private on private.person_id=p.id
  where p.archived_at is null and app_private.active()
$$;
revoke all on function public.directory_active_members() from public,anon,authenticated;
grant execute on function public.directory_active_members() to authenticated;

create or replace function public.mobile_contract_version() returns text language sql immutable set search_path='' as $$ select 'expo-directory-v2'::text $$;

-- Intentional cutover: identity-bound rows follow their existing FK actions.
delete from auth.users u using public.profiles p
where u.id=p.id and p.designation in ('pastor','deacon');

notify pgrst,'reload schema';
commit;
