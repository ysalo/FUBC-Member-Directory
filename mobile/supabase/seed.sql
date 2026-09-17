-- Repeatable fictional staging data for the Expo member directory.
-- Run only against the reviewed Expo schema. Existing non-seed records are preserved.
begin;

do $$
begin
  if public.mobile_contract_version() <> 'expo-directory-v1' then
    raise exception 'The Expo mobile database contract is required';
  end if;

  if (
    select count(*)
    from storage.objects
    where bucket_id = 'member-photos'
      and name ~ '^(men|women)-([1-9]|1[0-6])\.jpg$'
  ) <> 32 then
    raise exception 'All 32 staged portraits must be uploaded before seeding members';
  end if;

  if not exists (
    select 1 from auth.users where lower(email) = 'salo.yaro.slavik@gmail.com'
  ) then
    raise exception 'The Yaro Salo login account was not found';
  end if;

  -- The selected deacon accounts are optional staging data. Group One may
  -- legitimately have zero, one, or two leaders until those accounts exist
  -- and are approved as active deacons.
end
$$;

insert into public.deacon_groups (id, name, kind)
values
  ('70000000-0000-4000-8000-000000000001', 'Група один', 'membership'),
  ('70000000-0000-4000-8000-000000000002', 'Група два', 'membership'),
  ('70000000-0000-4000-8000-000000000003', 'Група три', 'membership'),
  ('70000000-0000-4000-8000-000000000101', 'Група турботи «Надія»', 'responsibility'),
  ('70000000-0000-4000-8000-000000000102', 'Група турботи «Милосердя»', 'responsibility')
on conflict (id) do update
set name = excluded.name,
    kind = excluded.kind,
    archived_at = null;

