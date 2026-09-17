begin;

-- Leadership is separate from church membership: a deacon leads exactly one
-- group, a group has at most two leaders, and a linked person cannot appear as
-- both a leader and an ordinary member of that same group.
do $$
declare
  group_one_id constant uuid := '70000000-0000-4000-8000-000000000001';
  matching_accounts integer;
  eligible_accounts integer;
begin
  if not exists(select 1 from public.deacon_groups where id=group_one_id and kind='membership' and archived_at is null) then return; end if;
  select count(*) into matching_accounts from auth.users where lower(email) in ('slav.salo@gmail.com','alinabelashov@gmail.com');
  if matching_accounts=0 then return; end if;
  if matching_accounts<>2 then raise exception 'Both selected Group 1 deacon accounts must exist before assignment'; end if;
  select count(*) into eligible_accounts
  from auth.users u
  join public.profiles profile on profile.id=u.id and profile.status='active' and profile.designation='deacon' and profile.person_id is not null
  join public.people person on person.id=profile.person_id and person.archived_at is null
  where lower(u.email) in ('slav.salo@gmail.com','alinabelashov@gmail.com');
  if eligible_accounts<>2 then raise exception 'Both selected Group 1 deacons must be active and linked to active member profiles'; end if;

  delete from public.deacon_group_deacons where group_id=group_one_id or account_id in (
    select id from auth.users where lower(email) in ('slav.salo@gmail.com','alinabelashov@gmail.com')
  );
  update public.people person set membership_group_id=null,revision=revision+1
  where membership_group_id=group_one_id and id in (
    select profile.person_id from auth.users u join public.profiles profile on profile.id=u.id
    where lower(u.email) in ('slav.salo@gmail.com','alinabelashov@gmail.com')
  );
  delete from public.deacon_group_members member
  where member.group_id=group_one_id and member.person_id in (
    select profile.person_id from auth.users u join public.profiles profile on profile.id=u.id
    where lower(u.email) in ('slav.salo@gmail.com','alinabelashov@gmail.com')
  );
  insert into public.deacon_group_deacons(group_id,account_id,slot)
  select group_one_id,u.id,wanted.slot
  from (values (1::smallint,'slav.salo@gmail.com'::text),(2::smallint,'alinabelashov@gmail.com'::text)) wanted(slot,email)
  join auth.users u on lower(u.email)=wanted.email order by wanted.slot;
end;
$$;

do $$ begin
  if exists(select account_id from public.deacon_group_deacons group by account_id having count(*)>1) then
    raise exception 'Resolve deacons assigned to multiple groups before applying the one-group constraint';
  end if;
  if not exists(select 1 from pg_constraint where conname='deacon_one_leadership_group' and conrelid='public.deacon_group_deacons'::regclass) then
    alter table public.deacon_group_deacons add constraint deacon_one_leadership_group unique(account_id);
  end if;
end $$;

create or replace function app_private.check_group_leader_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
declare linked_person uuid;
begin
  select person_id into linked_person from public.profiles where id=new.account_id and status='active' and designation='deacon';
  if linked_person is null or not exists(select 1 from public.people where id=linked_person and archived_at is null) then
    raise exception 'Choose active deacons with linked member profiles';
  end if;
  if exists(select 1 from public.people where id=linked_person and membership_group_id=new.group_id)
     or exists(select 1 from public.deacon_group_members where group_id=new.group_id and person_id=linked_person) then
    raise exception 'A group leader cannot also be an ordinary member of the same group';
  end if;
  return new;
end $$;

create or replace function app_private.check_membership_group_leader()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.membership_group_id is not null and exists(
    select 1 from public.deacon_group_deacons leader join public.profiles profile on profile.id=leader.account_id
    where leader.group_id=new.membership_group_id and profile.person_id=new.id
  ) then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.check_responsibility_group_leader()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select 1 from public.deacon_group_deacons leader join public.profiles profile on profile.id=leader.account_id
    where leader.group_id=new.group_id and profile.person_id=new.person_id
  ) then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

create or replace function app_private.check_linked_leader_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' and new.designation='deacon' and new.person_id is not null and exists(
    select 1 from public.deacon_group_deacons leader where leader.account_id=new.id and (
      exists(select 1 from public.people where id=new.person_id and membership_group_id=leader.group_id)
      or exists(select 1 from public.deacon_group_members where person_id=new.person_id and group_id=leader.group_id)
    )
  ) then raise exception 'A group leader cannot also be an ordinary member of the same group'; end if;
  return new;
end $$;

