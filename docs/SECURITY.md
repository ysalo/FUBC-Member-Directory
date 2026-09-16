# Security and environment operations

## Environments

Use separate staging and production Supabase projects and deliberate native configuration. Initialize staging from the new baseline with fictional fixtures. The initial baseline is for an empty project, not a repair script for a populated database. Existing hosted data is unchanged by creating this branch.

The local schema baseline must be compared with the actual hosted schema before any existing environment is adopted. Authentication provider settings, bucket options, extensions and scheduled jobs are environment configuration as well as SQL objects; record them during setup.

## Client and server boundary

The app may contain the Supabase URL and publishable key. It must not contain service-role keys, APNs private keys, Apple client secrets or developer signing material. Session credentials need secure device storage; user identity and backend authorization must be revalidated after session/role changes.

RLS and guarded SQL operations control member, group and visit access. Favorites and reminders belong to an individual account. Private visit notes are readable only by authorized participants. Hiding a screen is not access control.

Use private photo storage and bounded signed URL lifetimes. Clear protected caches when switching accounts or signing out. Do not intentionally persist a full directory offline in this release. Revocation blocks future access but cannot erase information a person already read or exported.

## Notifications

Payloads should identify a routable event without putting private addresses, birthdays, notes or reasons on the lock screen. The worker rechecks access before sending; the app rechecks before displaying a deep-linked record. Token rotation, logout, revocation, retries and duplicate events require explicit handling. APNs acceptance is not proof of reading or even display.

## Deletion and support

Deleting a login account is different from archiving a church membership record. Define the organization's data retention and removal policy before production. Account deletion must remove associated data according to that policy and handle provider token revocation where applicable. Do not return success before the operation succeeds. Logs should avoid names, contact details, private notes, tokens and credentials.

Support/privacy hosting must use a real church-controlled domain/contact before release. Draft content or unavailable URLs are not a completed support workflow. Report/correction requests require an operational owner and response process.

## Deployment and recovery

Git changes do not deploy database migrations or change Apple capabilities. Before a deployment, record the release commit, app build, schema version, configuration and backup/restore procedure. Test fresh installation and upgrades with new fixtures. Once native builds are distributed, preserve their API compatibility during rollout.

Keep one working administrator and test last-admin safeguards. Restrict worker execution to trusted credentials. Audit account/role/assignment decisions without copying private visit notes into audit records. Review both failure paths and successful paths when testing authorization.