with seed_people(id, name, ministry, ministry_uk, phone, email, photo_path, membership_group_id, birth_date, address) as (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 'Андрій Бондаренко', 'Welcome Team', 'Команда зустрічі', '(253) 555-0101', 'andrii.bondarenko@example.com', 'men-1.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1987-03-14'::date, '101 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'Марія Бойко', 'Children''s Ministry', 'Дитяче служіння', '(253) 555-0102', 'mariia.boiko@example.com', 'women-1.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1992-08-22'::date, '102 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'Олена Гнатюк', 'Hospitality', 'Гостинність', '(253) 555-0103', 'olena.hnatiuk@example.com', 'women-2.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1979-11-05'::date, '103 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'Микола Данилюк', 'Worship Team', 'Команда прославлення', '(253) 555-0104', 'mykola.danyliuk@example.com', 'men-2.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1984-01-29'::date, '104 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'Ірина Коваль', 'Prayer Ministry', 'Молитовне служіння', '(253) 555-0105', 'iryna.koval@example.com', 'women-3.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1990-06-17'::date, '105 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000006'::uuid, 'Петро Кравченко', 'Facilities', 'Господарське служіння', '(253) 555-0106', 'petro.kravchenko@example.com', 'men-3.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1975-12-03'::date, '106 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000007'::uuid, 'Софія Лисенко', 'Youth Ministry', 'Молодіжне служіння', '(253) 555-0107', 'sofiia.lysenko@example.com', 'women-4.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1995-04-11'::date, '107 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000008'::uuid, 'Лука Мельник', 'Media Team', 'Медіа служіння', '(253) 555-0108', 'luka.melnyk@example.com', 'men-4.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1981-09-26'::date, '108 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000009'::uuid, 'Надія Олійник', 'Hospitality', 'Гостинність', '(253) 555-0109', 'nadiia.oliinyk@example.com', 'women-5.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1989-02-08'::date, '109 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000010'::uuid, 'Давид Петренко', 'Worship Team', 'Команда прославлення', '(253) 555-0110', 'davyd.petrenko@example.com', 'men-5.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1972-07-19'::date, '110 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000011'::uuid, 'Катерина Савчук', 'Children''s Ministry', 'Дитяче служіння', '(253) 555-0111', 'kateryna.savchuk@example.com', 'women-6.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1998-10-31'::date, '111 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000012'::uuid, 'Тарас Шевченко', 'Small Groups', 'Малі групи', '(253) 555-0112', 'taras.shevchenko@example.com', 'men-6.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1986-05-24'::date, '112 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000001'::uuid, 'Олександр Бондаренко', 'Welcome Team', 'Команда зустрічі', '(253) 555-0113', 'oleksandr.bondarenko@example.com', 'men-7.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1983-02-04'::date, '113 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000002'::uuid, 'Оксана Бойко', 'Hospitality', 'Гостинність', '(253) 555-0114', 'oksana.boiko@example.com', 'women-7.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1988-05-12'::date, '114 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000003'::uuid, 'Богдан Гнатюк', 'Youth Ministry', 'Молодіжне служіння', '(253) 555-0115', 'bohdan.hnatiuk@example.com', 'men-8.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1991-09-18'::date, '115 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000004'::uuid, 'Наталія Данилюк', 'Prayer Ministry', 'Молитовне служіння', '(253) 555-0116', 'nataliia.danyliuk@example.com', 'women-8.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1978-12-27'::date, '116 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000005'::uuid, 'Василь Захарченко', 'Facilities', 'Господарське служіння', '(253) 555-0117', 'vasyl.zakharchenko@example.com', 'men-9.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1974-04-09'::date, '117 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000006'::uuid, 'Тетяна Коваль', 'Children''s Ministry', 'Дитяче служіння', '(253) 555-0118', 'tetiana.koval@example.com', 'women-9.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1993-07-21'::date, '118 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000007'::uuid, 'Дмитро Кравченко', 'Media Team', 'Медіа служіння', '(253) 555-0119', 'dmytro.kravchenko@example.com', 'men-10.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1985-10-16'::date, '119 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000008'::uuid, 'Людмила Лисенко', 'Hospitality', 'Гостинність', '(253) 555-0120', 'liudmyla.lysenko@example.com', 'women-10.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1969-01-30'::date, '120 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000009'::uuid, 'Євген Мельник', 'Worship Team', 'Команда прославлення', '(253) 555-0121', 'yevhen.melnyk@example.com', 'men-11.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1980-06-13'::date, '121 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000010'::uuid, 'Галина Олійник', 'Prayer Ministry', 'Молитовне служіння', '(253) 555-0122', 'halyna.oliinyk@example.com', 'women-11.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1976-08-25'::date, '122 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000011'::uuid, 'Іван Петренко', 'Small Groups', 'Малі групи', '(253) 555-0123', 'ivan.petrenko@example.com', 'men-12.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1990-03-03'::date, '123 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000012'::uuid, 'Юлія Романенко', 'Welcome Team', 'Команда зустрічі', '(253) 555-0124', 'yuliia.romanenko@example.com', 'women-12.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1996-11-14'::date, '124 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000013'::uuid, 'Максим Савчук', 'Youth Ministry', 'Молодіжне служіння', '(253) 555-0125', 'maksym.savchuk@example.com', 'men-13.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1989-05-28'::date, '125 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000014'::uuid, 'Віра Сидоренко', 'Children''s Ministry', 'Дитяче служіння', '(253) 555-0126', 'vira.sydorenko@example.com', 'women-13.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1982-09-07'::date, '126 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000015'::uuid, 'Роман Ткаченко', 'Facilities', 'Господарське служіння', '(253) 555-0127', 'roman.tkachenko@example.com', 'men-14.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1977-02-19'::date, '127 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000016'::uuid, 'Анна Федоренко', 'Hospitality', 'Гостинність', '(253) 555-0128', 'anna.fedorenko@example.com', 'women-14.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1994-04-23'::date, '128 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000017'::uuid, 'Сергій Хоменко', 'Media Team', 'Медіа служіння', '(253) 555-0129', 'serhii.khomenko@example.com', 'men-15.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1981-07-02'::date, '129 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000018'::uuid, 'Лілія Шевченко', 'Prayer Ministry', 'Молитовне служіння', '(253) 555-0130', 'liliia.shevchenko@example.com', 'women-15.jpg', '70000000-0000-4000-8000-000000000003'::uuid, '1987-10-11'::date, '130 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000019'::uuid, 'Тарас Яремчук', 'Worship Team', 'Команда прославлення', '(253) 555-0131', 'taras.yaremchuk@example.com', 'men-16.jpg', '70000000-0000-4000-8000-000000000001'::uuid, '1979-12-06'::date, '131 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000020'::uuid, 'Христина Дорошенко', 'Welcome Team', 'Команда зустрічі', '(253) 555-0132', 'khrystyna.doroshenko@example.com', 'women-16.jpg', '70000000-0000-4000-8000-000000000002'::uuid, '1997-01-15'::date, '132 Cedar Lane, Tacoma, WA')
)
insert into public.people (id, name, ministry, ministry_uk, phone, email, photo_path, membership_group_id)
select id, name, ministry, ministry_uk, phone, email, photo_path, membership_group_id from seed_people
on conflict (id) do update
set name = excluded.name,
    ministry = excluded.ministry,
    ministry_uk = excluded.ministry_uk,
    phone = excluded.phone,
    email = excluded.email,
    photo_path = excluded.photo_path,
    membership_group_id = excluded.membership_group_id,
    archived_at = null;

