# Web Application Release and Deployment

The application uses Vercel's GitHub integration. GitHub Actions verifies code; it does not hold Vercel credentials or deploy the application.

## Supabase Advisor Hardening

Implemented on `feature/supabase-advisor-hardening`, based on current `dev`, for feature -> dev -> main delivery. No client contracts or public RPC signatures changed.

- `20260923030000_advisor_security.sql` makes both leadership views security-invoker. `person_leadership_ministries` uses existing table RLS; `ministry_accounts` calls the narrowly scoped `app_private.ministry_account_rows()` helper so approved users retain leader pickers without gaining access to other profiles. The helper has an empty search path, an active-account guard, four explicit output fields, and no anonymous execute grant. Keep `app_private` out of Data API exposed schemas.
- `20260923040000_advisor_performance.sql` caches identity checks in seven RLS policies and adds nine covering foreign-key indexes. It also fixes birthday-preference group correlation: the live policy previously compared `assignment.group_id` with itself, rather than the preference's group. The corrected policy requires the caller's assignment to that specific group.
- Both transactions use a five-second lock timeout and sixty-second statement timeout. Live preflight confirmed small affected tables and no index-name collisions. No existing index was dropped, RLS disabled, or notification scheduled.

Applied both migrations, in the order above, through the authenticated SQL Editor for `lxrrjrezpdzyqkevgwyx` (main Production) on 2026-09-23 local / 2026-09-24 UTC. Both succeeded and notified PostgREST. Do not rerun them or use `supabase db push`: CLI migration history is still unreconciled. The unrelated membership-date migration was not applied as part of this work.

Verification: `pnpm verify` passed (161 main tests plus visitation/group suites), `pnpm build:web` passed, and focused SQL tests cover member/editor/admin approval states, restricted profile access, anonymous grants, owner isolation, cross-owner write rejection, birthday-group isolation, index coverage, and public definer-RPC anonymous denial/fixed search paths. Live read-only transactions checked leadership projections and owner isolation using all four existing profiles, then rolled back. Catalog checks confirmed both invoker views, seven optimized policies, and zero uncovered public foreign keys. Counts remained 36 people, four profiles, two visits, and nine notification events; no application data writes were performed.

Advisor results after deployment: Security **0 errors, 27 warnings, 2 suggestions**; Performance **0 errors, 0 warnings, 9 suggestions**. Remaining security warnings are the 26 intentional, guarded public definer RPCs and leaked-password protection (requires Pro or above; this project is Free). Existing RPCs were not rewritten merely to suppress warnings; catalog checks and regression tests do not constitute a complete live role-by-role audit of every RPC. The two RLS-without-policy suggestions are intentional deny-by-default tables (`people_private`, `visit_notification_events`). Performance suggestions are unused indexes, including newly created indexes; retain these until representative workload evidence supports removal.

Rollback compatibility: current and previous clients keep the same view names, columns, and public RPC contracts. UI rollback does not require reversing these migrations. Prefer a forward fix if needed; never restore the erroneous birthday-policy correlation, broaden profile access, or disable RLS. If the view implementation must be reverted, restore the guarded view definitions from `20260917110000_leadership_ministries.sql` before removing the private helper, with a reviewed migration. Indexes and optimized policies can remain during a client rollback.

Delivery requires a feature PR into `dev`, CI/review and Vercel Preview validation, followed by a separate reviewed `dev` -> `main` release PR. No protected-branch merge or frontend production release was performed by this work. Authenticated Preview, live OAuth/callback/confirmation workflows, and physical-device checks remain release gates; read-only SQL verification is not a signed-in UI test.

## Editable Membership Start Date

Implemented on `feature/member-membership-date` for feature -> dev -> main delivery. The member editor loads and saves the existing `people.membership_joined_at` date through the revision-checked `save_person` RPC. Administrators and Member Administrators can set, change, or clear the date; the English "Member since" and Ukrainian "Дата вступу до церкви" controls reuse the native/web date field. Unknown dates stay null rather than being silently assigned today. Future or invalid dates are rejected.

