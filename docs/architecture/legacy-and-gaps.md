# Legacy Areas And Known Gaps

This chapter prevents inactive or uncertain repository areas from being mistaken for production architecture. Legacy and prototype internals were intentionally not explored.

**Evidence:** status is based only on top-level paths, active entry points, deployment configuration, and explicit repository documentation as of 2026-09-22.

## Legacy And Non-Production Inventory

| Path | Classification | Evidence and handling |
| --- | --- | --- |
| `web/` | Legacy web application | Active documents identify `mobile/` as the single web/native app, and `web/vercel.json` sets Git deployment to disabled. Do not add new product behavior here. |
| `work/expo-app/` | Historical/working copy | It is under the non-production `work/` area. Current commands and ownership point to root `mobile/`. Do not treat it as a second active app. |
| `work/login-mockup-preview/` | UI prototype | Name and location identify a preview artifact; not part of the active build. |
| `work/visitation-ui/` | Standalone UI prototype | Not referenced by the active Expo entry point. |
| `work/loading-ui/` | UI prototype | Not referenced by the active Expo entry point. |
| `work/deacon-duty-mockups.html` | Static design artifact | Not part of the active Expo route tree. |
| Other `work/` scripts, SQL, logs, images, and lockfiles | Scratch/research artifacts | Do not execute or promote without separate review of purpose, safety, and current applicability. |
| `mobile/dist/`, test output, Expo caches, and local `.vercel/` metadata when present | Generated/local state | Build or tool output, not architecture source of truth. |

Classification does not authorize deletion. Removing legacy or scratch material should be a separate task with owner review and history checks.

## Documentation Drift Found

| Documented claim | Current evidence | Required correction/action |
| --- | --- | --- |
| Supabase setup commands run from `work/expo-app/mobile` | Active app is root `mobile/` | Correct the working directory to `D:\church_directory\mobile`. |
| Release setup says “see `.env.example`” | No checked-in `.env.example` exists | Remove the dead reference or add a secrets-safe template in a separate reviewed task. |
| Backend README describes account deletion as a queued request requiring a worker | Current UI invokes `delete-account`; the function deletes the Auth identity directly | Rewrite the account-deletion section while preserving any still-relevant provider-revocation limitation. |
| Existing-project notes repeat the person-based participant migration observation | Duplicate historical paragraphs | Consolidate without changing the historical claim. |
| Release flow assumes `dev` is available remotely | No `origin/dev` existed in this clone on 2026-09-22 | Create/publish `dev`, then configure protection and Vercel Preview behavior before relying on the flow. |
| Seed guard requires `expo-directory-v1` | Current client requires `expo-directory-v3` | Treat `seed.sql` as historical until reviewed and updated; do not run it against a current environment. |

This documentation change corrects only low-risk navigation/setup text. Behavioral backend documentation should be updated alongside focused tests or operational verification.

## Architecture And Operational Gaps

### Hosted state is not proven

Checked-in SQL and TypeScript show intended contracts, but the hosted catalog, migration history, policies, function versions, Auth providers, callback URLs, bucket policies, and jobs were not available for read-only inspection.

**Close with:** authenticated read-only catalog/settings review, dated evidence, and contract comparison. Do not apply or repair migrations during discovery.

### Development backend isolation is unknown

Vercel Preview variables may point to production or to an isolated project. Repository files cannot prove the mapping.

**Close with:** inspect only variable names/scopes and safe project identifiers in Vercel; confirm matching Supabase project identity without recording keys.

### Branch controls are unknown

The workflow listens to `dev` and `main`, but configuration cannot prove remote branch existence, protection, required checks, force-push restrictions, or review requirements.

**Close with:** publish `dev` through the authorized workflow, then inspect GitHub rulesets/protection and a test feature PR.

### Migration history is intentionally blocked

`CONNECT_EXISTING_PROJECT.md` records a timestamp collision between retired and active SQL histories. Running `supabase db push` before explicit reconciliation could apply the wrong assumptions.

**Close with:** authenticated `migration list`, catalog comparison, an approved reconciliation record, and a reviewed dry run. This is a separate backend operation.

### Notification delivery is not established

Tables, tokens, and queue helpers do not prove a deployed worker or successful delivery. Web deliberately makes no notification promise.

**Close with:** identify worker/scheduler ownership, inspect deployed job/function status, and test on a disposable native account/device.

### Cross-service deletion needs an operations procedure

Member deletion sequences Auth, Storage, and PostgreSQL operations without a distributed transaction. Structured retries reduce risk but do not eliminate partial failure.

**Close with:** define observable checkpoints, retry/manual repair steps, audit expectations, and disposable-record acceptance tests.

### Native distribution is unestablished

An Expo iOS export proves that JavaScript bundles. It does not prove signing, App Store configuration, OAuth callbacks in an installed build, push delivery, or physical-device behavior.

**Close with:** a separate native release checklist and verified signed-device/App Store workflow.

### Data provenance and retention need owner decisions

The repository shows forms, triggers, fixtures, and tables but does not prove how current live member records were originally collected or how long audit, visit, queue, and deleted-account metadata should be retained.

**Close with:** owner-approved source-of-record and retention decisions, followed by a separate privacy/operations review.

## Discovery Limits

This architecture pass did not:

- inspect legacy application internals;
- read or export live member/account data;
- reveal environment values or credentials;
- run SQL against a hosted project;
- initialize/link the Supabase CLI or alter migration history;
- deploy, merge, promote, or rollback an application;
- claim live OAuth, push, physical-device, or App Store verification.

These limits are deliberate. Unknowns are safer and more actionable when they remain clearly labeled.

## Related Reading

- [Architecture overview](README.md)
- [Data architecture](data.md)
- [Security and representative flows](security-and-flows.md)
- [Environments and delivery](environments-and-delivery.md)
- [Web application release and deployment](../web-app-release.md)