-- Optional demo setup, NOT a migration. Run as owner in Supabase SQL Editor.
-- Replace FIRST_DEACON_EMAIL and SECOND_DEACON_EMAIL with two existing active accounts.
-- Creates directory records only, not fake Auth/login accounts.
-- Existing access roles/statuses and non-demo directory records are preserved.
begin;
set local demo.first_email = 'FIRST_DEACON_EMAIL';
set local demo.second_email = 'SECOND_DEACON_EMAIL';

do $$
declare
  first_id uuid; second_id uuid;
  demo_group uuid := '60000000-0000-4000-8000-000000000001';
  demo_note text := 'Вигаданий запис для демонстрації дияконських груп.';
  today date := (now() at time zone 'America/Los_Angeles')::date;
begin
  perform pg_advisory_xact_lock(20260915, 1);
  select id into strict first_id from public.profiles
    where lower(email) = lower(current_setting('demo.first_email')) and status = 'active';
  select id into strict second_id from public.profiles
    where lower(email) = lower(current_setting('demo.second_email')) and status = 'active';
  if first_id = second_id then raise exception 'Choose two different active accounts'; end if;

  if exists(select 1 from public.deacon_groups where id = demo_group and name <> 'Демонстраційна група') then
    raise exception 'Reserved demo group ID already belongs to a different group';
  end if;
  if exists(select 1 from public.deacon_group_deacons where group_id = demo_group and profile_id not in (first_id, second_id)) then
    raise exception 'Demo group deacons have changed; existing assignments were not overwritten';
  end if;
  if exists(select 1 from public.people where id in (
    select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1,20) n
  ) and notes is distinct from demo_note) then
    raise exception 'Reserved member IDs already belong to other records';
  end if;
  if exists(select 1 from public.deacon_group_members where person_id in (
    select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1,20) n
  ) and group_id <> demo_group) then
    raise exception 'Demo members have other group assignments; no transfers were made';
  end if;

  update public.profiles p set ministry_roles = array(
    select distinct value from unnest(p.ministry_roles || array['deacon']::text[]) value
  ), updated_at = now() where id in (first_id, second_id);

  insert into public.deacon_groups(id,name) values(demo_group,'Демонстраційна група') on conflict(id) do nothing;
  insert into public.deacon_group_deacons(group_id,slot,profile_id)
    values(demo_group,1,first_id),(demo_group,2,second_id) on conflict(group_id,slot) do nothing;

  insert into public.people(id, first_name, last_name, date_of_birth, membership_joined_at,
    phone, address_line_1, city, state, postal_code, photo_path, notes)
  select ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
    (array['Олександр','Оксана','Богдан','Наталія','Василь','Тетяна','Дмитро','Людмила','Євген','Галина',
      'Іван','Юлія','Максим','Віра','Роман','Анна','Сергій','Лілія','Тарас','Христина'])[n],
    (array['Бондаренко','Бойко','Гнатюк','Данилюк','Захарченко','Коваль','Кравченко','Лисенко','Мельник','Олійник',
      'Петренко','Романенко','Савчук','Сидоренко','Ткаченко','Федоренко','Хоменко','Шевченко','Яремчук','Дорошенко'])[n],
    case when n <= 6 then (today + (array[0,2,7,14,21,29])[n] - make_interval(years => 25 + n))::date
      else make_date(1970 + n, 1 + ((n * 7) % 12), 1 + ((n * 3) % 27)) end,
    make_date(2010 + (n % 15), 1 + (n % 12), 1 + (n % 27)),
    '(253) 555-01' || lpad(n::text,2,'0'), (100 + n)::text || ' Example Lane',
    'Demo City','WA','98402',
    (array['/member-photos/stock/men-7.jpg','/member-photos/stock/women-7.jpg','/member-photos/stock/men-8.jpg','/member-photos/stock/women-8.jpg','/member-photos/stock/men-9.jpg','/member-photos/stock/women-9.jpg','/member-photos/stock/men-10.jpg','/member-photos/stock/women-10.jpg','/member-photos/stock/men-11.jpg','/member-photos/stock/women-11.jpg','/member-photos/stock/men-12.jpg','/member-photos/stock/women-12.jpg','/member-photos/stock/men-13.jpg','/member-photos/stock/women-13.jpg','/member-photos/stock/men-14.jpg','/member-photos/stock/women-14.jpg','/member-photos/stock/men-15.jpg','/member-photos/stock/women-15.jpg','/member-photos/stock/men-16.jpg','/member-photos/stock/women-16.jpg'])[n],
    demo_note
  from generate_series(1,20) n on conflict(id) do nothing;

  insert into public.deacon_group_members(person_id,group_id)
    select ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, demo_group
    from generate_series(1,20) n on conflict(person_id) do nothing;

  if (select count(*) from public.deacon_group_members where group_id = demo_group) <> 20 then
    raise exception 'Demo group membership differs from the expected 20; changes rolled back';
  end if;
  insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
    values(auth.uid(),'deacon_group.demo_seeded','deacon_group',demo_group::text,
      jsonb_build_object('source','seed_deacon_group.sql','deacons',array[first_id,second_id],'member_count',20));
end
$$;
commit;

select p.display_name || ' | deacon | Демонстраційна група | 20 members' as setup
from public.profiles p join public.deacon_group_deacons d on d.profile_id = p.id
where d.group_id = '60000000-0000-4000-8000-000000000001' order by d.slot;
