# Management experience revamp

## Outcome and scope

Administrators and editors can find a person, review access, and update a group without downloading the whole directory on entry or scrolling past a roster to save. Preserve the shared Expo native/web application, existing permissions, audit capture and rollback from #133, and existing record routes. This spec authorizes the implementation work requested October 6, 2026.

## Observed problems

| Evidence | User impact | Required change |
| --- | --- | --- |
| `management-repository.ts:50` loads all people, accounts, departures and signed photos together | Opening Manage waits for unrelated data; result limits may silently omit people | Independent, bounded member/account queries; lazy sections; page-scoped enrichment |
| `ManageScreen.tsx:158` invokes the aggregate loader on focus | Returning from editing blanks the list; stale requests may replace a newer search | Explicit initial/refresh/append states; stale-response protection and retained list context |
| `ManageScreen.tsx:180` filters downloaded members | Search cannot find unloaded results once pagination is introduced | Apply search/status constraints before backend pagination |
| `ManageScreen.tsx` puts tools, approvals, filters and results in one scrolling header | Everyday navigation and search disappear above the roster | Compact persistent workspace controls and clearly separated tools |
| `GroupAssignmentScreen.tsx:176` uses one ScrollView and `.map()` for the roster | Every row mounts, and Save is after all rows | Virtualized candidate list and persistent action region |
| `management-repository.ts:500` constructs group names without patronymic | People with similar names are difficult to distinguish | Shared structured-name display and full patronymic search |
| `GroupAssignmentScreen.tsx:212` labels its clear icon “Search members” | Screen-reader users cannot identify the action | Correct clear label; consistent accessible controls |
| Group editor has only one candidate view and a distant error area | Reviewing existing selections and resolving save errors is difficult | Selected/all modes, counts, assignment context, nearby validation/retry |
| `GroupsManagementScreen.tsx:27` discards refresh errors when prior data exists | Stale groups look current | Visible recoverable refresh failure and retry |
| Group overview uses full editor dataset | Reading group names signs every candidate photo and loads birth dates | Lightweight overview query, with full editor metadata only when necessary |

## Design contract

Use the existing appearance tokens and system font. Light anchors: background #F1F0EB, surface #FAF9F6, text #171B20, secondary #686B70, accent #EF5A24, line #D8D5CE; use the existing dark equivalents. Titles 24–30px, section headings 17–20px, normal controls 16px and secondary text 13–14px, respecting the existing text scale. Accent identifies the current view and primary action. Left-align labels and data; keep explanatory copy short. Use understated rows and separators instead of turning every action into a large card.

Apply [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) to hierarchy, restraint and coherent action wording, and [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) to accessible controls, virtualization, focus and failure states. These guidelines adapt to React Native Web; do not introduce a second web implementation or unrelated typography/branding changes.

```text
Manage                         Add member
Members / Accounts / Groups     [task navigation]
Member management (dedicated route)
Search people…                 Active / Former members
-----------------------------------------------
First name P. Last name         Group / status
… first bounded page …
Loading more… / Load more / Retry

Edit group
Name, type, responsible deacons
Members    Selected (32) | All members
Search members…
-----------------------------------------------
[✓] First name P. Last name     Current group
… virtualized results …
-----------------------------------------------
32 selected · Unsaved changes   Cancel  Save group
```

On narrow screens controls wrap, lists take remaining height, and actions stay above navigation/safe areas. On desktop use available width with readable content bounds. Persistent controls must not obscure focused inputs or last rows, including with large text and an open keyboard.

## Required behavior

### Find and manage members

- Fetch an initial bounded page (target 40–50 rows); end-of-list requests append the next backend page. Supply an explicit Load more alternative for keyboard users and unreliable scroll triggers. Do not fetch every page eagerly or disguise full-download slicing as pagination.
- Search all eligible members, including names with full patronymics, irrespective of loaded pages. Debounce input; clearing search acts immediately. Apply active/former status and query before the backend range/limit. Escape backend filter syntax and handle whitespace and Cyrillic text. Reuse established name normalization where compatible; document any intentional search semantics.
- Stable surname/name plus ID ordering, duplicate prevention, single in-flight append, explicit end state, and generation/cancellation checks prevent old responses from replacing a new query or account session. Reset the page when query/status changes.
- Initial loading, empty directory, no matches, initial error, refresh error and append error are distinct. Refresh/append failure keeps existing rows, supplies retry and never implies completion. Revalidate after edits; preserve useful query/view context.
- Display patronymic initials with the shared formatter in member rows and group/deacon selectors. Search uses original structured names, not abbreviated display strings. Preserve full identity for accessibility where available.
- Accounts load when their view is used, independently of the member list. Keep pending approvals easy to reach without duplicating the entire pending queue above every member list. Clearly distinguish member records from account access.
- Prefer a lightweight task hub with dedicated member/account routes. Account linking uses bounded member search and a targeted account read; existing family candidate workflows may retain compatibility loaders in this release.
- Existing bulk removal remains deliberate: explicit selection mode, visible selected count, clear selection, accurately scoped “Select loaded” wording, self protection, confirmation and existing audit-aware mutation contracts. Changing query/status clears selection predictably; never imply selection of unseen matches.
- Groups, ministries, schedule, imports and desktop-only audit history remain discoverable and permission-aware. Existing direct routes continue working.

