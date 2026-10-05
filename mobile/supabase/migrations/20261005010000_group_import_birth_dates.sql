-- Expose only the identity detail needed by authorized group managers.
create or replace function public.management_group_birth_dates()
returns table(person_id uuid, birth_date date)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  return query select p.id, d.birth_date
    from public.people p left join public.people_private d on d.person_id = p.id
    where p.archived_at is null;
end;
$$;
revoke all on function public.management_group_birth_dates() from public, anon, authenticated;
grant execute on function public.management_group_birth_dates() to authenticated;
