-- Repeatable fictional directory data for local/demo use.
-- Member names are Ukrainian; postal addresses remain in English.
-- Bundled /member-photos paths are public placeholder assets, not private uploads.
insert into public.people (
  id, first_name, last_name, date_of_birth, membership_joined_at, phone, address_line_1,
  address_line_2, city, state, postal_code, photo_path, notes, archived_at
) values
  ('10000000-0000-4000-8000-000000000001', 'Андрій', 'Бондаренко', '1987-03-14', '2014-09-21', '(555) 010-1101', '142 Cedar Lane', null, 'Brookfield', 'CA', '90210', '/member-photos/stock/men-1.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000002', 'Марія', 'Бойко', '1992-08-22', '2018-04-08', '(555) 010-1102', '88 Juniper Street', 'Apt 4', 'Brookfield', 'CA', '90210', '/member-photos/stock/women-1.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000003', 'Олена', 'Гнатюк', '1979-11-05', '2006-02-12', '(555) 010-1103', '315 Willow Avenue', null, 'Brookfield', 'CA', '90211', '/member-photos/stock/women-2.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000004', 'Микола', 'Данилюк', '1984-01-29', '2011-11-06', '(555) 010-1104', '27 Meadow Court', null, 'Brookfield', 'CA', '90211', '/member-photos/stock/men-2.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000005', 'Ірина', 'Коваль', '1990-06-17', '2019-06-09', '(555) 010-1105', '604 Harbor Road', null, 'Brookfield', 'CA', '90212', '/member-photos/stock/women-3.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000006', 'Петро', 'Кравченко', '1975-12-03', '2001-10-14', '(555) 010-1106', '19 Orchard Way', null, 'Brookfield', 'CA', '90212', '/member-photos/stock/men-3.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000007', 'Софія', 'Лисенко', '1995-04-11', '2022-05-15', '(555) 010-1107', '730 Cypress Drive', 'Unit 8', 'Brookfield', 'CA', '90213', '/member-photos/stock/women-4.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000008', 'Лука', 'Мельник', '1981-09-26', '2009-03-22', '(555) 010-1108', '256 Maple Boulevard', null, 'Brookfield', 'CA', '90213', '/member-photos/stock/men-4.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000009', 'Надія', 'Олійник', '1989-02-08', '2016-08-28', '(555) 010-1109', '911 Rose Terrace', null, 'Brookfield', 'CA', '90214', '/member-photos/stock/women-5.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000010', 'Давид', 'Петренко', '1972-07-19', '1998-12-06', '(555) 010-1110', '43 Oak Ridge', null, 'Brookfield', 'CA', '90214', '/member-photos/stock/men-5.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000011', 'Катерина', 'Савчук', '1998-10-31', '2023-01-29', '(555) 010-1111', '178 Sunrise Circle', null, 'Brookfield', 'CA', '90215', '/member-photos/stock/women-6.jpg', 'Вигаданий демонстраційний запис.', null),
  ('10000000-0000-4000-8000-000000000012', 'Тарас', 'Шевченко', '1986-05-24', '2013-07-07', '(555) 010-1112', '520 Pine Street', null, 'Brookfield', 'CA', '90215', '/member-photos/stock/men-6.jpg', 'Вигаданий демонстраційний запис.', null)
on conflict (id) do update set
  first_name = excluded.first_name, last_name = excluded.last_name,
  date_of_birth = excluded.date_of_birth, membership_joined_at = excluded.membership_joined_at,
  phone = excluded.phone, address_line_1 = excluded.address_line_1,
  address_line_2 = excluded.address_line_2, city = excluded.city,
  state = excluded.state, postal_code = excluded.postal_code,
  photo_path = excluded.photo_path, notes = excluded.notes, archived_at = excluded.archived_at,
  updated_at = now();