### Manage groups

- Group overview is searchable, distinguishes membership/care groups, shows useful counts, and has recoverable load/refresh states. Avoid loading every private photo or birthday merely to list groups.
- Persistent Save group and Cancel actions are visible at the top, middle and bottom of long rosters. Cancel and route exit use existing unsaved-change guards. Saving has pending feedback and prevents duplicate submission; failures preserve the draft and allow retry.
- Existing groups open with a manageable selected-members view; a clear All members view adds candidates. New groups make adding members obvious. Selection survives searches and view changes; counts reflect the complete draft, not only visible rows.
- Virtualize the roster. Searching includes patronymics and supports the app's established name matching. Show current assignments and selected deacons, retain the two-deacon limit and explain member moves before saving.
- Do not silently save a truncated selection. Existing full-assignment save RPC requires complete assignment IDs even if candidate browsing is paged. If editor metadata must be read in bounded batches to preserve full assignments/import matching, keep that separate from the visible list and document it honestly.
- Separate group deletion from routine Save; preserve confirmation, revisions, audit capture, import matching and existing membership/care rules. Expose load retry and actionable validation near controls.
- Changing language must not reload and overwrite an edited draft. Load import matching data only when the user opens that workflow, and bound candidate rendering during resolution.

### Accessibility and consistency

English/Ukrainian copy, light/dark themes, at least 44px touch targets, correct button/checkbox roles and state, meaningful icon labels, keyboard access/focus, live feedback and readable wrapping are mandatory. No private offline cache, extra analytics, notification calls, broad permission changes or new UI framework.

## Implementation and release

1. Introduce bounded management read contracts and regression coverage; use existing RLS/query capabilities where possible. Any new backend requirement must be verified deployed before production; never automatically push migrations.
2. Recompose Manage around stable workspace controls and the paged list, maintaining routes and permissions.
3. Refactor group overview/editor around task-focused views, virtualized rows and persistent actions.
4. Run behavioral tests, browser audit, complete required verify/build, and fix findings before release. Capture actual evidence and limitations in the release document and PR.

Use a feature branch from `dev`, PR into `dev`, CI and review, validate the Vercel Preview, then a separate `dev` → `main` release PR. User explicitly authorized merge to main. Do not bypass protection or claim authenticated hosted Preview success if SSO blocks it.

## Acceptance evidence

- A synthetic directory larger than two pages: initial bounded request, scroll append, explicit Load more, no duplicates, terminal page, retry after failed append, search finding a member outside the first page, clear/status changes and out-of-order responses.
- Account-view isolation, unauthorized direct access and session changes; bulk selection scope and canceled destructive confirmation.
- Group with hundreds of candidates: Save/Cancel visible without scrolling; selected/all/search preserve assignments; full patronymic search; move confirmation; failed save preserves draft; cancel/unsaved guard; roster payload completeness; overview retry.
- Browser fixtures at phone and desktop widths, light/dark, English/Ukrainian, plus narrow/large-text checks. Verify focus, overflow, reachable actions, direct links, auth callback handling and zero notification effects. Inspect screenshots, not only selectors.
- `pnpm verify` and `pnpm build:web` pass. Physical iPhone, live OAuth and real-data mutations must not be claimed unless performed. Keep test identities synthetic or disposable.

## Related work

#133 is already implemented audit history; this change preserves its entry point and write contracts. Existing #87 (direct date entry), #84 (schedule presentation), and #81 (family/deacon avatar names) remain separate focused tasks unless an overlapping change is explicitly included in the implementation report. This release targets Manage and group management rather than silently expanding every editor.
