# Production Release Setup and Cutover

Use this guide once, before publishing the first release through `.github/workflows/release.yml`. It configures the GitHub `production` environment, removes alternate Vercel automation, and verifies that merging to `main` no longer changes production.

Do not publish a GitHub Release while completing this guide.

## Values You Will Need

The linked Vercel project is expected to be:

- Project name: `fubc-member-directory`
- Project ID: `prj_wCCdbPKDq7Lh3tfXnW1CMLre5nMX`
- Organization ID: `team_l99I3JIcDUHuFANamiSkB2AV`
- Project root: `mobile`

Confirm these values in Vercel before entering them in GitHub. Do not copy a project ID from another environment or project.

`PRODUCTION_URL` is the stable public HTTPS origin used by members, such as `https://directory.example.org`. Use the custom production domain, not a branch preview URL and not a deployment-specific `*.vercel.app` URL.

## 1. Record the Current Production Deployment

Before changing integrations:

1. Open Vercel and select **fubc-member-directory**.
2. Open **Deployments** and filter to **Production**.
3. Open the deployment currently assigned to the production domain.
4. Record its deployment ID, deployment URL, source commit, creation time, and the stable production domain.
5. Confirm the deployment can still be selected and promoted from the Vercel dashboard.
6. Do not delete this deployment. It is the rollback target for the first release.

Store this record with the first Release notes or release ticket. Do not store tokens or environment-variable values in that record.

## 2. Confirm the Vercel Project

In **Vercel → fubc-member-directory → Settings**:

1. Open **General** and confirm **Root Directory** is `mobile`.
2. Confirm the install command, build command, and output directory come from `mobile/vercel.json`:
   - Install: `corepack enable && corepack pnpm install --frozen-lockfile`
   - Build: `pnpm build:web`
   - Output: `dist`
3. Open **Git** and confirm the connected repository is `ysalo/FUBC-Member-Directory` and the production branch is `main`.
4. Do not reconnect the legacy `web/` application. Its tracked `web/vercel.json` disables all Git deployments.
5. Open **Environment Variables** and confirm the Production environment contains the public client settings needed by the build:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or the supported legacy anon key
   - `EXPO_PUBLIC_ENABLE_APPLE_AUTH=false`, unless Apple authentication is fully configured

Never put a Supabase service-role key or database password in Vercel or GitHub for this web workflow.

## 3. Create a Dedicated Vercel Token

Create a token used only by the GitHub Release workflow:

1. In Vercel, open your avatar menu and select **Account Settings**.
2. Open **Tokens** and select **Create Token**.
3. Name it `github-fubc-production-release`.
4. Scope it to the team that owns `fubc-member-directory`, if Vercel offers scope selection.
5. Choose an expiration period supported by your rotation process. Record the expiration date, but do not record the token itself.
6. Create the token and keep the displayed value open only until it has been saved as the GitHub environment secret in the next section.

Treat this value as a credential. Do not paste it into chat, a terminal command, a repository file, a PR, or release notes.

## 4. Configure the GitHub Production Environment

In GitHub, open **FUBC-Member-Directory → Settings → Environments**:

1. Select **New environment**.
2. Name it exactly `production` and select **Configure environment**.
3. Under **Deployment branches and tags**, choose **Selected branches and tags**.
4. Add a protected tag rule matching `v*`. If GitHub requires a branch entry for environment deployment, add `main`; the workflow still validates that the tag commit is reachable from `main`.
5. Do not add a required reviewer if publishing the GitHub Release is intended to be the sole approval. Add a reviewer only if you deliberately want a second approval after publication.

Under **Environment secrets**, create:

| Name | Value |
| --- | --- |
| `VERCEL_TOKEN` | The dedicated token created in the previous section |

Under **Environment variables**, create:

| Name | Value |
| --- | --- |
| `VERCEL_ORG_ID` | The verified Vercel organization/team ID |
| `VERCEL_PROJECT_ID` | The verified `fubc-member-directory` project ID |
| `PRODUCTION_URL` | The stable public HTTPS production origin, without a trailing slash |

