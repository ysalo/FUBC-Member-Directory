# Publishing a New Production Version

This runbook publishes the Expo web application to Vercel production through a stable GitHub Release.

Merging to `main` runs CI but does not authorize a production deployment. The release workflow runs only when a stable GitHub Release is published.

## Before You Start

Confirm that:

- The release workflow is merged into `main`.
- Vercel Git deployment for `main` is disabled.
- The GitHub `production` environment has `VERCEL_TOKEN` configured as a secret.
- `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `PRODUCTION_URL` are configured as environment variables.
- The previous Vercel production deployment is still available for rollback.
- Any required Supabase migrations and Edge Functions have been applied and verified manually.

Before enabling this process, audit **Vercel project settings** for `fubc-member-directory`:

- Remove every Deploy Hook that can create a production deployment.
- Confirm the Git production branch is `main`; `mobile/vercel.json` disables Git-triggered deployments from that branch.
- Confirm no external CI service or integration has a Vercel token that can deploy this project.
- Limit project administration and production deployment access to trusted repository administrators.

The repository enforces GitHub Release publication as its only automated production path. A Vercel project administrator can still deploy or promote manually in the Vercel dashboard; reserve that access for documented emergency rollback only.

Do not publish a release containing backend-dependent client changes until the backend is ready. Do not run an unreconciled `supabase db push`.

## 1. Prepare the Release PR

Create a release branch from the latest `main` and update only the application version for the release batch:

```powershell
git switch main
git pull --ff-only origin main
git switch -c release/vX.Y.Z
Set-Location mobile
pnpm install --frozen-lockfile
```

Edit `mobile/package.json` and update its `version` field to the next stable SemVer value:

- Patch: backward-compatible fixes, for example `1.0.14` to `1.0.15`.
- Minor: backward-compatible features, for example `1.0.14` to `1.1.0`.
- Major: incompatible changes, for example `1.0.14` to `2.0.0`.

`mobile/package.json` is the application version source. Do not manually duplicate the version in `app.json` or `mobile/app.config.js`.

Run the release checks from `mobile/`:

```powershell
pnpm verify
pnpm build:web
```

Open a pull request into `main`. Wait for the PR checks to pass, review the diff, and merge through the normal protected PR process. Do not create or publish the GitHub Release from the release branch.

## 2. Create the Draft Release

After the PR is merged:

1. Open the repository's **Releases** page in GitHub.
2. Select **Draft a new release**.
3. Choose the exact latest `main` commit that contains the merged release PR.
4. Create the tag `vX.Y.Z`, where `X.Y.Z` exactly matches `mobile/package.json` on that commit.
5. Select **Generate release notes**.
6. Review the generated notes and add a concise summary, breaking changes, known issues, and backend changes.
7. Leave the Release as a draft while checking the readiness list below.

The tag must be a stable three-part version. Do not use `latest`, a prerelease suffix, or a tag that points at a different commit from the Release.

## 3. Complete Release Readiness

Add this exact line to the Release body:

```text
- [x] Backend readiness verified (or no backend changes)
```

Before publishing, verify each applicable item:

- [ ] The tag is `vX.Y.Z` and matches `mobile/package.json`.
- [ ] The tagged commit is on `main`.
- [ ] CI passed for the merged commit.
- [ ] Supabase migrations are applied and verified, or no migration is required.
- [ ] Required Supabase Edge Functions are deployed and verified, or none is required.
- [ ] The client is compatible with the current backend contract `expo-directory-v3`.
- [ ] The client remains compatible with the intended rollback deployment.
- [ ] Release notes list backend changes, or explicitly say there are none.
- [ ] The production URL and Vercel project settings are correct.
- [ ] The previous production deployment is available for rollback.

The application version and Supabase compatibility contract are separate. Do not change `expo-directory-v3` for a routine application version bump.

## 4. Publish the Release

When the readiness list is complete, select **Publish release**.

Publishing starts the `Release web production` GitHub Actions workflow. The workflow will:

1. Reject drafts and prereleases.
2. Confirm the Release version matches `mobile/package.json`.
3. Resolve the tag to its immutable commit and verify that commit is reachable from `main`.
4. Run `pnpm verify` against the tagged source.
5. Build and stage a production Vercel deployment without changing the production domain.
6. Smoke-test the staged deployment.
7. Promote the verified deployment and smoke-test the stable production URL.

A successful GitHub Release publication does not mean the deployment succeeded. Confirm the workflow result and Vercel deployment status.

## 5. If the Workflow Fails

If validation, tests, the build, or staged smoke tests fail, the existing production deployment should remain unchanged.

Fix the problem on a new branch and PR. Then publish a new version. Do not move an existing tag or reuse a published version for different source code.

If promotion reports a timeout, inspect GitHub Actions and Vercel before retrying. The promotion may have completed despite the timeout.

## 6. Roll Back

If the new production deployment is unhealthy after promotion:

1. Record the failed Release tag, commit, and Vercel deployment ID.
2. Confirm backend compatibility with the previous application version.
3. In Vercel, promote the previously recorded retained deployment.
4. Verify the production URL, app shell, authentication callback route, and critical read-only pages.
5. Record the rollback and final deployment ID in the incident or release notes.

Do not rebuild an old commit, move a published tag, or rerun an older Release as a rollback mechanism. A source fix requires a new version and a new pull request.

## Release Notes Template

```markdown
## Summary

Describe the user-visible changes.

## Changes

- Change one
- Change two

## Backend

- Migrations: none, or list the applied migration files
- Edge Functions: none, or list the deployed functions

- [x] Backend readiness verified (or no backend changes)

## Breaking Changes

None, or describe the migration and compatibility requirements.

## Known Issues

None, or list known issues and workarounds.
```
