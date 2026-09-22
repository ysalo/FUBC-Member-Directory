# Web application implementation and release handoff

Implementation date: September 19, 2026. Approved design and agent ownership: [web-app-plan.md](web-app-plan.md).

## Implemented

- One Expo SDK 57 application in `mobile/`; shared Supabase repositories, permissions, routes, and business rules.
- Standalone home-screen manifest, branded FUBC icons, Apple touch icon, localized installation help, and Vercel SPA configuration.
- Browser bottom navigation below 1,024px and 240px desktop sidebar above it, with desktop directory/profile, groups, visitation, and management layouts.
- Browser redirect OAuth with safe return paths, one PKCE exchange per callback, visible failure recovery, persistent sessions, and native callback navigation.
- Same-identity session revalidation preserves mounted forms; identity changes, revoked access, sign-out, and failures still gate content.
- Accessible browser dialogs, automatic dialog cleanup on navigation/access loss, browser date/time controls, sharing fallback, and web text-size persistence.
- Web notification scheduling and controls disabled without overwriting native reminder preferences. Visitation retains its workflows and calendar export.
- No service worker, private-data offline cache, or queued offline edits. Connection status and existing retry flows remain available.
- Agent routing recorded in `mobile/AGENTS.md`; no second web application or copied data layer.

## Run locally

Use Node 24 (tested with 24.21.0) and the package's pinned pnpm 12.4.1 from `mobile/`:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm build:web
pnpm serve:web
```

The production preview is served at `http://localhost:4173`. `pnpm web` starts Expo development mode. Supply the public Supabase settings in an ignored `.env.local` or the hosting environment; see `.env.example`. Never include a service-role or secret key. Production builds reject absent backend configuration and recognizable privileged keys.

## Vercel setup

1. Import this repository and set **Root Directory to `mobile`**. The older `web/` directory is not the application being deployed.
2. Use Node 24.x. `mobile/vercel.json` defines installation, build command, output `dist`, SPA fallback, and cache/security headers.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the existing project's public values. Legacy `EXPO_PUBLIC_SUPABASE_ANON_KEY` is supported. Set `EXPO_PUBLIC_ENABLE_APPLE_AUTH=false` unless the provider has actually been configured.
4. In Supabase Auth, register `https://<production-domain>/auth/callback` and the exact callback for a stable preview/staging origin. Preserve native callbacks. Do not use a broad production redirect wildcard. The app derives its redirect from the current origin.
5. Confirm Google provider configuration. For provider-side OAuth configuration, retain the existing Supabase Auth callback, rather than replacing it with the app callback.
6. Confirm the live `expo-directory-v3` contract, account access, private photos, and required deletion Edge Functions. This implementation did not alter the database or deploy functions. Follow `mobile/supabase/CONNECT_EXISTING_PROJECT.md`; do not run an unreconciled migration push.
7. Test the preview before promoting. Install the final stable production URL on phones. Keep the previous Vercel deployment available for rollback.

No Vercel deployment or live Supabase configuration change was performed in this implementation session.

## Application version

The semantic application version has one source: `mobile/package.json`. The initial release is `1.0.0`. For later releases, update that package version only; `mobile/app.config.js` supplies it to Expo builds and runtime config, and the About sheet displays the resolved value.

The application version is separate from the `expo-directory-v3` Supabase compatibility contract. Change that contract only when coordinating a database/client contract revision, not during a routine application version bump.

## Release workflow

Production releases are performed from a published stable GitHub Release. Merging to `main` runs CI and may create a branch or preview deployment, but must not change the production domain. The Vercel project disables Git deployment for `main`; do not re-enable it without reviewing `.github/workflows/release.yml`.

All release implementation changes are made on a separate branch and merged through a pull request. Do not create a production tag or publish a Release until the PR containing the release workflow has merged and a main merge has been verified not to move production.

### Prepare a release

1. Open a release PR that updates `mobile/package.json` to the next SemVer version. Keep the version change separate from unrelated feature PRs; one release may contain multiple merged changes.
2. Wait for the PR and `main` CI checks to pass, then merge through the normal protected PR flow.
3. In GitHub, create a **draft** Release from the exact `main` commit. Use the tag `v<package version>` and generate notes from previous releases, then edit the notes for users.
4. Include the following line exactly in the release body after verifying backend readiness:

	```text
	- [x] Backend readiness verified (or no backend changes)
	```

	Also list migrations and Edge Functions applied, or state that none are needed. Confirm the client remains compatible with the currently deployed version and the documented rollback target.
