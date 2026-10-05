begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- Hold the same graph lock as saves while replacing the writer and backfilling.
select revision from app_private.family_version where singleton=true for update;

create or replace function public.save_member_family(p_person_id uuid,p_revision bigint,p_parent_ids uuid[],p_spouse_id uuid,p_child_ids uuid[],p_sibling_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  current_revision bigint;
  previous_spouse uuid;
  removed_parents uuid[];
  parent_ids uuid[];
  child_ids uuid[];
begin
  if not app_private.editor() then raise exception 'Not authorized' using errcode='42501'; end if;
  select revision into current_revision from app_private.family_version for update;
  if p_revision is distinct from current_revision then
    raise exception 'Family connections changed. Refresh before saving.' using errcode='40001';
  end if;
  if p_parent_ids is null or p_child_ids is null or p_sibling_ids is null then raise exception 'Relationship lists are required'; end if;
  if not exists(select 1 from public.people where id=p_person_id) then raise exception 'Member not found'; end if;
  if p_person_id=any(p_parent_ids || p_child_ids || p_sibling_ids) or p_person_id=p_spouse_id then raise exception 'A member cannot be their own relative' using errcode='FM003'; end if;
  if exists(select 1 from unnest(p_parent_ids || p_child_ids || p_sibling_ids || case when p_spouse_id is null then '{}'::uuid[] else array[p_spouse_id] end) id
    where id is null or not exists(select 1 from public.people p where p.id=id)) then raise exception 'Relative not found'; end if;
  if p_spouse_id is not null and exists(select 1 from public.member_family_edges where kind='spouse'
    and (from_id=p_spouse_id or to_id=p_spouse_id) and from_id<>p_person_id and to_id<>p_person_id) then
    raise exception 'Selected member already has a spouse' using errcode='FM001';
  end if;
  select case when from_id=p_person_id then to_id else from_id end into previous_spouse
    from public.member_family_edges where kind='spouse' and (from_id=p_person_id or to_id=p_person_id);

  -- Removing either married parent from a child's editor removes both links.
  -- Adding either parent includes their spouse as the second parent.
  select coalesce(array_agg(from_id),'{}'::uuid[]) into removed_parents
    from public.member_family_edges where kind='parent' and to_id=p_person_id and not (from_id=any(p_parent_ids));
  with retained as (
    select distinct id from unnest(p_parent_ids) id
    where not exists(select 1 from public.member_family_edges e where e.kind='spouse'
      and ((e.from_id=id and e.to_id=any(removed_parents)) or (e.to_id=id and e.from_id=any(removed_parents))))
  ), expanded as (
    select id from retained
    union select case when e.from_id=r.id then e.to_id else e.from_id end
      from retained r join public.member_family_edges e on e.kind='spouse' and (e.from_id=r.id or e.to_id=r.id)
  ) select coalesce(array_agg(id),'{}'::uuid[]) into parent_ids from expanded;

  -- A new marriage combines both existing child lists. For an unchanged
  -- marriage the submitted list is authoritative, so removal reaches both.
  select coalesce(array_agg(distinct id),'{}'::uuid[]) into child_ids from (
    select id from unnest(p_child_ids) id
    union select to_id from public.member_family_edges where kind='parent' and from_id=any(array[p_person_id,p_spouse_id])
      and p_spouse_id is not null and p_spouse_id is distinct from previous_spouse
  ) children;
  if p_person_id=any(parent_ids || child_ids) or p_spouse_id=any(child_ids) then
    raise exception 'A member cannot be their own relative' using errcode='FM003';
  end if;
  delete from public.member_family_edges where from_id=p_person_id or to_id=p_person_id;
  insert into public.member_family_edges(kind,from_id,to_id)
    select 'parent',id,p_person_id from unnest(parent_ids) id
    union select 'parent',p_person_id,id from unnest(child_ids) id
    union select 'sibling',least(p_person_id,id),greatest(p_person_id,id) from unnest(p_sibling_ids) id
    union select 'spouse',least(p_person_id,p_spouse_id),greatest(p_person_id,p_spouse_id) where p_spouse_id is not null;
  if p_spouse_id is not null then
    delete from public.member_family_edges where kind='parent' and from_id=p_spouse_id and not (to_id=any(child_ids));
    insert into public.member_family_edges(kind,from_id,to_id)
      select 'parent',p_spouse_id,id from unnest(child_ids) id on conflict do nothing;
  end if;
  -- Propagation can create a cycle through the spouse without traversing the
  -- edited person. Check the entire resulting graph before committing.
  if exists(with recursive ancestry(ancestor,descendant) as (
    select from_id,to_id from public.member_family_edges where kind='parent'
    union select a.ancestor,e.to_id from ancestry a join public.member_family_edges e
      on e.kind='parent' and e.from_id=a.descendant
  ) select 1 from ancestry where ancestor=descendant) then
    raise exception 'Parent connections cannot create an ancestry cycle' using errcode='FM002';
  end if;
  return public.member_family(p_person_id,true);
end $$;
-- Reconcile saved marriages once, retaining every previously recorded child.
-- This changes parent facts only; spouse and explicit sibling edges stay intact.
insert into public.member_family_edges(kind,from_id,to_id)
  select 'parent',case when c.from_id=s.from_id then s.to_id else s.from_id end,c.to_id
  from public.member_family_edges s join public.member_family_edges c
    on c.kind='parent' and (c.from_id=s.from_id or c.from_id=s.to_id)
  where s.kind='spouse'
  on conflict do nothing;
do $$ begin
  if exists(with recursive ancestry(ancestor,descendant) as (
    select from_id,to_id from public.member_family_edges where kind='parent'
    union select a.ancestor,e.to_id from ancestry a join public.member_family_edges e
      on e.kind='parent' and e.from_id=a.descendant
  ) select 1 from ancestry where ancestor=descendant) then
    raise exception 'Existing married parents would create an ancestry cycle' using errcode='FM002';
  end if;
end $$;
notify pgrst,'reload schema';
commit;
