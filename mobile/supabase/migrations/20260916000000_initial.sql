-- Newly authored clean baseline. Apply only to a blank Supabase database after catalog review.
begin;
create schema app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
create type public.app_role as enum ('member', 'editor', 'admin');
create type public.account_status as enum ('pending', 'active', 'denied', 'revoked');
create type public.ministry_designation as enum ('none', 'pastor', 'deacon');

create table public.deacon_groups (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 120),
  kind text not null check (kind in ('membership','responsibility')),
  archived_at timestamptz, revision integer not null default 1 check (revision > 0)
);
create unique index group_active_names on public.deacon_groups(kind, lower(name)) where archived_at is null;
create table public.people (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 200),
  ministry text not null default '', ministry_uk text not null default '', phone text, email text,
  photo_path text, membership_group_id uuid references public.deacon_groups(id) on delete set null,
  archived_at timestamptz, revision integer not null default 1, created_at timestamptz not null default now()
);
-- Sensitive source columns are never part of directory SELECTs. Policy approval is required before exposing additional projections.
create table public.people_private (
  person_id uuid primary key references public.people(id) on delete cascade,
  birth_date date, address text, marital_status text, orphan_status boolean, private_notes text
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid unique references public.people(id) on delete set null,
  display_name text not null default '', status public.account_status not null default 'pending',
  role public.app_role not null default 'member', designation public.ministry_designation not null default 'none',
  revision integer not null default 1, created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.deacon_group_members (
  group_id uuid not null references public.deacon_groups(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  primary key(group_id,person_id), unique(person_id)
);
create table public.deacon_group_deacons (
  group_id uuid not null references public.deacon_groups(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check(slot in (1,2)), primary key(group_id,account_id), unique(group_id,slot)
);
create table public.visit_requests (
  id uuid primary key default gen_random_uuid(), pastor_id uuid references public.profiles(id) on delete set null,
  person_id uuid not null references public.people(id), scheduled_at timestamptz not null,
  location text not null check(length(trim(location)) between 1 and 500), notes text not null default '' check(length(notes) <= 10000),
  status text not null default 'open' check(status in ('open','cancelled','completed')),
  completed_at timestamptz, archived_at timestamptz, revision integer not null default 1,
  submission_id uuid not null, created_at timestamptz not null default now(), unique(pastor_id,submission_id),
  check ((status = 'completed') = (completed_at is not null)), check(archived_at is null or status <> 'open')
);
create table public.visit_recipients (
  visit_id uuid not null references public.visit_requests(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  response text not null default 'pending' check(response in ('pending','accepted','declined')),
  reason text check(length(reason) <= 2000), responded_at timestamptz,
  primary key(visit_id,account_id)
);
create table public.visit_notification_events (
  id uuid primary key default gen_random_uuid(), visit_id uuid not null references public.visit_requests(id) on delete cascade,
  account_id uuid not null references public.profiles(id) on delete cascade,
  revision integer not null, kind text not null, state text not null default 'queued' check(state in ('queued','sent','failed','cancelled')),
  ticket_id text, receipt jsonb, attempts integer not null default 0, created_at timestamptz not null default now(),
  unique(visit_id,account_id,revision,kind)
);
create table public.favorites (
  account_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade, primary key(account_id,person_id)
);
create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  title text not null check(length(trim(title)) between 1 and 500), remind_at timestamptz not null,
  completed_at timestamptz, notification_enabled boolean not null default true, revision integer not null default 1
);
create table public.preferences (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  locale text not null default 'en' check(locale in ('en','uk')),
  appearance text not null default 'system' check(appearance in ('system','light','dark')),
  notifications_enabled boolean not null default false
);
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique, platform text not null default 'ios' check(platform = 'ios'),
  invalidated_at timestamptz, updated_at timestamptz not null default now()
);
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(), account_id uuid unique not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(), state text not null default 'requested' check(state in ('requested','processing','failed'))
);
create index visits_pastor_date on public.visit_requests(pastor_id,scheduled_at);
create index recipients_account on public.visit_recipients(account_id,visit_id);
create index group_deacon_account on public.deacon_group_deacons(account_id);
create index reminders_account_time on public.personal_reminders(account_id,remind_at);
create index notification_queue on public.visit_notification_events(state,created_at);

create function app_private.active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;
create function app_private.editor() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active' and role in ('editor','admin'));
$$;
create function app_private.admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active' and role = 'admin');
$$;
create function app_private.designated(p_designation public.ministry_designation) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active' and designation = p_designation);
$$;
create function app_private.visit_participant(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.active() and (exists(select 1 from public.visit_requests where id = p_id and pastor_id = auth.uid())
    or exists(select 1 from public.visit_recipients where visit_id = p_id and account_id = auth.uid()));
$$;
create function app_private.audit(p_action text, p_entity uuid, p_metadata jsonb default '{}') returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events(actor_id,action,entity_id,metadata) values(auth.uid(),p_action,p_entity,p_metadata);
$$;
create function app_private.new_account() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data ->> 'full_name',''));
  return new;