with seed_private(person_id, birth_date, address) as (
  select id, birth_date, address
  from (values
    ('10000000-0000-4000-8000-000000000001'::uuid, '1987-03-14'::date, '101 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000002'::uuid, '1992-08-22'::date, '102 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000003'::uuid, '1979-11-05'::date, '103 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000004'::uuid, '1984-01-29'::date, '104 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '1990-06-17'::date, '105 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000006'::uuid, '1975-12-03'::date, '106 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000007'::uuid, '1995-04-11'::date, '107 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000008'::uuid, '1981-09-26'::date, '108 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000009'::uuid, '1989-02-08'::date, '109 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000010'::uuid, '1972-07-19'::date, '110 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000011'::uuid, '1998-10-31'::date, '111 Cedar Lane, Tacoma, WA'),
    ('10000000-0000-4000-8000-000000000012'::uuid, '1986-05-24'::date, '112 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000001'::uuid, '1983-02-04'::date, '113 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000002'::uuid, '1988-05-12'::date, '114 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000003'::uuid, '1991-09-18'::date, '115 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000004'::uuid, '1978-12-27'::date, '116 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000005'::uuid, '1974-04-09'::date, '117 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000006'::uuid, '1993-07-21'::date, '118 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000007'::uuid, '1985-10-16'::date, '119 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000008'::uuid, '1969-01-30'::date, '120 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000009'::uuid, '1980-06-13'::date, '121 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000010'::uuid, '1976-08-25'::date, '122 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000011'::uuid, '1990-03-03'::date, '123 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000012'::uuid, '1996-11-14'::date, '124 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000013'::uuid, '1989-05-28'::date, '125 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000014'::uuid, '1982-09-07'::date, '126 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000015'::uuid, '1977-02-19'::date, '127 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000016'::uuid, '1994-04-23'::date, '128 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000017'::uuid, '1981-07-02'::date, '129 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000018'::uuid, '1987-10-11'::date, '130 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000019'::uuid, '1979-12-06'::date, '131 Cedar Lane, Tacoma, WA'),
    ('50000000-0000-4000-8000-000000000020'::uuid, '1997-01-15'::date, '132 Cedar Lane, Tacoma, WA')
  ) rows(id, birth_date, address)
)
insert into public.people_private (person_id, birth_date, address)
select person_id, birth_date, address from seed_private
on conflict (person_id) do update
set birth_date = excluded.birth_date,
    address = excluded.address;

-- Legacy-style member details used by the native profile page.
update public.people
set membership_joined_at = make_date(2011 + (abs(hashtext(id::text)) % 13), 1 + (abs(hashtext(id::text || 'm')) % 12), 1 + (abs(hashtext(id::text || 'd')) % 27))
where id in (
  select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 12) n
  union all
  select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 20) n
);

update public.people_private
set marital_status = case
      when abs(hashtext(person_id::text)) % 7 = 0 then 'Widowed'
      when abs(hashtext(person_id::text)) % 4 = 0 then 'Single'
      else 'Married'
    end,
    orphan_status = abs(hashtext(person_id::text)) % 11 = 0
