# Web Application Release and Deployment

The application uses Vercel's GitHub integration. GitHub Actions verifies code; it does not hold Vercel credentials or deploy the application.

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
