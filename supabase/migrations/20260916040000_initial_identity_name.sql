begin;
-- Apple supplies the person's name only on first consent, after Auth has created
-- the profile. Fill that initial fallback without allowing account/role edits.
create function public.set_initial_display_name(display_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if $1 is null or length(trim($1)) not between 1 and 200 then
    raise exception 'Display name must contain 1 to 200 characters'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'Profile unavailable'; end if;
  update public.profiles p set display_name=trim($1),updated_at=now()
    where p.id=auth.uid() and (nullif(trim(p.display_name),'') is null or trim(p.display_name)=p.email);
end $$;
revoke all on function public.set_initial_display_name(text) from public,anon,authenticated;
grant execute on function public.set_initial_display_name(text) to authenticated;
commit;
