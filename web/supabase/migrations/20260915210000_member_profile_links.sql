-- Resolve account identities without exposing profiles or their private fields.
create function public.resolve_member_profiles(requested_profile_ids uuid[])
returns table(profile_id uuid, person_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select profile.id, person.id
  from public.profiles profile
  join public.people person on person.id = profile.person_id
  where public.current_role() in ('member', 'editor', 'admin')
    and profile.id = any(requested_profile_ids)
    and person.archived_at is null
$$;

revoke all on function public.resolve_member_profiles(uuid[]) from public, anon;
grant execute on function public.resolve_member_profiles(uuid[]) to authenticated;
