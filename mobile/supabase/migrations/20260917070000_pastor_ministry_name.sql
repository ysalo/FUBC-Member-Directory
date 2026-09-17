begin;
do $$
declare old_id uuid; canonical_id uuid;
begin
  select id into old_id from public.ministries where lower(trim(name))='pastoral care' order by archived_at nulls first limit 1;
  select id into canonical_id from public.ministries where lower(trim(name))='pastor' order by archived_at nulls first limit 1;
  if old_id is not null and canonical_id is not null and old_id<>canonical_id then
    insert into public.person_ministries(person_id,ministry_id) select person_id,canonical_id from public.person_ministries where ministry_id=old_id on conflict do nothing;
    delete from public.person_ministries where ministry_id=old_id;
    delete from public.ministries where id=old_id;
  elsif old_id is not null then
    update public.ministries set name='Pastor',name_uk='Пастор',revision=revision+1 where id=old_id;
    canonical_id:=old_id;
  end if;
  if canonical_id is not null then update public.ministries set name_uk='Пастор' where id=canonical_id and name_uk is distinct from 'Пастор'; end if;
end $$;
update public.people set ministry='Pastor',ministry_uk='Пастор',revision=revision+1
where lower(trim(ministry))='pastoral care' or lower(trim(ministry_uk))=lower('Пасторське служіння');
commit;
