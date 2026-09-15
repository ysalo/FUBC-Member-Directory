-- Repeatable fictional directory data for local/demo use.
-- Bundled /member-photos paths are public placeholder assets, not private uploads.
insert into public.people (
  id, first_name, last_name, date_of_birth, phone, address_line_1,
  address_line_2, city, state, postal_code, photo_path, notes, archived_at
) values
  ('10000000-0000-4000-8000-000000000001', 'Avery', 'Chen', '1987-03-14', '(555) 010-1101', '142 Cedar Lane', null, 'Brookfield', 'CA', '90210', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000002', 'Maya', 'Davis', '1992-08-22', '(555) 010-1102', '88 Juniper Street', 'Apt 4', 'Brookfield', 'CA', '90210', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000003', 'Elena', 'Garcia', '1979-11-05', '(555) 010-1103', '315 Willow Avenue', null, 'Brookfield', 'CA', '90211', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000004', 'Noah', 'Johnson', '1984-01-29', '(555) 010-1104', '27 Meadow Court', null, 'Brookfield', 'CA', '90211', '/member-photos/jordan-lee.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000005', 'Jordan', 'Lee', '1990-06-17', '(555) 010-1105', '604 Harbor Road', null, 'Brookfield', 'CA', '90212', '/member-photos/jordan-lee.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000006', 'Caleb', 'Martinez', '1975-12-03', '(555) 010-1106', '19 Orchard Way', null, 'Brookfield', 'CA', '90212', '/member-photos/jordan-lee.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000007', 'Sofia', 'Patel', '1995-04-11', '(555) 010-1107', '730 Cypress Drive', 'Unit 8', 'Brookfield', 'CA', '90213', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000008', 'Lucas', 'Rivera', '1981-09-26', '(555) 010-1108', '256 Maple Boulevard', null, 'Brookfield', 'CA', '90213', '/member-photos/jordan-lee.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000009', 'Grace', 'Thompson', '1989-02-08', '(555) 010-1109', '911 Rose Terrace', null, 'Brookfield', 'CA', '90214', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000010', 'David', 'Williams', '1972-07-19', '(555) 010-1110', '43 Oak Ridge', null, 'Brookfield', 'CA', '90214', '/member-photos/david-williams.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000011', 'Amelia', 'Wilson', '1998-10-31', '(555) 010-1111', '178 Sunrise Circle', null, 'Brookfield', 'CA', '90215', '/member-photos/avery-chen.jpg', 'Fictional demonstration record.', null),
  ('10000000-0000-4000-8000-000000000012', 'Ethan', 'Young', '1986-05-24', '(555) 010-1112', '520 Pine Street', null, 'Brookfield', 'CA', '90215', '/member-photos/david-williams.jpg', 'Fictional demonstration record.', null)
on conflict (id) do update set
  first_name = excluded.first_name, last_name = excluded.last_name,
  date_of_birth = excluded.date_of_birth, phone = excluded.phone,
  address_line_1 = excluded.address_line_1, address_line_2 = excluded.address_line_2,
  city = excluded.city, state = excluded.state, postal_code = excluded.postal_code,
  photo_path = excluded.photo_path, notes = excluded.notes, archived_at = excluded.archived_at,
  updated_at = now();
