# Native app backend

This is an **empty-database baseline**, followed by newly written native migrations.
Do not run it on the prototype database. No hosted database has been changed.

The baseline consolidates application-owned definitions from prototype commit
`4d158ca3b33cf18024f45ab9300f48be183eee56`. The committed schema, rather than the
uncommitted damaged ministry SQL, was used. Each table is defined once and each
routine uses its final definition. Historical resets, backfills, user records,
migration history and old tests were excluded. Live schema parity is unverified;
an authorized staging audit must compare tables, policies, routines, triggers,
grants, private storage and scheduled jobs before accepting a production baseline.

## Test locally

From `tools/backend`, run `pnpm install --frozen-lockfile`, then `pnpm test`.
The freshly authored tests execute migrations in PGlite PostgreSQL, with minimal
Auth/Storage platform fixtures. They check RLS, privileges, revision conflicts,
visit privacy, account boundaries and owner-specific native features. They do not
exercise Supabase Auth HTTP endpoints, Storage uploads, APNs or Apple identity.
These require an isolated real Supabase staging project and signed device build.
The notification worker has its own independently authored tests in `worker`.

With Docker and the Supabase CLI installed, run `supabase start` and
`supabase db reset` **only against the disposable local stack**. Seed is disabled.
The local config contains no credentials. Native sign-in must use the deployed
project URL/publishable key and configured provider audiences. Never embed a
service-role key in the application. Bootstrap the first admin through an
authorized database console after signing in: set that known profile's status
to `active` and role to `admin`. Do not approve users by an email substring.

## API contracts

Existing directory/group/account/visit tables and RPC names are retained as
schema, with member validation and audit triggers added. All callers require an
authenticated session; protected rows additionally require an active profile.
Ministry designation is separate from the member/editor/admin role. Admins and
editors have no implicit visit access. Only a visit's pastor and its assigned
deacons may read it. Archived visits are marked completed, and six-hour automatic
completion/archive semantics are preserved. Time instants remain unchanged; the
app must retain fixed UTC−07 display until the proposed timezone change is approved.

New native contracts:

| Operation | Contract |
| --- | --- |
| Favorites | Select `favorites(owner_id,person_id,created_at)`; `set_favorite(target_person uuid,is_favorite boolean)` |
| Reminder list | Select `personal_reminders(id,owner_id,person_id,title,due_at,completed_at,revision,created_at,updated_at)` |
| Save reminder | `save_reminder(target uuid,expected_revision integer,target_person uuid,reminder_title text,reminder_due_at timestamptz)` returns UUID; null target creates |
| Complete reminder | `complete_reminder(target uuid,expected_revision integer,is_completed boolean)` |
| Delete reminder | `delete_reminder(target uuid,expected_revision integer)` |
| Preferences | Select/upsert `account_preferences` with own `owner_id`; `language` en/uk, `appearance` system/light/dark, boolean `visit_notifications`, `birthday_notifications`, `reminder_notifications` |
| Register device | `register_push_device(installation uuid,device_token text,apns_environment text)`; environment sandbox/production, hex token |
| Unregister | `unregister_push_device(installation uuid)`; remove before sign-out, including revoked users |
| Deletion intake | `request_account_deletion()` returns UUID; select own `account_deletion_requests`; this **does not delete the account** |
| Initial Apple name | `set_initial_display_name(display_name text)` fills only the caller's blank/email fallback name; supports pending accounts and never overwrites a chosen name |

Tokens are never client-readable and one account cannot transfer another
account's device registration. Use a fresh installation UUID for each account
association and unregister before switching accounts. Reminder edits/completion
increment revision; stale revisions fail instead of overwriting another device.
Use returned `updated_at` after member writes for the next optimistic edit.

## Release blockers and remaining backend work

- Verify live schema parity; resolve sensitive-field visibility and retention with
  church owners. The baseline preserves prototype active-member field visibility,
  including notes and full dates. Do not expose it to real members before review.
- Configure and integration-test the worker in `worker` with APNs credentials on
  real development and TestFlight devices. The new per-device `notification_jobs`
  outbox adds transactional visit events, revision checks, private generic
  payloads, leases, retry limits, invalid-token handling and server-scheduled due
  reminders/birthdays. Embedded tests cannot establish actual APNs dispatch.
- Implement actual account deletion and Apple token revocation. Intake persists
  a request only. Existing visit foreign keys block deleting linked identities;
  an approved retention/anonymization transaction must resolve that deliberately.
  Test interrupted deletion and retries. This remains an App Store release blocker.
- Validate private Storage upload policy, image processing and orphan cleanup;
  verify OAuth/Apple private relay, scheduler and backup/restore on real staging.
- Restore tests must include cloud platform integration; embedded tests are not
  proof of hosted compatibility, multi-connection races or operational recovery.

`operations.sql` records the lifecycle scheduler setup separately from schema.
No migration installs a secret, APNs worker, provider configuration or production
job implicitly. Newly generated test records use `example.invalid` identities.

## Notification worker contract

Only `service_role` may call `queue_due_notifications()`,
`claim_notification_jobs(batch_size integer)`,
`revalidate_notification_job(target uuid,lease uuid)` and
`finish_notification_job(target uuid,lease uuid,outcome text,failure_reason text)`.
Never expose the service credential to the native app. Each claim returns one
installation with `job_id`, `lease_token`, `kind`, `entity_id`, `revision`,
`installation_id`, `device_token`, `apns_environment` and a generic `payload`.
The payload includes current preference `language` (`en`/`uk`); it contains no
member names, reminder titles, addresses, dates of birth or visit notes.

Claims expire after five minutes. Revalidate immediately before each send;
revoked accounts, switched ministries, completed/rescheduled reminders, stale
visits, disabled preferences, or changed device associations stop delivery.
Finish with `dispatched`, `retry`, `discarded` or `invalid_token`; `dispatched`
means APNs accepted the request, never that the user read it. Retry delays start
at 60 seconds and double to a 3600-second cap; eight claims exhaust a job.
Expired leases can be reclaimed. Crash-after-send can cause a duplicate delivery:
the outbox provides at-least-once dispatch, not exactly-once device receipt.

Device rotation after claim invalidates that claim. An invalid-token response
only removes the originally claimed token, preserving a newer registration.
Every device has a separate deduplication key, so one failing installation does
not replay successful deliveries to others. Unregistering cascades that device's
queue rows. Revocation prevents future fetches and drops pending sends; it cannot
recall a notification already handed to APNs.

Run the worker externally once per minute; it queues due reminders and birthdays
before claiming work. The only database cron tasks in `operations.sql` are the
preserved lifecycle jobs. Birthdays are queued from 09:00 America/Los_Angeles for the
deacon's responsibility group, once per day/device; Feb 29 is observed Feb 28 in
non-leap years as in the prototype. Date-only birthday values are not shifted.
Personal reminders are queued when due and remain subject to current revision,
completion and preference checks. Consent or delivery does not depend on the app
being in the foreground.
