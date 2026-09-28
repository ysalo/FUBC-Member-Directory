begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Only guarded RPCs write these facts. Mutual edges have a canonical orientation.
create table public.member_family_edges (
  kind text not null check (kind in ('parent','spouse','sibling')),
  from_id uuid not null references public.people(id) on delete cascade,
  to_id uuid not null references public.people(id) on delete cascade,
  primary key(kind,from_id,to_id),
  check(from_id <> to_id),
  check(kind='parent' or from_id < to_id)
);
create index member_family_edges_from on public.member_family_edges(from_id);
create index member_family_edges_to on public.member_family_edges(to_id);
alter table public.member_family_edges enable row level security;
revoke all on public.member_family_edges from anon,authenticated;
create table app_private.family_version (singleton boolean primary key default true check(singleton), revision bigint not null default 0);
insert into app_private.family_version default values;

-- Serializes every mutation, including cascading permanent deletion. A graph-wide
-- token deliberately errs toward refresh, covering shared-parent inference too.
create function app_private.family_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update app_private.family_version set revision=revision+1;
  return null;
end $$;
create trigger family_changed after insert or update or delete on public.member_family_edges
for each statement execute function app_private.family_changed();

create function public.member_family(p_person_id uuid,p_manage boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not app_private.active() or (p_manage and not app_private.editor()) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if not exists(select 1 from public.people where id=p_person_id and (p_manage or archived_at is null)) then
    raise exception 'Member not found';
  end if;
  with relatives as (
    select case when e.kind='parent' and e.to_id=p_person_id then 'parents'
                when e.kind='parent' then 'children' else e.kind end category,
           case when e.from_id=p_person_id then e.to_id else e.from_id end id,
           e.kind='sibling' explicit, null::uuid supporting_parent
    from public.member_family_edges e where e.from_id=p_person_id or e.to_id=p_person_id
    union all
    select 'sibling',other.to_id,false,own.from_id
    from public.member_family_edges own join public.member_family_edges other
      on other.kind='parent' and other.from_id=own.from_id and other.to_id<>p_person_id
    where own.kind='parent' and own.to_id=p_person_id
  ), grouped as (
    select r.category,p.id,p.name,p.archived_at,p.photo_path,bool_or(r.explicit) explicit,
      coalesce((select jsonb_agg(jsonb_build_object('id',parent.id,'name',parent.name,'archived',parent.archived_at is not null,'photoPath',parent.photo_path) order by parent.name,parent.id)
      from public.people parent where parent.id=any(array_agg(r.supporting_parent)) and (p_manage or parent.archived_at is null)),'[]'::jsonb) supporting
    from relatives r join public.people p on p.id=r.id
    where p_manage or p.archived_at is null
    group by r.category,p.id
  ), rows as (
    select category,jsonb_build_object('id',id,'name',name,'archived',archived_at is not null,'photoPath',photo_path,'explicit',explicit,'supportingParents',supporting) item,name,id from grouped
  ) select jsonb_build_object('memberId',p_person_id,'revision',(select revision from app_private.family_version),
    'parents',coalesce((select jsonb_agg(item order by name,id) from rows where category='parents'),'[]'::jsonb),
    'children',coalesce((select jsonb_agg(item order by name,id) from rows where category='children'),'[]'::jsonb),
    'spouse',(select item from rows where category='spouse'),
    'siblings',coalesce((select jsonb_agg(item order by name,id) from rows where category='sibling'),'[]'::jsonb)) into result;
  return result;
end $$;

create function public.save_member_family(p_person_id uuid,p_revision bigint,p_parent_ids uuid[],p_spouse_id uuid,p_child_ids uuid[],p_sibling_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_revision bigint;
begin
  if not app_private.editor() then raise exception 'Not authorized' using errcode='42501'; end if;
  select revision into current_revision from app_private.family_version for update;
  if p_revision is distinct from current_revision then
    raise exception 'Family connections changed. Refresh before saving.' using errcode='40001';
  end if;
  if p_parent_ids is null or p_child_ids is null or p_sibling_ids is null then raise exception 'Relationship lists are required'; end if;
  if not exists(select 1 from public.people where id=p_person_id) then raise exception 'Member not found'; end if;
  if p_person_id=any(p_parent_ids || p_child_ids || p_sibling_ids) or p_person_id=p_spouse_id then raise exception 'A member cannot be their own relative'; end if;
  if exists(select 1 from unnest(p_parent_ids || p_child_ids || p_sibling_ids || case when p_spouse_id is null then '{}'::uuid[] else array[p_spouse_id] end) id
    where id is null or not exists(select 1 from public.people p where p.id=id)) then raise exception 'Relative not found'; end if;
  if p_spouse_id is not null and exists(select 1 from public.member_family_edges where kind='spouse'
    and (from_id=p_spouse_id or to_id=p_spouse_id) and from_id<>p_person_id and to_id<>p_person_id) then
    raise exception 'Selected member already has a spouse';
  end if;
  delete from public.member_family_edges where from_id=p_person_id or to_id=p_person_id;
  insert into public.member_family_edges(kind,from_id,to_id)
    select 'parent',id,p_person_id from unnest(p_parent_ids) id
    union select 'parent',p_person_id,id from unnest(p_child_ids) id
    union select 'sibling',least(p_person_id,id),greatest(p_person_id,id) from unnest(p_sibling_ids) id
    union select 'spouse',least(p_person_id,p_spouse_id),greatest(p_person_id,p_spouse_id) where p_spouse_id is not null;
  if exists(with recursive descendants(id) as (
    select to_id from public.member_family_edges where kind='parent' and from_id=p_person_id
    union
    select e.to_id from descendants d join public.member_family_edges e on e.from_id=d.id and e.kind='parent'
  ) select 1 from descendants where id=p_person_id) then raise exception 'Parent connections cannot create an ancestry cycle'; end if;
  return public.member_family(p_person_id,true);
end $$;
revoke all on function app_private.family_changed() from public,anon,authenticated;
revoke all on function public.member_family(uuid,boolean),public.save_member_family(uuid,bigint,uuid[],uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.member_family(uuid,boolean),public.save_member_family(uuid,bigint,uuid[],uuid,uuid[],uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