end; $$;
create trigger auth_user_pending after insert on auth.users for each row execute function app_private.new_account();
create function app_private.account_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.designation <> 'deacon' or new.status <> 'active' then
    delete from public.deacon_group_deacons where account_id = new.id;
  end if;
  if new.designation is distinct from old.designation then
    perform app_private.audit('account.designation',new.id,jsonb_build_object('from',old.designation,'to',new.designation));
  end if;
  if new.status <> 'active' then
    update public.device_tokens set invalidated_at = now() where account_id = new.id;
    update public.visit_notification_events set state = 'cancelled' where account_id = new.id and state = 'queued';
  end if;
  return new;
end; $$;
create trigger profile_ministry_cleanup after update on public.profiles for each row execute function app_private.account_changed();

-- RLS + explicit final grants. Clients mutate shared records exclusively through guarded RPCs.
alter table public.people enable row level security;
alter table public.people_private enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_events enable row level security;
alter table public.deacon_groups enable row level security;
alter table public.deacon_group_members enable row level security;
alter table public.deacon_group_deacons enable row level security;
alter table public.visit_requests enable row level security;
alter table public.visit_recipients enable row level security;
alter table public.visit_notification_events enable row level security;
alter table public.favorites enable row level security;
alter table public.personal_reminders enable row level security;
alter table public.preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.account_deletion_requests enable row level security;
create policy people_read on public.people for select to authenticated using(app_private.active() and (archived_at is null or app_private.editor()));
create policy own_profile_or_admin on public.profiles for select to authenticated using(id = auth.uid() or app_private.admin());
create policy audit_admin on public.audit_events for select to authenticated using(app_private.admin());
create policy group_read on public.deacon_groups for select to authenticated using(app_private.active() and (archived_at is null or app_private.editor()));
create policy group_members_read on public.deacon_group_members for select to authenticated using(app_private.active());
create policy group_deacons_read on public.deacon_group_deacons for select to authenticated using(app_private.active());
create policy visit_participant_read on public.visit_requests for select to authenticated using(app_private.visit_participant(id));
create policy recipient_participant_read on public.visit_recipients for select to authenticated using(app_private.visit_participant(visit_id));
create policy favorite_owner on public.favorites for all to authenticated using(account_id = auth.uid() and app_private.active()) with check(account_id = auth.uid() and app_private.active());
create policy reminder_owner on public.personal_reminders for all to authenticated using(account_id = auth.uid() and app_private.active()) with check(account_id = auth.uid() and app_private.active());
create policy preferences_owner on public.preferences for all to authenticated using(account_id = auth.uid() and app_private.active()) with check(account_id = auth.uid() and app_private.active());
create policy token_owner on public.device_tokens for all to authenticated using(account_id = auth.uid() and app_private.active()) with check(account_id = auth.uid() and app_private.active());
create policy deletion_owner on public.account_deletion_requests for select to authenticated using(account_id = auth.uid());
-- This deliberate projection contains no email, linked person, access status or role.
create view public.ministry_accounts with (security_barrier = true) as
  select id,display_name,designation from public.profiles where status = 'active' and designation in ('pastor','deacon') and app_private.active();

create function public.save_person(p_id uuid, p_revision integer, p_data jsonb) returns public.people language plpgsql security definer set search_path = '' as $$
declare result public.people;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if nullif(p_data ->> 'membership_group_id','') is not null and not exists(select 1 from public.deacon_groups where id = (p_data ->> 'membership_group_id')::uuid and kind = 'membership' and archived_at is null) then raise exception 'Choose an active membership group'; end if;
  if p_id is null then
    insert into public.people(name,ministry,ministry_uk,phone,email,membership_group_id)
    values(trim(p_data ->> 'name'),coalesce(p_data ->> 'ministry',''),coalesce(p_data ->> 'ministry_uk',''),nullif(p_data ->> 'phone',''),nullif(p_data ->> 'email',''),nullif(p_data ->> 'membership_group_id','')::uuid) returning * into result;
  else
    update public.people set name=trim(p_data ->> 'name'),ministry=coalesce(p_data ->> 'ministry',''),ministry_uk=coalesce(p_data ->> 'ministry_uk',''),phone=nullif(p_data ->> 'phone',''),email=nullif(p_data ->> 'email',''),
      membership_group_id=nullif(p_data ->> 'membership_group_id','')::uuid,
      archived_at=case when coalesce((p_data ->> 'archived')::boolean,false) then coalesce(archived_at,now()) else null end,revision=revision+1
    where id=p_id and revision=p_revision returning * into result;
    if not found then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  end if;
  perform app_private.audit('person.saved',result.id);
  return result;
