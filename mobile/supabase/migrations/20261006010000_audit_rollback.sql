begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.people add column removed_at timestamptz;

create table app_private.member_removal_photo_cleanup(person_id uuid primary key,path text not null);
create function public.member_removal_photo_cleanup(p_person_id uuid) returns table(path text)
language sql security definer set search_path='' as $$ select path from app_private.member_removal_photo_cleanup where person_id=p_person_id $$;
create function public.member_removal_photo_cleanup_completed(p_person_id uuid) returns void
language sql security definer set search_path='' as $$ delete from app_private.member_removal_photo_cleanup where person_id=p_person_id $$;
revoke all on function public.member_removal_photo_cleanup(uuid),public.member_removal_photo_cleanup_completed(uuid) from public,anon,authenticated;
grant execute on function public.member_removal_photo_cleanup(uuid),public.member_removal_photo_cleanup_completed(uuid) to service_role;

-- Existing sessions lose backend access when a linked member is removed.
-- Restoration changes directory state only; profile.status remains revoked.
create function app_private.remove_member(p_id uuid,p_revision integer,p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.people; linked public.profiles;
begin
  if not app_private.admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into member from public.people where id=p_id for update;
  if not found then raise exception 'Member not found'; end if;
  if member.removed_at is not null then return jsonb_build_object('deletedPersonId',p_id,'deletedAccountId',null,'deletedVisitCount',0,'photoPath',null); end if;
  if member.revision is distinct from p_revision then raise exception 'Conflict: member changed' using errcode='40001'; end if;
  if p_confirmation is distinct from trim(member.name) then raise exception 'Type the member name exactly'; end if;
  select * into linked from public.profiles where person_id=p_id;
  if linked.id=auth.uid() then raise exception 'You cannot remove your own member record'; end if;
  if linked.role='admin' and linked.status='active' and not exists(select 1 from public.profiles where id<>linked.id and role='admin' and status='active') then raise exception 'The last active administrator cannot be removed'; end if;
  if member.photo_path is not null then insert into app_private.member_removal_photo_cleanup values(p_id,member.photo_path) on conflict(person_id) do update set path=excluded.path; end if;
  update public.profiles set status='revoked',revision=revision+1 where person_id=p_id and status<>'revoked';
  update public.people set removed_at=clock_timestamp(),photo_path=null,revision=revision+1 where id=p_id;
  return jsonb_build_object('deletedPersonId',p_id,'deletedAccountId',null,'deletedVisitCount',0,'photoPath',member.photo_path);
end $$;
create function public.remove_member(p_id uuid,p_revision integer,p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform app_private.audit_begin('member.removed');
  result:=app_private.remove_member(p_id,p_revision,p_confirmation);
  perform app_private.audit_end();
  return result;
end $$;
revoke all on function app_private.remove_member(uuid,integer,text) from public,anon,authenticated;
revoke all on function public.remove_member(uuid,integer,text) from public,anon;
grant execute on function public.remove_member(uuid,integer,text) to authenticated;

-- RLS filters direct reads even for managers. Security-definer legacy contracts
-- use the same filtered projection, preserving native/old-client signatures.
create function app_private.prevent_removed_account_access() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='active' and exists(select 1 from public.people where id=new.person_id and removed_at is not null) then raise exception 'Restore the directory member before explicitly re-enabling account access'; end if;
  return new;
end $$;
revoke all on function app_private.prevent_removed_account_access() from public,anon,authenticated;
create trigger prevent_removed_account_access before insert or update on public.profiles for each row execute function app_private.prevent_removed_account_access();
create policy people_not_removed on public.people as restrictive for select to authenticated using(removed_at is null);
create policy group_members_not_removed on public.deacon_group_members as restrictive for select to authenticated using(exists(select 1 from public.people where id=person_id));
create policy group_deacons_not_removed on public.deacon_group_deacons as restrictive for select to authenticated using(exists(select 1 from public.people where id=person_id));
create view app_private.visible_people as select * from public.people where removed_at is null;
revoke all on app_private.visible_people from public,anon,authenticated;
-- Reviewed existing read contracts only. Internal audit/removal helpers must
-- see removed rows; future readers must explicitly adopt visible_people.
do $$ declare f record; definition text; begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname||'.'||p.proname = any(array[
      'app_private.audit_impl_deacon_save_member','app_private.audit_impl_record_member_departure',
      'app_private.audit_impl_save_group','app_private.audit_impl_save_member_family',
      'app_private.can_edit_group_member','app_private.check_group_leader_assignment',
      'app_private.check_linked_leader_membership','app_private.eligible_deacon',
      'public.directory_active_members','public.group_birthdays','public.group_summary_counts',
      'public.management_group_birth_dates','public.management_member_care_details',
      'public.management_member_details','public.member_family','public.member_profile_details',
      'public.remove_member_note','public.save_member_note','public.save_person_without_gender',
      'public.save_visit','public.update_account','public.visit_person_defaults'
    ]) loop
    definition:=pg_get_functiondef(f.oid);
    definition:=replace(definition,'group by r.category,p.id','group by r.category,p.id,p.name,p.archived_at,p.photo_path');
    -- Only reads are redirected; writes and composite types continue using people.
    definition:=regexp_replace(definition,'((from|join)\s+)public\.people(\s|\))','\1app_private.visible_people\3','gi');
    execute definition;
  end loop;
end $$;

do $$ declare definition text; begin
  select pg_get_functiondef('app_private.audit_impl_set_person_photo(uuid,integer,text)'::regprocedure) into definition;
  definition:=replace(definition,'where id=p_id and revision=p_revision','where id=p_id and revision=p_revision and removed_at is null');
  execute definition;
end $$;

create function app_private.audit_current(p_entity text,p_key jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  execute format('select app_private.audit_snapshot(%L,to_jsonb(t)) from public.%I t where to_jsonb(t) @> $1',p_entity,p_entity) into result using p_key;
  return result;
end $$;
-- Created subjects can be undone only if later work/dependencies survive.
-- FK metadata makes this include visits/accounts/notes without snapshotting them.
create function app_private.audit_dependencies(p_action uuid,p_entity text,p_key jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare fk record; dependent jsonb;
begin
  if p_entity not in ('people','deacon_groups') then return false; end if;
  for fk in select c.conrelid::regclass relation,a.attname column_name,n.nspname schema_name,t.relname table_name
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where c.contype='f' and c.confrelid=format('public.%I',p_entity)::regclass and cardinality(c.conkey)=1 loop
    for dependent in execute format('select to_jsonb(t) from %s t where %I=$1',fk.relation,fk.column_name) using (p_key->>'id')::uuid loop
      if not exists(select 1 from public.audit_event_changes c where c.action_id=p_action and c.entity=fk.table_name
        and c.after_data=app_private.audit_snapshot(fk.table_name,dependent)) then return true; end if;
    end loop;
  end loop;
  return false;
end $$;
create function app_private.audit_changed_fields(p_before jsonb,p_after jsonb) returns text[]
language sql immutable set search_path='' as $$
  select coalesce(array_agg(key),'{}'::text[]) from jsonb_object_keys(coalesce(p_before,'{}')||coalesce(p_after,'{}')) key
  where key not in ('photo_path','created_at') and p_before->key is distinct from p_after->key
$$;
create function app_private.audit_plan(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event public.audit_events; change public.audit_event_changes; current_data jsonb; fields text[]; field text;
  conflicts jsonb:='[]'; changes jsonb:='[]'; photos boolean:=false; supported boolean:=false;
begin
  select * into event from public.audit_events where id=p_id;
  if not found then raise exception 'Action not found'; end if;
  if event.restoration<>'supported' then return jsonb_build_object('available',false,'reasonCode',event.restoration,'reason',case event.restoration when 'legacy' then 'Legacy entry: before/after snapshots are unavailable.' else 'Permanent deletion and directory replacement are irreversible.' end,'conflicts','[]'::jsonb,'changes','[]'::jsonb,'photoLimitations',false); end if;
  for change in select * from public.audit_event_changes where action_id=p_id order by id loop
    current_data:=app_private.audit_current(change.entity,change.record_key);
    -- removed_at was added after the capture migration; older captured rows
    -- interpret its absence as NULL, never as a changed field.
    fields:=app_private.audit_changed_fields(change.before_data,change.after_data);
    if cardinality(fields)>0 or change.before_data is null or change.after_data is null then supported:=true; end if;
    if change.entity='people' and ((change.before_data->'photo_path') is distinct from (change.after_data->'photo_path')
      or change.before_data->>'photo_path' is not null and change.after_data->>'removed_at' is not null) then photos:=true; end if;
    if change.before_data is null then
      if current_data is distinct from change.after_data then conflicts:=conflicts||jsonb_build_array(jsonb_build_object('entity',change.entity,'key',change.record_key,'field','record','code','record_changed','reason','Created record was subsequently changed or removed.')); end if;
      if app_private.audit_dependencies(p_id,change.entity,change.record_key) then conflicts:=conflicts||jsonb_build_array(jsonb_build_object('entity',change.entity,'key',change.record_key,'field','dependencies','code','dependencies','reason','Later dependent records would be lost.')); end if;
    elsif change.after_data is null then
      if current_data is not null then conflicts:=conflicts||jsonb_build_array(jsonb_build_object('entity',change.entity,'key',change.record_key,'field','record','code','identifier_used','reason','Deleted record identifier is already in use.')); end if;
    else
      foreach field in array fields loop
        if current_data is null or current_data->field is distinct from change.after_data->field then
          conflicts:=conflicts||jsonb_build_array(jsonb_build_object('entity',change.entity,'key',change.record_key,'field',field,'code','field_changed','reason','This field changed after the selected action.'));
        end if;
      end loop;
    end if;
    changes:=changes||jsonb_build_array(jsonb_build_object('entity',change.entity,'key',change.record_key,'fields',fields,
      'current',current_data,'proposed',case when change.before_data is null and change.entity='people' then current_data||jsonb_build_object('removed_at','On confirmation','photo_path',null)
        when change.before_data is null then null when change.after_data is null then change.before_data-'photo_path' else current_data||(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(change.before_data) where key=any(fields)) end));
  end loop;
  return jsonb_build_object('available',jsonb_array_length(conflicts)=0 and supported,'reasonCode',case when jsonb_array_length(conflicts)>0 then 'conflict' when not supported then 'photo_only' else null end,'reason',case when jsonb_array_length(conflicts)>0 then 'Conflicting later changes block the whole rollback.' when not supported then 'Photo metadata only: previous image files cannot be restored.' else null end,'conflicts',conflicts,'changes',changes,'photoLimitations',photos);
end $$;

-- Apply authoritative inverse changes in dependency order. Column lists come
-- only from retained snapshots and PostgreSQL's catalog, never client input.
create function app_private.audit_apply(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare change public.audit_event_changes; assignments text; columns text; values_sql text; restoring jsonb;
begin
  perform set_config('app.member_name_fields','',true);
  -- Delete affected relationship rows first, including slot moves. They are
  -- reinserted after subjects/ministries exist, avoiding transient invariants.
  for change in select * from public.audit_event_changes where action_id=p_id and entity in ('deacon_group_members','deacon_group_deacons','person_ministries','member_family_edges') order by id loop
    execute format('delete from public.%I t where to_jsonb(t) @> $1',change.entity) using change.record_key;
  end loop;
  for change in select * from public.audit_event_changes where action_id=p_id and entity not in ('deacon_group_members','deacon_group_deacons','person_ministries','member_family_edges')
    order by case entity when 'deacon_groups' then 0 when 'people' then 1 else 2 end,id loop
    if change.before_data is null then
      if change.entity='people' then
        perform app_private.remove_member((change.record_key->>'id')::uuid,(select revision from public.people where id=(change.record_key->>'id')::uuid),change.after_data->>'name');
      elsif change.entity='member_departures' then
        update public.member_departures set restored_at=coalesce(restored_at,clock_timestamp()) where id=(change.record_key->>'id')::uuid;
      elsif change.entity='people_private' and exists(select 1 from public.audit_event_changes c where c.action_id=p_id and c.entity='people' and c.before_data is null and c.record_key->>'id'=change.record_key->>'person_id') then
        null; -- Soft removal retains the created member's recoverable private data.
      else execute format('delete from public.%I t where to_jsonb(t) @> $1',change.entity) using change.record_key; end if;
    elsif change.after_data is null then
      restoring:=change.before_data;
      if change.entity='people' then restoring:=restoring||jsonb_build_object('photo_path',null); end if;
      select string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',change.entity,key),',') into columns,values_sql
      from jsonb_object_keys(restoring) key;
      execute format('insert into public.%I (%s) select %s',change.entity,columns,values_sql) using restoring;
    else
      select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,change.entity,key),',') into assignments
      from unnest(app_private.audit_changed_fields(change.before_data,change.after_data)) key;
      if assignments is not null then
        if change.entity in ('people','deacon_groups') then assignments:=assignments||',revision=revision+1'; end if;
        execute format('update public.%I t set %s where to_jsonb(t) @> $2',change.entity,assignments) using change.before_data,change.record_key;
      end if;
    end if;
  end loop;
  for change in select * from public.audit_event_changes where action_id=p_id and before_data is not null and entity in ('deacon_group_members','deacon_group_deacons','person_ministries','member_family_edges')
    order by case entity when 'person_ministries' then 0 when 'deacon_group_members' then 1 else 2 end,id loop
    select string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',change.entity,key),',') into columns,values_sql from jsonb_object_keys(change.before_data) key;
    execute format('insert into public.%I (%s) select %s',change.entity,columns,values_sql) using change.before_data;
  end loop;
  update public.deacon_groups set revision=revision+1 where id in (
    select unnest(subject_ids) from public.audit_event_changes where action_id=p_id
  );
  -- Validate only assignments introduced by this inverse. Existing unrelated
  -- archived data must not block a rollback, but normal writer eligibility
  -- rules still apply to relationships being restored.
  if exists(select 1 from public.audit_event_changes c join public.people p on p.id=(c.record_key->>'id')::uuid
    where c.action_id=p_id and c.entity='people' and c.before_data is not null
      and c.before_data->>'membership_group_id' is not null
      and c.before_data->'membership_group_id' is distinct from c.after_data->'membership_group_id'
      and (p.archived_at is not null or p.removed_at is not null)) then raise exception 'Restored group assignments require active members'; end if;
  if exists(select 1 from public.audit_event_changes c join public.people p on p.id=(c.before_data->>'person_id')::uuid
    where c.action_id=p_id and c.entity='deacon_group_members' and c.before_data is not null
      and (p.archived_at is not null or p.removed_at is not null)) then raise exception 'Restored responsibility assignments require active members'; end if;
  if exists(select 1 from public.audit_event_changes c join public.ministries m on m.id=(c.before_data->>'ministry_id')::uuid
    where c.action_id=p_id and c.entity='person_ministries' and c.before_data is not null and m.archived_at is not null) then raise exception 'Restored ministry assignments require active ministries'; end if;
  if exists(select 1 from public.audit_event_changes c join public.people p on p.id in ((c.before_data->>'from_id')::uuid,(c.before_data->>'to_id')::uuid)
    where c.action_id=p_id and c.entity='member_family_edges' and c.before_data is not null and p.removed_at is not null) then raise exception 'Restore the directory member before restoring family connections'; end if;
  -- Family invariants enforced by the public family writer also apply here.
  if exists(with recursive ancestry(a,d) as (
    select from_id,to_id from public.member_family_edges where kind='parent'
    union select a.a,e.to_id from ancestry a join public.member_family_edges e on e.kind='parent' and e.from_id=a.d
  ) select 1 from ancestry where a=d) then raise exception 'Parent connections cannot create an ancestry cycle'; end if;
  if exists(select id from (select from_id id from public.member_family_edges where kind='spouse' union all select to_id from public.member_family_edges where kind='spouse') spouses group by id having count(*)>1) then raise exception 'Selected member already has a spouse'; end if;
  if exists(select 1 from public.member_family_edges s join public.member_family_edges c on c.kind='parent' and c.from_id in (s.from_id,s.to_id)
    where s.kind='spouse' and not exists(select 1 from public.member_family_edges other where other.kind='parent' and other.from_id=case when c.from_id=s.from_id then s.to_id else s.from_id end and other.to_id=c.to_id)) then raise exception 'Married parents must share their child connections'; end if;
end $$;
create function public.preview_audit_rollback(p_action_id uuid,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan jsonb; failure text;
begin
  if not app_private.admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_limit is null or p_offset is null or p_limit not between 1 and 100 or p_offset<0 then raise exception 'Invalid pagination'; end if;
  perform app_private.audit_lock();
  plan:=app_private.audit_plan(p_action_id);
  if (plan->>'available')::boolean then
    -- Dry run in a subtransaction checks FKs, unique slots/names and domain
    -- invariants against current data. All side effects are rolled back.
    begin
      perform app_private.audit_apply(p_action_id);
      raise exception 'Preview complete' using errcode='ZP001';
    exception when sqlstate 'ZP001' then null;
      when others then get stacked diagnostics failure=message_text;
        plan:=plan||jsonb_build_object('available',false,'reasonCode','invariant','reason','Current domain invariants block the whole rollback.','conflicts',jsonb_build_array(jsonb_build_object('field','invariant','code','invariant','reason',failure)));
    end;
  end if;
  return (plan-'changes')||jsonb_build_object('total',jsonb_array_length(plan->'changes'),'changes',coalesce((select jsonb_agg(value order by ordinal) from jsonb_array_elements(plan->'changes') with ordinality c(value,ordinal) where ordinal>p_offset and ordinal<=p_offset+p_limit),'[]'::jsonb));
end $$;
create function public.execute_audit_rollback(p_action_id uuid,p_operation_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan jsonb; receipt public.audit_events; event_id uuid;
begin
  if not app_private.admin() then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_operation_id is null or length(trim(coalesce(p_reason,''))) not between 1 and 2000 then raise exception 'Supply an operation ID and a reason (1–2000 characters)'; end if;
  perform app_private.audit_lock();
  select * into receipt from public.audit_events where operation_id=p_operation_id;
  if found then
    if receipt.original_action_id is distinct from p_action_id or receipt.reason is distinct from trim(p_reason) or receipt.actor_id is distinct from auth.uid() then raise exception 'Operation ID already used for another request'; end if;
    return jsonb_build_object('actionId',receipt.id);
  end if;
  plan:=public.preview_audit_rollback(p_action_id,1,0);
  if not (plan->>'available')::boolean then raise exception '%',plan->>'reason' using errcode='40001',detail=(plan->'conflicts')::text; end if;
  perform app_private.audit_begin('audit.rollback','supported',p_operation_id);
  select action_id into event_id from app_private.audit_context where transaction_id=txid_current();
  update public.audit_events set original_action_id=p_action_id,reason=trim(p_reason) where id=event_id;
  perform app_private.audit_apply(p_action_id);
  perform app_private.audit_end();
  return jsonb_build_object('actionId',event_id);
end $$;
-- All internal functions and context remain inaccessible to client roles.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname like 'audit_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
revoke all on function public.preview_audit_rollback(uuid,integer,integer),public.execute_audit_rollback(uuid,uuid,text) from public,anon;
grant execute on function public.preview_audit_rollback(uuid,integer,integer),public.execute_audit_rollback(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
