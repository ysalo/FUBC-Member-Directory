-- Consolidated application schema from prototype commit 4d158ca3b33cf18024f45ab9300f48be183eee56.

-- Local-derived baseline; live schema parity is NOT verified. EMPTY DATABASE ONLY.

begin;

create type public.app_role as enum ('member','editor','admin');

create type public.account_status as enum ('pending','active','denied','revoked');

create table public.people (
  id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
  date_of_birth date, membership_joined_at date, phone text, address_line_1 text, address_line_2 text, city text,
  state text, postal_code text, photo_path text, notes text, archived_at timestamptz,
  marital_status text check (marital_status in ('single','married','widowed')),
  is_orphan boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, display_name text, avatar_url text, provider text not null default 'unknown',
  role public.app_role not null default 'member', status public.account_status not null default 'pending',
  person_id uuid unique references public.people(id) on delete set null, decision_note text,
  reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  ministry_roles text[] not null default '{}' check(ministry_roles <@ array['deacon','pastor']::text[] and cardinality(ministry_roles)<=1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null,
  event_type text not null, entity_type text not null, entity_id text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.deacon_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deacon_group_members (
  person_id uuid primary key references public.people(id) on delete cascade,
  group_id uuid not null references public.deacon_groups(id),
  created_at timestamptz not null default now()
);

create table public.deacon_group_deacons (
  group_id uuid not null references public.deacon_groups(id),
  slot smallint not null check (slot in (1, 2)),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unique(profile_id), primary key (group_id, slot), unique (group_id, profile_id)
);

create table public.visit_requests (
 id uuid primary key default gen_random_uuid(), pastor_id uuid not null references public.profiles(id),
 person_id uuid not null references public.people(id), group_id uuid references public.deacon_groups(id) on delete set null,
 pastor_name text not null, member_name text not null, member_address text not null,
 location text not null check(length(trim(location)) between 1 and 1000), scheduled_at timestamptz not null,
 notes text not null default '' check(length(notes)<=5000), status text not null default 'open' check(status in ('open','cancelled','completed')),
 archived_at timestamptz, revision integer not null default 1, updated_fields text[] not null default '{}', submission_key uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(pastor_id,submission_key)
);

create table public.visit_recipients (
 request_id uuid not null references public.visit_requests(id) on delete cascade, deacon_id uuid not null references public.profiles(id),
 deacon_name text not null, response text not null default 'pending' check(response in ('pending','accepted','declined')),
 decline_reason text not null default '' check(length(decline_reason)<=1000), responded_at timestamptz, last_viewed_revision integer not null default 0,
 primary key(request_id,deacon_id)
);

create table public.visit_notification_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.visit_requests(id) on delete cascade,
 revision integer not null, event_type text not null check(event_type in ('created','updated')), recipient_id uuid not null references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','delivered','failed')), created_at timestamptz not null default now(),
 unique(request_id,revision,recipient_id)
);

create index profiles_status_created_at_idx on public.profiles(status, created_at);

create index deacon_group_members_group_idx on public.deacon_group_members(group_id);

create index deacon_group_deacons_profile_idx on public.deacon_group_deacons(profile_id);

create index visit_pastor_idx on public.visit_requests(pastor_id,scheduled_at);

create index visit_deacon_idx on public.visit_recipients(deacon_id,request_id);

create index visit_open_time_idx on public.visit_requests(scheduled_at) where status='open';

create index visit_archive_idx
  on public.visit_requests(archived_at,scheduled_at desc);

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

create function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;

create or replace function public.review_account(
  target_id uuid, new_status public.account_status, new_role public.app_role,
  new_person_id uuid default null, note text default null
) returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid(); previous public.profiles; result public.profiles; active_admins integer;
begin
  perform pg_advisory_xact_lock(20260915, 1);
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

create or replace function public.can_read_deacon_group(target_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() is not null
$$;

create or replace function public.list_group_deacons()
returns table(group_id uuid, profile_id uuid, display_name text, status public.account_status, person_id uuid, phone text)
language sql stable security definer set search_path = public as $$
  select d.group_id, p.id,
    coalesce(case when p.status = 'active' then nullif(trim(concat_ws(' ', person.first_name, person.last_name)), '') end,
      nullif(trim(p.display_name), ''), 'Deacon'), p.status,
    case when p.status = 'active' then person.id end,
    case when p.status = 'active' then person.phone end
  from public.deacon_group_deacons d join public.profiles p on p.id = d.profile_id
  left join public.people person on person.id = p.person_id and person.archived_at is null
  where public.can_read_deacon_group(d.group_id) order by d.group_id, d.slot
$$;

create or replace function public.list_eligible_deacons()
returns table(id uuid, display_name text, group_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  return query select p.id,
    coalesce(nullif(trim(concat_ws(' ', person.first_name, person.last_name)), ''), nullif(trim(p.display_name), ''), p.email),
    d.group_id
  from public.profiles p
  left join public.people person on person.id = p.person_id and person.archived_at is null
  left join public.deacon_group_deacons d on d.profile_id = p.id
  where p.status = 'active' and 'deacon' = any(p.ministry_roles)
  order by 2;
end $$;

create or replace function public.save_deacon_group(target_group uuid, group_name text, deacon_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare result uuid; previous jsonb; next_ids uuid[] := coalesce(deacon_ids, '{}');
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if group_name is null or length(trim(group_name)) not between 1 and 100 then
    raise exception 'Group name must contain 1 to 100 characters';
  end if;
  if cardinality(next_ids) > 2 or cardinality(next_ids) <> (select count(distinct v) from unnest(next_ids) v) then
    raise exception 'Choose up to two distinct deacons';
  end if;
  -- Retained inactive assignments are allowed so editors can rename/replace them.
  if exists (select 1 from unnest(next_ids) v where not exists (
    select 1 from public.profiles p where p.id = v and 'deacon' = any(p.ministry_roles)
    and (p.status = 'active' or exists (select 1 from public.deacon_group_deacons d
      where d.group_id = target_group and d.profile_id = p.id))
  )) then raise exception 'Select active designated deacons'; end if;
  if exists (select 1 from public.deacon_group_deacons d where d.profile_id = any(next_ids)
    and d.group_id is distinct from target_group) then
    raise exception 'This deacon already belongs to another group';
  end if;
  if target_group is null then
    insert into public.deacon_groups(name) values (trim(group_name)) returning id into result;
  else
    select to_jsonb(g) || jsonb_build_object('deacons', (select jsonb_agg(d.profile_id)
      from public.deacon_group_deacons d where d.group_id = g.id)) into previous
      from public.deacon_groups g where g.id = target_group for update;
    if not found then raise exception 'Group not found'; end if;
    result := target_group;
    update public.deacon_groups set name = trim(group_name), updated_at = now() where id = result;
    delete from public.deacon_group_deacons where group_id = result;
  end if;
  insert into public.deacon_group_deacons(group_id, slot, profile_id)
    select result, ordinality::smallint, v from unnest(next_ids) with ordinality as ids(v, ordinality);
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.saved', 'deacon_group', result::text,
      jsonb_build_object('before', previous, 'name', trim(group_name), 'deacons', next_ids));
  return result;
end
$$;

create function public.assign_deacon_group_member(target_person uuid, target_group uuid, expected_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare previous_group uuid;
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if not exists (select 1 from public.people where id = target_person and
    (archived_at is null or target_group is null)) then raise exception 'Active member not found'; end if;
  if target_group is not null and not exists (select 1 from public.deacon_groups where id = target_group) then
    raise exception 'Group not found';
  end if;
  select group_id into previous_group from public.deacon_group_members where person_id = target_person;
  if previous_group is distinct from expected_group then
    raise exception 'Assignment changed. Refresh before transferring this member';
  end if;
  if previous_group is not distinct from target_group then return; end if;
  delete from public.deacon_group_members where person_id = target_person;
  if target_group is not null then
    insert into public.deacon_group_members(person_id, group_id) values(target_person, target_group);
  end if;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.member_assigned', 'person', target_person::text,
      jsonb_build_object('old_group', previous_group, 'new_group', target_group));
end
$$;

create function public.delete_deacon_group(target_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare previous jsonb;
begin
  if public.current_role() is null or public.current_role() not in ('editor', 'admin') then
    raise exception 'Editor access required';
  end if;
  perform pg_advisory_xact_lock(20260915, 1);
  select to_jsonb(g) into previous from public.deacon_groups g where id = target_group;
  if not found then raise exception 'Group not found'; end if;
  if exists(select 1 from public.deacon_group_members where group_id = target_group) or
    exists(select 1 from public.deacon_group_deacons where group_id = target_group) then
    raise exception 'Remove all member and deacon assignments before deleting this group';
  end if;
  delete from public.deacon_groups where id = target_group;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'deacon_group.deleted', 'deacon_group', target_group::text, previous);
end
$$;

create or replace function public.review_account_ministry(target_id uuid,new_status public.account_status,
 new_role public.app_role,new_person_id uuid,note text,is_deacon boolean)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare was_pastor boolean;
begin
 if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 perform pg_advisory_xact_lock(20260915,1);
 select 'pastor'=any(ministry_roles) into was_pastor from public.profiles where id=target_id;
 return public.review_account_designations(target_id,new_status,new_role,new_person_id,note,is_deacon,coalesce(was_pastor,false) and not coalesce(is_deacon,false));
end $$;

create function public.audit_ministry_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare removed_groups jsonb;
begin
  if old.ministry_roles is not distinct from new.ministry_roles then return new; end if;
  perform pg_advisory_xact_lock(20260915, 1);
  if 'deacon' = any(old.ministry_roles) and not ('deacon' = any(new.ministry_roles)) then
    select jsonb_agg(group_id) into removed_groups from public.deacon_group_deacons where profile_id = new.id;
    delete from public.deacon_group_deacons where profile_id = new.id;
  end if;
  insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
    values(auth.uid(), 'account.ministry_changed', 'profile', new.id::text,
      jsonb_build_object('before', old.ministry_roles, 'after', new.ministry_roles, 'removed_groups', removed_groups));
  return new;
end
$$;

create function public.list_member_groups()
returns table(person_id uuid, group_name text)
language sql stable security definer set search_path = public as $$
  select m.person_id, g.name from public.deacon_group_members m
  join public.deacon_groups g on g.id = m.group_id
  join public.people p on p.id = m.person_id
  where public.current_role() is not null and p.archived_at is null
$$;

create or replace function public.list_member_ministries()
returns table(person_id uuid, ministry_roles text[])
language sql stable security definer set search_path = public as $$
  select p.person_id, p.ministry_roles from public.profiles p
  join public.people person on person.id = p.person_id
  where public.current_role() is not null and p.status = 'active'
    and person.archived_at is null and cardinality(p.ministry_roles) > 0
$$;

create or replace function public.review_account_designations(target_id uuid,new_status public.account_status,
 new_role public.app_role,new_person_id uuid,note text,is_deacon boolean,is_pastor boolean)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare result public.profiles;
begin
 if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 if coalesce(is_deacon,false) and coalesce(is_pastor,false) then raise exception 'Choose either pastor or deacon'; end if;
 perform pg_advisory_xact_lock(20260915,1);
 result:=public.review_account(target_id,new_status,new_role,new_person_id,note);
 update public.profiles set ministry_roles=case when is_pastor then array['pastor']::text[] when is_deacon then array['deacon']::text[] else '{}'::text[] end,
 updated_at=now() where id=target_id returning * into result;
 return result;
end $$;

create function public.has_visit_ministry(designation text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active' and designation=any(ministry_roles))
$$;

create function public.can_read_visit(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.visit_requests v where v.id=target and
 ((v.pastor_id=auth.uid() and public.has_visit_ministry('pastor')) or
 (public.has_visit_ministry('deacon') and exists(select 1 from public.visit_recipients r where r.request_id=v.id and r.deacon_id=auth.uid()))))
$$;

create function public.list_visit_deacons() returns table(id uuid,name text,group_id uuid) language sql stable security definer set search_path=public as $$
 select p.id,coalesce(nullif(trim(concat_ws(' ',m.first_name,m.last_name)),''),nullif(p.display_name,''),'Deacon'),d.group_id
 from public.profiles p left join public.people m on m.id=p.person_id and m.archived_at is null
 left join public.deacon_group_deacons d on d.profile_id=p.id
 where public.has_visit_ministry('pastor') and p.status='active' and 'deacon'=any(p.ministry_roles) order by 2
$$;

create function public.save_visit(target uuid,expected_revision integer,target_person uuid,visit_location text,visit_time timestamptz,visit_notes text,deacon_ids uuid[],submission uuid)
 returns uuid language plpgsql security definer set search_path=public as $$
declare v public.visit_requests; m public.people; result uuid; actor_name text;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
 if visit_time is null or visit_time<=now() then raise exception 'Choose a future visit time'; end if;
 if visit_location is null or length(trim(visit_location)) not between 1 and 1000 or length(coalesce(visit_notes,''))>5000 then raise exception 'Invalid visit details'; end if;
 if target is null then
  if submission is null then raise exception 'Submission key required'; end if;
  select id into result from public.visit_requests where pastor_id=auth.uid() and submission_key=submission;
  if found then return result; end if;
  select * into m from public.people where id=target_person and archived_at is null;
  if not found then raise exception 'Member unavailable'; end if;
  if coalesce(cardinality(deacon_ids),0) not between 1 and 2 or (select count(distinct x) from unnest(deacon_ids) x)<>cardinality(deacon_ids)
   or exists(select 1 from unnest(deacon_ids) x where not exists(select 1 from public.profiles p where p.id=x and p.status='active' and 'deacon'=any(p.ministry_roles))) then raise exception 'Choose one or two active distinct deacons'; end if;
  select coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(a.display_name,''),'Pastor') into actor_name from public.profiles a left join public.people p on p.id=a.person_id and p.archived_at is null where a.id=auth.uid();
  insert into public.visit_requests(pastor_id,person_id,group_id,pastor_name,member_name,member_address,location,scheduled_at,notes,submission_key)
   values(auth.uid(),m.id,(select group_id from public.deacon_group_members where person_id=m.id),actor_name,concat_ws(' ',m.first_name,m.last_name),concat_ws(', ',nullif(m.address_line_1,''),nullif(m.address_line_2,''),nullif(m.city,''),nullif(m.state,''),nullif(m.postal_code,'')),trim(visit_location),visit_time,coalesce(visit_notes,''),submission) returning id into result;
  insert into public.visit_recipients(request_id,deacon_id,deacon_name) select result,id,name from public.list_visit_deacons() where id=any(deacon_ids);
 else
  select * into v from public.visit_requests where id=target for update;
  if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
  if v.status<>'open' then raise exception 'Request is closed'; end if;
  if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
  if v.location=trim(visit_location) and v.scheduled_at=visit_time and v.notes=coalesce(visit_notes,'') then return v.id; end if;
  update public.visit_requests set updated_fields=array_remove(array[case when v.location<>trim(visit_location) then 'location' end,case when v.scheduled_at<>visit_time then 'scheduled_at' end,case when v.notes<>coalesce(visit_notes,'') then 'notes' end],null),location=trim(visit_location),scheduled_at=visit_time,notes=coalesce(visit_notes,''),revision=revision+1,updated_at=now() where id=target;
  result:=target;
 end if;
 insert into public.visit_notification_events(request_id,revision,event_type,recipient_id)
  select result,q.revision,case when target is null then 'created' else 'updated' end,r.deacon_id from public.visit_requests q join public.visit_recipients r on r.request_id=q.id where q.id=result;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),case when target is null then 'visit.created' else 'visit.updated' end,'visit',result::text,jsonb_build_object('revision',(select revision from public.visit_requests where id=result)));
 return result;
end $$;

create function public.respond_visit(target uuid,decision text,reason text,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('deacon') then raise exception 'Deacon access required'; end if;
 select * into v from public.visit_requests where id=target for update;
 if not found or not exists(select 1 from public.visit_recipients where request_id=target and deacon_id=auth.uid()) then raise exception 'Request unavailable'; end if;
 if v.status<>'open' then raise exception 'Request is closed'; end if;
 if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
 if decision is null or decision not in ('accepted','declined') or length(coalesce(reason,''))>1000 then raise exception 'Invalid response'; end if;
 update public.visit_recipients set response=decision,decline_reason=case when decision='declined' then coalesce(reason,'') else '' end,responded_at=now(),last_viewed_revision=v.revision where request_id=target and deacon_id=auth.uid();
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'visit.responded','visit',target::text,jsonb_build_object('response',decision));
end $$;

create or replace function public.close_visit(target uuid,decision text,expected_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
 select * into v from public.visit_requests where id=target for update;
 if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
 if v.status<>'open' then raise exception 'Request is closed'; end if;
 if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
 if decision is null or decision not in ('cancelled','completed') then raise exception 'Invalid status'; end if;
 update public.visit_requests set status=decision,updated_at=now() where id=target;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'visit.closed','visit',target::text,jsonb_build_object('status',decision));
end $$;

create function public.view_visit(target uuid,seen_revision integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_visit_ministry('deacon') or not public.can_read_visit(target) then raise exception 'Request unavailable'; end if;
 update public.visit_recipients set last_viewed_revision=greatest(last_viewed_revision,seen_revision) where request_id=target and deacon_id=auth.uid() and seen_revision between 1 and (select revision from public.visit_requests where id=target);
end $$;

create function public.auto_complete_visits() returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 perform pg_advisory_xact_lock(20260915,1);
 with closed as (
  update public.visit_requests set status='completed',updated_at=now()
  where status='open' and scheduled_at<=now()-interval '6 hours' returning id
 ), audited as (
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
  select null,'visit.auto_completed','visit',id::text,jsonb_build_object('status','completed') from closed returning id
 ) select count(*) into total from audited;
 return total;
end $$;

create function public.resolve_member_profiles(requested_profile_ids uuid[])
returns table(profile_id uuid, person_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select profile.id, person.id
  from public.profiles profile
  join public.people person on person.id = profile.person_id
  where public.current_role() in ('member', 'editor', 'admin')
    and profile.id = any(requested_profile_ids)
    and person.archived_at is null
$$;

create or replace function public.archive_visit(target uuid,expected_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
  perform pg_advisory_xact_lock(20260915,1);
  if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
  select * into v from public.visit_requests where id=target for update;
  if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
  if v.archived_at is not null then return; end if;
  if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
  update public.visit_requests
    set status='completed',archived_at=now(),updated_at=now()
    where id=target;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'visit.archived','visit',target::text,
      jsonb_build_object('automatic',false,'status','completed'));
end $$;

create or replace function public.auto_archive_visits() returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  perform pg_advisory_xact_lock(20260915,1);
  with archived as (
    update public.visit_requests set archived_at=now()
    where archived_at is null and status='completed' and updated_at<=now()-interval '6 hours'
    returning id
  ), audited as (
    insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
      select null,'visit.auto_archived','visit',id::text,jsonb_build_object('automatic',true)
      from archived returning id
  ) select count(*) into total from audited;
  return total;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create trigger profile_ministry_changed after update of ministry_roles on public.profiles
  for each row execute function public.audit_ministry_change();

alter table public.people enable row level security;

alter table public.profiles enable row level security;

alter table public.audit_events enable row level security;

alter table public.deacon_groups enable row level security;

alter table public.deacon_group_members enable row level security;

alter table public.deacon_group_deacons enable row level security;

alter table public.visit_requests enable row level security;

alter table public.visit_recipients enable row level security;

alter table public.visit_notification_events enable row level security;

insert into storage.buckets(id,name,public) values('member-photos','member-photos',false);

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

create policy "approved accounts view member photos" on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('member', 'editor', 'admin'));

create policy "editors and admins upload member photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));

create policy "editors and admins update member photos" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'))
  with check (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));

create policy "editors and admins delete member photos" on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and public.current_role() in ('editor', 'admin'));

