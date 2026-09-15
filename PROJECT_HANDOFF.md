# Private Member Directory — Project Handoff

## Purpose

Visitation UI cleanup: red pending-request badge on the Visitation tab, grouped meeting details and response pills, clearer Accept/Decline and pastor management actions, and optional decline-reason disclosure. Only the meeting location is shown; member addresses still prefill new requests. All visitation input/display now uses fixed PDT (UTC−07:00) year-round without a timezone label; persisted timestamps and church birthday timezone behavior remain unchanged. No database migration is needed. Badge queries retrieve protected counts only and refresh on visible-page intervals, navigation, focus, and mutations.

Visitation implemented locally: pastors can request visits from directory/group member profiles, edit time/location/notes, cancel, and complete. Selected deacons independently accept/decline and can change responses; edits preserve decisions and indicate unseen revisions. Supabase RPCs/RLS enforce participant-only access and atomically queue pending notification events for creation/updates. No phone notification worker. Additive `20260915060000_visitation.sql` was applied live on September 15, 2026 with explicit user authorization; verified 34 members preserved, three RLS-protected tables, save RPC, and no client access to notification queue. UI deploys through the connected Vercel project on pushes to main. The requested account is verified active with pastor designation and linked to the fictional member Максим Савчук; its access role remains member. The link was applied through a guarded, audited SQL transaction after user confirmation. See `docs/VISITATION.md` for operation, tests, and remaining real-device/live integration checks.

Birthday notification prototype: assigned active deacons see an accessible on/off switch above the list in their group's Birthdays view. Preference is stored on this device, separately for each account/group. A question-mark disclosure explains birthday reminders and accurately notes that delivery is not enabled; no demo label or persistent explanation appears in the row. No browser notification permission, push delivery, service worker, scheduler, database migration, or private member caching is added. Expo native UI skill guidance informed the contextual switch row, touch size, labels, and dark-mode styling; the app remains Next.js, not Expo.

Linked deacon details fix: group labels and admin deacon selectors read the linked active member's name, not the stale Google display name. Phone remains read from the member record. Member edits invalidate the Groups listing and all group detail routes, admin group selectors, and account member selectors. `web/supabase/migrations/20260915050000_linked_deacon_details.sql` was applied successfully to the live Supabase project on September 15, 2026 with explicit user approval. Live assertions confirmed group and picker names/phones match linked member records. No member/account data reset or name copying is needed. Regression checks cover linked member name/phone edits and prevent exposing linked details for revoked accounts.

Ministry badges: member names display localized Deacon/Pastor badges in directory, group rosters, birthdays, and profile headers, based on active linked account designations. Admin approval forms allow both independent ministry roles. `web/supabase/migrations/20260915040000_ministry_badges.sql` was applied successfully to the live Supabase project on September 15, 2026 with explicit user approval. Approved readers get only member IDs and ministry roles through a secured RPC, never other profiles' private account fields. TypeScript, production build, database upgrade/baseline/security tests passed; lint reports only the three existing image warnings.

Appearance and Groups UI update: Settings offers System/Light/Dark, persisted on this device and applied before page paint. System mode follows OS changes. Groups shows a prominent My Group heading and large linked group card without redundant Open group text; other groups have a localized name search that does not hide the led group. No database migration. Expo/SwiftUI skills were not available; changes use the existing responsive Next.js UI.

Directory follow-up release: profiles link membership group names to `/groups/[id]`, Members/Birthdays tabs have people/cake icons, and the directory and group detail pages show total/orphan/widowed counters. Counts use the full active roster, independent of search/badge filters; group counts exclude deacons who belong elsewhere. English and Ukrainian labels are included. No database migration is required. Production webpack build, TypeScript, targeted lint (existing image warnings only), and group database/security suite passed before publishing.

Stock portrait update (September 15, 2026): all 34 current live directory members received name-matched male/female placeholder portraits through the authenticated admin editor. Images were uploaded to private Supabase Storage; no deployment or SQL execution was needed for the live update. Verified all 34 directory images loaded from signed private Storage URLs and the admin member list remained unchanged. Bundled assets and updated seeds cover the 32 Ukrainian-named fictional members; the two linked demo deacon members use women-14 (Alina) and men-13 (Yaroslav). `web/supabase/seed_stock_portraits.sql` is an optional repeatable seed update, not a migration and was not applied live.

Group-browser release implemented: Groups is available to all active approved accounts, with a Group I lead shortcut for deacons and `/groups/[id]` rosters/deacon member profiles. `web/supabase/migrations/20260915030000_group_browser.sql` was applied successfully to the live demo on September 15, 2026 after explicit user confirmation. The UI is ready for deployment. `web/supabase/seed_deacon_members.sql` was applied to the live demo on September 15, 2026: both confirmed deacon accounts are linked to member records with fictional 555 phones; they remain responsible for the 20-member original group but belong to a separate two-member group with no assigned deacons. No new Auth accounts or access-role changes were made.

