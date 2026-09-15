begin;
-- Pastor takes precedence when correcting legacy accounts with both ministries.
update public.profiles set ministry_roles=array['pastor']::text[],updated_at=now()
where 'pastor'=any(ministry_roles) and 'deacon'=any(ministry_roles);
alter table public.profiles drop constraint profiles_ministry_roles_check;
alter table public.profiles add constraint profiles_ministry_roles_check
 check(ministry_roles <@ array['deacon','pastor']::text[] and cardinality(ministry_roles)<=1);

create or replace function public.review_account_designations(target_id uuid,new_status public.account_status,
 new_role public.app_role,new_person_id uuid,note text,is_deacon boolean,is_pastor boolean)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare result public.profiles;
begin
 if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 if coalesce(is_deacon,false) and coalesce(is_pastor,false) then raise exception 'Choose either pastor or deacon'; end if;
 perform pg_advisory_xact_lock(20260915,1);
 result:=public.review_account(target_id,new_status,new_role,new_person_id,note);
 update public.profiles set ministry_roles=case when is_pastor then array['pastor']::text[] when is_deacon then array['deacon']::text[] else '{}'::text[] end,
 updated_at=now() where id=target_id returning * into result;
 return result;
end $$;
-- Legacy deacon callers explicitly switch the ministry when requesting deacon.
create or replace function public.review_account_ministry(target_id uuid,new_status public.account_status,
 new_role public.app_role,new_person_id uuid,note text,is_deacon boolean)
returns public.profiles language plpgsql security definer set search_path=public as $$
declare was_pastor boolean;
begin
 if public.current_role() is distinct from 'admin' then raise exception 'Administrator access required'; end if;
 perform pg_advisory_xact_lock(20260915,1);
 select 'pastor'=any(ministry_roles) into was_pastor from public.profiles where id=target_id;
 return public.review_account_designations(target_id,new_status,new_role,new_person_id,note,is_deacon,coalesce(was_pastor,false) and not coalesce(is_deacon,false));
end $$;
create or replace function public.close_visit(target uuid,decision text,expected_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
 select * into v from public.visit_requests where id=target for update;
 if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
 if v.status<>'open' then raise exception 'Request is closed'; end if;
 if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
 if decision is null or decision not in ('cancelled','completed') then raise exception 'Invalid status'; end if;
 update public.visit_requests set status=decision,updated_at=now() where id=target;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
 values(auth.uid(),'visit.closed','visit',target::text,jsonb_build_object('status',decision));
end $$;
create function public.auto_complete_visits() returns integer
language plpgsql security definer set search_path=public as $$
declare total integer;
begin
 perform pg_advisory_xact_lock(20260915,1);
 with closed as (
  update public.visit_requests set status='completed',updated_at=now()
  where status='open' and scheduled_at<=now()-interval '6 hours' returning id
 ), audited as (
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
  select null,'visit.auto_completed','visit',id::text,jsonb_build_object('status','completed') from closed returning id
 ) select count(*) into total from audited;
 return total;
end $$;
revoke all on function public.auto_complete_visits() from public,anon,authenticated;
create index visit_open_time_idx on public.visit_requests(scheduled_at) where status='open';
commit;

-- Hosted scheduler (not available in the embedded PostgreSQL test runtime).
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('visitation-auto-complete','* * * * *','select public.auto_complete_visits();');
select public.auto_complete_visits();
commit;
