begin;

create or replace function public.directory_active_members()
returns table (
  id uuid,
  name text,
  ministry text,
  ministry_uk text,
  phone text,
  photo_path text,
  designation public.ministry_designation,
  is_orphan boolean,
  is_widow boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.ministry, p.ministry_uk, p.phone, p.photo_path,
    coalesce(profile.designation, 'none'::public.ministry_designation),
    coalesce(private.orphan_status, false),
    lower(coalesce(private.marital_status, '')) in ('widowed', 'widow', 'вдова', 'вдівець', 'вдівець/вдова')
  from public.people p
  left join public.people_private private on private.person_id = p.id
  left join public.profiles profile on profile.person_id = p.id and profile.status = 'active'
  where p.archived_at is null and app_private.active();
$$;

create or replace function public.directory_visible_visit_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.visit_requests visit
  where visit.archived_at is null
    and visit.status = 'open'
    and app_private.active()
    and (
      visit.pastor_id = auth.uid()
      or exists (
        select 1 from public.visit_recipients recipient
        where recipient.visit_id = visit.id and recipient.account_id = auth.uid()
      )
    );
$$;

revoke all on function public.directory_active_members() from public, anon, authenticated;
revoke all on function public.directory_visible_visit_count() from public, anon, authenticated;
grant execute on function public.directory_active_members() to authenticated;
grant execute on function public.directory_visible_visit_count() to authenticated;

commit;