drop trigger if exists prevent_deacon_membership_group on public.people;
drop trigger if exists prevent_deacon_group_member on public.deacon_group_members;
drop trigger if exists detach_deacon_from_membership_group on public.profiles;
drop function if exists app_private.keep_deacon_out_of_membership_groups();
drop function if exists app_private.reject_deacon_group_member();
drop function if exists app_private.detach_deacon_from_membership_group();
drop trigger if exists validate_group_leader_assignment on public.deacon_group_deacons;
create trigger validate_group_leader_assignment before insert or update on public.deacon_group_deacons for each row execute function app_private.check_group_leader_assignment();
drop trigger if exists validate_membership_group_leader on public.people;
create trigger validate_membership_group_leader before insert or update of membership_group_id on public.people for each row execute function app_private.check_membership_group_leader();
drop trigger if exists validate_responsibility_group_leader on public.deacon_group_members;
create trigger validate_responsibility_group_leader before insert or update on public.deacon_group_members for each row execute function app_private.check_responsibility_group_leader();
drop trigger if exists validate_linked_leader_membership on public.profiles;
create trigger validate_linked_leader_membership before insert or update of status,designation,person_id on public.profiles for each row execute function app_private.check_linked_leader_membership();

create or replace function public.save_group(p_id uuid,p_revision integer,p_name text,p_kind text,p_archived boolean,p_deacon_ids uuid[],p_member_ids uuid[])
returns public.deacon_groups language plpgsql security definer set search_path='' as $$
declare result public.deacon_groups; v_account uuid; v_slot smallint := 0;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_kind not in ('membership','responsibility') or p_kind is null then raise exception 'Invalid group kind'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Enter a group name'; end if;
  if p_deacon_ids is null or p_member_ids is null then raise exception 'Provide membership and leadership selections'; end if;
  if cardinality(p_deacon_ids)>2 or cardinality(p_deacon_ids)<>(select count(distinct x) from unnest(p_deacon_ids) x) then raise exception 'Choose up to two distinct deacons'; end if;
  if exists(select 1 from unnest(p_deacon_ids) x where not exists(
    select 1 from public.profiles profile join public.people person on person.id=profile.person_id
    where profile.id=x and profile.status='active' and profile.designation='deacon' and person.archived_at is null
  )) then raise exception 'Choose active deacons with linked member profiles'; end if;
  if exists(select 1 from unnest(p_member_ids) x where not exists(select 1 from public.people where id=x and archived_at is null)) then raise exception 'Choose active members'; end if;
  if exists(select 1 from unnest(p_deacon_ids) account_id join public.profiles profile on profile.id=account_id where profile.person_id=any(p_member_ids)) then
    raise exception 'A group leader cannot also be an ordinary member of the same group';
  end if;
  perform pg_advisory_xact_lock(41001);
  if p_id is null then
    insert into public.deacon_groups(name,kind,archived_at) values(trim(p_name),p_kind,case when p_archived then now() else null end) returning * into result;
  else
    update public.deacon_groups set name=trim(p_name),archived_at=case when p_archived then coalesce(archived_at,now()) else null end,revision=revision+1
    where id=p_id and revision=p_revision and kind=p_kind returning * into result;
    if not found then raise exception 'Conflict: group changed. Reload and try again.'; end if;
  end if;
  if p_kind='membership' then
    update public.deacon_groups set revision=revision+1 where id in(select membership_group_id from public.people where id=any(p_member_ids)) and id<>result.id;
    update public.people set membership_group_id=null,revision=revision+1 where membership_group_id=result.id and not(id=any(p_member_ids));
    update public.people set membership_group_id=result.id,revision=revision+1 where id=any(p_member_ids) and membership_group_id is distinct from result.id;
  else
    update public.deacon_groups set revision=revision+1 where id in(select group_id from public.deacon_group_members where person_id=any(p_member_ids)) and id<>result.id;
    delete from public.deacon_group_members where group_id=result.id or person_id=any(p_member_ids);
    insert into public.deacon_group_members(group_id,person_id) select result.id,x from(select distinct unnest(p_member_ids) x) members;
  end if;
  delete from public.deacon_group_deacons where group_id=result.id or account_id=any(p_deacon_ids);
  foreach v_account in array p_deacon_ids loop
    v_slot:=v_slot+1;
    insert into public.deacon_group_deacons(group_id,account_id,slot) values(result.id,v_account,v_slot);
  end loop;
  perform app_private.audit('group.saved',result.id,jsonb_build_object('deacon_ids',p_deacon_ids));
  return result;
end $$;

revoke all on function app_private.check_group_leader_assignment(),app_private.check_membership_group_leader(),app_private.check_responsibility_group_leader(),app_private.check_linked_leader_membership() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
