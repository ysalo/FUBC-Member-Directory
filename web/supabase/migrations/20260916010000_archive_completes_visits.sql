-- Archiving is a terminal action: archived visits are completed, not left planned.
create or replace function public.archive_visit(target uuid,expected_revision integer)
returns void language plpgsql security definer set search_path=public as $$
declare v public.visit_requests;
begin
  perform pg_advisory_xact_lock(20260915,1);
  if not public.has_visit_ministry('pastor') then raise exception 'Pastor access required'; end if;
  select * into v from public.visit_requests where id=target for update;
  if not found or v.pastor_id<>auth.uid() then raise exception 'Request unavailable'; end if;
  if v.archived_at is not null then return; end if;
  if expected_revision is distinct from v.revision then raise exception 'Request changed; refresh and retry'; end if;
  update public.visit_requests
    set status='completed',archived_at=now(),updated_at=now()
    where id=target;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'visit.archived','visit',target::text,
      jsonb_build_object('automatic',false,'status','completed'));
end $$;

revoke all on function public.archive_visit(uuid,integer) from public,anon,authenticated;
grant execute on function public.archive_visit(uuid,integer) to authenticated;

-- Normalize visits archived before this behavior was introduced.
update public.visit_requests
set status='completed',updated_at=greatest(updated_at,archived_at)
where archived_at is not null and status<>'completed';