Review the names character-for-character. Repository secrets or variables with similar names do not replace these environment-scoped values.

## 5. Remove Alternate Production Triggers

Remove alternate automation only after `VERCEL_TOKEN` is safely stored in GitHub.

### Deploy Hooks

1. Open **Vercel → fubc-member-directory → Settings → Git**.
2. Find **Deploy Hooks**.
3. Record the owner or consumer of each hook, then delete every hook that can deploy this project.
4. Remove each deleted hook URL from external CI systems, password managers, scripts, and webhook services.

A deploy-hook URL is itself a credential. If it was shared or its consumer is unknown, treat it as compromised and delete it rather than reusing it.

### Tokens and External Integrations

1. In Vercel **Account Settings → Tokens**, review tokens that can access the owning team.
2. Revoke tokens used by retired CI jobs, local automation, or unknown consumers.
3. Keep the new `github-fubc-production-release` token and any explicitly documented administrator token needed for emergency rollback.
4. Review team members and project access. Remove users or integrations that no longer need production deployment access.
5. Review GitHub **Settings → Webhooks**, **Actions secrets and variables**, and installed GitHub Apps for retired services that can call Vercel. Remove their hooks and credentials.

Do not revoke the new workflow token to test failure behavior. Rotate it by creating a replacement, updating the GitHub environment secret, validating the next release, and then revoking the old token.

## 6. Merge the Release Workflow

Merge the release-workflow PR through the protected `main` branch after CI succeeds. The merged `mobile/vercel.json` sets `git.deploymentEnabled.main` to `false`, while leaving branch preview deployments available.

Do not publish a Release yet.

## 7. Verify That Main No Longer Deploys Production

Use a harmless PR after the release workflow is merged. A documentation-only change is sufficient.

Before merging the test PR:

1. Record the current production deployment ID and production domain assignment in Vercel.
2. Note the time and commit SHA.

Merge the test PR into `main`, wait for GitHub CI and any Vercel activity to settle, then verify:

- GitHub CI ran successfully.
- The stable production domain still points to the same recorded deployment ID.
- No new Vercel **Production** deployment was created from the merge.
- A branch Preview may exist; it must not own the production domain.

If the production deployment changed, stop. Do not publish a GitHub Release. Recheck the Vercel project link, root directory, Git settings, Deploy Hooks, and external integrations.

## 8. Verify Manual Backend Readiness

The release workflow intentionally does not deploy Supabase resources.

Before each Release:

1. Review the changes since the previous release for files under `mobile/supabase/migrations/` and `mobile/supabase/functions/`.
2. Follow `mobile/supabase/CONNECT_EXISTING_PROJECT.md`.
3. Do not run `supabase db push` until migration history has been explicitly reconciled.
4. Apply approved SQL through the authenticated Supabase SQL Editor when required.
5. Deploy and verify required Edge Functions manually.
6. Confirm the new client and rollback client are both compatible with the live backend.
7. List the migration and function status in the GitHub Release notes.
8. Include the exact required attestation:

   ```text
   - [x] Backend readiness verified (or no backend changes)
   ```

## 9. Final Cutover Checklist

- [ ] GitHub environment is named exactly `production`.
- [ ] `VERCEL_TOKEN` exists as an environment secret.
- [ ] `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `PRODUCTION_URL` exist as environment variables.
- [ ] The Vercel project root is `mobile`.
- [ ] The previous production deployment ID and URL are recorded and retained.
- [ ] All Vercel Deploy Hooks are removed.
- [ ] Retired Vercel tokens and external deployment integrations are revoked.
- [ ] A post-merge test confirmed `main` does not change the production domain.
- [ ] Supabase readiness is verified manually.
- [ ] The release runbook in `docs/release-runbook.md` has been reviewed.

After every item is complete, follow `docs/release-runbook.md` to prepare and publish the first stable GitHub Release.