end; $$;

create function public.save_group(p_id uuid,p_revision integer,p_name text,p_kind text,p_archived boolean,p_deacon_ids uuid[],p_member_ids uuid[]) returns public.deacon_groups language plpgsql security definer set search_path = '' as $$
declare result public.deacon_groups; v_account uuid; v_slot integer := 0;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_kind not in ('membership','responsibility') or p_kind is null then raise exception 'Invalid group kind'; end if;
  if p_deacon_ids is null or p_member_ids is null then raise exception 'Provide membership and leadership selections'; end if;
  if cardinality(p_deacon_ids)>2 or cardinality(p_deacon_ids)<>(select count(distinct x) from unnest(p_deacon_ids) x) then raise exception 'Choose up to two distinct deacons'; end if;
  if p_kind='membership' and cardinality(p_deacon_ids)>0 then raise exception 'Deacons are assigned to responsibility groups'; end if;
  if exists(select 1 from unnest(p_deacon_ids) x where not exists(select 1 from public.profiles where id=x and status='active' and designation='deacon')) then raise exception 'Choose active deacons'; end if;
  if exists(select 1 from unnest(p_member_ids) x where not exists(select 1 from public.people where id=x and archived_at is null)) then raise exception 'Choose active members'; end if;
  -- Serialize group transfers, including targets modified concurrently by another editor.
  perform pg_advisory_xact_lock(41001);
  if p_id is null then
    insert into public.deacon_groups(name,kind,archived_at) values(trim(p_name),p_kind,case when p_archived then now() else null end) returning * into result;
  else
    update public.deacon_groups set name=trim(p_name),archived_at=case when p_archived then coalesce(archived_at,now()) else null end,revision=revision+1
      where id=p_id and revision=p_revision and kind=p_kind returning * into result;
    if not found then raise exception 'Conflict: group changed. Reload and try again.'; end if;
  end if;
  if p_kind='membership' then
    update public.deacon_groups set revision=revision+1 where id in (select membership_group_id from public.people where id=any(p_member_ids)) and id<>result.id;
    update public.people set membership_group_id=null,revision=revision+1 where membership_group_id=result.id and not(id=any(p_member_ids));
    update public.people set membership_group_id=result.id,revision=revision+1 where id=any(p_member_ids) and membership_group_id is distinct from result.id;
  else
    update public.deacon_groups set revision=revision+1 where id in(select group_id from public.deacon_group_members where person_id=any(p_member_ids)) and id<>result.id;
    delete from public.deacon_group_members where group_id=result.id or person_id=any(p_member_ids);
    insert into public.deacon_group_members(group_id,person_id) select result.id,x from (select distinct unnest(p_member_ids) x) members;
    delete from public.deacon_group_deacons where group_id=result.id;
    foreach v_account in array p_deacon_ids loop
      v_slot:=v_slot+1;
      insert into public.deacon_group_deacons(group_id,account_id,slot) values(result.id,v_account,v_slot);
    end loop;
  end if;
  perform app_private.audit('group.saved',result.id);
  return result;
end; $$;

