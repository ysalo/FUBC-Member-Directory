# Implementation Status and Operations

Deacon Groups are implemented locally: separate ministry designation, editor/admin group management, assigned-member lists, upcoming birthdays, and bilingual bottom navigation. Deployment requires the additive migration first. See [Deacon Groups](DEACON_GROUPS.md). Notifications and pastor-specific workflows are deferred.

Verification for this release: TypeScript and production webpack build passed; targeted lint passed with only existing image-element warnings. The PostgreSQL-in-memory group suite and three birthday unit tests passed. All 30 public/route-protection Playwright checks passed across configured desktop/iPhone viewports using the production server. Development-server testing initially timed out on the slow filesystem. Authenticated new-screen interactions, multi-session database contention, and real-iPhone Safari acceptance remain manual checks after migration.

Last reviewed against the workspace: September 14, 2026.

## Current deployed baseline

| Capability                | Status                   | Notes                                                                           |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| Next.js web application   | Implemented and deployed | Vercel production URL is `https://fubc-member-directory.vercel.app`             |
| Google OAuth              | Implemented/configured   | Supabase brokers provider authentication                                        |
| Apple OAuth               | Implemented, disabled    | Hidden behind `NEXT_PUBLIC_ENABLE_APPLE_AUTH=false`; credentials still required |
| Approval workflow         | Implemented              | Pending, active, denied, and revoked states                                     |
| Role management           | Implemented              | Member, editor, and administrator                                               |
| Admin safeguards/audit    | Implemented in database  | Atomic RPC blocks self/final-admin removal and records decisions                |
| Member directory          | Implemented              | Search and last-name/first-name query ordering                                  |
| Member management         | Implemented              | Add, edit, archive, restore, and 4 MB photo uploads                             |
| Private photo storage     | Implemented              | Supabase private bucket and one-hour signed URLs                                |
| Responsive/PWA foundation | Implemented              | Manifest, icons, safe-area/dynamic viewport behavior; no service worker         |
| Fictional demo data       | Available                | Seed SQL contains 12 fictional records and bundled placeholder images           |

## Current release candidate

| Requested change         | Workspace status                                                                                       | Deployment dependency                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Membership date          | Implemented in schema, add/edit forms, profile display, and search                                      | Apply the new Supabase migration before deploying code that selects the column |
| Contacts-style directory | Implemented with last-name sections, compact contact rows, bottom search, and an iPhone-friendly index | Deploy after the database migration                                            |
| English/Ukrainian UI     | Implemented across sign-in, access, directory, profile, member management, and account management      | Deploy after the database migration                                            |
| Ukrainian member data    | Updated repeatable seed uses Ukrainian fictional names and English addresses                            | Run the seed only when replacing disposable demo data is desired               |
| Locale-aware ordering    | Ukrainian names use Ukrainian collation and alphabet grouping regardless of interface language          | Verify with authenticated production data after deployment                     |

The release candidate passes TypeScript, a production Next.js build, and 15 Playwright checks across desktop, iPhone 13, and iPhone SE projects. It is not yet the production baseline until the additive migration is applied and the commit is pushed to `main`.

## Deployment model

- GitHub repository: `https://github.com/ysalo/FUBC-Member-Directory`
- Production branch: `main`
- Web project root in Vercel: `web`
- Hosting: Vercel Hobby for the personal, non-commercial test
- Backend: Supabase project `lxrrjrezpdzyqkevgwyx`
- Runtime: Node.js 24.x and pnpm 12.4.1

Every push to `main` normally triggers a production build. Environment-variable changes require a redeployment. Keep exact localhost and production OAuth callback URLs in Supabase; preview OAuth is intentionally not part of the current setup.

## Database operations

The checked-in `20260914130000_initial_schema.sql` is a destructive clean-test baseline. It drops and recreates application types/tables and should not be rerun against data that must be preserved. Although the project remains disposable today, new schema changes should be delivered as a later migration once retaining deployed demo data matters.

For the membership-date change, apply `web/supabase/migrations/20260914210000_add_membership_joined_at.sql` in Supabase SQL Editor before deploying application code that reads `membership_joined_at`. If schema and code are deployed out of order, the directory query can fail because the column does not yet exist. The migration uses `add column if not exists`, so it is also safe after a reset that used the updated baseline.

The seed script is repeatable for its fixed fictional IDs, but it is demo data—not an operational backup or migration mechanism.

## Release checklist

1. Review `git status` and the diff; do not include `.env.local` or credentials.
2. Apply any required additive Supabase migration before deploying dependent code.
3. Run from `web`:

   ```powershell
   pnpm typecheck
   pnpm lint
   pnpm build
   pnpm test:e2e
   ```

4. Test at 320, 375, and 390-pixel widths and confirm there is no horizontal overflow.
5. Verify English and Ukrainian UI, alphabet grouping, search, date formatting, and member management.
6. Push to `main` and watch the Vercel build logs.
7. In a private browser, test administrator Google sign-in and directory access.
8. Test a second account's pending-to-approved transition and then revoke it.
9. Confirm pending/denied/revoked users cannot load member records or private photos.
10. Test Add to Home Screen and authenticated navigation in Safari on a real iPhone.

## Routine administration

- Use `/admin/accounts` for account status, role, and member linking.
- Use `/admin` for directory record maintenance.
- Keep at least one active administrator; the database enforces this during RPC reviews.
- Use Supabase logs/database inspection for troubleshooting, but avoid direct profile edits except first-admin bootstrap or test recovery.
- Archive member records instead of deleting them through ad hoc SQL.
- Update Google test users or publish the OAuth consent screen when additional testers need access.

## Known follow-up work

- Complete authenticated Playwright fixtures and cover role/status transitions.
- Add clearer success/error feedback for administrative operations.
- Expose audit events through an administrator UI if operational review becomes necessary.
- Perform a privacy/security review before entering real member data.
- Reconsider Vercel/Supabase plan limits and backups before non-test use.
- Defer a native SwiftUI client until the bilingual responsive web workflow is validated.

For exact environment variables, redirect URLs, troubleshooting, and redeployment steps, see `DEPLOYMENT.md` at the repository root.