create policy "authorized group reads" on public.deacon_groups for select to authenticated
  using (public.can_read_deacon_group(id));

create policy "authorized member assignment reads" on public.deacon_group_members for select to authenticated
  using (public.can_read_deacon_group(group_id));

create policy "authorized deacon assignment reads" on public.deacon_group_deacons for select to authenticated
  using (public.can_read_deacon_group(group_id));

create policy visit_read on public.visit_requests for select to authenticated using(public.can_read_visit(id));

create policy recipient_read on public.visit_recipients for select to authenticated using(public.can_read_visit(request_id));

revoke all on all tables in schema public from public,anon,authenticated;

revoke execute on all functions in schema public from public,anon,authenticated;

grant usage on schema public to authenticated;

grant select,insert,update on public.people to authenticated;

grant select on public.profiles,public.audit_events,public.deacon_groups,public.deacon_group_members,public.deacon_group_deacons,public.visit_requests,public.visit_recipients to authenticated;

grant execute on function public.current_role() to authenticated;

grant execute on function public.review_account(uuid,public.account_status,public.app_role,uuid,text) to authenticated;

grant execute on function public.can_read_deacon_group(uuid) to authenticated;

grant execute on function public.list_group_deacons() to authenticated;

grant execute on function public.list_eligible_deacons() to authenticated;

