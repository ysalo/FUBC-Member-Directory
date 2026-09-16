-- Manual staging/release setup, AFTER migrations and owner authorization.
-- Not a migration and never run against an existing prototype database blindly.
-- This preserves the prototype's six-hour auto-complete/archive lifecycle.
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid) from cron.job where jobname in ('native-visits-complete','native-visits-archive');
select cron.schedule('native-visits-complete','* * * * *','select public.auto_complete_visits();');
select cron.schedule('native-visits-archive','* * * * *','select public.auto_archive_visits();');

-- REQUIRED BEFORE RELEASE, intentionally not automated:
-- 1. Configure Apple/Google providers, native callback and Apple audiences.
-- 2. Configure private member-photos bucket limits and MIME allowlist.
-- 3. Configure the worker in supabase/worker as an external scheduler job every
--    minute. Each run calls queue_due_notifications before claiming jobs, so do
--    NOT add a second pg_cron entry for queue_due_notifications.
--    Supply server-only APNs/Supabase secrets and monitor failures/backlog.
-- 4. Install account deletion orchestration after approving retention and Apple
--    token revocation requirements. Request intake alone is not deletion.
