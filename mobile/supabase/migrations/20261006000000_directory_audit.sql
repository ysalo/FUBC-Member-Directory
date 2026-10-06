begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

-- History owns identifiers, never subject/actor lifetimes. Legacy rows retain
-- their original payload and are explicitly unavailable for restoration.
alter table public.audit_events drop constraint audit_events_actor_id_fkey;
alter table public.audit_events add column actor_name text,
  add column schema_version integer not null default 0,
  add column restoration text not null default 'legacy' check(restoration in ('legacy','supported','irreversible')),
  add column operation_id uuid unique,
  add column original_action_id uuid references public.audit_events(id),
  add column reason text;
update public.audit_events e set actor_name=p.display_name from public.profiles p where e.actor_id=p.id;
create index audit_history_order on public.audit_events(created_at desc,id desc);
create index audit_history_actor on public.audit_events(actor_id,created_at desc);
create table public.audit_event_changes (
  id bigint generated always as identity primary key,
  action_id uuid not null references public.audit_events(id),
  entity text not null,
  record_key jsonb not null,
  before_data jsonb,
  after_data jsonb,
  subject_ids uuid[] not null,
  unique(action_id,entity,record_key)
);
create index audit_changes_subjects on public.audit_event_changes using gin(subject_ids);
alter table public.audit_event_changes enable row level security;
create policy audit_changes_admin on public.audit_event_changes for select to authenticated using(app_private.admin());
revoke all on public.audit_events,public.audit_event_changes from public,anon,authenticated;
grant select on public.audit_events,public.audit_event_changes to authenticated;

-- This private table, rather than a caller-settable GUC, binds triggers to a
-- trusted command. Transaction failure rolls back both mutations and history.
create table app_private.audit_context(transaction_id bigint primary key,action_id uuid not null,depth integer not null);
create function app_private.audit_lock() returns void language plpgsql security definer set search_path='' as $$
begin
  -- A common order also covers family writers and import/permanent-delete paths.
  perform pg_advisory_xact_lock(20261006,133);
  perform revision from app_private.family_version where singleton=true for update;
  lock table public.people,public.people_private,public.profiles,public.deacon_groups,
    public.deacon_group_members,public.deacon_group_deacons,public.person_ministries,
    public.member_family_edges,public.member_departures in share row exclusive mode;
