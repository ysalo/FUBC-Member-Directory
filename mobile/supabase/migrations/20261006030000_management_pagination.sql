begin;

-- Keep the legacy readers for released clients and deliberate import/family workflows.
-- Interactive management reads are counted and limited before leaving PostgreSQL.
create function app_private.management_search_normalize(p_text text)
returns text language plpgsql immutable set search_path='' as $$
declare word text; repaired text := ''; result text;
begin
  foreach word in array regexp_split_to_array(coalesce(p_text,''),'\s+') loop
    if word ~ '[А-Яа-яІіЇїЄєҐґ]' then
      word := translate(word,'ABCEHIKMOPTXYaceiopxy','АВСЕНІКМОРТХУасеіорху');
    end if;
    repaired := repaired || ' ' || word;
  end loop;
  result := lower(normalize(repaired,NFKD));
  result := regexp_replace(result,U&'[\0300-\036f]','','g');
  result := regexp_replace(result,'[’''ʼ`-]','','g');
  return btrim(regexp_replace(result,'[^[:alnum:]]+',' ','g'));
end $$;

-- Distinct name words must match distinct query words; token order is irrelevant.
create function app_private.management_name_score(p_name text,p_query text)
returns integer language sql immutable set search_path='' as $$
  with recursive tokens as (
    select regexp_split_to_array(app_private.management_search_normalize(p_name),' ') words,
           regexp_split_to_array(app_private.management_search_normalize(p_query),' ') needles
  ), matches(step,used,score) as (
    select 1,'{}'::integer[],0
    union all
    select m.step+1,m.used||w.ordinality::integer,m.score+case when w.word=t.needles[m.step] then 0 else 1 end
    from matches m cross join tokens t
      cross join lateral unnest(t.words) with ordinality w(word,ordinality)
    where m.step<=cardinality(t.needles) and not w.ordinality::integer=any(m.used)
      and starts_with(w.word,t.needles[m.step])
  )
  select case when btrim(coalesce(p_query,''))='' then 0 when app_private.management_search_normalize(p_query)='' then null
    else (select min(score) from matches,tokens where step>cardinality(needles)) end
$$;
revoke all on function app_private.management_search_normalize(text),app_private.management_name_score(text,text) from public,anon,authenticated;

create function public.management_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  return jsonb_build_object(
    'members',(select count(*) from public.people where archived_at is null and removed_at is null),
    'formerMembers',(select count(*) from public.people where archived_at is not null and removed_at is null),
    'groups',(select count(*) from public.deacon_groups where archived_at is null),
    'pendingAccounts',case when app_private.admin() then (select count(*) from public.profiles where status='pending') else null end
  );
end $$;

