# Private Member Directory — Project Handoff

## Purpose

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
