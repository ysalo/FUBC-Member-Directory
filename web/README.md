# Private Member Directory

Phone-first private directory built with Next.js and Supabase. Google OAuth is the initial sign-in provider. Apple OAuth is implemented but hidden until credentials are available.

## Local setup

1. Run `supabase/migrations/20260914130000_initial_schema.sql` in the SQL Editor. It self-resets the disposable public application schema and recreates retained Auth users as pending accounts.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key.
3. In Supabase Authentication → Providers, enable Google and enter the Google client ID and secret.
4. In Google Cloud, add the Supabase callback shown by the provider screen, normally `https://<project-ref>.supabase.co/auth/v1/callback`.
5. In Supabase Authentication → URL Configuration, use `http://localhost:3000` as the local Site URL and allow `http://localhost:3000/auth/callback`.
6. Run `pnpm dev` and open `http://localhost:3000`.

For the fictional demo directory, run `supabase/seed.sql` in the SQL Editor after the baseline migration. It is safe to rerun and uses the bundled placeholder portraits in `public/member-photos`.

After the intended administrator signs in with Google once, promote that pending profile in the SQL Editor:

```sql
update public.profiles
set status = 'active', role = 'admin', reviewed_at = now(), updated_at = now()
where email = 'your-admin-email@example.com';
```

The administrator can then review other accounts at `/admin/accounts`.

## Apple provider

After configuring Apple in Supabase, set `NEXT_PUBLIC_ENABLE_APPLE_AUTH=true`. No application code change is required. Keep it `false` until the Apple provider is ready.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm exec playwright install
pnpm test:e2e
```

## Vercel test deployment

Follow the repository's complete [deployment guide](../DEPLOYMENT.md) for the exact Vercel, Supabase, and Google settings plus the production verification checklist.

Provider secrets belong in Supabase/provider settings, never in Vercel browser-visible environment variables. This project intentionally has no service worker, so private directory data and photos are not cached for offline use.
