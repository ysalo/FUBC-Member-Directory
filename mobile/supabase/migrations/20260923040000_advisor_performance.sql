begin;

set local lock_timeout='5s';
set local statement_timeout='60s';

alter policy own_profile_or_admin on public.profiles
  using(id=(select auth.uid()) or (select app_private.admin()));
alter policy favorite_owner on public.favorites
  using(account_id=(select auth.uid()) and (select app_private.active()))
  with check(account_id=(select auth.uid()) and (select app_private.active()));
alter policy reminder_owner on public.personal_reminders
  using(account_id=(select auth.uid()) and (select app_private.active()))
  with check(account_id=(select auth.uid()) and (select app_private.active()));
alter policy preferences_owner on public.preferences
  using(account_id=(select auth.uid()) and (select app_private.active()))
  with check(account_id=(select auth.uid()) and (select app_private.active()));
alter policy token_owner on public.device_tokens
  using(account_id=(select auth.uid()) and (select app_private.active()))
  with check(account_id=(select auth.uid()) and (select app_private.active()));
alter policy deletion_owner on public.account_deletion_requests
  using(account_id=(select auth.uid()));
alter policy birthday_preferences_owner on public.group_birthday_notification_preferences
  using(account_id=(select auth.uid()) and exists(
    select 1 from public.deacon_group_deacons assignment
    join public.profiles profile on profile.person_id=assignment.person_id
    where profile.id=(select auth.uid())
      and assignment.group_id=group_birthday_notification_preferences.group_id
  ));

create index audit_events_actor on public.audit_events(actor_id);
create index device_tokens_account on public.device_tokens(account_id);
create index favorites_person on public.favorites(person_id);
create index birthday_preferences_group on public.group_birthday_notification_preferences(group_id);
create index people_membership_group on public.people(membership_group_id);
create index person_ministries_ministry on public.person_ministries(ministry_id);
create index reminders_person on public.personal_reminders(person_id);
create index notification_events_account on public.visit_notification_events(account_id);
create index visits_person on public.visit_requests(person_id);

notify pgrst,'reload schema';
commit;