grant execute on function public.save_deacon_group(uuid,text,uuid[]) to authenticated;

grant execute on function public.assign_deacon_group_member(uuid,uuid,uuid) to authenticated;

grant execute on function public.delete_deacon_group(uuid) to authenticated;

grant execute on function public.review_account_ministry(uuid,public.account_status,public.app_role,uuid,text,boolean) to authenticated;

grant execute on function public.list_member_groups() to authenticated;

grant execute on function public.list_member_ministries() to authenticated;

grant execute on function public.review_account_designations(uuid,public.account_status,public.app_role,uuid,text,boolean,boolean) to authenticated;

grant execute on function public.has_visit_ministry(text) to authenticated;

grant execute on function public.can_read_visit(uuid) to authenticated;

grant execute on function public.list_visit_deacons() to authenticated;

grant execute on function public.save_visit(uuid,integer,uuid,text,timestamptz,text,uuid[],uuid) to authenticated;

grant execute on function public.respond_visit(uuid,text,text,integer) to authenticated;

grant execute on function public.close_visit(uuid,text,integer) to authenticated;

grant execute on function public.view_visit(uuid,integer) to authenticated;

grant execute on function public.resolve_member_profiles(uuid[]) to authenticated;

grant execute on function public.archive_visit(uuid,integer) to authenticated;

commit;
