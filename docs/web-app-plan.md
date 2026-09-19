# Shared Expo app for iPhone, web, and desktop

Approved September 19, 2026. This is the implementation contract; verification results and remaining deployment steps belong in `web-app-release.md`.

## Approach

Keep one Expo project in `mobile/`, using the existing Supabase database. Share business logic, permissions, repositories, and routes; isolate genuine platform differences in `.web.tsx`/`.native.tsx` modules. Do not copy the app or restructure into a monorepo.

Include all existing features, authorized management, and visitation. Web has no notifications or offline data storage. Preserve native notification functionality and future native publication. Home-screen installation opens a standalone browser app with branded icons. Web push can be added separately later.

## Navigation and presentation

- Centralize web navigation in the shell. Below 1,024px use bottom navigation with safe-area padding; above it use a 240px sidebar and full-page content.
- Preserve branding, English/Ukrainian localization, appearance, text scaling, and permissions.
- Desktop lists use aligned wider rows; related detail sections and forms use columns where suitable, with readable widths. Records retain separate pages, not split views.
- Preserve record URLs, direct links, reloads, browser back/forward, and normal link behavior.
- Provide keyboard focus, accessible labels, visible scrollbars, and reachable form actions with a phone keyboard open.

## Platform compatibility

- Replace ineffective browser React Native alerts with shared native/browser confirmation and error interfaces.
- Isolate birthday notification scheduling; web never invokes native APIs or overwrites saved native preferences. Hide web notification controls.
- Preserve visitation planning, responses, viewed state, event metadata, and calendar links. Remove browser promises of lock-screen notifications.
- Provide browser date/time controls with existing string interfaces, validation, disabled state, maximum dates, date-only semantics, and existing fixed-PDT rules.
- Verify photo selection/upload/removal, contact links, calendar export, and sharing. Copy when sharing is unavailable; cancellation is not failure.
- Retain SDK 57 components with working web implementations.

## Authentication and data

- Reuse typed repositories, RPCs, access rules, private photos, and the existing database; no conversion migration expected.
- Browser uses redirect OAuth and `/auth/callback`, reachable outside the authenticated shell. Exchange PKCE once and restore a validated same-origin destination.
- Preserve native OAuth and secure storage; use persistent Supabase browser storage on web.
- Handle failed/canceled sign-in, expired callbacks, reloads, sign-out, and pending/revoked accounts.
- Google remains enabled; Apple remains behind its existing flag.
- Production builds fail without backend configuration. Do not deploy demonstration mode accidentally.
- Verify backend contracts, Edge Functions, CORS, and authorization. Respect the existing migration-history restriction; no automatic database push.

## Installation and Vercel

- Export a client-rendered SPA (`web.output: single`) without enumerating private record IDs.
- Vercel root: `mobile`; compatible pinned Node/pnpm, frozen lockfile, `expo export -p web`, output `dist`.
- Serve real assets and rewrite application paths, including OAuth callback, to the SPA entry point.
- Manifest: stable identity, root start URL/scope, standalone display, theme, 192/512px icons, Apple touch icon.
- Localized install help on sign-in and Menu; supported browser install prompt or manual iPhone guidance; hidden in standalone mode.
- No service worker, private-data cache, or offline mutation queue. Visible connection errors and retry.
- Public Supabase environment variables only; no service-role credentials. Register exact production/stable staging redirects, preserving native redirects.
- Revalidate HTML/manifest; immutable fingerprinted assets. Install from a stable production origin.

## Agent routing

One lead and up to three workers. Agree interfaces and file ownership before parallel editing; route cross-owner changes through the lead.

| Agent | Ownership |
| --- | --- |
| Lead/integration | Contracts, configuration/dependencies, shared integration, deployment artifacts, verification |
| Shell/PWA | Web shell, sidebar/bottom navigation, installation help, layout primitives |
| Platform compatibility | Dialogs, notification adapters, dates, photo/share fallbacks |
| Auth/data | Browser OAuth/callback, session lifecycle, backend configuration/authorization checks |

Sequence: baseline and contracts; parallel foundation work; lead integration; separate feature passes for directory/profiles, groups/visitation, management/settings; consolidated browser review/fixes; preview/release checks. Never duplicate data or permissions logic.

## Acceptance

- `pnpm verify` and production export pass; behavioral tests cover browser changes.
- Google OAuth works in Safari/Chrome and installed iPhone mode, with persistent sessions and recoverable failures.
- Record and management URLs survive direct loads/reloads; unauthorized access reveals no private data.
- Existing feature workflows work with the same backend; confirmations support cancel, pending, error, and retry.
- Web makes zero notification API calls and preserves native preferences.
- Verify photos, date/time, sharing, contacts/calendar, both languages, themes, text scaling, responsive layouts, keyboard use.
- Physically verify iPhone icon, standalone launch, OAuth return, safe areas, relaunch; emulation is not a substitute.
- Smoke-test native navigation, OAuth, date fields, and birthday notifications.
- Test destructive operations only on disposable records/accounts. Missing backend deployments are release blockers.

## Assumptions

Existing branding and business rules remain authoritative. Final domain comes from deployment configuration. Native store publication and future notification infrastructure are separate work. Keep the previous Vercel deployment available for rollback.
