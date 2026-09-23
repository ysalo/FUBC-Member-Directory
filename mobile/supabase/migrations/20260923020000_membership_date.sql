begin;

create or replace function public.save_person(p_id uuid,p_revision integer,p_data jsonb)
returns public.people language plpgsql security definer set search_path='' as $$
declare result public.people; current_person public.people; selected_leadership uuid[]; current_leadership uuid[]; joined_date date;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_id is not null then
    select * into current_person from public.people where id=p_id for update;
    if not found or current_person.revision is distinct from p_revision then
      raise exception 'Conflict: member changed. Reload and try again.';
    end if;
  end if;
  if p_data ? 'membership_joined_at' then
    joined_date:=nullif(p_data->>'membership_joined_at','')::date;
    if joined_date>current_date or not isfinite(joined_date) then
      raise exception 'Membership date must be a valid date not in the future';
    end if;
  end if;
  if not app_private.admin() then
    if p_data ? 'ministry_ids' then
      select coalesce(array_agg(id order by id),'{}'::uuid[]) into selected_leadership
      from public.ministries where system_key in ('pastor','deacon') and id in (
        select value::uuid from jsonb_array_elements_text(p_data->'ministry_ids')
      );
      select coalesce(array_agg(ministry.id order by ministry.id),'{}'::uuid[]) into current_leadership
      from public.person_ministries assignment join public.ministries ministry on ministry.id=assignment.ministry_id
      where assignment.person_id=p_id and ministry.system_key in ('pastor','deacon');
      if selected_leadership is distinct from current_leadership then
        raise exception 'Only administrators can change Pastor or Deacon sub-roles';
      end if;
    end if;
  end if;
  result:=app_private.save_person(p_id,p_revision,p_data);
  if p_data ? 'membership_joined_at' then
    update public.people set membership_joined_at=joined_date where id=result.id returning * into result;
  end if;
  if result.archived_at is not null then
    update public.deacon_groups set revision=revision+1 where id=current_person.membership_group_id
      or id in (select group_id from public.deacon_group_members where person_id=result.id)
      or id in (select group_id from public.deacon_group_deacons where person_id=result.id);
    delete from public.deacon_group_members where person_id=result.id;
    delete from public.deacon_group_deacons where person_id=result.id;
    update public.people set membership_group_id=null where id=result.id returning * into result;
  end if;
  return result;
end $$;

notify pgrst, 'reload schema';
commit;