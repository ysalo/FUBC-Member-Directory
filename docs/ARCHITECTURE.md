# System Architecture and Data Flow

## System map

```text
Browser / installed PWA
        |
        | HTTPS, OAuth initiation, Server Actions
        v
Next.js 16 application on Vercel
  - App Router pages and route handler
  - server-rendered protected data
  - client directory interactions
  - session-refresh proxy
        |
        | user-scoped Supabase session
        v
Supabase
  - Auth: Google now, Apple optionally
  - PostgreSQL: people, profiles, audit_events
  - Row Level Security policies
  - private Storage: member-photos
```

The application uses the Supabase publishable key and the signed-in user's session. It does not use or expose a service-role key. Authorization remains enforced in PostgreSQL and Storage policies even if a caller bypasses the user interface.

## Web application layers

| Area                     | Responsibility                                                           | Principal source                                                                           |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Route protection         | Refresh the Supabase session; redirect unauthenticated requests to login | `web/proxy.ts`, `web/src/lib/supabase/proxy.ts`                                            |
| Authentication           | Start provider OAuth and securely exchange the PKCE callback code        | `web/src/app/login/page.tsx`, `web/src/app/auth/callback/route.ts`                         |
| Authorization helpers    | Require active, editor, or administrator profiles                        | `web/src/lib/auth.ts`                                                                      |
| Directory read           | Query sorted people and issue one-hour signed photo URLs                 | `web/src/app/page.tsx`                                                                     |
| Directory experience     | Search, list/profile navigation, phone/map links, photo viewer           | `web/src/components/directory-client.tsx`                                                  |
| Member management        | Add/edit/archive/restore records and manage private photos               | `web/src/app/admin`, `web/src/app/admin/actions.ts`                                        |
| Account administration   | List profile states and call the protected review RPC                    | `web/src/app/admin/accounts`                                                               |
| Language foundation      | English/Ukrainian dictionaries, locale cookie, switcher                  | `web/src/lib/i18n.ts`, `web/src/lib/locale.ts`, `web/src/components/language-switcher.tsx` |
| Installable web metadata | Manifest, icons, Apple home-screen metadata, safe-area viewport          | `web/src/app/manifest.ts`, `web/src/app/layout.tsx`, `web/src/app/globals.css`             |

## Core data model

Deacon responsibilities are separate from access roles. `profiles.ministry_roles` adds designation, and `deacon_groups`, `deacon_group_members`, and `deacon_group_deacons` model assignments. Reads use RLS; editor/admin assignment writes and admin designation changes use audited RPCs. Shared directory loading supplies the full directory and assigned-member views. See [Deacon Groups](DEACON_GROUPS.md) for authorization, navigation, rollout, and future notification boundaries.

### `people`

Directory records are separate from login identities. Fields in the deployed baseline include:

- `id`, `first_name`, `last_name`
- `date_of_birth`, `phone`
- `address_line_1`, `address_line_2`, `city`, `state`, `postal_code`
- `photo_path`, `notes`, `archived_at`
- `created_at`, `updated_at`

The `membership_joined_at` date is included in the checked-in model, forms, search, and profile display. Existing deployed databases require `web/supabase/migrations/20260914210000_add_membership_joined_at.sql` before application code selects the column.

### `profiles`

One profile is created for each Supabase Auth identity. It stores provider identity details, account status, application role, optional one-to-one `person_id`, review metadata, and timestamps.

### `audit_events`

Account decisions are append-only audit records created by the account-review database function. Administrators can read these events under RLS; the current interface does not yet present a dedicated audit-log screen.

### `member-photos` Storage bucket

Real uploads live in a private bucket. The database stores an object path rather than file content. An approved request receives a short-lived signed URL. Editor/admin policies control writes and deletion.

## Important flows

### Directory read

1. The proxy refreshes the Supabase session and rejects unauthenticated access.
2. The page requires an `active` profile.
3. A user-scoped query asks Supabase for people; RLS independently authorizes it.
4. The server signs private photo paths for one hour.
5. The client receives rendered member data and temporary photo URLs for search and navigation.

### Member write

1. A Next.js Server Action requires an active editor or administrator.
2. Input and photo type/size are validated.
3. The photo is uploaded to private Storage, if supplied.
4. The user-scoped client inserts or updates the database row; RLS checks the role again.
5. Failed database operations remove a newly uploaded object where possible, and successful actions revalidate affected routes.

### Account review

1. The admin page is protected by `requireAdmin()`.
2. Its Server Action validates requested status and role values.
3. It calls `public.review_account(...)` with the administrator's authenticated session.
4. The database locks the target profile, verifies authority and administrator safeguards, updates the profile, and writes an audit event atomically.

## Mobile and PWA design

The UI uses dynamic viewport units, safe-area padding, mobile-first layouts, and 44-pixel-or-larger primary controls. On wider screens it retains a centered, constrained layout. A manifest and maskable/Apple icons support installation. There is deliberately no service worker in this phase, so private directory data and photos are not intentionally cached for offline use.

## Bilingual design

The localization layer uses English (`en`) and Ukrainian (`uk`) dictionaries and stores the selected locale in an `app_locale` cookie. UI translations are distinct from member data: names are entered in Ukrainian, while addresses can remain English. The directory detects Ukrainian name data, sorts last names with Ukrainian collation, and uses the full Ukrainian alphabet index regardless of the selected interface language.