Backend prerequisite: manually apply `20260923020000_membership_date.sql` after the role-permissions migration before enabling the client in production. This migration is NOT deployed by this feature work. It preserves the existing guarded writer, leadership restrictions, archival cleanup, and older-client omission behavior. Do not run an automatic database push. Older clients remain compatible with the new writer; rolling back the UI does not require reverting the migration.

Focused SQL coverage checks creation, editing, clearing, older-client preservation, single revision advancement, invalid/future dates, stale revisions, and unauthorized writes. Client regressions check payload/omission and editor hydration. Authenticated Preview, live save/reload, and physical-device checks remain release gates. Keep the feature PR targeted at dev and use a separate dev -> main PR for production.

Verification: `pnpm verify` passed (159 main tests plus visitation/group suites), `pnpm build:web` passed, and editor diagnostics/whitespace checks were clean. Built-app synthetic browser checks verified saved-date hydration, editing and reopening with the changed date, and clearing/reopening with null. Phone layout at 390x844 was visually inspected with no horizontal overflow. Desktop 1440x1000 hydration and keyboard-save checks passed, but the integrated-browser screenshot was clipped; full desktop visual and physical-device validation are not claimed. No live member data or database schema was changed.

## Bulk Member Deletion

Implemented on `feature/manage-member-bulk-delete`, based on current `dev`. The Members list supports administrator-only multi-selection, select-all-shown, clear selection, and a typed-confirmation review of every selected name. Search, filter, panel, account, and reload changes clear selection. The caller's linked member is excluded. Accounts-only deletion is not part of this feature.

The client calls the existing `delete-member` Edge Function sequentially with each reviewed name and revision. Existing server authorization, self-deletion, revision, and last-administrator guards remain authoritative. Processing stops on the first failure; the dialog reports confirmed deletions separately from unprocessed or uncertain records and reloads on close. A failed member may already have lost linked sign-in access or photos. No new migrations, Edge Function deployments, notification scheduling, or persistent data storage are introduced.

Verification: focused selection/confirmation/batch regressions, `pnpm verify`, and `pnpm build:web` passed. The built local app was checked with synthetic in-page backend responses at 1440x1000 and 390x844, including direct Manage load, self-selection exclusion, disabled confirmation, cancel with zero deletion requests, partial failure, and refreshed remaining rows. Desktop/mobile confirmation screenshots were inspected and no horizontal overflow was found. No real members were deleted. Physical-device, live OAuth, authenticated Vercel Preview, and live deletion checks remain unperformed.

Delivery is a feature PR into `dev`; CI/review and authenticated Preview remain merge gates. A separate reviewed `dev` to `main` PR is required for production. Verify the existing deletion endpoint on disposable records before production release, and retain the previous Vercel deployment for rollback; deleted member data itself cannot be recovered by rolling back the client.

## Member Administrator Permissions

Work in progress on `feature/member-administrator-permissions`, based on `dev` at `3803eeb`. Uncommitted changes were transferred from `main`, preserving the member-name and session-recovery changes already in `dev`. Neither protected branch was committed to or pushed.

Member Administrators (stored as `editor` for compatibility) manage members, groups, ministries, and duty schedules. Account management and permission-granting Pastor/Deacon assignments remain Administrator-only. Pastors and Deacons can plan visits; Administrators can manage all visits.

Local integration verification: `pnpm verify` passed (154 main tests plus visitation and group suites), and `pnpm build:web` passed. Authenticated browser/Preview and physical-device checks remain outstanding. VS Code reported workspace module-resolution diagnostics despite the passing project TypeScript check; these are not claimed resolved.

On 2026-09-23, applied `20260923000000_member_patronymic.sql`, then `20260923010000_role_permissions.sql`, through the user-authenticated Supabase SQL Editor for project `lxrrjrezpdzyqkevgwyx` (main Production). Preflight found both migrations absent; the patronymic prerequisite was applied and verified first. Both transactions completed successfully and notified PostgREST to reload its schema. Do not rerun either migration or use `supabase db push`; CLI migration history remains unreconciled. Older clients may receive authorization errors for newly restricted actions; UI rollback must not remove server restrictions.

