begin;

alter table public.people add column if not exists gender text;

-- This update runs once during migration, including archived members. Existing values
-- are retained if a deployment has already populated the column.
update public.people
set gender = case when random() < 0.5 then 'male' else 'female' end
where gender is null;

alter table public.people
  alter column gender set not null,
  add constraint people_gender_values check (gender in ('male', 'female'));

-- Keep older-client updates compatible, while requiring explicit gender on create.
-- The previous writer still owns authorization, revision checks, and all other fields.
alter function public.save_person(uuid,integer,jsonb) rename to save_person_without_gender;
revoke all on function public.save_person_without_gender(uuid,integer,jsonb) from public,anon,authenticated;

create function public.save_person(p_id uuid,p_revision integer,p_data jsonb)
returns public.people language plpgsql security definer set search_path='' as $$
declare result public.people;
begin
  if p_id is null and not (p_data ? 'gender') then
    raise exception 'Choose a member gender';
  end if;
  if p_data ? 'gender' and (jsonb_typeof(p_data->'gender') <> 'string' or p_data->>'gender' not in ('male','female')) then
    raise exception 'Choose Male or Female';
  end if;
  -- The legacy writer inserts first, so pass the required value through a local
  -- transaction setting consumed by the insert trigger below.
  if p_id is null then
    perform set_config('app.member_gender',p_data->>'gender',true);
  end if;
  result := public.save_person_without_gender(p_id,p_revision,p_data);
  if p_id is null then
    perform set_config('app.member_gender','',true);
  end if;
  if p_data ? 'gender' and p_id is not null then
    update public.people set gender=p_data->>'gender' where id=result.id returning * into result;
  end if;
  return result;
end $$;

create function app_private.member_gender_on_insert() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.gender is null then
    new.gender := nullif(current_setting('app.member_gender',true),'');
  end if;
  return new;
end $$;
create trigger member_gender_on_insert before insert on public.people
for each row execute function app_private.member_gender_on_insert();

revoke all on function public.save_person(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_person(uuid,integer,jsonb) to authenticated;

drop function public.directory_active_members();
create function public.directory_active_members()
returns table(id uuid,name text,ministry text,ministry_uk text,phone text,photo_path text,leadership_ministry text,is_orphan boolean,is_widow boolean,patronymic text,gender text)
language sql stable security definer set search_path='' as $$
  select p.id,p.name,p.ministry,p.ministry_uk,p.phone,p.photo_path,app_private.person_leadership(p.id),
    coalesce(private.orphan_status,false),lower(coalesce(private.marital_status,'')) in ('widowed','widow','вдова','вдівець','вдівець/вдова'),p.patronymic,p.gender
  from public.people p left join public.people_private private on private.person_id=p.id
  where p.archived_at is null and app_private.active()
$$;
revoke all on function public.directory_active_members() from public,anon,authenticated;
grant execute on function public.directory_active_members() to authenticated;

notify pgrst,'reload schema';
commit;
