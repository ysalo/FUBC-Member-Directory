# Deacon Groups

## Rollout

Existing deployments apply additive migrations in filename order. The group-browser release requires `web/supabase/migrations/20260915030000_group_browser.sql` after the earlier group/member-status migrations, before deploying the UI. It preserves members/accounts. Do not rerun the clean baseline on the live project.

The updated clean baseline includes this schema for fresh test databases. Do not apply the additive Deacon Groups migration again after using that baseline. Optionally configure `CHURCH_TIMEZONE` in Vercel; its default is `America/Los_Angeles`. No OAuth redirect changes are needed.

## Operating the groups

For an optional 20-person demo, run `web/supabase/seed_deacon_group.sql` in SQL Editor after replacing its two email placeholders with existing active accounts. It creates fictional Ukrainian-named directory people with placeholder photos and some upcoming birthdays, adds deacon designation without changing access roles/statuses, and assigns both accounts to one demo group. It does not create Auth identities. Repeating the script does not duplicate records; it refuses to overwrite conflicting records or transfer members moved to another group. Do not commit actual account emails into the template.

Administrators designate deacons from Manage → Account Requests. This is independent of member/editor/admin permissions: a deacon may also be an editor. Linking the account to a directory person remains optional.

Editors and administrators use Manage → Deacon Groups to create and name groups, select up to two deacons, and assign members. Groups can remain incomplete during setup; twenty members is guidance, not a limit. Each member belongs to at most one membership group; each designated deacon leads at most one responsibility group. These are independent relationships and may reference different groups. Transfers/removals require confirmation. Stale transfers fail instead of overwriting a newer assignment; refresh and retry.

Revoked deacons retain their assignments, marked inactive, but lose access immediately. Replace them through group management. Removing deacon designation removes that account's assignments atomically. Delete groups only after removing all assignments. Archived people disappear from deacon lists/birthdays but remain available to managers for removal or restoration.

## Navigation and member experience

Bottom tabs provide Directory, Groups for all active approved accounts, Manage for editors/admins, and Settings (hamburger icon). Settings contains language, text size, and sign-out. Navigation is hidden on member profiles/photo viewers. Returning from a profile restores the originating list's search, filters, view, and scroll position.

`/groups` lists all groups alphabetically with responsible deacons. Deacons see a prominent, full-width Group I lead card with the group name and Open group action, separated from Other groups without duplicating that group in the list. `/groups/[id]` shows both deacons and the searchable, surname-grouped roster. Tap an active deacon to open their linked member profile, whose Member of group field refers to membership, not responsibility. Missing links open a minimal name/contact fallback; missing phones show Not provided, never email. Inactive deacons are labeled and not tappable; unassigned slots are shown. Birthdays is available only for the viewing deacon's own responsibility group. The Members/Birthdays switch sits beneath the group name and responsible deacons, followed by Search and the list; the group page uses one normal scroll region. The main directory keeps its fixed search row. The total non-archived roster count is centered at the bottom and unaffected by search/filter selection. Labels support English and Ukrainian.

`web/supabase/seed_deacon_members.sql` creates two linked demo member records using existing profile display names and fictional phone numbers (253) 555-0121/0122. Other optional personal fields remain unspecified. These two members belong to a separate second demo group with unassigned deacon slots; their responsibility group keeps its original twenty members. The seed is transactional, repeatable, audited, and rejects conflicting links/assignments. Replace email placeholders privately; do not commit actual account emails. It creates no Auth accounts and changes no access roles or ministry designations.

Members have nullable marital status (`single`, `married`, `widowed`) and an independent `is_orphan` flag. Existing records remain unknown/not orphan unless edited explicitly. Only Widowed and Orphan appear as list badges. A filter icon beside Search in Directory and My Group opens checkbox filters; selecting both matches either badge, and the text query is applied as well. The icon shows the number of selected filters; Clear filters resets the selection. Member profiles emphasize calculated age, with birth date underneath, plus marital status, badges, and assigned group (or Unassigned). Age uses the server-supplied church date, with February 29 observed on February 28 in non-leap years.

`web/supabase/seed_member_statuses.sql` is an optional, repeatable demo update, not a migration. It changes only the 20 reserved IDs with the fictional-record note: eight married, eight single, four widowed, and four independent orphan flags (one also widowed). No real directory people or Auth accounts are changed.

Apply `web/supabase/migrations/20260915020000_member_status_and_single_group.sql` before deploying these changes. It adds the fields, enforces one group per deacon, and updates minimal-information RPCs. It fails without changes if a deacon already has multiple assignments; resolve those through group management first. Do not rerun the destructive clean baseline on the live demo.

`list_group_deacons` returns group ID, profile ID, display name, account status, active linked member ID, and phone; no email is returned. Inactive/archived member links and contacts are omitted. `list_member_groups` returns non-archived members' assigned group names to approved directory readers. Full-account-profile RLS remains unchanged.

## Architecture and security

- `profiles.ministry_roles`: empty array or `deacon`; pastor capabilities are deferred.
- `deacon_groups`: UUID, name, and timestamps.
- `deacon_group_members`: one row per directory person, linked to a group.
- `deacon_group_deacons`: two database-enforced slots per group, linked to login profiles.
- Editor/admin RPCs: `save_deacon_group`, `assign_deacon_group_member`, `delete_deacon_group`.
- Admin-only `review_account_ministry` combines account review and designation, preserving existing administrator safeguards.

RLS permits all active approved accounts to inspect groups, responsibility assignments, and rosters. Pending, denied, and revoked sessions cannot read them. Clients receive no direct assignment-write grants. Eligible-deacon listing and editing remain editor/admin-only; public group browsing does not grant full-account-profile access.

Application assignment/review RPCs share a transaction advisory lock. Primary keys, uniqueness, and fixed slots enforce assignment limits. Changes and audit events commit together; audit failure rolls back mutations. Calls use the signed-in session and publishable key, never a service-role key.

## Birthday foundation

Birthdays use known dates of birth for active people in assigned groups. The window includes today and the next 29 days, crosses year boundaries, and observes February 29 on February 28 in non-leap years. Dates follow the configured church timezone. Reload/navigation refreshes the server-supplied current date.

No notification jobs, push subscriptions, delivery credentials, care notes, contact history, or pastor-specific screens exist yet. Future delivery should resolve currently active designated deacons from current group assignments, not copied recipient IDs on member records. Consent, channels, timing, deduplication, and retries belong to that future phase.

## Verification

Run TypeScript, lint, production build, `pnpm test:groups`, `pnpm test:unit`, and Playwright tests. On a slow local filesystem, set `PLAYWRIGHT_USE_BUILD=1` after building to run Playwright against the production server instead of waiting for development compilation. The group database suite runs PostgreSQL in memory without touching Supabase: it checks upgrade/clean baseline, RLS, RPC permissions, transfers, designation removal, revoked access, slot limits, and atomic audit rollback.

After migration, manually check with two deacons, an editor, a regular member, and a revoked account. Verify profile return, keyboard behavior, tabs/safe areas, and no overflow at 320, 375, 390, and larger widths in Safari. Multi-session contention and real-device Safari checks remain deployment acceptance steps; the in-memory suite does not simulate multiple database sessions.
