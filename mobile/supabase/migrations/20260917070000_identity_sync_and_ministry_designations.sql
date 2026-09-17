begin;

-- Pastor and Deacon are account designations, never selectable ministries.
delete from public.person_ministries
where ministry_id in (
  select id from public.ministries
  where lower(trim(name)) in ('pastor','deacon','пастор','диякон')
     or lower(trim(name_uk)) in ('pastor','deacon','пастор','диякон')
);
update public.ministries set archived_at=coalesce(archived_at,now()),revision=revision+1
where lower(trim(name)) in ('pastor','deacon','пастор','диякон')
   or lower(trim(name_uk)) in ('pastor','deacon','пастор','диякон');
update public.people set ministry='',ministry_uk='',revision=revision+1
where lower(trim(ministry)) in ('pastor','deacon','пастор','диякон')
   or lower(trim(ministry_uk)) in ('pastor','deacon','пастор','диякон');

create or replace function public.save_ministry(p_id uuid,p_revision integer,p_name text,p_name_uk text,p_archived boolean)
returns public.ministries language plpgsql security definer set search_path='' as $$
declare result public.ministries; normalized text:=lower(trim(coalesce(p_name,'')));
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Enter a ministry name'; end if;
  if normalized in ('pastor','deacon','пастор','диякон') then raise exception 'Pastor and Deacon are account designations, not ministries'; end if;
  if p_id is null then
    insert into public.ministries(name,name_uk,archived_at) values(trim(p_name),'',case when p_archived then now() else null end) returning * into result;
  else
    update public.ministries set name=trim(p_name),name_uk='',archived_at=case when p_archived then coalesce(archived_at,now()) else null end,revision=revision+1 where id=p_id and revision=p_revision returning * into result;
    if not found then raise exception 'Conflict: ministry changed. Reload and try again.'; end if;
  end if;
  perform app_private.audit('ministry.saved',result.id,jsonb_build_object('archived',result.archived_at is not null)); return result;
end;
$$;

create or replace function app_private.sync_linked_account_name()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.name is distinct from old.name then
    update public.profiles set display_name=new.name,revision=revision+1 where person_id=new.id and display_name is distinct from new.name;
  end if;
  return new;
end;
$$;
drop trigger if exists people_sync_linked_account_name on public.people;
create trigger people_sync_linked_account_name after update of name on public.people for each row execute function app_private.sync_linked_account_name();

commit;