5. Publish the stable Release. Publishing is the production approval. Draft Releases, prereleases, bare tags, and ordinary pushes do not deploy production.

The workflow validates the tag against `mobile/package.json`, resolves the tag to its immutable commit, verifies reachability from `main`, reruns `pnpm verify`, stages a production Vercel deployment without changing the domain, performs read-only smoke checks, and promotes only that staged deployment. A published Release is not itself proof of a successful deployment; use the workflow result and Vercel deployment record.

### Repository setup

The GitHub `production` environment requires:

- `VERCEL_TOKEN` secret with the minimum deployment permissions needed by the linked project.
- `VERCEL_ORG_ID` variable for the verified Vercel organization.
- `VERCEL_PROJECT_ID` variable for the verified `fubc-member-directory` project whose root directory is `mobile`.
- `PRODUCTION_URL` variable containing the stable HTTPS origin.

Keep production public Supabase values in Vercel's production environment. Never add service-role keys, database credentials, or `.env` files to GitHub Actions. Confirm the Vercel CLI project linkage before the first production run so the legacy `web/` directory cannot be deployed accidentally.

### Backend ordering

Database migrations and Supabase Edge Functions remain manual release prerequisites. Follow `mobile/supabase/CONNECT_EXISTING_PROJECT.md`; do not run an unreconciled `supabase db push`, and do not apply destructive or breaking schema changes as part of this workflow. Apply and verify backend changes before publishing the client Release, and document them in its notes.

### Failure and rollback

Validation, tests, build, or staged smoke-test failures leave the current production deployment unchanged. Correct the source on a new branch/PR and create a new version; do not move an existing tag or reuse a published version for different code.

If promotion or the final production smoke test fails, inspect the actual Vercel status before retrying because a timeout may be ambiguous. Roll back by promoting the previously recorded, retained Vercel deployment rather than rebuilding or rerunning an older GitHub Release. Verify the stable origin afterward and record the rollback in the deployment history. Backend compatibility must be checked before any client rollback.

## Verification

- Full `pnpm verify` passed after integration: TypeScript, authorization/database tests, existing domain suites, and new web-auth/platform/build tests.
- Final web production export passed after the browser-discovered Link styling correction.
- iOS production bundle export passed (`expo export -p ios`); this confirms bundling, not physical native operation.
- Browser checks used the configured production sign-in page and a separate local development fixture session (with backend environment loading disabled). No fixture data was written to Supabase.
- Checked production sign-in, callback denial/recovery UI, direct-route HTTP serving, mobile bottom navigation, desktop sidebar, directory search/no-results/recovery, member navigation/profile, group list, visitation planning/required-person validation, browser date/time controls, and Menu language/theme/text-size controls.
- Reviewed phone (390×844) and desktop (1440×900) layouts. Fixed Expo Router Slot style merging discovered in the browser; phone directory and desktop profile verified afterward. Phone form and Ukrainian large-text Menu measurements showed no horizontal overflow; dark mode and localized installation help rendered correctly.
- Mechanical UI detector returned no findings. Dialog cleanup and stale callbacks, notification isolation, date bounds, sharing/cancellation, OAuth replay/return validation, session races, and missing/secret build configuration have automated regression coverage.

## Still required before production use

- Complete real Google OAuth on the final HTTPS origin, including reload/relaunch and installed-iPhone return flow. Confirm pending/member/deacon/pastor/editor/admin authorization against live accounts.
- Exercise photo chooser/cancel/upload/removal and all management mutations with disposable authorized records, including Edge Function CORS and deployment checks. Local UI and SQL tests do not establish live service readiness.
- Physically verify iPhone Add to Home Screen, icon, standalone display, safe areas, keyboard-open forms, external links, and relaunch. Check Safari and Chrome independently.
- Smoke-test native iOS sign-in, tabs, date pickers, and birthday notifications on a device. A successful iOS export is not a device test.
- Confirm deployment cache headers, callback and record deep links on Vercel, and rollback behavior. Offline behavior requires reconnecting; notifications and offline editing are intentionally absent on web.