create function public.management_page(p_resource text,p_query text default '',p_filters jsonb default '{}',p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; page_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); page_offset integer:=greatest(0,coalesce(p_offset,0));
  search text:=left(btrim(coalesce(p_query,'')),120); selected uuid[];
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_resource='accounts' then
    if not app_private.admin() then raise exception 'Not authorized'; end if;
    with filtered as materialized (
      select p.id,p.person_id as "personId",p.display_name as name,coalesce(u.email,'') as email,p.status,p.role,p.revision,p.created_at as "createdAt",p.last_seen_at as "lastSeenAt"
      from public.profiles p join auth.users u on u.id=p.id
      where (coalesce(p_filters->>'status','all')='all' or p.status::text=p_filters->>'status')
        and (not p_filters ? 'id' or p.id=(p_filters->>'id')::uuid)
        and (search='' or position(lower(search) in lower(p.display_name||' '||coalesce(u.email,'')))>0)
    ), page as (
      select * from filtered order by case status when 'pending' then 0 when 'active' then 1 when 'denied' then 2 else 3 end,
        case when status='pending' then "createdAt" end desc nulls last,lower(name),id limit page_limit offset page_offset
    ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered),'offset',page_offset,'limit',page_limit) into result;
  elsif p_resource='groups' then
    with filtered as materialized (
      select g.id,g.name,g.kind,g.revision,
        case when g.kind='membership' then (select count(*) from public.people p where p.membership_group_id=g.id and p.archived_at is null and p.removed_at is null)
          else (select count(*) from public.deacon_group_members m join public.people p on p.id=m.person_id where m.group_id=g.id and p.archived_at is null and p.removed_at is null) end as "memberCount",
        (select count(*) from public.deacon_group_deacons d join public.people leader on leader.id=d.person_id where d.group_id=g.id and leader.archived_at is null and leader.removed_at is null) as "deaconCount"
      from public.deacon_groups g where g.archived_at is null
        and (search='' or position(lower(search) in lower(g.name))>0)
        and (coalesce(p_filters->>'kind','all')='all' or g.kind=p_filters->>'kind')
    ), page as (select * from filtered order by lower(name),id limit page_limit offset page_offset)
    select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from filtered),'offset',page_offset,'limit',page_limit) into result;
  elsif p_resource in ('members','candidates') then
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into selected from jsonb_array_elements_text(coalesce(p_filters->'selectedIds','[]'));
    with filtered as materialized (
      select p.id,p.name,p.first_name,p.last_name,p.patronymic,p.revision,p.phone,p.email,p.photo_path as "photoPath",
        p.archived_at is not null as archived,coalesce(d.date_left::text,p.archived_at::text) as "leftAt",coalesce(g.name,'') as "group",
        p.membership_group_id as "currentMembershipGroupId",g.name as "currentMembershipGroupName",r.group_id as "currentResponsibilityGroupId",rg.name as "currentResponsibilityGroupName",
        a.group_id as "currentDeaconGroupId",ag.name as "currentDeaconGroupName",priv.birth_date::text as "birthDate",
        app_private.management_name_score(concat_ws(' ',p.first_name,p.last_name,p.patronymic),search) as score
      from public.people p left join public.deacon_groups g on g.id=p.membership_group_id
        left join public.deacon_group_members r on r.person_id=p.id left join public.deacon_groups rg on rg.id=r.group_id
        left join public.deacon_group_deacons a on a.person_id=p.id left join public.deacon_groups ag on ag.id=a.group_id
        left join public.people_private priv on priv.person_id=p.id and p_resource='candidates'
        left join lateral (select date_left from public.member_departures dep where dep.person_id=p.id and dep.restored_at is null order by created_at desc,id limit 1) d on true
      where p.removed_at is null and (p.archived_at is not null)=coalesce((p_filters->>'archived')::boolean,false)
        and (not coalesce((p_filters->>'selectedOnly')::boolean,false) or p.id=any(selected))
        and (not coalesce((p_filters->>'deacons')::boolean,false) or app_private.person_leadership(p.id)='deacon')
        and (not coalesce((p_filters->>'linkable')::boolean,false) or not exists(select 1 from public.profiles linked where linked.person_id=p.id and linked.id is distinct from (p_filters->>'accountId')::uuid))
        and (not p_filters ? 'id' or p.id=(p_filters->>'id')::uuid)
    ), matching as materialized (
      select * from filtered where search='' or score is not null
        or (p_resource='members' and (position(lower(search) in lower(coalesce(email,'')))>0 or position(lower(search) in lower(coalesce(phone,'')))>0 or position(lower(search) in lower("group"))>0))
    ), page as (select * from matching order by score nulls last,lower(last_name),lower(first_name),lower(coalesce(patronymic,'')),id limit page_limit offset page_offset)
    select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)-'score') from page),'[]'::jsonb),'total',(select count(*) from matching),'offset',page_offset,'limit',page_limit) into result;
  else raise exception 'Unknown management resource'; end if;
  return result;
end $$;

create function public.management_group_context(p_group_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_group_id is null then return jsonb_build_object('group',null); end if;
  select jsonb_build_object('group',jsonb_build_object('id',g.id,'name',g.name,'kind',g.kind,'revision',g.revision,'archived',false,
    'memberIds',case when g.kind='membership' then coalesce((select jsonb_agg(p.id order by p.id) from public.people p where p.membership_group_id=g.id and p.archived_at is null and p.removed_at is null),'[]'::jsonb)
      else coalesce((select jsonb_agg(m.person_id order by m.person_id) from public.deacon_group_members m join public.people p on p.id=m.person_id where m.group_id=g.id and p.archived_at is null and p.removed_at is null),'[]'::jsonb) end,
    'deaconIds',coalesce((select jsonb_agg(d.person_id order by d.slot) from public.deacon_group_deacons d join public.people leader on leader.id=d.person_id where d.group_id=g.id and leader.archived_at is null and leader.removed_at is null),'[]'::jsonb)))
    into result from public.deacon_groups g where g.id=p_group_id and g.archived_at is null;
  return coalesce(result,jsonb_build_object('group',null));
end $$;

-- Read all draft IDs for the confirmation, independently of the visible candidate page.
-- Existing atomic save_group remains authoritative for permissions and revisions.
create function public.management_group_move_preview(p_group_id uuid,p_kind text,p_member_ids uuid[],p_deacon_ids uuid[])
returns integer language plpgsql stable security definer set search_path='' as $$
declare result integer;
begin
  if not app_private.editor() then raise exception 'Not authorized'; end if;
  if p_kind not in ('membership','responsibility') then raise exception 'Unknown group type'; end if;
  select count(*)::integer into result from public.people p where p.id=any(coalesce(p_member_ids,'{}'::uuid[]))
    and not p.id=any(coalesce(p_deacon_ids,'{}'::uuid[]))
    and case when p_kind='membership' then p.membership_group_id is not null and p.membership_group_id is distinct from p_group_id
      else exists(select 1 from public.deacon_group_members m where m.person_id=p.id and m.group_id is distinct from p_group_id) end;
  return result+(select count(*)::integer from public.deacon_group_deacons d where d.person_id=any(coalesce(p_deacon_ids,'{}'::uuid[])) and d.group_id is distinct from p_group_id);
end $$;

revoke all on function public.management_summary(),public.management_page(text,text,jsonb,integer,integer),public.management_group_context(uuid),public.management_group_move_preview(uuid,text,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.management_summary(),public.management_page(text,text,jsonb,integer,integer),public.management_group_context(uuid),public.management_group_move_preview(uuid,text,uuid[],uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
