begin;

do $$
declare
  slav_account_id uuid;
  alina_account_id uuid;
  slav_person_id uuid;
  alina_person_id uuid;
  target_group_id uuid;
begin
  select p.id into slav_account_id
  from public.profiles p join auth.users u on u.id=p.id
  where lower(u.email)=lower('slav.salo@gmail.com');

  select p.id into alina_account_id
  from public.profiles p join auth.users u on u.id=p.id
  where lower(u.email)=lower('alinabelashov@gmail.com');

  if slav_account_id is null and alina_account_id is null then return; end if;
  if slav_account_id is null or alina_account_id is null then
    raise exception 'Both selected Group 1 deacon accounts must exist';
  end if;

  select id into slav_person_id from public.people
  where archived_at is null and (lower(email)=lower('salo.yaro.slavik@gmail.com') or lower(name) in (lower('Ярослав Сало'),lower('Yaroslav Salo')))
  order by case when lower(email)=lower('salo.yaro.slavik@gmail.com') then 0 else 1 end limit 1;
  if slav_person_id is null then raise exception 'Yaroslav Salo member profile is missing'; end if;

  select id into alina_person_id from public.people
  where archived_at is null and (lower(email)=lower('alinabelashov@gmail.com') or lower(name) in (lower('Аліна Бєлашова'),lower('Alina Belashov')))
  order by case when lower(email)=lower('alinabelashov@gmail.com') then 0 else 1 end limit 1;
  if alina_person_id is null then
    insert into public.people(name,email)
    select coalesce(nullif(btrim(p.display_name),''),'Alina Belashov'),u.email from public.profiles p join auth.users u on u.id=p.id where p.id=alina_account_id
    returning id into alina_person_id;
  end if;

  if exists(select 1 from public.profiles where person_id=slav_person_id and id<>slav_account_id)
    or exists(select 1 from public.profiles where person_id=alina_person_id and id<>alina_account_id)
  then raise exception 'A selected member profile is already linked to another account'; end if;

  update public.profiles set person_id=slav_person_id,status='active',designation='deacon',revision=revision+1
  where id=slav_account_id and (person_id is distinct from slav_person_id or status<>'active' or designation<>'deacon');
  update public.profiles set person_id=alina_person_id,status='active',designation='deacon',revision=revision+1
  where id=alina_account_id and (person_id is distinct from alina_person_id or status<>'active' or designation<>'deacon');

  select id into target_group_id from public.deacon_groups
  where archived_at is null and kind='membership' and lower(btrim(name))=lower('Група один')
  order by name limit 1;
  if target_group_id is null then raise exception 'Група один is missing'; end if;

  delete from public.deacon_group_deacons
  where group_id=target_group_id or account_id in (slav_account_id,alina_account_id);
  insert into public.deacon_group_deacons(group_id,account_id,slot)
  values(target_group_id,slav_account_id,1),(target_group_id,alina_account_id,2);

  if (select count(*) from public.deacon_group_deacons where group_id=target_group_id and account_id in (slav_account_id,alina_account_id)) <> 2 then
    raise exception 'Both selected deacons must be assigned to Група один';
  end if;

  perform app_private.audit('group.deacons.repaired',target_group_id,jsonb_build_object('deacon_ids',jsonb_build_array(slav_account_id,alina_account_id)));
end;
$$;

commit;