create function public.delete_group(p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(41001);
  if exists(select 1 from public.people where membership_group_id=p_id) or exists(select 1 from public.deacon_group_members where group_id=p_id) then raise exception 'Transfer members before deleting this group'; end if;
  delete from public.deacon_groups where id=p_id and revision=p_revision;
  if not found then raise exception 'Conflict: group changed. Reload and try again.'; end if;
  perform app_private.audit('group.deleted',p_id);
end; $$;

create function public.update_account(p_id uuid,p_revision integer,p_status public.account_status,p_role public.app_role,p_designation public.ministry_designation,p_person_id uuid) returns public.profiles language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  -- Last-admin check is serialized to prevent two admins demoting each other concurrently.
  perform pg_advisory_xact_lock(41002);
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  select * into result from public.profiles where id=p_id for update;
  if not found or result.revision is distinct from p_revision then raise exception 'Conflict: account changed. Reload and try again.'; end if;
  if result.status='active' and result.role='admin' and (p_status<>'active' or p_role<>'admin') and not exists(select 1 from public.profiles where id<>p_id and status='active' and role='admin') then raise exception 'The last active administrator cannot be removed'; end if;
  update public.profiles set status=p_status,role=p_role,designation=p_designation,person_id=p_person_id,revision=revision+1 where id=p_id returning * into result;
  perform app_private.audit('account.updated',p_id,jsonb_build_object('status',p_status,'role',p_role));
  return result;
end; $$;

create function app_private.queue_visit(p_visit public.visit_requests,p_kind text) returns void language sql security definer set search_path = '' as $$
  insert into public.visit_notification_events(visit_id,account_id,revision,kind)
    select p_visit.id,account_id,p_visit.revision,p_kind from public.visit_recipients where visit_id=p_visit.id
    union select p_visit.id,p_visit.pastor_id,p_visit.revision,p_kind where p_visit.pastor_id is not null
    on conflict(visit_id,account_id,revision,kind) do nothing;
$$;
create function public.save_visit(p_id uuid,p_revision integer,p_submission_id uuid,p_person_id uuid,p_scheduled_at timestamptz,p_location text,p_notes text,p_deacon_ids uuid[]) returns public.visit_requests language plpgsql security definer set search_path = '' as $$
declare result public.visit_requests;
begin
  if not app_private.designated('pastor') then raise exception 'Only active pastors can plan visits'; end if;
  if p_deacon_ids is null or cardinality(p_deacon_ids) not between 1 and 2 or cardinality(p_deacon_ids)<>(select count(distinct x) from unnest(p_deacon_ids) x) then raise exception 'Choose one or two distinct deacons'; end if;
  if exists(select 1 from unnest(p_deacon_ids) x where not exists(select 1 from public.profiles where id=x and status='active' and designation='deacon')) then raise exception 'Choose active deacons'; end if;
  if not exists(select 1 from public.people where id=p_person_id and archived_at is null) then raise exception 'Choose an active member'; end if;
  if p_id is null then
    -- Same submission ID, including concurrent retries, returns the original committed request.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_submission_id::text,0));
    select * into result from public.visit_requests where pastor_id=auth.uid() and submission_id=p_submission_id;
    if found then return result; end if;
    insert into public.visit_requests(pastor_id,person_id,scheduled_at,location,notes,submission_id)
      values(auth.uid(),p_person_id,p_scheduled_at,trim(p_location),coalesce(p_notes,''),p_submission_id) returning * into result;
  else
    update public.visit_requests set person_id=p_person_id,scheduled_at=p_scheduled_at,location=trim(p_location),notes=coalesce(p_notes,''),revision=revision+1
      where id=p_id and pastor_id=auth.uid() and revision=p_revision and status='open' and archived_at is null returning * into result;
    if not found then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
    -- A changed itinerary requires a fresh independent response from every invitee.
    delete from public.visit_recipients where visit_id=p_id;
  end if;
  insert into public.visit_recipients(visit_id,account_id) select result.id,unnest(p_deacon_ids);
  perform app_private.queue_visit(result,'visit.updated');
  perform app_private.audit('visit.saved',result.id);
  return result;
end; $$;

create function public.respond_to_visit(p_id uuid,p_revision integer,p_response text,p_reason text) returns public.visit_requests language plpgsql security definer set search_path = '' as $$
declare result public.visit_requests;
begin
  if not app_private.designated('deacon') then raise exception 'Only active invited deacons can respond'; end if;
  if p_response not in ('accepted','declined') or p_response is null then raise exception 'Choose accept or decline'; end if;
  select * into result from public.visit_requests where id=p_id for update;
  if not found or not exists(select 1 from public.visit_recipients where visit_id=p_id and account_id=auth.uid()) then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision or result.status<>'open' or result.archived_at is not null then raise exception 'Conflict: visit changed or is no longer open. Reload and try again.'; end if;
  update public.visit_recipients set response=p_response,reason=nullif(trim(p_reason),''),responded_at=now() where visit_id=p_id and account_id=auth.uid();
  update public.visit_requests set revision=revision+1 where id=p_id returning * into result;
  perform app_private.queue_visit(result,'visit.response');
  perform app_private.audit('visit.responded',result.id);
  return result;
end; $$;

