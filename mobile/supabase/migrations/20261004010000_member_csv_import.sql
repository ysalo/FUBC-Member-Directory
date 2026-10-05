begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Operation receipts make a lost HTTP response safe to retry. These tables have
-- no client SELECT policy; responses contain counts, never member/photo bytes.
create table public.member_csv_imports (
  id uuid primary key, actor_id uuid references public.profiles(id) on delete set null,
  fingerprint text not null, mode text not null check (mode in ('add','replace')),
  imported_count integer not null, replaced_count integer not null,
  created_at timestamptz not null default now()
);
create table public.member_import_photo_cleanup (
  path text primary key,
  import_id uuid not null references public.member_csv_imports(id)
);
create index member_import_photo_cleanup_operation on public.member_import_photo_cleanup(import_id);
alter table public.member_csv_imports enable row level security;
alter table public.member_import_photo_cleanup enable row level security;
revoke all on public.member_csv_imports,public.member_import_photo_cleanup from public,anon,authenticated;
grant all on public.member_csv_imports,public.member_import_photo_cleanup to service_role;

create function public.import_members_from_csv(p_import_id uuid,p_rows jsonb,p_mode text,p_confirmation text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  receipt public.member_csv_imports;
  fingerprint text;
  row_data jsonb;
  data jsonb;
  row_number integer := 1;
  old_count integer := 0;
  birth_value date;
  joined_value date;
  key text;
  value jsonb;
begin
  if not app_private.admin() then raise exception 'Only active administrators can import members'; end if;
  if p_import_id is null or p_mode is null or p_mode not in ('add','replace') then raise exception 'Choose an import operation and mode'; end if;
  if p_mode='replace' and p_confirmation is distinct from 'REPLACE MEMBERS' then raise exception 'Type REPLACE MEMBERS to confirm'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Provide a member array'; end if;
  if jsonb_array_length(p_rows) not between 1 and 5000 then raise exception 'Import between 1 and 5000 members'; end if;
  fingerprint := md5(p_rows::text);
  -- Serialize imports and receipt checks, including two simultaneous retries.
  perform pg_advisory_xact_lock(20261004,1);
  select * into receipt from public.member_csv_imports where id=p_import_id;
  if found then
    if receipt.fingerprint<>fingerprint or receipt.mode<>p_mode or receipt.actor_id is distinct from auth.uid() then raise exception 'This import ID was already used for another request'; end if;
    return jsonb_build_object('importId',receipt.id,'importedCount',receipt.imported_count,'replacedCount',receipt.replaced_count,
      'pendingPhotos',(select count(*) from public.member_import_photo_cleanup where import_id=p_import_id));
  end if;

  -- Validate the entire payload before removing records. The writer is also
  -- called within this transaction, so any constraint failure rolls back reset.
  for row_data in select item from jsonb_array_elements(p_rows) item loop
    row_number := row_number+1;
    if jsonb_typeof(row_data) is distinct from 'object' then raise exception 'Row %: member must be an object',row_number; end if;
    for key,value in select * from jsonb_each(row_data) loop
      if key not in ('first_name','last_name','patronymic','gender','phone','email','birth_date','membership_joined_at','address')
        or jsonb_typeof(value) not in ('string','null') then raise exception 'Row %: invalid field %',row_number,key; end if;
    end loop;
    if jsonb_typeof(row_data->'first_name') is distinct from 'string' or jsonb_typeof(row_data->'last_name') is distinct from 'string'
      or length(trim(row_data->>'first_name')) not between 1 and 200 or length(trim(row_data->>'last_name')) not between 1 and 200
      or length(trim(row_data->>'first_name')||' '||trim(row_data->>'last_name'))>200 then raise exception 'Row %: first and last names are required (combined maximum 200 characters)',row_number; end if;
    if jsonb_typeof(row_data->'gender') is distinct from 'string' or row_data->>'gender' not in ('male','female') then raise exception 'Row %: use male or female',row_number; end if;
    if length(coalesce(row_data->>'patronymic',''))>200 or length(coalesce(row_data->>'address',''))>2000 then raise exception 'Row %: patronymic or address is too long',row_number; end if;
    if nullif(row_data->>'phone','') is not null and row_data->>'phone' !~ '^[0-9]{10}$' then raise exception 'Row %: phone must contain ten digits',row_number; end if;
    if nullif(row_data->>'email','') is not null and (length(row_data->>'email')>254 or row_data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Row %: invalid email',row_number; end if;
    for key in select unnest(array['birth_date','membership_joined_at']) loop
      if nullif(row_data->>key,'') is not null then
        if row_data->>key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Row %: use YYYY-MM-DD for %',row_number,key; end if;
        birth_value := (row_data->>key)::date;
        if birth_value>current_date or not isfinite(birth_value) then raise exception 'Row %: % cannot be in the future',row_number,key; end if;
      end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_rows) input(value)
    group by lower(trim(input.value->>'first_name')),lower(trim(input.value->>'last_name')),lower(trim(coalesce(input.value->>'patronymic',''))),coalesce(input.value->>'birth_date','') having count(*)>1)
    then raise exception 'Duplicate name and birth date in the import'; end if;

  lock table public.people,public.profiles in share row exclusive mode;
  if p_mode='add' and exists(
    select 1 from jsonb_array_elements(p_rows) incoming join public.people p
    on lower(p.first_name)=lower(trim(incoming->>'first_name')) and lower(p.last_name)=lower(trim(incoming->>'last_name'))
    and lower(coalesce(p.patronymic,''))=lower(trim(coalesce(incoming->>'patronymic','')))
    left join public.people_private detail on detail.person_id=p.id
    where coalesce(detail.birth_date::text,'')=coalesce(incoming->>'birth_date',''))
    then raise exception 'A member in this file already exists. Review the file or choose Replace directory'; end if;

  if p_mode='replace' then select count(*)::integer into old_count from public.people; end if;
  insert into public.member_csv_imports(id,actor_id,fingerprint,mode,imported_count,replaced_count)
  values(p_import_id,auth.uid(),fingerprint,p_mode,jsonb_array_length(p_rows),old_count);
  if p_mode='replace' then
    -- Read Storage metadata only. Never DELETE storage.objects with SQL: the
    -- Storage API must remove the physical objects after the transaction commits.
    insert into public.member_import_photo_cleanup(path,import_id)
    select name,p_import_id from storage.objects where bucket_id='member-photos'
    on conflict(path) do update set import_id=excluded.import_id;
    update public.profiles set person_id=null,designation='none',revision=revision+1 where person_id is not null or designation<>'none';
    delete from public.visit_requests where id is not null;
    delete from public.deacon_duty_periods where id is not null;
    delete from public.people where id is not null;
    delete from public.deacon_groups where id is not null;
    -- Protected Pastor/Deacon definitions are schema reference data.
    delete from public.ministries where system_key is null;
    delete from public.preferences where account_id is not null;
    delete from public.device_tokens where id is not null;
    delete from public.account_deletion_requests where id is not null;
    delete from public.audit_events where id is not null;
  end if;
  for row_data in select item from jsonb_array_elements(p_rows) item loop
    -- All user-provided keys were checked. Empty optional fields become NULL.
    data := row_data || jsonb_build_object('first_name',trim(row_data->>'first_name'),'last_name',trim(row_data->>'last_name'),
      'ministry_ids','[]'::jsonb,'orphan_status',false,'widow_status',false);
    perform public.save_person(null,null,data);
  end loop;
  perform app_private.audit('members.csv_imported',p_import_id,jsonb_build_object('mode',p_mode,'imported_count',jsonb_array_length(p_rows),'replaced_count',old_count));
  return jsonb_build_object('importId',p_import_id,'importedCount',jsonb_array_length(p_rows),'replacedCount',old_count,
    'pendingPhotos',(select count(*) from public.member_import_photo_cleanup where import_id=p_import_id));
