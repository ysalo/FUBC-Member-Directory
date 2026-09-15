-- Add the church membership date to already-deployed databases.
-- IF NOT EXISTS makes this safe to run after a reset that used the updated baseline.
alter table public.people
  add column if not exists membership_joined_at date;