Live catalog checks verified the preserved patronymic writer/directory return field, authenticated public member-RPC access, anonymous denial, private-writer denial for both client roles, security-definer wrapper with empty search path, leadership-assignment guard, administrator visitation guards, and administrator-only linked account name synchronization. A read-only transaction with locally simulated identity claims checked editor/admin/visitation helpers against all four existing profiles and rolled back; both visitation tables retain RLS, with two policies present. No member, visit, account, or notification records were changed by deployment verification. This is not a full signed-in client/RLS workflow test.

Feature PR #46 targets `dev`. Delivery still requires successful CI/review and Vercel Preview validation, then a separate release PR from `dev` into `main`. This database operation did not merge branches or deploy the frontend.

## Member Names and Mobile Recovery

Implemented on `feature/member-names-mobile-recovery`, branched from `dev`. Not deployed or merged.

- Optional patronymics are stored separately from the existing member name, editable in English/Ukrainian management forms, searchable in the directory, abbreviated in directory rows, and shown in full on member profiles. Existing names and surname sorting are unchanged.
- Session revalidation retries transient network/server failures once, preserves ready content during that attempt, and still blocks access after a persistent failure or account change. Contract-read network failures are no longer reported as backend-version mismatches. Recovery screens use localized reconnect copy and retry on foreground/online events; OAuth callbacks defer data work until after the auth callback returns.
- The opening screen uses a larger white church logo and white spinner without the sign-in checklist. Web form controls have a 16px minimum font size without disabling browser zoom. Navigation labels stay on one line with ellipsis and retain full accessible names/tooltips. Schedule no longer adds native bottom clearance or duplicate safe-area insets inside the web shell.

### Verification and Release Gates

- `pnpm verify` passed on the final source: TypeScript, 152 main tests, the visitation suite, and 12 group-suite entries. `pnpm build:web` passed. The design detector reported no findings.
- Local production-build checks used synthetic in-browser backend responses only: directory initial and full profile patronymic rendering, editor prefill, 16px inputs with small-text preference, deacon search, and Ukrainian large-text Schedule navigation. Phone (390x844) and desktop (1440x900) screenshots were inspected; measured layouts had no horizontal overflow, single-line navigation labels, and no gap between Schedule's content region and navigation. This does not establish physical iPhone focus behavior or live OAuth reliability.
- A simulated backend 503 on foreground revalidation displayed the localized reconnect state; restoring the fixture and dispatching an online event automatically restored the directory. These were synthetic requests, not a live token-expiry test.
- Applied `mobile/supabase/migrations/20260923000000_member_patronymic.sql` through the authenticated SQL Editor on 2026-09-23, before the role-permissions migration described above. Live column/writer/directory return-field checks passed. Signed-in editor add/update/clear, ordinary-member read access, unauthorized writes, and conflict-handling checks remain outstanding. Do not rerun the migration or use `supabase db push`. No live member mutation was performed in this deployment.
- The migration is additive for the previous client: omitted patronymics remain unchanged on edits, absent values remain null, and existing RPC arguments and permission checks are preserved. PGlite tests cover persistence, clearing, legacy writes, authorization, length constraints, and stale revisions. Retain the prior Vercel deployment for rollback; do not remove the column while clients may use it.
- Complete feature PR -> reviewed, CI-green `dev` Preview -> separate `dev` to `main` release PR, with the release version updated as part of that batch. Authenticated Preview, live idle/refresh behavior, callback/deep-link/confirmation smoke checks, and physical-device validation remain required before production release. Notification APIs and preferences are unchanged.

## Profile Portrait Loading Fix

Implemented on `fix/profile-avatar-flash`. Profiles with a known photo path reserve a neutral portrait area while the signed source is pending instead of briefly displaying initials. Details still render immediately, and retained portraits remain visible during same-member refreshes. Members without photos and failed signing/image requests retain the initials fallback. Portrait completion is independent of deacon-avatar loading and remains protected by the existing member/session request guards.

The focused screen-state regression covers desktop/mobile pending, successful, failed, and absent portraits plus obsolete responses. Physical-device and authenticated Preview checks are not implied by these tests.

## Home-Screen Icon and Name

