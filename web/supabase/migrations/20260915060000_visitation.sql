begin;
create table public.visit_requests (
 id uuid primary key default gen_random_uuid(), pastor_id uuid not null references public.profiles(id),
 person_id uuid not null references public.people(id), group_id uuid references public.deacon_groups(id) on delete set null,
 pastor_name text not null, member_name text not null, member_address text not null,
 location text not null check(length(trim(location)) between 1 and 1000), scheduled_at timestamptz not null,
 notes text not null default '' check(length(notes)<=5000), status text not null default 'open' check(status in ('open','cancelled','completed')),
 revision integer not null default 1, updated_fields text[] not null default '{}', submission_key uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(pastor_id,submission_key)
);
create table public.visit_recipients (
 request_id uuid not null references public.visit_requests(id) on delete cascade, deacon_id uuid not null references public.profiles(id),
 deacon_name text not null, response text not null default 'pending' check(response in ('pending','accepted','declined')),
 decline_reason text not null default '' check(length(decline_reason)<=1000), responded_at timestamptz, last_viewed_revision integer not null default 0,
 primary key(request_id,deacon_id)
);
create table public.visit_notification_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.visit_requests(id) on delete cascade,
 revision integer not null, event_type text not null check(event_type in ('created','updated')), recipient_id uuid not null references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','delivered','failed')), created_at timestamptz not null default now(),
 unique(request_id,revision,recipient_id)
);
create index visit_pastor_idx on public.visit_requests(pastor_id,scheduled_at);
create index visit_deacon_idx on public.visit_recipients(deacon_id,request_id);
alter table public.visit_requests enable row level security;
alter table public.visit_recipients enable row level security;
alter table public.visit_notification_events enable row level security;
create function public.has_visit_ministry(designation text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and status='active' and designation=any(ministry_roles))
$$;
create function public.can_read_visit(target uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.visit_requests v where v.id=target and
 ((v.pastor_id=auth.uid() and public.has_visit_ministry('pastor')) or
 (public.has_visit_ministry('deacon') and exists(select 1 from public.visit_recipients r where r.request_id=v.id and r.deacon_id=auth.uid()))))
$$;
create policy visit_read on public.visit_requests for select to authenticated using(public.can_read_visit(id));
create policy recipient_read on public.visit_recipients for select to authenticated using(public.can_read_visit(request_id));
revoke all on public.visit_requests,public.visit_recipients,public.visit_notification_events from public,anon,authenticated;
grant select on public.visit_requests,public.visit_recipients to authenticated;
create function public.list_visit_deacons() returns table(id uuid,name text,group_id uuid) language sql stable security definer set search_path=public as $$
 select p.id,coalesce(nullif(trim(concat_ws(' ',m.first_name,m.last_name)),''),nullif(p.display_name,''),'Deacon'),d.group_id
 from public.profiles p left join public.people m on m.id=p.person_id and m.archived_at is null
 left join public.deacon_group_deacons d on d.profile_id=p.id
 where public.has_visit_ministry('pastor') and p.status='active' and 'deacon'=any(p.ministry_roles) order by 2
$$;
create function public.save_visit(target uuid,expected_revision integer,target_person uuid,visit_location text,visit_time timestamptz,visit_notes text,deacon_ids uuid[],submission uuid)
 returns uuid language plpgsql security definer set search_path=public as $$
