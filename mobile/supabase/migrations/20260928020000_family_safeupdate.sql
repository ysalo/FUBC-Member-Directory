begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- API sessions enforce pg-safeupdate, including SQL inside this trigger.
-- Target the singleton explicitly while preserving graph revision invalidation.
create or replace function app_private.family_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update app_private.family_version
  set revision=revision+1
  where singleton = true;
  return null;
end $$;

revoke all on function app_private.family_changed() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
