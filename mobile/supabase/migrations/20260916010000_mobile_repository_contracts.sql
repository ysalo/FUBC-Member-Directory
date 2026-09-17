-- Additive mobile contracts for the reviewed Expo baseline, not a legacy-schema conversion.
begin;
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='designation')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='visit_requests' and column_name='submission_id') then
    raise exception 'Reviewed Expo baseline is required. Do not apply this migration to an unverified legacy schema.';
  end if;
end $$;

create or replace function public.mobile_contract_version() returns text language sql immutable set search_path = '' as $$ select 'expo-directory-v1'::text; $$;
revoke all on function public.mobile_contract_version() from public,anon,authenticated;
grant execute on function public.mobile_contract_version() to authenticated;

alter table public.visit_requests add column if not exists updated_fields text[] not null default '{}';
alter table public.visit_recipients add column if not exists last_viewed_revision integer not null default 0;

-- Active ministry directory links enable deacon profile navigation without exposing login emails or access roles.
create or replace view public.ministry_accounts with (security_barrier = true) as
  select id,display_name,designation,person_id from public.profiles
  where status='active' and designation in ('pastor','deacon') and app_private.active();
revoke all on public.ministry_accounts from public,anon,authenticated;
grant select on public.ministry_accounts to authenticated;

create or replace function app_private.visit_changed_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at or new.location is distinct from old.location or new.notes is distinct from old.notes then
    new.updated_fields := array_remove(array[
      case when new.scheduled_at is distinct from old.scheduled_at then 'scheduledAt' end,
      case when new.location is distinct from old.location then 'location' end,
      case when new.notes is distinct from old.notes then 'notes' end
    ],null);
  end if;
  return new;
end; $$;
create or replace trigger visit_changed_fields before update on public.visit_requests for each row execute function app_private.visit_changed_fields();
revoke all on function app_private.visit_changed_fields() from public,anon,authenticated;

create or replace function public.mark_visit_viewed(p_id uuid,p_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
  if not app_private.visit_participant(p_id) then raise exception 'Not authorized'; end if;
  select revision into current_revision from public.visit_requests where id=p_id;
  if p_revision is null or p_revision<1 or p_revision>current_revision then raise exception 'Invalid viewed revision'; end if;
  update public.visit_recipients set last_viewed_revision=greatest(last_viewed_revision,p_revision)
    where visit_id=p_id and account_id=auth.uid();
end; $$;
revoke all on function public.mark_visit_viewed(uuid,integer) from public,anon,authenticated;
grant execute on function public.mark_visit_viewed(uuid,integer) to authenticated;

create or replace function public.set_person_photo(p_id uuid,p_revision integer,p_path text) returns public.people language plpgsql security definer set search_path = '' as $$
declare result public.people;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_path is not null and (left(p_path,length(p_id::text)+1)<>p_id::text || '/' or not exists(select 1 from storage.objects where bucket_id='member-photos' and name=p_path)) then raise exception 'Photo upload is missing or belongs to another member'; end if;
  update public.people set photo_path=p_path,revision=revision+1 where id=p_id and revision=p_revision returning * into result;
  if not found then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  perform app_private.audit('person.photo',p_id,jsonb_build_object('removed',p_path is null));
  return result;
end; $$;
revoke all on function public.set_person_photo(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.set_person_photo(uuid,integer,text) to authenticated;
commit;
