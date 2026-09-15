-- Replace portraits on existing fictional demo members, including existing photos.
-- Apply after deploying web/public/member-photos/stock. Repeatable; changes only photo_path.
begin;
update public.people p
set photo_path = portraits.photo_path, updated_at = now()
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'Андрій', '/member-photos/stock/men-1.jpg'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'Марія', '/member-photos/stock/women-1.jpg'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'Олена', '/member-photos/stock/women-2.jpg'),
  ('10000000-0000-4000-8000-000000000004'::uuid, 'Микола', '/member-photos/stock/men-2.jpg'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'Ірина', '/member-photos/stock/women-3.jpg'),
  ('10000000-0000-4000-8000-000000000006'::uuid, 'Петро', '/member-photos/stock/men-3.jpg'),
  ('10000000-0000-4000-8000-000000000007'::uuid, 'Софія', '/member-photos/stock/women-4.jpg'),
  ('10000000-0000-4000-8000-000000000008'::uuid, 'Лука', '/member-photos/stock/men-4.jpg'),
  ('10000000-0000-4000-8000-000000000009'::uuid, 'Надія', '/member-photos/stock/women-5.jpg'),
  ('10000000-0000-4000-8000-000000000010'::uuid, 'Давид', '/member-photos/stock/men-5.jpg'),
  ('10000000-0000-4000-8000-000000000011'::uuid, 'Катерина', '/member-photos/stock/women-6.jpg'),
  ('10000000-0000-4000-8000-000000000012'::uuid, 'Тарас', '/member-photos/stock/men-6.jpg'),
  ('50000000-0000-4000-8000-000000000001'::uuid, 'Олександр', '/member-photos/stock/men-7.jpg'),
  ('50000000-0000-4000-8000-000000000002'::uuid, 'Оксана', '/member-photos/stock/women-7.jpg'),
  ('50000000-0000-4000-8000-000000000003'::uuid, 'Богдан', '/member-photos/stock/men-8.jpg'),
  ('50000000-0000-4000-8000-000000000004'::uuid, 'Наталія', '/member-photos/stock/women-8.jpg'),
  ('50000000-0000-4000-8000-000000000005'::uuid, 'Василь', '/member-photos/stock/men-9.jpg'),
  ('50000000-0000-4000-8000-000000000006'::uuid, 'Тетяна', '/member-photos/stock/women-9.jpg'),
  ('50000000-0000-4000-8000-000000000007'::uuid, 'Дмитро', '/member-photos/stock/men-10.jpg'),
  ('50000000-0000-4000-8000-000000000008'::uuid, 'Людмила', '/member-photos/stock/women-10.jpg'),
  ('50000000-0000-4000-8000-000000000009'::uuid, 'Євген', '/member-photos/stock/men-11.jpg'),
  ('50000000-0000-4000-8000-000000000010'::uuid, 'Галина', '/member-photos/stock/women-11.jpg'),
  ('50000000-0000-4000-8000-000000000011'::uuid, 'Іван', '/member-photos/stock/men-12.jpg'),
  ('50000000-0000-4000-8000-000000000012'::uuid, 'Юлія', '/member-photos/stock/women-12.jpg'),
  ('50000000-0000-4000-8000-000000000013'::uuid, 'Максим', '/member-photos/stock/men-13.jpg'),
  ('50000000-0000-4000-8000-000000000014'::uuid, 'Віра', '/member-photos/stock/women-13.jpg'),
  ('50000000-0000-4000-8000-000000000015'::uuid, 'Роман', '/member-photos/stock/men-14.jpg'),
  ('50000000-0000-4000-8000-000000000016'::uuid, 'Анна', '/member-photos/stock/women-14.jpg'),
  ('50000000-0000-4000-8000-000000000017'::uuid, 'Сергій', '/member-photos/stock/men-15.jpg'),
  ('50000000-0000-4000-8000-000000000018'::uuid, 'Лілія', '/member-photos/stock/women-15.jpg'),
  ('50000000-0000-4000-8000-000000000019'::uuid, 'Тарас', '/member-photos/stock/men-16.jpg'),
  ('50000000-0000-4000-8000-000000000020'::uuid, 'Христина', '/member-photos/stock/women-16.jpg')
) as portraits(id, first_name, photo_path)
where p.id = portraits.id and p.first_name = portraits.first_name;
commit;
