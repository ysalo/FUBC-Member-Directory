-- Optional demo update, not a schema migration. Only marked fictional demo members are changed.
begin;
with demo as (
  select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as id, n
  from generate_series(1,20) n
), changed as (
  update public.people p set
    marital_status = case when demo.n <= 8 then 'married' when demo.n <= 16 then 'single' else 'widowed' end,
    is_orphan = demo.n in (3, 9, 12, 18), updated_at = now()
  from demo where p.id = demo.id
    and p.notes = 'Вигаданий запис для демонстрації дияконських груп.'
  returning p.id
)
insert into public.audit_events(actor_id, event_type, entity_type, entity_id, metadata)
select auth.uid(), 'demo.member_statuses_seeded', 'deacon_group', '60000000-0000-4000-8000-000000000001',
  jsonb_build_object('updated_members', count(*)) from changed;
commit;
select marital_status, count(*) as members, count(*) filter (where is_orphan) as orphans
from public.people
where id in (select ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,20) n)
  and notes = 'Вигаданий запис для демонстрації дияконських груп.'
group by marital_status order by marital_status;