Implemented on `feature/home-screen-icon-name`. New web installs suggest `Довідник` through both manifest names and Apple's home-screen title metadata. Standard 192/512px and Apple 180px icons use the existing church logo at 86% of tile height on white. Android has a separate maskable icon with the artwork inside the central 80%-diameter safe area. Native app names/icons and in-app language preferences are unchanged.

Verification: `pnpm verify` passed (146 main tests, visitation domain suite, 12 group-suite entries), and `pnpm build:web` passed. Built manifest/Apple metadata and all four icon decodes were checked in the browser. Pixel checks confirmed opaque artwork, standard logo height near 86%, and maskable ink within 38.8% of the tile width from its center. Apple and Android artwork was visually inspected. This change does not alter auth, confirmations, notifications, or backend behavior; live OAuth and physical-device installation were not exercised.

Existing home-screen shortcuts may retain their cached icon or user-selected name. After deployment, remove and re-add the shortcut to see the new defaults. Physical iPhone/Android installation remains a manual release check.

## Bounded Photos and Faster Profiles (1.3.0)

Local implementation on `feature/optimized-profile-photos`; not deployed. This supersedes the unchanged-original upload behavior described below.

- New uploads encode a JPEG portrait with a longest edge of at most 1280 pixels and a centered avatar of at most 256 pixels, without upscaling. Output limits are 512 KiB and 50 KiB respectively; encoding tries quality 0.8, 0.75, then 0.7 and rejects images that still exceed the limit. The existing 5 MiB input limit remains. The selected camera-resolution source is not uploaded.
- Both images upload to new versioned paths before revision-checked publication. Successful replacements/removals check for references before deleting the previous pair. Unconfirmed publication preserves attempted files; cleanup failures report a warning without undoing publication. Storage policy limits are unchanged, so older installed writers can still upload larger files.
- Profile details no longer wait for image signing. Portraits and responsible-deacon avatars hydrate independently. Same-member content remains visible during focused reloads; member/session changes hide old content and reject late responses. An unused account query was removed and deacon/member-ministry reads run concurrently. No new persistent private cache or database contract was added.

### Verification and Remaining Gates

- Focused tests passed for size limits, capped encoding retries, temporary-resource cleanup, paired publication, reference-aware deletion, uncertain publication, text-before-photo rendering, warm focus, and obsolete member/session responses. These encoder tests use mocks, not real-image visual validation.
- `pnpm verify` passed: TypeScript, 146 main tests, visitation domain suite, and 12 group-suite entries. `pnpm build:web` passed. Editor diagnostics and `git diff --check` were clean.
- The production web encoder generated two local portrait/thumbnail pairs from bundled, nonprivate PNG samples. Both decoded and were visually inspected: 1,935,724 input bytes became a 151,414-byte portrait and 11,730-byte avatar; 1,770,886 input bytes became a 128,833-byte portrait and 9,074-byte avatar. Portraits retained their 1254x1254 input dimensions; avatars were 256x256. Neither JPEG contained EXIF/XMP markers. These opaque PNG samples do not establish EXIF-rotation or transparency handling, nor do they measure live member-photo savings. No samples were uploaded.
- Before release, check two representative real image pairs for dimensions, bytes, sharpness, orientation, and metadata. Verify picking and replacement on physical iOS/Android. A consistent white transparency matte is not implemented or established by the SDK inspection; resolve that before declaring the agreed image-normalization work complete.
- Complete authenticated mobile/desktop Preview checks, including existing auth/deep-link/confirmation flows and no notification side effects. Native-device and live OAuth checks have not been performed for this change.
- Deploy the updated writers before converting existing storage. Conversion has not been run and no existing originals were deleted by this implementation. Inventory first, validate two representative converted pairs, then process remaining records with automatic upload/publication checks. Publish with the current member revision, check that old paths are unreferenced, and remove the old pair immediately after confirmed success. Failed or ambiguous publication must preserve the old pair. Finish with aggregate reference/object counts; no per-pair download verification or retention window is required.
- Follow feature PR -> reviewed, CI-green `dev` Preview -> separate `dev` to `main` release PR. Existing readers understand the same base-path/thumbnail convention, but deleted full-resolution sources cannot be recovered from the optimized files.

## Warm Tabs and Thumbnails (1.2.0)

