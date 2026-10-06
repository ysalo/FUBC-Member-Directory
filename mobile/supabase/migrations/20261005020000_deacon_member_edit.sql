begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create function app_private.can_edit_group_member(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select app_private.active() and exists (
    select 1 from public.profiles actor
    join public.deacon_group_deacons assignment on assignment.person_id=actor.person_id
    join public.deacon_groups g on g.id=assignment.group_id
    join public.people target on target.membership_group_id=g.id
    where actor.id=auth.uid() and actor.status='active'
      and app_private.person_leadership(actor.person_id)='deacon'
      and g.kind='membership' and g.archived_at is null
      and target.id=p_person_id and target.archived_at is null
  )
$$;
revoke all on function app_private.can_edit_group_member(uuid) from public,anon,authenticated;
create function public.can_edit_group_member(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select app_private.can_edit_group_member(p_person_id)
$$;
revoke all on function public.can_edit_group_member(uuid) from public,anon,authenticated;
grant execute on function public.can_edit_group_member(uuid) to authenticated;

create or replace function public.management_member_care_details(p_person_id uuid)
returns table(person_id uuid,birth_date date,address text,marital_status text,orphan_status boolean,ministry_ids uuid[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app_private.editor() or app_private.can_edit_group_member(p_person_id)) then raise exception 'Not authorized'; end if;
  return query
  select p.id,private.birth_date,private.address,private.marital_status,private.orphan_status,
    coalesce(array_agg(pm.ministry_id) filter(where pm.ministry_id is not null),array[]::uuid[])
  from public.people p
  left join public.people_private private on private.person_id=p.id
  left join public.person_ministries pm on pm.person_id=p.id
  where p.id=p_person_id
  group by p.id,private.birth_date,private.address,private.marital_status,private.orphan_status;
end;
$$;

revoke all on function public.management_member_care_details(uuid) from public,anon,authenticated;
grant execute on function public.management_member_care_details(uuid) to authenticated;


create function public.deacon_save_member(p_id uuid,p_revision integer,p_data jsonb)
returns public.people
language plpgsql security definer set search_path = '' as $$
declare
  result public.people;
  birth_date_value date;
  current_person public.people;
  previous_setting text := current_setting('app.member_name_fields',true);
  joined_date date;
  current_ministries uuid[];
  supplied_ministries uuid[];
begin
  -- Lock before checking scope so a concurrent group move cannot authorize a stale write.
  select * into current_person from public.people where id=p_id for update;
  if not found or not app_private.can_edit_group_member(p_id) then raise exception 'Not authorized'; end if;
  if current_person.revision is distinct from p_revision then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_data) k where k not in
      ('first_name','last_name','name','patronymic','gender','phone','email','birth_date','address','orphan_status','widow_status','membership_joined_at','ministry_ids')
  ) then raise exception 'Only member information can be edited'; end if;
  if p_data ? 'ministry_ids' then
    select coalesce(array_agg(ministry_id order by ministry_id),'{}'::uuid[]) into current_ministries from public.person_ministries where person_id=p_id;
    select coalesce(array_agg(value::uuid order by value::uuid),'{}'::uuid[]) into supplied_ministries from jsonb_array_elements_text(p_data->'ministry_ids');
    if current_ministries is distinct from supplied_ministries then raise exception 'Ministry assignments cannot be changed'; end if;
  end if;
  p_data := p_data - 'ministry_ids';
  if p_data ? 'first_name' or p_data ? 'last_name' then
    if jsonb_typeof(p_data->'first_name') is distinct from 'string' or jsonb_typeof(p_data->'last_name') is distinct from 'string'
      or length(trim(p_data->>'first_name')) not between 1 and 200 or length(trim(p_data->>'last_name')) not between 1 and 200 then raise exception 'Enter first and last names'; end if;
    perform set_config('app.member_name_fields',jsonb_build_object('id',p_id,'first_name',trim(p_data->>'first_name'),'last_name',trim(p_data->>'last_name'))::text,true);
    p_data := p_data || jsonb_build_object('name',trim(p_data->>'first_name') || ' ' || trim(p_data->>'last_name'));
  else
    p_data := p_data || jsonb_build_object('name',current_person.name);
  end if;
  if p_data ? 'gender' and (p_data->>'gender' is null or p_data->>'gender' not in ('male','female')) then raise exception 'Choose a gender'; end if;
  if p_data ? 'membership_joined_at' then
    joined_date := nullif(p_data->>'membership_joined_at','')::date;
    if joined_date>current_date or not isfinite(joined_date) then raise exception 'Membership date must be a valid date not in the future'; end if;
  end if;
  if length(trim(coalesce(p_data->>'name',''))) not between 1 and 200 then raise exception 'Enter a member name'; end if;
  if p_data ? 'birth_date' then
    birth_date_value := nullif(p_data->>'birth_date','')::date;
    if birth_date_value>current_date then raise exception 'Birthday cannot be in the future'; end if;
  end if;

    update public.people set name=trim(p_data->>'name'),
      phone=case when p_data ? 'phone' then nullif(trim(coalesce(p_data->>'phone','')),'') else phone end,
      email=case when p_data ? 'email' then nullif(trim(coalesce(p_data->>'email','')),'') else email end,
      revision=revision+1
    where id=p_id and revision=p_revision returning * into result;
    if not found then raise exception 'Conflict: member changed. Reload and try again.'; end if;
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

  update public.people set
    patronymic=case when p_data ? 'patronymic' then nullif(trim(p_data->>'patronymic'),'') else patronymic end,
    gender=case when p_data ? 'gender' then p_data->>'gender' else gender end,
    membership_joined_at=case when p_data ? 'membership_joined_at' then joined_date else membership_joined_at end
  where id=result.id returning * into result;
  perform set_config('app.member_name_fields',coalesce(previous_setting,''),true);
  perform app_private.audit('person.saved',result.id);
  return result;
end;
$$;

revoke all on function public.deacon_save_member(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.deacon_save_member(uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
