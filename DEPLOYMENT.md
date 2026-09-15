# Deploying the Private Member Directory

## Recommendation

Use **Vercel Hobby** for this private, non-commercial test application and keep Supabase Free for authentication, the database, and private photo storage.

Vercel is the best fit because this repository already uses Next.js App Router and Server Actions. It deploys the application without an adapter, connects directly to GitHub, provides HTTPS automatically, and creates a new deployment whenever `main` is pushed. Netlify is a reasonable fallback, but it adds no useful advantage for this project.

> Vercel Hobby is intended for personal, non-commercial use. Move to a paid plan and perform a privacy/security review before using the directory as an operational church system.

## Before you start

You need:

- Access to the GitHub repository: `ysalo/FUBC-Member-Directory`
- Access to the Vercel account that will own the deployment
- Access to Supabase project `lxrrjrezpdzyqkevgwyx`
- Access to the Google Cloud OAuth client already connected to Supabase
- The Supabase project URL and **publishable** key from **Supabase → Project Settings → API Keys**

Do not put the Supabase service-role key or the Google client secret in Vercel. The Google secret belongs only in **Supabase → Authentication → Providers → Google**.

## 1. Import the GitHub repository into Vercel

1. Sign in at [vercel.com](https://vercel.com/) using GitHub.
2. Select **Add New → Project**.
3. Import **ysalo/FUBC-Member-Directory**. If it is not listed, grant the Vercel GitHub app access to that repository.
4. Use these project settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Next.js |
   | Root Directory | `web` |
   | Build Command | leave at the Next.js default (`pnpm build`) |
   | Output Directory | leave at the Next.js default |
   | Install Command | leave at the detected pnpm default |
   | Node.js Version | 24.x |

5. Do not deploy yet; add the environment variables in the next section first.

The Root Directory is important. The Next.js application and `pnpm-lock.yaml` are under `web`, not at the repository root.

## 2. Add Vercel environment variables

Add these under the project's **Environment Variables** section:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lxrrjrezpdzyqkevgwyx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your `sb_publishable_...` key from Supabase |
| `NEXT_PUBLIC_ENABLE_APPLE_AUTH` | `false` |

Select **Production**, **Preview**, and **Development** for each variable. The publishable key is designed to be used by browser applications; Row Level Security remains the actual data boundary.

Click **Deploy**. When it finishes, open the deployment and copy its stable production origin, for example:

```text
https://fubc-member-directory.vercel.app
```

Use your actual Vercel origin everywhere that `<production-origin>` appears below. Do not include a trailing slash.

## 3. Configure Supabase redirect URLs

In **Supabase → Authentication → URL Configuration** set:

```text
Site URL
<production-origin>
```

Add these exact redirect URLs:

```text
http://localhost:3000/auth/callback
<production-origin>/auth/callback
```

Keep the localhost entry so local development continues to work. Use an exact production callback rather than a wildcard.

For the first deployment, do not enable OAuth on Vercel Preview URLs. Preview URLs change and should not become accidental entry points to private data. If preview OAuth is needed later, follow [Supabase's Vercel preview redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls#vercel-preview-urls) and add only the account-specific wildcard it describes.

## 4. Update the Google OAuth client

Open **Google Cloud Console → Google Auth Platform → Clients**, then select the Web application client used by Supabase.

Under **Authorized JavaScript origins**, include:

```text
http://localhost:3000
<production-origin>
```

Under **Authorized redirect URIs**, keep this exact Supabase callback:

```text
https://lxrrjrezpdzyqkevgwyx.supabase.co/auth/v1/callback
```

Do **not** put the Vercel `/auth/callback` URL in Google's Authorized redirect URIs. Google returns to Supabase first; Supabase then returns to the application's allowlisted callback.

In **Google Auth Platform → Audience**:

- If the app is in **Testing**, add every person who will test sign-in as a test user.
- Keep only the `openid`, email, and profile scopes unless the application is later expanded to access other Google services.
- Publishing the OAuth app is optional for this small personal test, but users not listed as test users cannot sign in while it remains in Testing.

Google settings can take a few minutes to propagate.

## 5. Verify the production deployment

Use a private/incognito window and work through this checklist:

1. Open `<production-origin>` and confirm it redirects to `/login`.
2. Sign in with the existing administrator's Google account.
3. Confirm the administrator can open the directory and `/admin/accounts`.
4. Sign out.
5. Sign in with a second Google account. It should land on `/access/pending` and must not be able to read the directory or private photos.
6. From the administrator account, approve that request as a member.
7. Refresh the second account and confirm directory access now works.
8. Test one add/edit operation, including a photo smaller than 4 MB.
9. Revoke the second account and confirm it loses access.
10. On an iPhone, open the production URL in Safari, test navigation, and use **Share → Add to Home Screen**.

If the administrator cannot sign in, do not create a second administrator blindly. Verify the signed-in Google email matches the existing active admin profile in Supabase.

## 6. Future updates

Every push to `main` will create a new production deployment automatically:

```powershell
git add .
git commit -m "Describe the change"
git push origin main
```

Pull requests and non-production branches create Vercel Preview deployments. Because preview OAuth is intentionally not allowlisted, use previews for public/login-screen checks and use localhost or production for full sign-in testing.

Environment-variable changes require a redeploy. In Vercel, open **Deployments**, select the latest deployment, and choose **Redeploy**.

## Optional: add a custom domain

A generated `vercel.app` address is adequate for testing. If you later add a domain:

1. Add it in **Vercel → Project → Settings → Domains**.
2. Change Supabase's Site URL and add `https://your-domain/auth/callback`.
3. Add `https://your-domain` to Google's Authorized JavaScript origins.
4. Leave Google's Authorized redirect URI pointing to the Supabase callback unless you also configure a Supabase custom domain.
5. Redeploy and repeat the production checklist.

## Troubleshooting

### Google reports `redirect_uri_mismatch`

Google's Authorized redirect URI must exactly equal:

```text
https://lxrrjrezpdzyqkevgwyx.supabase.co/auth/v1/callback
```

Check scheme, project reference, path, and trailing slash.

### Sign-in returns to localhost or the wrong site

Set the Supabase Site URL to the production origin and make sure `<production-origin>/auth/callback` is in the redirect allowlist. Then try again in a new private window.

### Google says the app is not available to this user

Add the Google account under **Google Auth Platform → Audience → Test users**, or publish the OAuth app.

### Vercel builds the wrong folder or shows a 404

Set **Vercel → Project → Settings → Build and Deployment → Root Directory** to `web`, then redeploy.

### Vercel reports missing Supabase configuration

Confirm both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exist for the Production environment, then redeploy. Variable changes do not alter an already-built deployment.

### A photo upload is rejected

The deployed app intentionally limits photos to 4 MB because [Vercel Functions have a 4.5 MB request/response body limit](https://vercel.com/docs/functions/limitations#request-body-size). Resize or compress the image and retry.

## Official references

- [Deploying GitHub projects with Vercel](https://vercel.com/docs/git/vercel-for-github)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Google login setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