Implemented on `feature/warm-tabs-thumbnails`, branched from `dev`. Not deployed or merged.

- Directory records, Groups list records, yearly duty periods, visit counts, and pending-approval badge counts have five-minute, bounded, session-only caches. Concurrent reads share requests. Manual refresh bypasses freshness; successful local mutations invalidate affected data. Birthday authorization is not cached.
- Directory, Groups, Schedule, and Duty Summary retain ready content during background refresh. Native pull-to-refresh and web refresh buttons remain available; failed warm refreshes retain rows with a retry action. Focus/unmount guards reject late UI updates. Foreground/four-minute active-view checks revalidate account access and renew photo sources; no background polling while hidden.
- Cache scope includes account ID, status, role, leadership, linked member, revision, and session generation. Access changes/sign-out clear caches. There is no private offline store, service worker, new backend service, or cross-account image key.
- Private photo URLs are signed in batches of at most 100 and reused for 240 seconds of their 300-second lifetime, independently of dataset freshness. Native image decoding uses memory-only caching with stable session/path keys. Browser HTTP caching remains browser-controlled.
- Every photo upload produces an unchanged selected original plus a centered JPEG thumbnail, at most 256x256 without upscaling. The thumbnail path is `<original-path>.avatar-256.jpg`. Both upload before the original path is published. Partial failures/conflicts clean the attempted pair; replacement/removal/member deletion clean both files. Generated temporary files and image handles are released.
- Small avatars, including Menu, use thumbnails; profile portraits and the large member editor portrait use originals. Missing/failed thumbnails show initials. There is no original-only compatibility branch, original-image fallback, backfill tool, or legacy-photo handling.

### Verification

- `pnpm verify`: passed (142 main tests, visitation domain suite, 12 group-suite entries). Covers freshness, bounded retention, request deduplication, account/permission changes, late responses, warm error state, signing renewal/batching, paired upload rollback, and crop/cleanup API behavior.
- `pnpm build:web`: passed. iOS and Android exports passed into ignored `.expo/warm-tabs-native`; exports are not physical-device tests.
- Built web app with an in-page synthetic backend fixture: ten warm Directory -> Groups -> Schedule cycles issued **zero additional backend requests**, including badges, and inserted **zero cold loading indicators**. Each dataset/count was requested once during warm-up. A forced failed manual refresh retained both visible directory rows. Phone (390x844) and desktop (1440x900) layout bounds had no horizontal overflow across those three views.
- Browser fixture uses initials, not signed private photos, and dispatched navigation events because embedded-browser pointer actionability was unreliable. Phone screenshot inspected; desktop captures were clipped by the embedded browser. This is not an authenticated Preview, real-photo transfer measurement, full desktop visual review, or live OAuth test.

### Release Gates

1. Manually deploy and verify the changed `delete-member` Edge Function before enabling paired uploads in production. No database schema/contract change or automatic migration push is required.
2. Build/distribute native binaries with the SDK 57 image-manipulator and file-system dependencies. Verify picking, orientation/transparency, thumbnail dimensions/bytes, replacement/removal/deletion, and cleanup on physical iOS/Android with disposable records.
3. In authenticated dev Preview and on devices, measure real photo transfers/decodes and sharpness at 1x/2x/3x. A typical <=50 KB thumbnail remains a measurement target, not a guarantee. Check image renewal after expiry, failed thumbnails, changed member photos, foreground revalidation, and sign-out/account switching.
4. Complete full mobile/desktop visual and existing auth/deep-link/confirmation/notification-side-effect smoke checks. Follow feature PR -> reviewed/CI-green `dev` Preview -> separate `dev` to `main` release PR. Keep the prior deployment as the rollback target; do not add legacy-photo code.

## Branch Model

Pull-to-refresh refinement: removed the added refresh icon from Directory, Groups, and Schedule. Native refresh controls remain; touch web refreshes on a downward gesture from the top, with a progress indicator only during refresh. Warm-refresh errors remain visible without a button. Validation was limited to TypeScript and a focused gesture check at the requester's direction; the full suite, production build, and device/browser smoke checks were not rerun for this refinement.

```text
feature/* -> dev -> main
			  |      |
			  |      +-- Vercel Production
			  +--------- Vercel Preview/staging
```