Follow-up release: badge filters now open from a filter icon beside Search (multi-select, matching either badge), and profiles emphasize age above the birth date. Live fictional demo members were updated using `web/supabase/seed_member_statuses.sql`: eight married, eight single, four widowed, four orphan flags. Real members/accounts were untouched.

Latest release: member marital status and orphan badges/filters, singular My Group, separate Birthdays view, fellow-deacon contacts, profile age/group, and hamburger Settings. The user confirmed `web/supabase/migrations/20260915020000_member_status_and_single_group.sql` succeeded on September 15, 2026. See `docs/DEACON_GROUPS.md` for the access model and phone-linking requirement.

Private directory for roughly 800 members. Approved accounts can search and view member data; editors manage member records; administrators will manage access and roles. The current focus is the web application, with a future SwiftUI client planned against the same Supabase backend.

## Local workspace

- Project root: `D:\church_directory`
- Web application: `D:\church_directory\web`
- Start locally: `cd D:\church_directory\web; pnpm dev`
- Verification: `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test:e2e`

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- pnpm
- Supabase: Auth, PostgreSQL, private Storage bucket, Row Level Security
- Node.js 24 LTS

## Supabase configuration

- Project URL and publishable key belong only in `web\.env.local`; never commit this file.
- Fresh test databases can use the clean baseline migration: `web\supabase\migrations\20260914130000_initial_schema.sql`. Existing deployments should apply subsequent additive migrations in filename order.
- Enable Google in Supabase Auth and allow `/auth/callback` for localhost and the deployed origin.
- Apple support is controlled by `NEXT_PUBLIC_ENABLE_APPLE_AUTH` and remains disabled until provider credentials exist.
- The first admin must be an Auth user whose `public.profiles` record has `role = 'admin'` and `status = 'active'`.

## Implemented

- Google OAuth sign-in and session refresh via `@supabase/ssr`; optional Apple OAuth is feature-flagged.
- New identities enter a pending state and receive no directory access until approved.
- Admin account portal supports approval, denial, revocation, restoration, role assignment, and optional member linking.
- Account decisions are written atomically with audit events by a protected database RPC.
- Approved-account-only directory, backed by the `people` table.
- Directory people store name, date of birth, membership join date, phone, and English postal address.
- Search across name, date of birth, phone, and address.
- Profile view with arrow-only back navigation.
- Uploaded profile photos fill the profile photo area and open in a full-screen viewer when clicked.
- Editor/admin portal can add member records and upload JPG/PNG/WebP photos up to 4 MB.
- Editors/admins can edit and archive/restore member records, replace photos safely, or remove a photo.
- Photos are private; the server creates time-limited signed URLs for approved users.
- The repeatable seed contains twelve fictional Ukrainian-named members with English addresses and bundled placeholder photos.

## Important source files

- `web\src\app\page.tsx` — authenticated server-side directory fetch + signed photo URLs.
- `web\src\components\directory-client.tsx` — searchable directory and profile/full-screen photo UI.
- `web\src\app\admin\page.tsx` — editor/admin portal.
- `web\src\app\admin\actions.ts` — secured member/photo creation action.
- `web\src\app\login\page.tsx` — sign-in screen.
- `web\src\app\admin\accounts\page.tsx` — account approval and role-management portal.
- `web\src\app\auth\callback\route.ts` — secure OAuth PKCE callback.
- `web\proxy.ts` — redirects unauthenticated users to sign-in.

## Next priorities

Deacon Groups implementation: see `docs/DEACON_GROUPS.md`. Apply `web/supabase/migrations/20260915010000_deacon_groups.sql` before deploying the dependent UI. It adds separate deacon designation, editor/admin group management, My Groups/upcoming birthdays, and bottom navigation. Existing people/accounts are preserved. The updated clean baseline includes these additions for fresh projects; do not apply the additive group migration again after that baseline.

1. Apply `20260914210000_add_membership_joined_at.sql` to the deployed Supabase project before deploying the dependent application code.
2. Run the updated repeatable seed if Ukrainian fictional demo records are desired.
3. Complete a real iPhone Safari/add-to-home-screen test of the bilingual Contacts-style directory.
4. Add richer success/error states and authenticated end-to-end test fixtures.
5. Build the SwiftUI client once the web workflows are validated.

Visitation follow-up: response buttons show only the saved selection; meeting locations link to Google Maps. Pastors can create from Visitation with date/time then person and group deacons, and complete requests at any time. Migration 20260915181500_visitation_lifecycle.sql is applied live: exclusive pastor/deacon ministries (legacy dual profiles retain pastor) and database-only cron auto-completion six hours after visit time, checked every minute. Verification: zero dual profiles, one active named job, clients denied worker execution, 34 members preserved.
Visitation consistency pass: new/edit/details use shared circular member-page back links; forms constrain native date fields and fieldsets to mobile width; person picker supports inline search, scrollable results, no matches, Change, and retained date/time. The visitation list supports GET search over names, location, and localized status. No database changes.
