begin;

alter table public.people add column patronymic text check (patronymic is null or length(patronymic) between 1 and 200);

create or replace function public.save_person(p_id uuid,p_revision integer,p_data jsonb)
returns public.people
language plpgsql security definer set search_path = '' as $$
declare
  result public.people;
  ministry_ids uuid[] := array[]::uuid[];
  has_ministry_ids boolean := p_data ? 'ministry_ids';
  primary_ministry text := '';
  primary_ministry_uk text := '';
  birth_date_value date;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Enter a member name'; end if;
  if nullif(p_data->>'membership_group_id','') is not null and not exists(
    select 1 from public.deacon_groups where id=(p_data->>'membership_group_id')::uuid and kind='membership' and archived_at is null
  ) then raise exception 'Choose an active membership group'; end if;

  if has_ministry_ids then
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into ministry_ids
    from jsonb_array_elements_text(coalesce(p_data->'ministry_ids','[]'::jsonb));
    if cardinality(ministry_ids)<>(select count(distinct id) from unnest(ministry_ids) id) then raise exception 'Choose each ministry once'; end if;
    if exists(select 1 from unnest(ministry_ids) id where not exists(
      select 1 from public.ministries m where m.id=id and m.archived_at is null
    )) then raise exception 'Choose active ministries'; end if;
    select m.name,coalesce(nullif(m.name_uk,''),m.name) into primary_ministry,primary_ministry_uk
    from public.ministries m where m.id=any(ministry_ids) order by m.name limit 1;
    primary_ministry := coalesce(primary_ministry,'');
    primary_ministry_uk := coalesce(primary_ministry_uk,'');
  end if;

  if p_data ? 'birth_date' then
    birth_date_value := nullif(p_data->>'birth_date','')::date;
    if birth_date_value>current_date then raise exception 'Birthday cannot be in the future'; end if;
  end if;

  if p_id is null then
    insert into public.people(name,patronymic,ministry,ministry_uk,phone,email,membership_group_id)
    values(trim(p_data->>'name'),nullif(trim(coalesce(p_data->>'patronymic','')),''),
      case when has_ministry_ids then primary_ministry else coalesce(p_data->>'ministry','') end,
      case when has_ministry_ids then primary_ministry_uk else coalesce(p_data->>'ministry_uk','') end,
      nullif(trim(coalesce(p_data->>'phone','')),''),nullif(trim(coalesce(p_data->>'email','')),''),nullif(p_data->>'membership_group_id','')::uuid)
    returning * into result;
  else
    update public.people set name=trim(p_data->>'name'),
      patronymic=case when p_data ? 'patronymic' then nullif(trim(coalesce(p_data->>'patronymic','')),'') else patronymic end,
      ministry=case when has_ministry_ids then primary_ministry else coalesce(p_data->>'ministry',ministry) end,
      ministry_uk=case when has_ministry_ids then primary_ministry_uk else coalesce(p_data->>'ministry_uk',ministry_uk) end,
      phone=case when p_data ? 'phone' then nullif(trim(coalesce(p_data->>'phone','')),'') else phone end,
      email=case when p_data ? 'email' then nullif(trim(coalesce(p_data->>'email','')),'') else email end,
      membership_group_id=case when p_data ? 'membership_group_id' then nullif(p_data->>'membership_group_id','')::uuid else membership_group_id end,
      archived_at=case when coalesce((p_data->>'archived')::boolean,false) then coalesce(archived_at,now()) else null end,
      revision=revision+1
    where id=p_id and revision=p_revision returning * into result;
    if not found then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  end if;

  if has_ministry_ids then
    delete from public.person_ministries
    where person_id=result.id and not (ministry_id=any(ministry_ids));
    insert into public.person_ministries(person_id,ministry_id)
    select result.id,id from unnest(ministry_ids) id on conflict do nothing;
  end if;

  if p_data ? 'birth_date' or p_data ? 'address' or p_data ? 'orphan_status' or p_data ? 'widow_status' then
    insert into public.people_private(person_id) values(result.id) on conflict(person_id) do nothing;
    if p_data ? 'birth_date' then update public.people_private set birth_date=birth_date_value where person_id=result.id; end if;
    if p_data ? 'address' then update public.people_private set address=nullif(trim(coalesce(p_data->>'address','')),'') where person_id=result.id; end if;
    if p_data ? 'orphan_status' then update public.people_private set orphan_status=coalesce((p_data->>'orphan_status')::boolean,false) where person_id=result.id; end if;
    if p_data ? 'widow_status' then
      update public.people_private set marital_status=case
        when coalesce((p_data->>'widow_status')::boolean,false) then 'widowed'
        when lower(trim(coalesce(marital_status,''))) in ('widow','widowed','вдова','вдівець','вдівець/вдова') then null
        else marital_status end where person_id=result.id;
    end if;
  end if;

  perform app_private.audit('person.saved',result.id);
  return result;
end;
$$;

drop function public.directory_active_members();
create function public.directory_active_members()
returns table(id uuid,name text,ministry text,ministry_uk text,phone text,photo_path text,leadership_ministry text,is_orphan boolean,is_widow boolean,patronymic text)
language sql stable security definer set search_path='' as $$
  select p.id,p.name,p.ministry,p.ministry_uk,p.phone,p.photo_path,app_private.person_leadership(p.id),
    coalesce(private.orphan_status,false),lower(coalesce(private.marital_status,'')) in ('widowed','widow','вдова','вдівець','вдівець/вдова'),p.patronymic
  from public.people p left join public.people_private private on private.person_id=p.id
  where p.archived_at is null and app_private.active()
$$;
revoke all on function public.directory_active_members() from public,anon,authenticated;
grant execute on function public.directory_active_members() to authenticated;

notify pgrst,'reload schema';
commit;