- Feature branches create Vercel Preview deployments through pull requests.
- Merging into `dev` creates the shared development/staging Preview deployment.
- Merging a reviewed release pull request from `dev` into `main` creates the Vercel Production deployment.
- The legacy `web/` application is not deployed. Its `web/vercel.json` disables Git deployments.
- GitHub Releases are optional release notes and audit records. They do not trigger deployment.

This model intentionally makes a merge into `main` a production release. Keep unreleased work in `dev`.

## Repository CI

`.github/workflows/ci.yml` runs `pnpm verify` for pull requests and pushes targeting `dev` or `main`. Protected branches must require this check. The workflow has no Vercel token, deploy command, or production secret.

Use Node 24 (tested with 24.21.0) and the package's pinned pnpm 12.4.1 from `mobile/`:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm build:web
pnpm serve:web
```

The production preview is served at `http://localhost:4173`. `pnpm web` starts Expo development mode. Supply `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env.local` or the hosting environment. Never include a service-role or secret key. Production builds reject absent backend configuration and recognizable privileged keys.

## Vercel Setup

1. Connect `ysalo/FUBC-Member-Directory` and set **Root Directory** to `mobile`.
2. Set the Vercel **Production Branch** to `main`.
3. Keep Git deployments enabled for `main`, `dev`, and feature branches as appropriate.
4. Optionally assign a stable staging domain to `dev`; never assign it to the production domain.
5. Configure Production variables for the live Supabase public URL and publishable key.
6. Configure Preview variables separately when possible, preferably against a staging Supabase project.
7. Remove Deploy Hooks and revoke retired external Vercel tokens or integrations.
8. Preserve the current Production deployment before cutover for emergency rollback.

