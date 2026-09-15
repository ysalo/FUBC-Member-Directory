# Deacon Groups

## Rollout

Run the entire `web/supabase/migrations/20260915010000_deacon_groups.sql` in Supabase SQL Editor before deploying this application version. It is additive and preserves members/accounts. Do not rerun the clean baseline on the live project. Confirm the `profiles.ministry_roles` column and the three `deacon_group_*` tables exist, then deploy through GitHub/Vercel.

The updated clean baseline includes this schema for fresh test databases. Do not apply the additive Deacon Groups migration again after using that baseline. Optionally configure `CHURCH_TIMEZONE` in Vercel; its default is `America/Los_Angeles`. No OAuth redirect changes are needed.

## Operating the groups

For an optional 20-person demo, run `web/supabase/seed_deacon_group.sql` in SQL Editor after replacing its two email placeholders with existing active accounts. It creates fictional Ukrainian-named directory people with placeholder photos and some upcoming birthdays, adds deacon designation without changing access roles/statuses, and assigns both accounts to one demo group. It does not create Auth identities. Repeating the script does not duplicate records; it refuses to overwrite conflicting records or transfer members moved to another group. Do not commit actual account emails into the template.

Administrators designate deacons from Manage → Account Requests. This is independent of member/editor/admin permissions: a deacon may also be an editor. Linking the account to a directory person remains optional.

Editors and administrators use Manage → Deacon Groups to create and name groups, select up to two deacons, and assign members. Groups can remain incomplete during setup; twenty members is guidance, not a limit. Each member belongs to at most one group, and a deacon belongs to at most one group. Transfers/removals require confirmation. Stale transfers fail instead of overwriting a newer assignment; refresh and retry.

Revoked deacons retain their assignments, marked inactive, but lose access immediately. Replace them through group management. Removing deacon designation removes that account's assignments atomically. Delete groups only after removing all assignments. Archived people disappear from deacon lists/birthdays but remain available to managers for removal or restoration.

## Navigation and member experience

Bottom tabs provide Directory, My Group for deacons, Manage for editors/admins, and Settings (hamburger icon). Settings contains language, text size, and sign-out. Navigation is hidden on member profiles/photo viewers. Returning from a profile restores the originating list's search, filters, view, and scroll position.

My Group shows the signed-in deacon's single group and their fellow deacon's contact information. Members is the default view; Birthdays is a separate selectable view for the next 30 days. The total member count is centered at the bottom, not in the group heading. Deacons retain full-directory access but do not gain editing privileges merely through designation. Labels support English and Ukrainian.

Members have nullable marital status (`single`, `married`, `widowed`) and an independent `is_orphan` flag. Existing records remain unknown/not orphan unless edited explicitly. Only Widowed and Orphan appear as list badges. A filter icon beside Search in Directory and My Group opens checkbox filters; selecting both matches either badge, and the text query is applied as well. The icon shows the number of selected filters; Clear filters resets the selection. Member profiles emphasize calculated age, with birth date underneath, plus marital status, badges, and assigned group (or Unassigned). Age uses the server-supplied church date, with February 29 observed on February 28 in non-leap years.

`web/supabase/seed_member_statuses.sql` is an optional, repeatable demo update, not a migration. It changes only the 20 reserved IDs with the fictional-record note: eight married, eight single, four widowed, and four independent orphan flags (one also widowed). No real directory people or Auth accounts are changed.

Apply `web/supabase/migrations/20260915020000_member_status_and_single_group.sql` before deploying these changes. It adds the fields, enforces one group per deacon, and updates minimal-information RPCs. It fails without changes if a deacon already has multiple assignments; resolve those through group management first. Do not rerun the destructive clean baseline on the live demo.

`list_group_deacons` exposes active deacons' email and linked, non-archived member phone only to readers authorized for that group. Link a deacon account to their member record through account administration to provide a phone number; otherwise email is available. Inactive deacons' contacts are omitted. `list_member_groups` exposes only non-archived members' assigned group names to approved directory readers, not group rosters or account identities. Full-profile RLS remains unchanged.

## Architecture and security

- `profiles.ministry_roles`: empty array or `deacon`; pastor capabilities are deferred.
- `deacon_groups`: UUID, name, and timestamps.
- `deacon_group_members`: one row per directory person, linked to a group.
- `deacon_group_deacons`: two database-enforced slots per group, linked to login profiles.
- Editor/admin RPCs: `save_deacon_group`, `assign_deacon_group_member`, `delete_deacon_group`.
- Admin-only `review_account_ministry` combines account review and designation, preserving existing administrator safeguards.

RLS permits editors/admins to inspect all groups and active deacons to inspect their own groups. Clients receive no direct assignment-write grants. Minimal identity RPCs provide group labels and eligible deacon names without revealing full profiles to editors or other deacons.

Application assignment/review RPCs share a transaction advisory lock. Primary keys, uniqueness, and fixed slots enforce assignment limits. Changes and audit events commit together; audit failure rolls back mutations. Calls use the signed-in session and publishable key, never a service-role key.

## Birthday foundation

Birthdays use known dates of birth for active people in assigned groups. The window includes today and the next 29 days, crosses year boundaries, and observes February 29 on February 28 in non-leap years. Dates follow the configured church timezone. Reload/navigation refreshes the server-supplied current date.

No notification jobs, push subscriptions, delivery credentials, care notes, contact history, or pastor-specific screens exist yet. Future delivery should resolve currently active designated deacons from current group assignments, not copied recipient IDs on member records. Consent, channels, timing, deduplication, and retries belong to that future phase.

## Verification

Run TypeScript, lint, production build, `pnpm test:groups`, `pnpm test:unit`, and Playwright tests. On a slow local filesystem, set `PLAYWRIGHT_USE_BUILD=1` after building to run Playwright against the production server instead of waiting for development compilation. The group database suite runs PostgreSQL in memory without touching Supabase: it checks upgrade/clean baseline, RLS, RPC permissions, transfers, designation removal, revoked access, slot limits, and atomic audit rollback.

After migration, manually check with two deacons, an editor, a regular member, and a revoked account. Verify profile return, keyboard behavior, tabs/safe areas, and no overflow at 320, 375, 390, and larger widths in Safari. Multi-session contention and real-device Safari checks remain deployment acceptance steps; the in-memory suite does not simulate multiple database sessions.
