begin;

-- One deacon covers the Friday two days before sunday_on through that Sunday.
create table public.deacon_duty_periods (
  id uuid primary key default gen_random_uuid(),
  sunday_on date not null,
  person_id uuid not null references public.people(id) on delete restrict,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now()
);
create unique index deacon_duty_periods_sunday on public.deacon_duty_periods(sunday_on);
create index deacon_duty_periods_person on public.deacon_duty_periods(person_id);

alter table public.deacon_duty_periods enable row level security;
-- Every active approved account may read the schedule; only editors/admins write, exclusively through the RPCs below.
create policy duty_periods_read on public.deacon_duty_periods for select to authenticated using(app_private.active());

revoke all on public.deacon_duty_periods from public,anon,authenticated;
grant select on public.deacon_duty_periods to authenticated;
grant all on public.deacon_duty_periods to service_role;

create or replace function app_private.eligible_deacon(p_person_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles
    where person_id = p_person_id and status = 'active' and designation = 'deacon'
  );
$$;

-- Replaces every Sunday of p_year with an ordered, wrapping rotation across p_person_ids.
create or replace function public.generate_duty_schedule(p_year integer, p_person_ids uuid[])
returns setof public.deacon_duty_periods
language plpgsql security definer set search_path = '' as $$
declare
  candidate_count integer := coalesce(array_length(p_person_ids, 1), 0);
  invalid_person uuid;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_year < 2000 or p_year > 2100 then raise exception 'Enter a valid year.'; end if;
  if candidate_count = 0 then raise exception 'Choose at least one deacon before generating the schedule.'; end if;

  select person_id into invalid_person from unnest(p_person_ids) as person_id
  where not app_private.eligible_deacon(person_id) limit 1;
  if invalid_person is not null then raise exception 'Choose active deacons with linked member profiles.'; end if;

  delete from public.deacon_duty_periods
  where sunday_on >= make_date(p_year, 1, 1) and sunday_on <= make_date(p_year, 12, 31);

  insert into public.deacon_duty_periods(sunday_on, person_id)
  select day, p_person_ids[1 + (row_number() over (order by day) - 1) % candidate_count]
  from (
    select generate_series(make_date(p_year, 1, 1), make_date(p_year, 12, 31), interval '1 day')::date as day
  ) days
  where extract(dow from day) = 0;

  perform app_private.audit('duty_schedule.generated', null, jsonb_build_object('year', p_year, 'deacon_count', candidate_count));
  return query select * from public.deacon_duty_periods
    where sunday_on >= make_date(p_year, 1, 1) and sunday_on <= make_date(p_year, 12, 31)
    order by sunday_on;
end;
$$;

-- Reassigns one already-generated weekend, enforcing optimistic concurrency.
create or replace function public.reassign_duty_period(p_sunday_on date, p_person_id uuid, p_revision integer)
returns public.deacon_duty_periods
language plpgsql security definer set search_path = '' as $$
declare result public.deacon_duty_periods;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if not app_private.eligible_deacon(p_person_id) then raise exception 'Choose an active deacon with a linked member profile.'; end if;

  update public.deacon_duty_periods set person_id = p_person_id, revision = revision + 1
  where sunday_on = p_sunday_on and revision = p_revision
  returning * into result;
  if not found then
    if exists(select 1 from public.deacon_duty_periods where sunday_on = p_sunday_on) then
      raise exception 'Someone else already updated this weekend. Reload and try again.';
    end if;
    raise exception 'That weekend isn''t part of the generated schedule.';
  end if;

  perform app_private.audit('duty_schedule.reassigned', result.id, jsonb_build_object('sunday_on', p_sunday_on, 'person_id', p_person_id));
  return result;
end;
$$;

revoke all on function public.generate_duty_schedule(integer, uuid[]) from public,anon;
revoke all on function public.reassign_duty_period(date, uuid, integer) from public,anon;
grant execute on function public.generate_duty_schedule(integer, uuid[]) to authenticated;
grant execute on function public.reassign_duty_period(date, uuid, integer) to authenticated;

commit;
