-- Management repairs: validate account links before writing and provide clear,
-- deterministic errors instead of relying on FK/unique constraint failures.
create or replace function public.update_account(
  p_id uuid,
  p_revision integer,
  p_status public.account_status,
  p_role public.app_role,
  p_designation public.ministry_designation,
  p_person_id uuid
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare result public.profiles;
begin
  if not app_private.admin() then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(41002);
  if not app_private.admin() then raise exception 'Not authorized'; end if;

  if p_person_id is not null then
    if not exists(select 1 from public.people where id = p_person_id and archived_at is null) then
      raise exception 'Choose an active member';
    end if;
    if exists(select 1 from public.profiles where person_id = p_person_id and id <> p_id) then
      raise exception 'That member is already linked to another account';
    end if;
  end if;

  select * into result from public.profiles where id = p_id for update;
  if not found or result.revision is distinct from p_revision then
    raise exception 'Conflict: account changed. Reload and try again.';
  end if;
  if result.status='active' and result.role='admin'
    and (p_status<>'active' or p_role<>'admin')
    and not exists(select 1 from public.profiles where id<>p_id and status='active' and role='admin') then
    raise exception 'The last active administrator cannot be removed';
  end if;

  update public.profiles
    set status=p_status, role=p_role, designation=p_designation,
        person_id=p_person_id, revision=revision+1
    where id=p_id
    returning * into result;
  perform app_private.audit('account.updated', p_id, jsonb_build_object(
    'status', p_status, 'role', p_role, 'designation', p_designation,
    'person_id', p_person_id));
  return result;
end;
$$;

revoke all on function public.update_account(uuid,integer,public.account_status,public.app_role,public.ministry_designation,uuid) from public, anon, authenticated;
grant execute on function public.update_account(uuid,integer,public.account_status,public.app_role,public.ministry_designation,uuid) to authenticated;
