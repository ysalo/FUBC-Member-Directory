# Existing-project connection and migration gate

The Expo app is configured locally with the existing project's public URL and publishable key in ignored `mobile/.env.local`. Values are intentionally absent from this document. The original configuration file was read without modifying it. The existing Auth endpoint accepted the public key on 2026-09-16: Google sign-in is enabled; Apple sign-in is disabled. `EXPO_PUBLIC_ENABLE_APPLE_AUTH=false` reflects that verified setting.

Live feature bindings use Supabase whenever the public project configuration is present. Directory, profiles, favorites, reminders, group membership, authorized birthdays, participant visits, account management and member archival read/write through the typed repositories. No configured session falls back to the demonstration repositories when a query fails.

The reviewed Expo schema was applied through the authenticated Supabase SQL Editor on 2026-09-16. The legacy `public` and `app_private` application schemas contained test data and were reset with the user's authorization. `auth` and `storage` infrastructure were retained. Existing Auth users were backfilled into the new profiles table, including the existing active administrator; future signups are created as pending.

The deployed contract reports `expo-directory-v3`. The leadership-ministry migration and `20260917120000_visitation_leader_planning.sql` were applied through the authenticated Supabase SQL Editor; the latter was applied and verified on 2026-09-18. Its verification confirmed the generic planner/participant schema, renamed indexes, authenticated `save_visit` execution grant, RLS on both visitation tables, and zero pre-existing visitation rows. Earlier verification found 15 application tables with RLS enabled, 13 public-schema policies, four private-photo policies, one signup trigger, and one active administrator. The two obsolete prototype visitation cron jobs remain present but disabled. The private `member-photos` bucket was retained and normalized to the reviewed limits; its old test objects were not deleted.

The dashboard execution does not create or reconcile Supabase CLI migration history. Do **not** run `supabase db push` against this project until the linked migration history has been inspected and reconciled. The retired migration chain used the timestamp `20260916010000` for different SQL than the mobile contract file with that timestamp.

## Safe next steps

From `D:\church_directory\work\expo-app\mobile`, authenticate with the intended Supabase account using the CLI's browser flow. Do not paste secrets into tracked files or command arguments:

```powershell
pnpm dlx supabase login
pnpm dlx supabase projects list
```

Compare the intended project's reference with the host in the existing ignored `EXPO_PUBLIC_SUPABASE_URL`. Only then initialize/link this worktree, using the verified reference rather than a guessed or newly selected project:

```powershell
pnpm dlx supabase init
pnpm dlx supabase link --project-ref <verified-project-reference>
pnpm dlx supabase migration list --linked
```

Compare the linked history with the three deployed local migrations. Reconcile it explicitly with the Supabase CLI before any future push; do not mark the retired SQL and mobile contract as interchangeable merely because a timestamp collides. Always review `supabase db push --linked --dry-run` before a real push.

After approved migrations, generate database types, enable and configure desired Auth providers and callback URLs, restart Expo so it reloads the public configuration, and verify the app on a physical iPhone. Confirm RLS using real accounts representing pending/member/deacon/pastor/editor/admin access. Apple provider credentials and callback setup remain necessary before enabling the Apple sign-in button. The unlisted App Store build also requires its signed native callback registration.

Notification delivery and Apple account-deletion worker deployment remain separate documented backend operations. The app must not claim a push was delivered or an Auth identity deleted merely because a queue/request row exists.