end $$;
revoke all on function public.import_members_from_csv(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.import_members_from_csv(uuid,jsonb,text,text) to authenticated;

create function public.member_import_cleanup_batch(p_import_id uuid)
returns table(path text) language sql stable security definer set search_path='' as $$
  select q.path from public.member_import_photo_cleanup q where q.import_id=p_import_id order by q.path limit 100
$$;
create function public.member_import_cleanup_completed(p_import_id uuid,p_paths text[])
returns bigint language plpgsql security definer set search_path='' as $$
begin
  if cardinality(p_paths)>100 then raise exception 'Delete at most 100 paths at a time'; end if;
  delete from public.member_import_photo_cleanup where import_id=p_import_id and path=any(p_paths);
  return (select count(*) from public.member_import_photo_cleanup where import_id=p_import_id);
end $$;
create function public.member_import_receipt(p_import_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('importId',i.id,'importedCount',i.imported_count,'replacedCount',i.replaced_count,
    'pendingPhotos',(select count(*) from public.member_import_photo_cleanup q where q.import_id=i.id))
  from public.member_csv_imports i where i.id=p_import_id
$$;
revoke all on function public.member_import_cleanup_batch(uuid),public.member_import_cleanup_completed(uuid,text[]),public.member_import_receipt(uuid) from public,anon,authenticated;
grant execute on function public.member_import_cleanup_batch(uuid),public.member_import_cleanup_completed(uuid,text[]),public.member_import_receipt(uuid) to service_role;

-- An upload saves only these metadata fields; no binary photo or signed URL is
-- included in the write response and there is no read of the uploaded object.
create function public.set_person_photo_metadata(p_id uuid,p_revision integer,p_path text)
returns table(id uuid,revision integer,photo_path text)
language plpgsql security definer set search_path='' as $$
declare result public.people;
begin
  result := public.set_person_photo(p_id,p_revision,p_path);
  return query select result.id,result.revision,result.photo_path;
end $$;
revoke all on function public.set_person_photo_metadata(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.set_person_photo_metadata(uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