create function public.transition_visit(p_id uuid,p_revision integer,p_action text) returns public.visit_requests language plpgsql security definer set search_path = '' as $$
declare result public.visit_requests;
begin
  if not app_private.designated('pastor') then raise exception 'Not authorized'; end if;
  select * into result from public.visit_requests where id=p_id and pastor_id=auth.uid() for update;
  if not found then raise exception 'Not authorized'; end if;
  if result.revision is distinct from p_revision then raise exception 'Conflict: visit changed. Reload and try again.'; end if;
  if p_action in ('complete','cancel') and result.status='open' and result.archived_at is null then
    update public.visit_requests set status=case when p_action='complete' then 'completed' else 'cancelled' end,completed_at=case when p_action='complete' then now() else null end,revision=revision+1 where id=p_id returning * into result;
  elsif p_action='archive' and result.status<>'open' and result.archived_at is null then
    update public.visit_requests set archived_at=now(),revision=revision+1 where id=p_id returning * into result;
  elsif p_action='restore' and result.archived_at is not null then
    update public.visit_requests set archived_at=null,revision=revision+1 where id=p_id returning * into result;
  else raise exception 'Invalid visit transition'; end if;
  perform app_private.queue_visit(result,'visit.' || p_action);
  perform app_private.audit('visit.' || p_action,result.id);
  return result;
end; $$;

create function public.group_birthdays(p_group_id uuid) returns table(person_id uuid,name text,month integer,day integer) language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.designated('deacon') or not exists(select 1 from public.deacon_group_deacons d join public.deacon_groups g on g.id=d.group_id where d.group_id=p_group_id and d.account_id=auth.uid() and g.archived_at is null) then raise exception 'Not authorized'; end if;
  return query select p.id,p.name,extract(month from s.birth_date)::integer,extract(day from s.birth_date)::integer
    from public.people p join public.people_private s on s.person_id=p.id join public.deacon_group_members m on m.person_id=p.id
    where m.group_id=p_group_id and p.archived_at is null and s.birth_date is not null;
end; $$;

create function public.request_account_deletion() returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(41002);
  if exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') and not exists(select 1 from public.profiles where id<>auth.uid() and role='admin' and status='active') then raise exception 'Assign another administrator before deleting this account'; end if;
  insert into public.account_deletion_requests(account_id) values(auth.uid()) on conflict(account_id) do update set requested_at=now() returning id into result;
  update public.profiles set status='revoked',revision=revision+1 where id=auth.uid();
  delete from public.favorites where account_id=auth.uid();
  delete from public.personal_reminders where account_id=auth.uid();
  delete from public.preferences where account_id=auth.uid();
  delete from public.device_tokens where account_id=auth.uid();
  perform app_private.audit('account.deletion_requested',auth.uid());
  -- A server-only worker must revoke Apple credentials then delete auth.users; requests are not falsely marked complete.
  return result;
end; $$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.people,public.profiles,public.deacon_groups,public.deacon_group_members,public.deacon_group_deacons,public.visit_requests,public.visit_recipients,public.audit_events,public.account_deletion_requests,public.ministry_accounts to authenticated;
grant select,insert,update,delete on public.favorites,public.personal_reminders,public.preferences,public.device_tokens to authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated;
grant execute on function app_private.active(),app_private.editor(),app_private.admin(),app_private.designated(public.ministry_designation),app_private.visit_participant(uuid) to authenticated;
revoke all on function public.save_person(uuid,integer,jsonb),public.save_group(uuid,integer,text,text,boolean,uuid[],uuid[]),public.delete_group(uuid,integer),public.update_account(uuid,integer,public.account_status,public.app_role,public.ministry_designation,uuid),public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]),public.respond_to_visit(uuid,integer,text,text),public.transition_visit(uuid,integer,text),public.group_birthdays(uuid),public.request_account_deletion() from public,anon,authenticated;
grant execute on function public.save_person(uuid,integer,jsonb),public.save_group(uuid,integer,text,text,boolean,uuid[],uuid[]),public.delete_group(uuid,integer),public.update_account(uuid,integer,public.account_status,public.app_role,public.ministry_designation,uuid),public.save_visit(uuid,integer,uuid,uuid,timestamptz,text,text,uuid[]),public.respond_to_visit(uuid,integer,text,text),public.transition_visit(uuid,integer,text),public.group_birthdays(uuid),public.request_account_deletion() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('member-photos','member-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
  on conflict(id) do update set
    name=excluded.name,
    public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;
create policy member_photo_read on storage.objects for select to authenticated using(bucket_id='member-photos' and app_private.active());
create policy member_photo_insert on storage.objects for insert to authenticated with check(bucket_id='member-photos' and app_private.editor());
create policy member_photo_update on storage.objects for update to authenticated using(bucket_id='member-photos' and app_private.editor()) with check(bucket_id='member-photos' and app_private.editor());
create policy member_photo_delete on storage.objects for delete to authenticated using(bucket_id='member-photos' and app_private.editor());
commit;
