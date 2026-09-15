# Authentication, Approval, and Security Model

## Trust boundaries

Google or Apple proves who a user is; it does not decide whether that identity may see the directory. Supabase Auth manages the authenticated session, while the application's `profiles` row controls status and role. PostgreSQL Row Level Security (RLS) and Storage policies are the authoritative authorization boundary.

The browser receives only the Supabase project URL and publishable key. The application must never contain the Supabase service-role key. Provider client secrets belong in Supabase's provider configuration, not in Vercel or browser code.

## OAuth sign-in flow

```text
User -> Next.js login -> Google/Apple -> Supabase Auth
     -> /auth/callback with a one-time code
     -> exchange code for session
     -> read own profile status
     -> active: directory
        pending/denied/revoked: matching status page
```

The login page derives `redirectTo` from the current application origin. The callback uses the PKCE code exchange and passes any requested `next` path through `safeNextPath`, which accepts only safe internal paths. External return URLs are rejected.

The session proxy refreshes auth cookies and sends unauthenticated requests to `/login`. This improves navigation behavior, but the proxy is not the sole security control: protected pages also require a profile and the database applies RLS.

## Profile creation and approval

An `auth.users` insert trigger creates a matching `public.profiles` row with:

- identity ID, email, display name, avatar, and provider metadata;
- role `member`;
- status `pending`.

Pending, denied, and revoked users may read their own profile so the application can route them to the correct status page, but `current_role()` returns a role only when the profile is active. Consequently those users cannot read `people` or private member photos.

An administrator approves a user through the `review_account` RPC. This security-definer function:

1. Requires the caller to be an active administrator.
2. Locks and loads the target profile.
3. Prevents self-demotion and self-revocation.
4. Prevents removal of the final active administrator.
5. Updates status, role, optional member link, note, and reviewer metadata.
6. Inserts a detailed audit event in the same transaction.

The optional `profiles.person_id` foreign key is unique, so no two login identities can be linked to the same directory member.

## Effective permissions

| Resource/action             | Pending, denied, revoked | Active member | Active editor | Active admin |
| --------------------------- | -----------------------: | ------------: | ------------: | -----------: |
| Read own profile            |                      Yes |           Yes |           Yes |          Yes |
| Read active people          |                       No |           Yes |           Yes |          Yes |
| Read archived people        |                       No |            No |           Yes |          Yes |
| Create/update people        |                       No |            No |           Yes |          Yes |
| Read private photos         |                       No |           Yes |           Yes |          Yes |
| Upload/update/delete photos |                       No |            No |           Yes |          Yes |
| List all profiles           |                       No |            No |            No |          Yes |
| Review accounts             |                       No |            No |            No |          Yes |
| Read audit events           |                       No |            No |            No |          Yes |

Archiving is implemented as an update to `archived_at`, not a hard deletion. The ordinary member policy exposes only records where `archived_at` is null.

## Deployment configuration

Vercel needs only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_ENABLE_APPLE_AUTH=false` until Apple is configured

Supabase's production callback allowlist includes `https://fubc-member-directory.vercel.app/auth/callback`. Google's authorized redirect URI points to Supabase (`https://lxrrjrezpdzyqkevgwyx.supabase.co/auth/v1/callback`), not directly to Vercel. See the repository-root `DEPLOYMENT.md` for the complete setup.

## Security limitations and operational cautions

- This is currently disposable test software on free-tier hosting, not a completed production privacy program.
- Directory data contains personal information. Before operational church use, establish consent, retention, incident response, backups, access reviews, and applicable privacy/legal controls.
- Date of birth is particularly sensitive. Consider whether storing the year is necessary and restrict administrative exports if those are added later.
- Signed photo URLs expire after one hour, but anyone who receives an active URL can use it until expiration.
- The app deliberately has no offline service worker. Avoid adding caches that persist private API responses or images.
- Review administrator accounts and audit events periodically. Do not bypass the RPC for routine account decisions.
- Moving beyond a personal demo should include paid-plan capacity review, database backups, monitoring, authenticated end-to-end tests, and a formal security review.
