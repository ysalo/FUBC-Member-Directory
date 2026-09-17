begin;

-- Legacy prototype schedules call functions that are intentionally absent from
-- the explicit mobile lifecycle. Disable them when upgrading an existing project.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.alter_job(jobid,active=>false)
      from cron.job
      where jobname in ('visitation-auto-complete','visitation-auto-archive');
  end if;
end $$;

-- Keep future objects private by default. Client access remains opt-in through
-- the explicit grants in the baseline and contract migrations.
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon,authenticated;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges for role postgres in schema public grant execute on functions to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant usage on schema app_private to service_role;
grant execute on all functions in schema app_private to service_role;

notify pgrst,'reload schema';
commit;
