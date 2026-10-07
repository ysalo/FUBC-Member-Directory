begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Storage stays immutable for deacons. Cleanup may remove only unpublished files.
create function app_private.deacon_photo_access(p_name text,p_delete boolean)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare member_id uuid; folder text := split_part(p_name,'/',1);
begin
  if folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or strpos(p_name,'/')=0 then return false; end if;
  member_id := folder::uuid;
  if not app_private.can_edit_group_member(member_id) then return false; end if;
  if not exists(select 1 from public.people where id=member_id and removed_at is null) then return false; end if;
  return not p_delete or not exists(
    select 1 from public.people where photo_path=p_name or photo_path || '.avatar-256.jpg'=p_name
  );
end $$;
revoke all on function app_private.deacon_photo_access(text,boolean) from public,anon;
grant execute on function app_private.deacon_photo_access(text,boolean) to authenticated;

alter policy member_photo_insert on storage.objects with check(
  bucket_id='member-photos' and (app_private.editor() or app_private.deacon_photo_access(name,false))
);
alter policy member_photo_delete on storage.objects using(
  bucket_id='member-photos' and (app_private.editor() or app_private.deacon_photo_access(name,true))
);

-- Keep the public audit wrappers and metadata response contract intact.
create or replace function app_private.audit_impl_set_person_photo(p_id uuid,p_revision integer,p_path text)
returns public.people language plpgsql security definer set search_path='' as $$
declare result public.people;
begin
  select * into result from public.people where id=p_id and removed_at is null for update;
  if not found or not (app_private.editor() or app_private.can_edit_group_member(p_id)) then raise exception 'Not authorized'; end if;
  if p_path is not null and (left(p_path,length(p_id::text)+1)<>p_id::text || '/' or not exists(select 1 from storage.objects where bucket_id='member-photos' and name=p_path)) then raise exception 'Photo upload is missing or belongs to another member'; end if;
  update public.people set photo_path=p_path,revision=revision+1 where id=p_id and revision=p_revision and removed_at is null returning * into result;
  if not found then raise exception 'Conflict: member changed. Reload and try again.'; end if;
  perform app_private.audit('person.photo',p_id,jsonb_build_object('removed',p_path is null));
  return result;
end $$;
revoke all on function app_private.audit_impl_set_person_photo(uuid,integer,text) from public,anon,authenticated;
commit;
