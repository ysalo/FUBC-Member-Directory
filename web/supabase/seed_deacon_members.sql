-- Optional demo member linking, not a migration. Replace the two email placeholders.
-- Creates no Auth accounts. Existing non-demo links/assignments are never overwritten.
begin;
set local demo.first_email = 'FIRST_DEACON_EMAIL';
set local demo.second_email = 'SECOND_DEACON_EMAIL';
do $$
declare
  account public.profiles; member_id uuid; n integer; first_id uuid; second_id uuid;
  member_group uuid := '60000000-0000-4000-8000-000000000002';
  demo_note text := 'Test member profile for demo deacon. Phone is fictional.';
begin
  perform pg_advisory_xact_lock(20260915, 1);
  select id into strict first_id from public.profiles where lower(email)=lower(current_setting('demo.first_email'))
    and status='active' and 'deacon'=any(ministry_roles);
  select id into strict second_id from public.profiles where lower(email)=lower(current_setting('demo.second_email'))
    and status='active' and 'deacon'=any(ministry_roles);
  if first_id=second_id then raise exception 'Choose two distinct active deacons'; end if;
  if exists(select 1 from public.deacon_groups where id=member_group and name <> 'Демонстраційна група 2') then
    raise exception 'Reserved group ID belongs to another group';
  end if;
  insert into public.deacon_groups(id,name) values(member_group,'Демонстраційна група 2') on conflict(id) do nothing;
  for n in 1..2 loop
    select * into strict account from public.profiles where id=case when n=1 then first_id else second_id end for update;
    member_id := ('50000000-0000-4000-8000-' || lpad((20+n)::text,12,'0'))::uuid;
    if account.person_id is not null and account.person_id <> member_id then
      raise exception 'Account already linked to another member; no changes made';
    end if;
    if exists(select 1 from public.people where id=member_id and (notes is distinct from demo_note or archived_at is not null)) then
      raise exception 'Reserved member ID belongs to another or archived record';
    end if;
    if exists(select 1 from public.profiles where person_id=member_id and id<>account.id) then
      raise exception 'Demo member belongs to another account';
    end if;
    if exists(select 1 from public.deacon_group_members where person_id=member_id and group_id<>member_group) then
      raise exception 'Member already belongs to another group; no transfers made';
    end if;
    insert into public.people(id,first_name,last_name,phone,notes)
      values(member_id,
        split_part(coalesce(nullif(trim(account.display_name),''),'Demo Deacon'), ' ', 1),
        coalesce(nullif(trim(substr(coalesce(nullif(trim(account.display_name),''),'Demo Deacon'),
          length(split_part(coalesce(nullif(trim(account.display_name),''),'Demo Deacon'),' ',1))+1)),''),'Deacon'),
        case when n=1 then '(253) 555-0121' else '(253) 555-0122' end, demo_note)
      on conflict(id) do nothing;
    update public.profiles set person_id=member_id, updated_at=now() where id=account.id;
    insert into public.deacon_group_members(person_id,group_id) values(member_id,member_group) on conflict(person_id) do nothing;
    insert into public.audit_events(actor_id,event_type,entity_type,entity_id,metadata)
      values(auth.uid(),'demo.deacon_member_linked','profile',account.id::text,
        jsonb_build_object('person_id',member_id,'membership_group_id',member_group));
  end loop;
end
$$;
commit;
select g.name, count(p.id) as members from public.deacon_groups g
left join public.deacon_group_members m on m.group_id=g.id
left join public.people p on p.id=m.person_id and p.archived_at is null
where g.id in ('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002')
group by g.id,g.name order by g.name;
