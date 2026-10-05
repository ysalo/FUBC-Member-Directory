begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.people add column first_name text, add column last_name text;
-- Existing display names use given-name/surname order. Preserve every remaining
-- token as the surname; single-token historical records have an unknown surname.
update public.people set
  first_name = split_part(trim(regexp_replace(name, '\s+', ' ', 'g')), ' ', 1),
  last_name = regexp_replace(trim(regexp_replace(name, '\s+', ' ', 'g')), '^\S+\s*', '')
where id is not null;
alter table public.people
  alter column first_name set not null,
  alter column last_name set not null,
  add constraint people_first_name_length check (length(trim(first_name)) between 1 and 200),
  add constraint people_last_name_length check (length(last_name) <= 200);

-- name remains a synchronized compatibility projection for existing RPCs,
-- identity synchronization, deletion confirmations, and previous clients.
create function app_private.sync_person_name_fields() returns trigger
language plpgsql set search_path='' as $$
declare supplied jsonb;
begin
  supplied := nullif(current_setting('app.member_name_fields',true),'')::jsonb;
  if supplied is not null and (
    (tg_op='INSERT' and supplied->>'id' is null) or supplied->>'id'=new.id::text
  ) then
    new.first_name := supplied->>'first_name';
    new.last_name := supplied->>'last_name';
  elsif tg_op='INSERT' then
    if new.first_name is null then
      new.first_name := split_part(trim(regexp_replace(new.name,'\s+',' ','g')),' ',1);
      new.last_name := regexp_replace(trim(regexp_replace(new.name,'\s+',' ','g')),'^\S+\s*','');
    end if;
  elsif new.name is distinct from old.name
    and new.first_name is not distinct from old.first_name
    and new.last_name is not distinct from old.last_name then
    new.first_name := split_part(trim(regexp_replace(new.name,'\s+',' ','g')),' ',1);
    new.last_name := regexp_replace(trim(regexp_replace(new.name,'\s+',' ','g')),'^\S+\s*','');
  end if;
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.name := concat_ws(' ',new.first_name,nullif(new.last_name,''));
  return new;
end $$;
create trigger sync_person_name_fields before insert or update on public.people
for each row execute function app_private.sync_person_name_fields();

alter function public.save_person(uuid,integer,jsonb) rename to save_person_without_name_fields;
revoke all on function public.save_person_without_name_fields(uuid,integer,jsonb) from public,anon,authenticated;
create function public.save_person(p_id uuid,p_revision integer,p_data jsonb)
returns public.people language plpgsql security definer set search_path='' as $$
declare
  result public.people;
  previous_setting text := current_setting('app.member_name_fields',true);
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_data ? 'first_name' or p_data ? 'last_name' then
    if jsonb_typeof(p_data->'first_name') is distinct from 'string'
      or jsonb_typeof(p_data->'last_name') is distinct from 'string'
      or length(trim(p_data->>'first_name')) not between 1 and 200
      or length(trim(p_data->>'last_name')) not between 1 and 200 then
      raise exception 'Enter first and last names';
    end if;
    perform set_config('app.member_name_fields',jsonb_build_object(
      'id',p_id,'first_name',trim(p_data->>'first_name'),'last_name',trim(p_data->>'last_name')
    )::text,true);
    p_data := p_data || jsonb_build_object('name',trim(p_data->>'first_name') || ' ' || trim(p_data->>'last_name'));
  end if;
  result := public.save_person_without_name_fields(p_id,p_revision,p_data);
  perform set_config('app.member_name_fields',coalesce(previous_setting,''),true);
  return result;
end $$;
revoke all on function public.save_person(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.save_person(uuid,integer,jsonb) to authenticated;

drop function public.directory_active_members();
create function public.directory_active_members()
returns table(id uuid,name text,ministry text,ministry_uk text,phone text,photo_path text,leadership_ministry text,is_orphan boolean,is_widow boolean,patronymic text,gender text,first_name text,last_name text)
language sql stable security definer set search_path='' as $$
  select p.id,p.name,p.ministry,p.ministry_uk,p.phone,p.photo_path,app_private.person_leadership(p.id),
    coalesce(private.orphan_status,false),lower(coalesce(private.marital_status,'')) in ('widowed','widow','вдова','вдівець','вдівець/вдова'),p.patronymic,p.gender,p.first_name,p.last_name
  from public.people p left join public.people_private private on private.person_id=p.id
  where p.archived_at is null and app_private.active()
$$;
revoke all on function public.directory_active_members() from public,anon,authenticated;
grant execute on function public.directory_active_members() to authenticated;
notify pgrst,'reload schema';
commit;
