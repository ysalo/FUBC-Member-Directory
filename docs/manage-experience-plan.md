# Management revamp delivery plan

The [specification and UX audit](manage-experience-spec.md) define the acceptance contract. Implementation is assigned to GPT-6.1-Sol at the user's request.

| Issue | Deliverable | Dependencies |
| --- | --- | --- |
| [#138](https://github.com/ysalo/FUBC-Member-Directory/issues/138) | Task hub, dedicated member/account routes, account linking and consistent management navigation | #139 read contracts |
| [#139](https://github.com/ysalo/FUBC-Member-Directory/issues/139) | Bounded backend search, independent sections, resilient paging and targeted enrichment | Reviewed additive database functions |
| [#140](https://github.com/ysalo/FUBC-Member-Directory/issues/140) | Searchable group overview, virtualized selected/all candidate views, persistent actions and preserved drafts | #139 paging and complete group context |

## Sequence

1. Audit the current shared Expo implementation and existing issue #133; retain audit history and its mutation contracts.
2. Read and apply Anthropic frontend-design and Vercel web-design-guidelines, preserving the app's established palette and typography. Record concrete findings and responsive behavior in the spec.
3. Implement and test read contracts before wiring UI. Group context carries complete selected IDs; candidate records and photos are page-bounded. Legacy import/family loaders remain only where explicitly needed.
4. Implement the workspace and group editor on `feat/manage-experience` from `dev`. Do not alter unrelated untracked audit planning documents.
5. Review backend authorization/search and rehearse any additive SQL against the documented existing project. Manually apply only the reviewed migration; do not reconcile migration history or run `db push`. Verify old-client compatibility and read-only live smoke checks.
6. Run `pnpm verify`, `pnpm build:web`, and synthetic browser workflows. Inspect phone/desktop screenshots and exercise paging, stale responses, failures, guarded saves and role restrictions. Fix review findings.
7. Open a feature PR to `dev` with linked issues, actual evidence, rollback instructions and verification limits. Wait for CI and review; check Vercel Preview and state any authentication boundary explicitly.
8. Merge the feature PR, open a separate `dev` to `main` release PR, verify CI/backend readiness, merge and check the production deployment. Record outcome in `web-app-release.md` and the final report.

## Boundaries

User authorization includes issue creation, implementation and merge to main. Repository release gates and branch protections still apply. Never claim live OAuth, physical iPhone testing or authenticated hosted preview checks based on synthetic fixtures. Production member/account records are not test fixtures. Keep all mutation smoke checks disposable or rolled back.

Related existing issues #87, #84 and #81 are not implicitly closed by this work; the audit records them without replacing their focused requirements.