end $$;
create function app_private.audit_begin(p_action text,p_restoration text default 'supported',p_operation uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
  if exists(select 1 from app_private.audit_context where transaction_id=txid_current()) then
    update app_private.audit_context set depth=depth+1 where transaction_id=txid_current(); return;
  end if;
  if not app_private.active() then raise exception 'Not authorized' using errcode='42501'; end if;
  perform app_private.audit_lock();
  insert into public.audit_events(actor_id,actor_name,action,schema_version,restoration,operation_id)
  select auth.uid(),display_name,p_action,1,p_restoration,coalesce(p_operation,gen_random_uuid()) from public.profiles where id=auth.uid()
  returning id into event_id;
  insert into app_private.audit_context values(txid_current(),event_id,1);
end $$;
create function app_private.audit_end() returns void language plpgsql security definer set search_path='' as $$
declare context app_private.audit_context;
begin
  select * into context from app_private.audit_context where transaction_id=txid_current();
  if context.depth>1 then update app_private.audit_context set depth=depth-1 where transaction_id=txid_current(); return; end if;
  delete from public.audit_event_changes where action_id=context.action_id and before_data is not distinct from after_data;
  if not exists(select 1 from public.audit_event_changes where action_id=context.action_id) then
    delete from public.audit_events where id=context.action_id;
  end if;
  delete from app_private.audit_context where transaction_id=txid_current();
end $$;
create or replace function app_private.audit(p_action text,p_entity uuid,p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from app_private.audit_context where transaction_id=txid_current()) then
    insert into public.audit_events(actor_id,actor_name,action,entity_id,metadata)
    values(auth.uid(),(select display_name from public.profiles where id=auth.uid()),p_action,p_entity,p_metadata);
  end if;
end $$;

-- Explicitly remove sensitive/out-of-scope fields. Photo paths are metadata;
-- rollback never puts an old path back, and no image bytes/URLs are captured.
create function app_private.audit_snapshot(p_entity text,p_row jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select p_row - array['revision','private_notes','notes','body','account_id','recorded_by','removed_by']::text[]
$$;
create function app_private.audit_key(p_entity text,p_row jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case p_entity
    when 'people_private' then jsonb_build_object('person_id',p_row->'person_id')
    when 'person_ministries' then jsonb_build_object('person_id',p_row->'person_id','ministry_id',p_row->'ministry_id')
    when 'deacon_group_members' then jsonb_build_object('group_id',p_row->'group_id','person_id',p_row->'person_id')
    when 'deacon_group_deacons' then jsonb_build_object('group_id',p_row->'group_id','person_id',p_row->'person_id')
    when 'member_family_edges' then jsonb_build_object('kind',p_row->'kind','from_id',p_row->'from_id','to_id',p_row->'to_id')
    else jsonb_build_object('id',p_row->'id') end
$$;
create function app_private.capture_audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare action_id uuid; previous jsonb; next jsonb; row_key jsonb; subjects uuid[];
begin
  select c.action_id into action_id from app_private.audit_context c where transaction_id=txid_current();
  if action_id is null then return coalesce(new,old); end if;
  previous:=case when tg_op<>'INSERT' then app_private.audit_snapshot(tg_table_name,to_jsonb(old)) end;
  next:=case when tg_op<>'DELETE' then app_private.audit_snapshot(tg_table_name,to_jsonb(new)) end;
  if previous is not distinct from next then return coalesce(new,old); end if;
  row_key:=app_private.audit_key(tg_table_name,coalesce(next,previous));
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into subjects from (
    select value from jsonb_each_text(coalesce(previous,'{}')) where key in ('id','person_id','group_id','membership_group_id','from_id','to_id') and value is not null
    union select value from jsonb_each_text(coalesce(next,'{}')) where key in ('id','person_id','group_id','membership_group_id','from_id','to_id') and value is not null
  ) ids;
  insert into public.audit_event_changes(action_id,entity,record_key,before_data,after_data,subject_ids)
    values(action_id,tg_table_name,row_key,previous,next,subjects)
    on conflict on constraint audit_event_changes_action_id_entity_record_key_key do update
      set after_data=excluded.after_data,subject_ids=(select array_agg(distinct id) from unnest(public.audit_event_changes.subject_ids||excluded.subject_ids) id);
  return coalesce(new,old);
end $$;
do $$ declare entity text; begin
  foreach entity in array array['people','people_private','deacon_groups','deacon_group_members','deacon_group_deacons','person_ministries','member_family_edges','member_departures'] loop
    execute format('create trigger directory_audit after insert or update or delete on public.%I for each row execute function app_private.capture_audit_change()',entity);
  end loop;
end $$;

-- Preserve every legacy contract. The catalog supplies exact signatures,
-- defaults and return types; nested public calls share their outer action.
-- The moved implementations are private and explicitly non-executable by clients.
set local search_path='';
do $$ declare command record; definition text; call_args text; invoke text; classification text; begin
  -- Replace only the historical wipe; never rewrite migration history.
  select pg_get_functiondef('public.import_members_from_csv(uuid,jsonb,text,text)'::regprocedure) into definition;
  definition:=replace(definition,'delete from public.audit_events where id is not null;','-- Audit history is retained indefinitely.');
  execute definition;
  for command in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,
    pg_get_function_identity_arguments(p.oid) identity_args,pg_get_function_result(p.oid) result,p.proretset,p.prorettype,p.proargnames,p.pronargs
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
    ('save_person','deacon_save_member','save_group','delete_group','save_member_family','record_member_departure','set_person_photo','set_person_photo_metadata','delete_member_record','import_members_from_csv') loop
    call_args:=(select string_agg(format('$%s',i),',') from generate_series(1,command.pronargs) i);
    execute format('alter function public.%I(%s) rename to %I',command.proname,command.identity_args,'audit_impl_'||command.proname);
    execute format('alter function public.%I(%s) set schema app_private','audit_impl_'||command.proname,command.identity_args);
    execute format('revoke all on function app_private.%I(%s) from public,anon,authenticated','audit_impl_'||command.proname,command.identity_args);
    classification:=case when command.proname='delete_member_record' then quote_literal('irreversible')
      when command.proname='import_members_from_csv' then 'case when p_mode=''replace'' then ''irreversible'' else ''supported'' end' else quote_literal('supported') end;
    invoke:=case when command.proretset then format('return query select * from app_private.%I(%s);','audit_impl_'||command.proname,call_args)
      when command.prorettype='void'::regtype then format('perform app_private.%I(%s);','audit_impl_'||command.proname,call_args)
      else format('result:=app_private.%I(%s);','audit_impl_'||command.proname,call_args) end;
    execute format('create function public.%I(%s) returns %s language plpgsql security definer set search_path='''' as $wrapper$ %s begin perform app_private.audit_begin(%L,%s); %s perform app_private.audit_end(); %s end $wrapper$',
      command.proname,command.args,command.result,
      case when not command.proretset and command.prorettype<>'void'::regtype then 'declare result '||command.result||';' else '' end,
      command.proname,classification,invoke,
      case when not command.proretset and command.prorettype<>'void'::regtype then 'return result;' else '' end);
    execute format('revoke all on function public.%I(%s) from public,anon; grant execute on function public.%I(%s) to authenticated',command.proname,command.identity_args,command.proname,command.identity_args);
  end loop;
end $$;

create function public.audit_history(p_filters jsonb default '{}',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not app_private.admin() then raise exception 'Only active administrators can read audit history' using errcode='42501'; end if;
  if p_limit is null or p_offset is null or p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid pagination'; end if;
  with matching as (
    select e.*,(select count(*) from public.audit_event_changes c where c.action_id=e.id) change_count
    from public.audit_events e where
      (nullif(p_filters->>'actor','') is null or e.actor_id=(p_filters->>'actor')::uuid)
      and (nullif(p_filters->>'action','') is null or e.action=p_filters->>'action')
      and (nullif(p_filters->>'from','') is null or e.created_at>=(p_filters->>'from')::timestamptz)
      and (nullif(p_filters->>'to','') is null or e.created_at<(p_filters->>'to')::date+interval '1 day')
      and (nullif(p_filters->>'subject','') is null or e.entity_id=(p_filters->>'subject')::uuid or exists(select 1 from public.audit_event_changes c where c.action_id=e.id and c.subject_ids @> array[(p_filters->>'subject')::uuid]))
  ), page as (select * from matching order by created_at desc,id desc limit p_limit offset p_offset)
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),'total',(select count(*) from matching)) into result;
  return result;
end $$;
create function public.audit_action_details(p_action_id uuid,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.admin() then raise exception 'Only active administrators can read audit history' using errcode='42501'; end if;
  if p_limit is null or p_offset is null or p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid pagination'; end if;
  return jsonb_build_object('action',(select to_jsonb(e) from public.audit_events e where id=p_action_id),
    'items',coalesce((select jsonb_agg(to_jsonb(c) order by id) from (select * from public.audit_event_changes where action_id=p_action_id order by id limit p_limit offset p_offset) c),'[]'::jsonb),
    'total',(select count(*) from public.audit_event_changes where action_id=p_action_id));
end $$;
-- Internal-only helpers: no caller can synthesize an envelope or trigger context.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and (p.proname like 'audit_%' or p.proname='capture_audit_change') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
revoke all on function public.audit_history(jsonb,integer,integer),public.audit_action_details(uuid,integer,integer) from public,anon;
grant execute on function public.audit_history(jsonb,integer,integer),public.audit_action_details(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
