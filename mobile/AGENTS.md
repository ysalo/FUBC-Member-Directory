# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Shared native and web application

Follow `../docs/web-app-plan.md`. This directory is the single Expo application for native and web; do not create a second web application or copy business logic. Use platform modules for integrations and share repositories, permissions, and route identities.

## Branch and release workflow

All requested work must follow the repository flow: create a feature branch from `dev`, open a pull request into `dev`, validate the Vercel Preview deployment, and merge into `dev` only after CI and review pass. Production work then moves through a separate pull request from `dev` into protected `main`; merging `main` is the production release through Vercel. Do not commit directly to `dev` or `main`, open feature pull requests directly into `main`, or introduce a GitHub Actions/Vercel token deployment path. Keep backend readiness and rollback compatibility verified before merging backend-dependent changes into `main`. See `../docs/web-app-release.md` for the operating procedure.

For parallel work use one integration lead and at most three workers: shell/PWA, platform compatibility, auth/data. Agree file ownership first. The lead owns package/configuration changes and cross-feature integration; workers must report cross-owner changes instead of editing concurrently. After foundation integration, feature UI ownership can be reassigned to directory/profiles, groups/visitation, and management/settings.

Run `pnpm verify` and `pnpm build:web` before delivery. Browser checks must cover mobile and desktop, auth callbacks/deep links, confirmations, and no notification side effects. Do not claim physical iPhone/native checks or live OAuth checks unless actually performed. Document deployment prerequisites and remaining verification in `../docs/web-app-release.md`.

Web production uses existing Supabase public configuration and RLS. Never place service-role credentials in the client, cache private data for offline use, or automatically push migrations. See `supabase/CONNECT_EXISTING_PROJECT.md` for the migration-history restriction.
