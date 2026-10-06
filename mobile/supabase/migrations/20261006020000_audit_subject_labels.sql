begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.audit_event_changes add column subject_labels jsonb not null default '{}';

-- Names belong to history, rather than the lifetime of the directory record.
-- Only public display names are copied; no private care fields are read.
create function app_private.audit_subject_labels(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(id::text,name),'{}'::jsonb) from (
  select id,name from public.people where id=any(p_ids)
  union all select id,name from public.deacon_groups where id=any(p_ids)
 ) names
$$;
create function app_private.capture_audit_subject_labels() returns trigger
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; name text;
begin
 new.subject_labels:=coalesce(new.subject_labels,'{}')||app_private.audit_subject_labels(new.subject_ids);
 if new.entity in ('people','deacon_groups') then
  snapshot:=coalesce(new.after_data,new.before_data);
  name:=coalesce(nullif(snapshot->>'name',''),nullif(new.before_data->>'name',''));
  if name is not null then new.subject_labels:=new.subject_labels||jsonb_build_object(snapshot->>'id',name); end if;
 end if;
 return new;
end $$;
create trigger audit_subject_labels before insert or update of before_data,after_data,subject_ids on public.audit_event_changes
 for each row execute function app_private.capture_audit_subject_labels();

-- Existing snapshots take priority over today's names. A current-name fallback
-- can label old private-detail/relationship actions that did not change people.
update public.audit_event_changes c set subject_labels=app_private.audit_subject_labels(c.subject_ids) where c.id is not null;
update public.audit_event_changes c set subject_labels=c.subject_labels||snapshots.labels
 from (select action_id,jsonb_object_agg(coalesce(after_data,before_data)->>'id',coalesce(after_data,before_data)->>'name') labels
  from public.audit_event_changes where entity in ('people','deacon_groups') and coalesce(after_data,before_data)->>'name' is not null group by action_id) snapshots
 where c.action_id=snapshots.action_id;
-- Backfill is complete; later events retain the captured labels without joins.

create function app_private.audit_action_subjects(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with names as (
  select distinct on (key) key,value from public.audit_event_changes c cross join lateral jsonb_each_text(c.subject_labels)
  where c.action_id=p_id
  order by key,case when c.entity in ('people','deacon_groups') and c.record_key->>'id'=key then 0 else 1 end,c.id desc
 ), fallback as (
  select key,value from public.audit_events e cross join lateral jsonb_each_text(app_private.audit_subject_labels(array[e.entity_id]))
  where e.id=p_id and not exists(select 1 from names)
 ), all_names as (select * from names union select * from fallback), page as (select * from all_names order by value,key limit 5)
 select jsonb_build_object('subject_labels',coalesce((select jsonb_object_agg(key,value) from page),'{}'::jsonb),'subject_count',(select count(*) from all_names))
$$;

-- Preserve the existing authorization, filtering, pagination and rollback checks.
alter function public.audit_history(jsonb,integer,integer) rename to audit_labels_impl_history;
alter function public.audit_labels_impl_history(jsonb,integer,integer) set schema app_private;
create function public.audit_history(p_filters jsonb default '{}',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.audit_labels_impl_history(p_filters,p_limit,p_offset);
 return result||jsonb_build_object('items',coalesce((select jsonb_agg(item||app_private.audit_action_subjects((item->>'id')::uuid) order by ordinal)
  from jsonb_array_elements(result->'items') with ordinality rows(item,ordinal)),'[]'::jsonb));
end $$;

-- Detail rows already include subject_labels through the existing to_jsonb(c).
alter function public.preview_audit_rollback(uuid,integer,integer) rename to audit_labels_impl_preview;
alter function public.audit_labels_impl_preview(uuid,integer,integer) set schema app_private;
create function public.preview_audit_rollback(p_action_id uuid,p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.audit_labels_impl_preview(p_action_id,p_limit,p_offset);
 return result||jsonb_build_object('changes',coalesce((select jsonb_agg(item||jsonb_build_object('subject_labels',coalesce(
  (select c.subject_labels from public.audit_event_changes c where c.action_id=p_action_id and c.entity=item->>'entity' and c.record_key=item->'key'),'{}'::jsonb)) order by ordinal)
  from jsonb_array_elements(result->'changes') with ordinality rows(item,ordinal)),'[]'::jsonb));
end $$;
revoke all on function app_private.audit_subject_labels(uuid[]),app_private.capture_audit_subject_labels(),app_private.audit_action_subjects(uuid),
 app_private.audit_labels_impl_history(jsonb,integer,integer),app_private.audit_labels_impl_preview(uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.audit_history(jsonb,integer,integer),public.preview_audit_rollback(uuid,integer,integer) from public,anon;
grant execute on function public.audit_history(jsonb,integer,integer),public.preview_audit_rollback(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
