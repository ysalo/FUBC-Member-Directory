# Web Application Release and Deployment

The application uses Vercel's GitHub integration. GitHub Actions verifies code; it does not hold Vercel credentials or deploy the application.

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

## Still required before production use

- Complete real Google OAuth on the final HTTPS origin, including reload/relaunch and installed-iPhone return flow. Confirm pending/member/deacon/pastor/editor/admin authorization against live accounts.
- Exercise photo chooser/cancel/upload/removal and all management mutations with disposable authorized records, including Edge Function CORS and deployment checks. Local UI and SQL tests do not establish live service readiness.
- Physically verify iPhone Add to Home Screen, icon, standalone display, safe areas, keyboard-open forms, external links, and relaunch. Check Safari and Chrome independently.
- Smoke-test native iOS sign-in, tabs, date pickers, and birthday notifications on a device. A successful iOS export is not a device test.
- Confirm deployment cache headers, callback and record deep links on Vercel, and rollback behavior. Offline behavior requires reconnecting; notifications and offline editing are intentionally absent on web.