where person_id in (
  select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 12) n
  union all
  select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 20) n
);

insert into public.people (id, name, ministry, ministry_uk, email, membership_group_id)
values (
  '90000000-0000-4000-8000-000000000001',
  'Ярослав Сало',
  'Pastor',
  'Пастор',
  'salo.yaro.slavik@gmail.com',
  '70000000-0000-4000-8000-000000000002'
)
on conflict (id) do update
set name = excluded.name,
    ministry = excluded.ministry,
    ministry_uk = excluded.ministry_uk,
    email = excluded.email,
    membership_group_id = excluded.membership_group_id,
    archived_at = null;

update public.people
set membership_joined_at = '2018-09-01'
where id = '90000000-0000-4000-8000-000000000001';

insert into public.people_private (person_id, birth_date, address, marital_status, orphan_status)
values ('90000000-0000-4000-8000-000000000001', '1987-06-15', 'Tacoma, WA', 'Married', false)
on conflict (person_id) do update
set birth_date = excluded.birth_date,
    address = excluded.address,
    marital_status = excluded.marital_status,
    orphan_status = excluded.orphan_status;

insert into public.deacon_group_members (group_id, person_id)
select
  case when row_number() over (order by id) <= 16
    then '70000000-0000-4000-8000-000000000101'::uuid
    else '70000000-0000-4000-8000-000000000102'::uuid
  end,
  id
from public.people
where id between '10000000-0000-4000-8000-000000000001'::uuid and '50000000-0000-4000-8000-000000000020'::uuid
  and id in (
    select ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 12) n
    union all
    select ('50000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 20) n
  )
on conflict (person_id) do update set group_id = excluded.group_id;

-- Normalize the account used only for administration in this staging dataset.
update public.profiles
set designation = 'none', revision = revision + 1
where id = (select id from auth.users where lower(email) = 'slav27@gmail.com')
  and designation = 'deacon';

update public.profiles
set designation = 'deacon', revision = revision + 1
where id in (
  select id from auth.users
  where lower(email) in ('slav.salo@gmail.com', 'alinabelashov@gmail.com')
)
  and status = 'active'
  and designation is distinct from 'deacon';

update public.profiles
set designation = 'pastor',
    person_id = '90000000-0000-4000-8000-000000000001',
    revision = revision + 1
where id = (select id from auth.users where lower(email) = 'salo.yaro.slavik@gmail.com')
  and status = 'active'
  and (designation is distinct from 'pastor' or person_id is distinct from '90000000-0000-4000-8000-000000000001');

-- Rebuild only the seeded leadership rows from accounts that are actually
-- approved deacons. Missing accounts therefore produce no rows rather than a
-- null-FK error, while rerunning the seed removes stale Group One leaders.
delete from public.deacon_group_deacons
where group_id = '70000000-0000-4000-8000-000000000001';

insert into public.deacon_group_deacons (group_id, account_id, slot)
select assignment.group_id, user_account.id, assignment.slot
from (values
  ('70000000-0000-4000-8000-000000000001'::uuid, 'slav.salo@gmail.com'::text, 1),
  ('70000000-0000-4000-8000-000000000001'::uuid, 'alinabelashov@gmail.com'::text, 2)
) assignment(group_id, email, slot)
join auth.users user_account on lower(user_account.email) = assignment.email
join public.profiles profile on profile.id = user_account.id
  and profile.status = 'active' and profile.designation = 'deacon'
on conflict (group_id, account_id) do update set slot = excluded.slot;

insert into public.audit_events (actor_id, action, metadata)
values (null, 'demo.seeded', jsonb_build_object(
  'source', 'supabase/seed.sql',
  'fictional_people', 32,
  'linked_people', 1,
  'groups', 5
));

commit;

select
  (select count(*) from public.people where archived_at is null) as active_people,
  (select count(*) from public.people where photo_path is not null) as photographed_people,
  (select count(*) from public.deacon_groups where archived_at is null) as active_groups,
  (select count(*) from public.profiles where status = 'active' and designation = 'deacon') as active_deacons,
  (select count(*) from public.profiles where status = 'active' and designation = 'pastor') as active_pastors;