The Vercel GitHub App manages deployment authentication. Do not add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` to GitHub Actions.

No Vercel deployment or live Supabase configuration change was performed in this implementation session.

## Supabase Readiness

Supabase deployment remains manual and independent of Vercel:

- Apply and verify required SQL before merging backend-dependent client changes into `main`.
- Deploy and verify required Edge Functions separately.
- Do not run `supabase db push` until migration history has been inspected and reconciled in `mobile/supabase/CONNECT_EXISTING_PROJECT.md`.
- Keep `expo-directory-v3` separate from application SemVer.
- Confirm the current and rollback clients are compatible with the live backend.

## Release Procedure

1. Create a feature branch from `dev` and open a pull request into `dev`.
2. Wait for CI and inspect the Vercel Preview deployment.
3. Merge into `dev` after review and verify the shared staging Preview.
4. For a production batch, update `mobile/package.json` on `dev` using SemVer. `mobile/app.config.js` reads this value automatically.
5. Run `pnpm verify` and `pnpm build:web`.
6. Open a release pull request from `dev` into `main` with version, backend readiness, known issues, and rollback target.
7. Merge after required CI and review checks pass. This immediately deploys Production through Vercel.
8. Verify the production deployment, stable domain, authentication callback, app shell, and critical read-only flows.
9. Optionally create a matching `vX.Y.Z` GitHub Release on the merged `main` commit. It is audit metadata, not a deployment trigger.

The semantic application version has one source: `mobile/package.json`. The initial release is `1.0.0`; later releases update that package version only.

The application version is separate from the `expo-directory-v3` Supabase compatibility contract. Change that contract only when coordinating a database/client contract revision, not during a routine application version bump.

## Rollback

If Production is unhealthy:

1. Check backend compatibility with the previous application version.
2. In Vercel, promote the retained previous Production deployment.
3. Verify the stable domain, authentication callback, and critical read-only routes.
4. Open a revert or fix pull request so `main` reflects production state.

Do not rebuild an old commit as an untracked deployment. Use a new PR through `dev` and `main` for the durable fix.

## Acceptance Checklist

- [ ] `dev` and `main` block force pushes and deletion.
- [ ] Both branches require the CI check before merge.
- [ ] Feature PRs target `dev`; production PRs target `main`.
- [ ] Vercel Root Directory is `mobile` and Production Branch is `main`.
- [ ] A dev merge creates Preview only; a main merge creates Production.
- [ ] No GitHub Actions Vercel token or deployment workflow exists.
- [ ] The previous Production deployment is retained for rollback.
- [ ] Manual Supabase readiness is complete before backend-dependent production merges.

## Verification History

- Full `pnpm verify` passed after integration: TypeScript, authorization/database tests, existing domain suites, and new web-auth/platform/build tests.
- Final web production export passed after the browser-discovered Link styling correction.
- iOS production bundle export passed (`expo export -p ios`); this confirms bundling, not physical native operation.
- Browser checks used the configured production sign-in page and a separate local development fixture session (with backend environment loading disabled). No fixture data was written to Supabase.
- Checked production sign-in, callback denial/recovery UI, direct-route HTTP serving, mobile bottom navigation, desktop sidebar, directory search/no-results/recovery, member navigation/profile, group list, visitation planning/required-person validation, browser date/time controls, and Menu language/theme/text-size controls.
- Reviewed phone (390×844) and desktop (1440×900) layouts. Fixed Expo Router Slot style merging discovered in the browser; phone directory and desktop profile verified afterward. Phone form and Ukrainian large-text Menu measurements showed no horizontal overflow; dark mode and localized installation help rendered correctly.
- Mechanical UI detector returned no findings. Dialog cleanup and stale callbacks, notification isolation, date bounds, sharing/cancellation, OAuth replay/return validation, session races, and missing/secret build configuration have automated regression coverage.

## Member Responsible Deacons (1.1.0)

- Member profiles show assigned membership-group deacons above Contact, reusing compact directory cards on native and web. Empty assignments hide the section; archived deacons are excluded and cards open member profiles.
- Uses existing `deacon_group_deacons` and `people` reads with existing RLS and private photo signing. No migration, backend deployment, or contract change is required; the previous client remains compatible.
- Local `pnpm verify`, `pnpm build:web`, and focused repository/layout regression tests passed. Live Vercel Preview, review, staging, and production verification remain release gates.
- Fixture browser checks passed at 390x844 and 1440x1000: section order, directory card appearance, no horizontal overflow, deacon profile navigation, direct-link reload, and hidden empty section. No live records were modified.
- Rollback target: the retained production deployment at `ecd361f` (application 1.0.14). Physical native and live OAuth checks have not been performed for this change.

## Responsible Deacon Avatars (1.1.1)

- Replaces responsible-deacon cards with 64px avatar links, preserving the section's original position above Contact on desktop and mobile. Links have accessible names, browser name tooltips, and existing initials fallbacks.
- No repository, backend, permissions, or notification changes. No migration is required and application 1.1.0 remains backend-compatible for rollback.
- Local `pnpm verify` and `pnpm build:web` passed, including avatar navigation markup and unchanged section-order regression coverage. Fixture browser checks covered 1440x900 and 390x844 layouts, avatar-only content, image asset loading, click and Enter navigation, and hidden empty sections. Authenticated Vercel Preview validation, CI, and review remain release gates. Physical native and live OAuth checks have not been performed.

## Member Profile Refinements (1.1.2)

- Moves Responsible deacons below Contact on desktop and mobile, while retaining avatar-only profile links without redundant Deacon badges.
- Renames the English visitation action from Request visit to Plan visit. The existing Ukrainian planning label is unchanged.
- No repository, backend, permissions, notification, or migration changes are required. Application 1.1.1 remains backend-compatible for rollback.
- Focused profile tests, full `pnpm verify`, and `pnpm build:web` are required before release. Browser and physical-device checks were omitted at the requester's direction.

## Native Performance Pass

- Delivered through feature PR #30 into `dev` and release PR #31 into `main` (merge `08dcfa2`). Deployment verification is separate from the merge record.
- Group detail now reuses the existing directory-summary RPC in bounded 100-ID batches instead of one private-profile RPC per member. Fixture data requests fall from 57 to 7 for 50 members and from 1,006 to 16 for 999 members. Photo-signing counts are unchanged.
- No new infrastructure, migration, RPC contract, permission, or notification changes are required. The previous client remains backend-compatible.
- Directory reads now use a 30-second memory-only, account/revision-scoped cache with in-flight deduplication and stale-response invalidation. Directory search keeps typing immediate while debouncing derived filtering and reuses a prepared normalized/sorted index. No private data is persisted.
- Visitation reads now support 50-record pages with continuation and duplicate protection; hydration uses keyed maps, and cold directory/visitation screens show accessible skeletons. The existing full-list compatibility method remains for detail/domain callers. Native visitation card virtualization remains a follow-up because the current screen container has not been replaced yet.
- Focused repository and real PostgreSQL projection/authorization tests passed, along with full `pnpm verify`, `pnpm build:web`, and iOS/Android bundle exports. Export success is not a physical-device performance check.
- A local public Lighthouse baseline completed: performance 0.46, accessibility 0.88, best practices 1.00, SEO 0.54, LCP 15.1s, TBT 760ms, CLS 0. Authenticated preview and desktop/mobile repeated audits remain release gates.
- Cleanup audit removed two unreachable files, four unused direct Expo dependencies, ignored avatar props, unused helper/export surfaces, and one tautological assertion. `@expo/ngrok` remains intentionally for `start:phone`; generated database types and deployment/runtime metadata were retained.
- See [performance evidence and remaining slices](performance-pass.md) for reproducible measurements, bundle baselines, and pending cache/list/startup/Lighthouse work.
- Authenticated Preview checks, group flags/order/photos, navigation/deep links, and native group-detail smoke checks require separate release evidence. Live OAuth and physical-device timing were not performed in this slice; the local public Lighthouse audit is recorded above. No hosted backend records were changed.
- Release only through a separate reviewed `dev -> main` PR after the remaining performance work and release gates. Keep the retained web deployment and existing native recovery path available; the first slice needs no database rollback.

## Loading Layout and Cleanup (1.1.3)

- Directory placeholders reuse the real row and section styles, 72px phone/56px desktop avatars, scaled typography, separators, and desktop ministry/phone columns. The centered empty-state wrapper and extra spinner are gone. Existing rows remain visible during refresh.
- Visitation placeholders use the actual visit-card and response-row styles. Tabs and authorized planning actions remain in place during loading; tabs are disabled until the initial request finishes. Web lists reserve scrollbar space to prevent width changes.
- Removed the unused generic skeleton, unreachable directory summary/filter UI, four unused domain models, unused domain type exports, and the broken reset-project script. Deleted two obsolete/vacuous source-only tests and fixed three missing-element order assertions. Cache and rendered loading-state tests now run in `pnpm verify`.
- Local full verification passed (129 main tests plus visitation/groups suites). Final web, iOS, and Android exports passed. Rendered fixture checks cover loading/loaded/error accessibility; browser measurements compare phone (390px) and desktop (1440px), standard/large text, light/dark themes, and English/Ukrainian variants. Representative row/card bounds match within 1px with no horizontal overflow.
- Fixtures isolate repositories, navigation, and the optional duty banner. Unknown badge counts, variable invitees, wrapping data, and optional banners can still affect final content height. These checks are not authenticated Preview, live OAuth, or physical-device verification.
- No backend changes, migration, permission changes, or new dependencies. Rollback target: retained production deployment from `08dcfa2` (application 1.1.2).
- Release gates: feature PR into `dev`, CI/review and authenticated Preview, then separate reviewed `dev -> main` PR and production smoke checks. No production release is claimed by these local checks.

## Still required before production use

- Complete real Google OAuth on the final HTTPS origin, including reload/relaunch and installed-iPhone return flow. Confirm pending/member/deacon/pastor/editor/admin authorization against live accounts.
- Exercise photo chooser/cancel/upload/removal and all management mutations with disposable authorized records, including Edge Function CORS and deployment checks. Local UI and SQL tests do not establish live service readiness.
- Physically verify iPhone Add to Home Screen, icon, standalone display, safe areas, keyboard-open forms, external links, and relaunch. Check Safari and Chrome independently.
- Smoke-test native iOS sign-in, tabs, date pickers, and birthday notifications on a device. A successful iOS export is not a device test.
- Confirm deployment cache headers, callback and record deep links on Vercel, and rollback behavior. Offline behavior requires reconnecting; notifications and offline editing are intentionally absent on web.