declare v public.visit_requests; m public.people; result uuid; actor_name text;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
 if visit_time is null or visit_time<=now() then raise exception 'Choose a future visit time'; end if;
 if visit_location is null or length(trim(visit_location)) not between 1 and 1000 or length(coalesce(visit_notes,''))>5000 then raise exception 'Invalid visit details'; end if;
 if target is null then
  if submission is null then raise exception 'Submission key required'; end if;
  select id into result from public.visit_requests where pastor_id=auth.uid() and submission_key=submission;
  if found then return result; end if;
  select * into m from public.people where id=target_person and archived_at is null;
  if not found then raise exception 'Member unavailable'; end if;
  if coalesce(cardinality(deacon_ids),0) not between 1 and 2 or (select count(distinct x) from unnest(deacon_ids) x)<>cardinality(deacon_ids)
   or exists(select 1 from unnest(deacon_ids) x where not exists(select 1 from public.profiles p where p.id=x and p.status='active' and 'deacon'=any(p.ministry_roles))) then raise exception 'Choose one or two active distinct deacons'; end if;
  select coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),nullif(a.display_name,''),'Pastor') into actor_name from public.profiles a left join public.people p on p.id=a.person_id and p.archived_at is null where a.id=auth.uid();
  insert into public.visit_requests(pastor_id,person_id,group_id,pastor_name,member_name,member_address,location,scheduled_at,notes,submission_key)
   values(auth.uid(),m.id,(select group_id from public.deacon_group_members where person_id=m.id),actor_name,concat_ws(' ',m.first_name,m.last_name),concat_ws(', ',nullif(m.address_line_1,''),nullif(m.address_line_2,''),nullif(m.city,''),nullif(m.state,''),nullif(m.postal_code,'')),trim(visit_location),visit_time,coalesce(visit_notes,''),submission) returning id into result;
  insert into public.visit_recipients(request_id,deacon_id,deacon_name) select result,id,name from public.list_visit_deacons() where id=any(deacon_ids);
 else
  select * into v from public.visit_requests where id=target for update;
  if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
  if v.status<>'open' then raise exception 'Request is closed'; end if;
  if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
  if v.location=trim(visit_location) and v.scheduled_at=visit_time and v.notes=coalesce(visit_notes,'') then return v.id; end if;
  update public.visit_requests set updated_fields=array_remove(array[case when v.location<>trim(visit_location) then 'location' end,case when v.scheduled_at<>visit_time then 'scheduled_at' end,case when v.notes<>coalesce(visit_notes,'') then 'notes' end],null),location=trim(visit_location),scheduled_at=visit_time,notes=coalesce(visit_notes,''),revision=revision+1,updated_at=now() where id=target;
  result:=target;
 end if;
 insert into public.visit_notification_events(request_id,revision,event_type,recipient_id)
  select result,q.revision,case when target is null then 'created' else 'updated' end,r.deacon_id from public.visit_requests q join public.visit_recipients r on r.request_id=q.id where q.id=result;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),case when target is null then 'visit.created' else 'visit.updated' end,'visit',result::text,jsonb_build_object('revision',(select revision from public.visit_requests where id=result)));
 return result;
end $$;
create function public.respond_visit(target uuid,decision text,reason text,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('deacon') then raise exception 'Deacon access required'; end if;
 select * into v from public.visit_requests where id=target for update;
 if not found or not exists(select 1 from public.visit_recipients where request_id=target and deacon_id=auth.uid()) then raise exception 'Request unavailable'; end if;
 if v.status<>'open' then raise exception 'Request is closed'; end if;
 if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
 if decision is null or decision not in ('accepted','declined') or length(coalesce(reason,''))>1000 then raise exception 'Invalid response'; end if;
 update public.visit_recipients set response=decision,decline_reason=case when decision='declined' then coalesce(reason,'') else '' end,responded_at=now(),last_viewed_revision=v.revision where request_id=target and deacon_id=auth.uid();
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'visit.responded','visit',target::text,jsonb_build_object('response',decision));
end $$;
create function public.close_visit(target uuid,decision text,expected_revision integer) returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
 perform pg_advisory_xact_lock(20260915,1);
 if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
 select * into v from public.visit_requests where id=target for update;
 if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
 if v.status<>'open' then raise exception 'Request is closed'; end if;
 if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
 if decision is null or decision not in ('cancelled','completed') then raise exception 'Invalid status'; end if;
 if decision='completed' and (v.scheduled_at>now() or not exists(select 1 from public.visit_recipients where request_id=target and response='accepted')) then raise exception 'Completion requires an acceptance and the visit time to have arrived'; end if;
 update public.visit_requests set status=decision,updated_at=now() where id=target;
 insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata) values(auth.uid(),'visit.closed','visit',target::text,jsonb_build_object('status',decision));
end $$;
create function public.view_visit(target uuid,seen_revision integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_visit_ministry('deacon') or not public.can_read_visit(target) then raise exception 'Request unavailable'; end if;
 update public.visit_recipients set last_viewed_revision=greatest(last_viewed_revision,seen_revision) where request_id=target and deacon_id=auth.uid() and seen_revision between 1 and (select revision from public.visit_requests where id=target);
end $$;
revoke all on function public.has_visit_ministry(text),public.can_read_visit(uuid),public.list_visit_deacons(),public.save_visit(uuid,integer,uuid,text,timestamptz,text,uuid[],uuid),public.respond_visit(uuid,text,text,integer),public.close_visit(uuid,text,integer),public.view_visit(uuid,integer) from public,anon,authenticated;
grant execute on function public.has_visit_ministry(text),public.can_read_visit(uuid),public.list_visit_deacons(),public.save_visit(uuid,integer,uuid,text,timestamptz,text,uuid[],uuid),public.respond_visit(uuid,text,text,integer),public.close_visit(uuid,text,integer),public.view_visit(uuid,integer) to authenticated;
commit;
