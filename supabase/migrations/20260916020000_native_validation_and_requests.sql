begin;
-- New server-side validation is required because native clients write directly.
create function public.validate_person() returns trigger language plpgsql set search_path='' as $$
begin
  new.first_name:=trim(new.first_name);
  new.last_name:=trim(new.last_name);
  if new.first_name is null or length(new.first_name) not between 1 and 100
    or new.last_name is null or length(new.last_name) not between 1 and 100 then
    raise exception 'First and last names must contain 1 to 100 characters'; end if;
  if new.date_of_birth>current_date or new.membership_joined_at>current_date then
    raise exception 'Birth and membership dates cannot be in the future'; end if;
  if length(coalesce(new.phone,''))>100 or length(coalesce(new.address_line_1,''))>500
    or length(coalesce(new.address_line_2,''))>500 or length(coalesce(new.city,''))>200
    or length(coalesce(new.state,''))>100 or length(coalesce(new.postal_code,''))>40
    or length(coalesce(new.notes,''))>5000 or length(coalesce(new.photo_path,''))>500 then
    raise exception 'Member details exceed the allowed length'; end if;
  if TG_OP='UPDATE' then new.created_at:=old.created_at; end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
create trigger validate_member before insert or update on public.people for each row execute function public.validate_person();
revoke all on function public.validate_person() from public,anon,authenticated;

create function public.audit_person_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Metadata deliberately omits personal field values.
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),case when TG_OP='INSERT' then 'person.created' else 'person.updated' end,
      'person',new.id::text,jsonb_build_object('archived',new.archived_at is not null));
  return new;
end $$;
create trigger audit_member after insert or update on public.people for each row execute function public.audit_person_change();
revoke all on function public.audit_person_change() from public,anon,authenticated;

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'requested' check(status in ('requested','processing','completed','failed')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.account_deletion_requests enable row level security;
create policy deletion_request_owner on public.account_deletion_requests for select to authenticated using(owner_id=auth.uid());
revoke all on public.account_deletion_requests from public,anon,authenticated;
grant select on public.account_deletion_requests to authenticated;
create function public.request_account_deletion() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Pending and revoked accounts retain the right to initiate deletion.
  insert into public.account_deletion_requests(owner_id) values(auth.uid())
    on conflict(owner_id) do update set updated_at=now() returning id into result;
  return result;
end $$;
revoke all on function public.request_account_deletion() from public,anon,authenticated;
grant execute on function public.request_account_deletion() to authenticated;
commit;
