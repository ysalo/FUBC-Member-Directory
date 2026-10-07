## Mobile form layout and duty rotation dragging (2026-10-06, version 1.8.3)

Member editor fields use natural content height so the multiline Address input
cannot overlap Care status on mobile. Ministry management rows restore a
visible disclosure chevron. Schedule rotation rows have dedicated touch/mouse
drag handles with drop feedback and cancellation; excluded rows retain their
positions and inclusion choices. Up/down buttons remain for keyboard and
assistive technology, and draft order is saved only by Generate/Regenerate.
Drag uses the shared React Native responder component; no dependency, backend
or migration changes. English/Ukrainian instructions include both ways to reorder.

Validation: Node 24 pnpm verify (323 passes, no skips, including real PostgreSQL
concurrency with safeupdate) and pnpm build:web. Browser fixtures reproduced a
10px Address/Care status overlap before the fix and verify 24px clearance at
320/390/1440px with large text, multiline edits and no horizontal overflow.
Phone touch/desktop mouse rotation tests cover cancellation, excluded deacons,
reset, empty-roster prevention, draft-only reorder, generation and reinclusion.
Ministry rows expose a decorative arrow and navigate to the editor. Screenshots
reviewed; no page errors or notification side effects. Physical native/live OAuth
are not claimed. Hosted Preview may require SSO. Feature/release PRs record CI
and deployment evidence; release follows feature → dev → main. Rollback to 1.8.2
is compatible with the unchanged backend.

## Pastor note ownership (2026-10-06, version 1.8.2)

Pastors can create a care note for any active member. Pastors and responsible
group deacons retain read access; only the creator can edit or remove a note
while still holding that read access. One note per member remains the existing
contract. The server records the authenticated account as creator and rejects
cross-author saves/removals. Historical notes with no recorded creator remain
read-only, as do notes whose creator account has been deleted. No authors are
inferred. Membership date remains optional and clearable, with no known/unknown
switch; that UI change was already included in 1.8.1.

Reviewed and manually applied `20261006040000_member_note_ownership.sql` after a
rolled-back live rehearsal of pastor creation/update, other-pastor read access,
denied cross-author save/removal and author removal. No smoke notes persisted.
No Edge Function change or migration-history reconciliation; do not use db push.
Older clients remain compatible with the RPC signatures but now enforce the
same server ownership restrictions. Retain the additive backend on rollback.

Release follows feature → dev → main. Local checks cover database scope,
ownership, legacy notes, revisions, deletion/recreation and denied direct writes,
plus phone/desktop synthetic browser workflows. Physical native/live OAuth and
authenticated hosted Preview are not claimed. Final CI, Preview accessibility
and production evidence belong to the feature/release PRs.

Investigation of 1.8.1: release PR #144 merged to main as `8b20a8a` with passing
GitHub CI, but GitHub records no deployment for that main commit. Its successful
Vercel PR status belongs to dev Preview `3034710`, not Production. The public
site still served the 1.8.0 `entry-ff7d70c7dfbfe0c29aa07ec2a10d695c.js` bundle
when this release began. This establishes a missing production deployment;
Vercel account settings/event logs are needed to establish why it was skipped.

## Management refinements (2026-10-06, version 1.8.1)

Group assignments use neutral rows with checked controls, membership language and a stable draft roster: unchecking someone keeps them available through search and tab changes. Group management creates and lists membership groups only; care type controls are removed and care imports rejected explicitly. A read-only live preflight found zero care groups, so no records were deleted. Row disclosure arrows are removed throughout the directory.

The member editor has clearer field groups, paired desktop name/date inputs, focus/error styling, single clearable date controls, and persistent Save/Cancel actions. Unknown dates stay empty; future typed dates fail Save validation. Duplicate date fields, the date-known switch and duplicate footer actions are removed. Dirty navigation and deletion guards, permissions and existing mutation contracts remain.

Used frontend-design and web-design-guidelines skills. Validation: Node 24 `pnpm verify` (308 main + 1 visitation + 13 groups, no skips), `pnpm build:web`, targeted group browser checks at 390px/light and 1440px/dark, and editor checks at 390px/light, 1440px/dark and 320px/Ukrainian/large text. Synthetic backends cover complete paged assignment saves, uncheck/recheck, date clearing, future-date validation, failed-save draft retention/retry, persistent actions and zero unexpected writes, browser errors, overflow or notification effects. Screenshots reviewed; narrow header adjusted after review. No migration or dependency changes; rollback to 1.8.0 remains compatible.

Release follows feature → dev → main. Hosted Vercel Preview can require SSO; authenticated hosted Preview, physical native devices and live OAuth are not claimed. Feature/release PRs record CI, preview accessibility and production smoke evidence.

## Management workspace and paged group editing (2026-10-06, version 1.8.0)

The management revamp follows [the specification](manage-experience-spec.md) and
[delivery plan](manage-experience-plan.md), tracked by issues #138–#140. Manage
becomes a compact task hub with dedicated member/account pages. Interactive
member, account, group and candidate searches use bounded backend pages;
patronymic initials distinguish people and complete draft IDs preserve group
assignments outside the visible page. Group editing has selected/all views,
virtualized candidates, persistent Save/Cancel actions, guarded navigation and
on-demand file-import matching. Audit history retains its desktop-admin entry
point and existing mutation capture.

Manually applied `20261006030000_management_pagination.sql` after independent
review, full-chain database tests and a rolled-back live rehearsal. Post-apply
read checks passed for 50-row pages, nonoverlapping next pages, search outside
the first page, the hard cap, complete group context and denied ordinary-member
access. Preserved 850 people, six profiles, 82 photos and 1,029 audit events.
No Edge Function changes, automatic migration push or history reconciliation.
Retain the additive read functions when rolling back the frontend; existing
write contracts and released clients remain compatible.

Validation: Node 24 `pnpm verify` passed 317 tests with zero skips, including
real PostgreSQL concurrency, and `pnpm build:web` passed. Synthetic browser
checks passed the ten-case phone/desktop, English/Ukrainian, light/dark and
320px large-text matrix. Behavioral checks cover page retry/end boundaries,
keyboard Load more, stale search/session responses, scoped bulk selection,
complete group saves, failed-save retry, move/leave confirmation, targeted
account linking, role restrictions, visible refresh errors and zero notification
calls. Final selection checks preserve backend offsets after first-page removal,
retain the bottom position without refetching, and save the complete remaining
draft. Last-seen details open by click/keyboard without navigating away.
Screenshots were inspected; before/after review images are in
`docs/manage-experience-images/` and contain only synthetic records.

Physical native and live OAuth checks are not claimed. Feature/release PRs
record CI, Vercel Preview accessibility and production deployment evidence.
Release follows feature → dev → main through Vercel Git integration.

## Readable audit subjects (2026-10-06)

Audit history shows affected member/group names, readable action and record labels,
and old → new names for renames. Expanded records and rollback previews retain
identifiers and exact JSON snapshots. English and Ukrainian labels share the
existing desktop-admin restrictions. Large action summaries show at most five
subjects and the remaining count; record details remain paginated.

Reviewed, rehearsed with rollback, and applied
`20261006020000_audit_subject_labels.sql` through authenticated CLI SQL to the
documented existing project before releasing this frontend. It captures display names with audit changes and
backfills existing snapshots, using current directory names only when no historical
name is available. Captured names survive later renames/deletion. Legacy entries
without surviving names retain their existing fallback. No private notes are read,
no Edge Function update is needed, and old clients remain compatible. Do not use
`db push` or reconcile CLI history. The additive labels can remain on frontend rollback. Live rolled-back checks
verified named history/previews and unchanged rollback/removal authorization;
850 members, six profiles and 82 photos were preserved. Verification includes the
full application suite, PostgreSQL concurrency with safeupdate, web export and
16 synthetic-backend browser cases; real OAuth/native checks are not claimed.

## Desktop audit history and guarded restoration (issue #133)

Manage → Audit history is available to active admins on web at widths of at least
1024px. Native/small-web direct routes redirect to management without fetching
history. History and large action details are paginated; date, actor ID, action
and affected member/group ID filters select newest-first actions. Expansions show
before/after JSON. Restoration previews explain field conflicts and unavailable
photos; confirmation requires a reason.

Directory commands retain one transactional action with server-derived actor
identity and per-record snapshots. Covered commands include general/deacon member
writes, private details, family, departures, ministry assignments, groups and
cross-group assignments, photo metadata and imports. Notes are excluded. Legacy
entries remain explicit; permanent deletion and replacement remain irreversible.
History survives subject/account deletion and replacement.

Ordinary removal hides the member, preserves recoverable family/group data,
revokes linked account access for existing sessions and clears photo references.
The editor provides a separate permanent-deletion choice. Restoration does not
reactivate accounts or resurrect old image paths. Photo cleanup runs through the
Storage API with a durable retry queue; failures are disclosed by the endpoint.
The frontend uses the dedicated `remove-member` endpoint for recoverable removal,
so a backend without that endpoint fails closed rather than performing the older
permanent deletion behavior.

Backend readiness is a separately reviewed release gate. Review and apply
`20261006000000_directory_audit.sql`, then
`20261006010000_audit_rollback.sql`, and deploy both `remove-member` and the updated
`delete-member` Edge Function before releasing this frontend to main. Do not use
`db push` or reconcile existing migration history automatically. Verify these
contracts with real active-admin/deacon/editor/inactive accounts and Storage
cleanup after deployment. Existing native/web command signatures remain intact;
new commands wrap their private implementations. Future replacements of a
covered writer must retain its audit envelope. Rollback to the prior frontend
can retain the additive backend, but old deletion copy describes permanent loss
while the updated default endpoint now performs recoverable removal.

Audit/rollback transactions share one lock order (audit advisory lock, family
revision row, covered tables), serializing directory writers and rechecking current
state at execution. This favors consistency over concurrent write throughput;
large imports/restorations can temporarily delay other directory writes. Preview
uses a rolled-back database subtransaction to validate constraints and invariants;
it never changes committed directory state. Retention is indefinite, including
historical personal information after permanent deletion.

Validation: Node 24 `pnpm verify` passes all 306 tests, including both real
PostgreSQL concurrency suites with pg-safeupdate enabled; `pnpm build:web` passes.
Fifteen audit SQL integration cases plus an Edge Function/SQL integration case
cover capture, authorization, inverse changes, idempotence, retention, access
revocation, and photo cleanup/retry. Sixteen synthetic-backend Chromium cases in
light/dark themes at 390/1023/1024/1440px cover admin/editor navigation and direct
routes, filters, pagination, JSON comparisons, reason validation, confirmation,
conflict display, irreversible/legacy labels, photo limitations, and recoverable versus permanent removal endpoint selection. Platform route
tests execute the native width guard; physical devices and live OAuth are not
claimed. Hosted Preview/CI evidence is recorded in the feature PR; live backend
migrations and real-service acceptance remain a separate reviewed step.

## Release 1.6.0 — group import birth dates

Imports can resolve identical full names by exact YYYY-MM-DD birth date. Import review and group assignment rows display full birth dates, and files accept one or two deacons. The manager-only birth-date RPC is deployed; old clients remain compatible. The reusable name-audit script keeps private sources, approved resolutions and omitted-name issues outside Git. Group 2 has already been imported and must not be imported again as part of deployment.

Backend rollback: retain the additive `management_group_birth_dates` RPC. Frontend rollback target: 1.5.1. Local verification and phone/desktop fixtures passed in feature PR #116; live OAuth and physical-device behavior are not claimed. Hosted Preview requires Vercel SSO. Release goes through dev → main and Vercel Git integration.

## Plain totals at the bottom, hidden during search (2026-10-05, version 1.4.5)

Directory totals use plain secondary-color text without a surface background or border. They remain the full-width final item in the scrollable directory, with flexible space placing them at the viewport bottom for short rosters. Long rosters show them only at the end of the list. Any nonempty search input immediately hides the totals, including no-match searches; clearing the input restores them. An accessible localized clear button appears inside the search box when it contains text, resets both immediate and debounced queries in one press, and restores the directory/totals. Grouped name results, compact surname navigation and full-height layout remain intact on shared web/native screens.

No backend change or migration; rollback to 1.4.4 is compatible. Required verification: `pnpm verify`, `pnpm build:web`, and phone/desktop browser fixtures in both themes covering plain footer styling/end position, absent totals during exact/prefix/empty-result searches, restoration on clear, short-roster bottom layout, name groups, member taps, index scrubbing, departure confirmations/retry, callbacks/deep links and no notification side effects. Hosted Preview requires SSO; physical native/live OAuth checks are not claimed. CI, deployment and final production evidence belong to the feature/release PRs.

## Scrolling totals and grouped name matches (2026-10-05, version 1.4.4)

Directory totals are a full-width footer at the end of the scrollable roster on web and native. They appear when the end of the results is reached rather than remaining pinned above navigation. The compact surname gutter is applied only to surname sections/member rows, leaving totals full width.

Search results use subtle localized Top matches and Other results headings. The best name score forms the first group (exact name tokens before prefixes); remaining matching scores follow with surname order preserved within each group. Empty groups are omitted and prefix-only searches retain their best matches at the top. Substring/fuzzy matching remains excluded. Search never shows the surname index or reserves its gutter, including when both result sections exist; full-height layout and profile tap targets remain intact.

No backend change or migration; rollback to 1.4.3 is compatible. Validate with `pnpm verify`, `pnpm build:web`, and phone/desktop browser fixtures in both themes covering footer scroll visibility/full width, exact/prefix grouping, prefix-only and empty queries, index scrubbing, member taps, full-height search, departure confirmations/retry, callbacks/deep links and notification side effects. Hosted Preview is SSO protected; physical native/live OAuth checks are not claimed. Feature/release PRs carry final CI, Preview and production evidence.

## Compact surname index (2026-10-05, version 1.4.3)

The directory surname index uses 13px letter spacing (previously 18px) and a 20px strip (previously 30px). The dedicated list gutter shrinks from 42px to 24px, with a 2px gap between member rows and the index touch area. Search and single-section lists reclaim the gutter completely. Directory screen/list flex bounds stay full width and full height for short and empty searches; the hidden browser scrollbar does not reserve a gutter. The totals footer now stays below the roster and spans its full width; the index is centered between the header and footer. The centered, borderless index retains tap, keyboard and finger/mouse scrubbing; its responder stays inside the gutter and cannot intercept member row clicks.

No backend change or migration; rollback to 1.4.2 is compatible. Required verification is `pnpm verify`, `pnpm build:web`, and phone/desktop browser checks in light/dark themes with intercepted fixture data, including index bounds, both-direction mouse/touch scrubbing, row-edge member clicks, search, departure confirmations/retry, and public auth callbacks/deep links. Hosted Preview is SSO protected; physical native and live OAuth checks are not claimed. Final validation and deployment evidence belong to the feature/release PRs.

## Directory surname scrubbing and hidden visitation (2026-10-05, version 1.4.2)

The surname index is transparent, borderless and vertically centered against the scrollable roster. Tapping a letter or dragging a mouse/finger along the index jumps the roster immediately to that section; the full index fits the available roster height. Normal list scrolling remains available with its scrollbar hidden on web and native. Member rows omit disclosure chevrons while retaining profile links and family selection controls.

Visitation navigation, badges, directory alerts/count subscriptions and member profile planning actions are hidden on web and native. Direct visitation URLs redirect to Directory. Existing visitation records, repositories and backend permissions are preserved. No migration or backend prerequisite is required; rollback to 1.4.1 remains compatible.

Node 24 `pnpm verify` and `pnpm build:web` passed. Interaction tests cover forward/reverse dragging, section boundaries, deduplicated immediate jumps and native unmeasured-section retry. Chromium fixture checks cover 390×844 and 1440×900 in light/dark themes, mouse and touch scrubbing, index centering, transparent index styling, hidden scrollbars/visitation, profile links, visitation URL redirects, name ranking and departure confirmation/retry/history. Public auth callbacks/deep links are checked separately. Hosted Preview is protected by Vercel SSO; authenticated Preview, live OAuth and physical native checks are not claimed. CI, Preview deployment and final production evidence are recorded in the feature/release PRs.

# Web Application Release and Deployment

## Group member rows (2026-10-05, version 1.5.1)

Group detail sorts its member roster by structured last name using the shared directory comparator, including Cyrillic ordering and repair of visual Latin letters in Cyrillic surnames. Filtering preserves that surname order. Member and responsible-deacon rows use the shared abbreviated patronymic formatter (for example, Олександр В. Данилюк); names without a patronymic remain unchanged. The existing group queries now include patronymic and retain structured name fields. Search includes the full patronymic, and profile links remain clickable with their row chevrons removed.

No backend change, migration or group-data mutation is required; rollback to 1.5.0 is compatible. Verify/build and phone/desktop browser fixtures cover surname order despite conflicting first-name order, mixed alphabets, patronymic initials, absent patronymics, full-patronymic search, profile navigation and zero overflow/errors/notification calls. Physical native/live OAuth are unverified. Feature and release PRs record final CI, deployment and production evidence.


## Group JSON file upload (2026-10-05)

Manage → Groups → Add group now accepts a versioned JSON file containing the full group heading, two deacons and member names. A nonempty or malformed `verify` section blocks file upload; only an empty array or absent section is accepted. Imports attach existing people and never create members. A review lists every source name alongside its existing-person match; unique complete names match automatically and missing/ambiguous names require manual resolution. All rows must resolve to distinct people before applying assignments to the editor. The file only fills a draft; the existing authorized `save_group` RPC and movement confirmation perform the save. Full surname/first/patronymic identity is fetched for import without changing the editor display names. Invalid files and canceled picking preserve the prior draft, pending imports block saving, and native picker copies are deleted. No backend change or migration is needed; frontend rollback remains compatible.

`pnpm verify` and `pnpm build:web` passed. Chromium fixture checks at 390×844 and 1440×900 covered direct editor links, invalid JSON, rejection of a nonempty verify section, acceptance of an empty verify section, exact full-name matching, manual resolution, pending-save blocking, draft-only apply, canceled assignment movement, failed-save retry, correct RPC assignments and auth callback errors. Both widths had zero overflow, page errors and notification permission requests. Browser checks used intercepted backend fixtures; physical native and live OAuth were not checked. Private photo extraction and processed-main comparison are saved beside the source photograph and excluded from Git; uncertain spellings await user verification. Hosted Vercel Preview validation and CI/review remain prerequisites before merging into dev; production remains a separate dev → main release.


## Directory and departure UI polish (2026-10-05, issue #101)

The departure editor now follows the member form's typography, field spacing, hairline borders, rounded surfaces and orange save action. Radio choices use the shared icon family and palette selection colors. Phone and desktop layouts use the existing 18px/32px form spacing; light/dark palettes apply to every field and action. Browser text-entry fields, including date inputs and notes, keep their normal borders without focus outlines. Button/link keyboard focus styling remains available.

The surname index is a compact, rounded floating control centered beside the roster, with a subtle shadow and scrollable content for long alphabets. Web/native section jumps and bounded offscreen retries continue to use the existing roster. During search, results form a single relevance-ordered list and the alphabet index is hidden. Name matching now uses whole tokens or prefixes only, with exact names first and surname-order ties. Fuzzy/inside-name matches are excluded: Andrew finds Andrew before Andrews, while Drew finds Drew without matching Andrew. Both Directory and Management use the same ranking helper. The English/Ukrainian placeholder describes first/last-name lookup.

Node 24 `pnpm verify` and `pnpm build:web` passed. Chromium fixtures at 390×844 and 1440×900 in light and dark themes checked centered/compact index geometry and jumps, reversed-name lookup, exact-name ranking in both lists, no inside-name matches, focus styles on search/date/notes, palette-consistent save colors, radio selection, cancellation, failed-save retry, history and direct/callback routes. All four cases had zero overflow/page errors/notification calls. Browser UI fixtures intercept backend responses; physical native and live OAuth checks were not performed. No migration or new backend contract is introduced: the previously applied departure table/RPC remain the prerequisite and frontend rollback is compatible. CI/Preview and final production evidence are recorded in the feature/release PRs. Application version: 1.4.1.


## Smarter member search, surname index and departure history (2026-10-05, issue #98)

Directory and management member search now match individual first/last/patronymic tokens in either order, with prefixes, case/spacing/apostrophe/hyphen/accent normalization, repair of visual Latin letters in Cyrillic words, and one-character typo tolerance for queries of at least four characters. Short queries remain prefix-only and each query token must match a distinct name token. Results keep surname ordering. The right-side index uses populated Ukrainian/Latin surname sections and scrolls the web roster or native SectionList; long indexes scroll and native offscreen jumps retry with a bounded timer.

Mark as left membership opens a dedicated date/reason form with four radio options: different church, died, excommunicated and other. Other requires one short line (maximum 160 characters); optional notes allow 5000 characters. Confirmation precedes a single revision-checked RPC that archives the member, performs existing group cleanup and saves a separate `member_departures` record atomically. Name snapshots include first name, last name and patronymic. Management displays the supplied departure date without a timezone day shift. History survives restored membership, subsequent departures, name edits and member deletion; direct table writes are unavailable to clients and reads are restricted to active directory managers. Member Administrators can reach the nested route. Cancel/discard, failed saves and retries preserve the expected draft behavior.

Reviewed and manually applied `20261005000000_member_departures.sql` to the existing project through authenticated CLI SQL, without `db push` or migration-history reconciliation. The additive table/RPC/archive-restore trigger retain old client compatibility: legacy archive operations record an explicitly unknown reason, and restoration closes the episode. Backfill uses the prior archive date and labels it as historical rather than claiming a collected departure date/reason. The live project had no archived members, so the migration created zero historical rows. A hosted authenticated, rolled-back smoke transaction checked validation, archival/contact preservation, restoration, repeat episodes and manager-only RLS. All 850 members remained unchanged and zero test departure rows were retained. Frontend rollback to 1.3.0 can retain the additive migration and transition trigger; new clients require it.

Node 24 `pnpm verify` and `pnpm build:web` passed. Behavior coverage includes search variants/typos/compound and Ukrainian names, surname jumps, departure form validation, confirmation and retry, role routing, nullable history loading, stale writes, atomic failure, private table permissions and preserved snapshots. Chromium fixtures at 390×844 and 1440×900 jumped to the Z surname section, searched by surname/given name and a typo, selected Other, canceled confirmation, retried a failed departure and reloaded history. Both widths had zero overflow/page errors/notification permission calls; failed auth callbacks and direct nested URLs were checked. The local production export used a placeholder public key with intercepted fixture responses. Physical native and live OAuth checks were not performed. Hosted Preview status and release deployment evidence belong to the feature/release PRs.


## Schedule generation exclusions (2026-10-04)

Manage → Schedule now has an Include in rotation checkbox for every eligible deacon. Unchecked deacons stay visible with an excluded label and are omitted from the ordered roster passed to the existing `generate_duty_schedule` RPC. Arrows move included deacons past excluded rows; ordinal labels reflect the actual generated order. The included count and empty-roster guidance update immediately, generation is disabled when everyone is excluded, and Reset rotation choices restores the current saved draft. Successful generation retains current choices and clears the unsaved-state guard.

Exclusions are per-generation draft choices, not permanent eligibility or ministry changes. Choices stay in the current editor after generating; reopening/loading the roster starts with all eligible deacons. Existing generated weekends stay unchanged until Generate/Regenerate is pressed. Manual weekend reassignment can still choose any eligible deacon. No migration, new storage or permission change is required; the current backend already accepts a subset and validates eligibility. Frontend rollback remains compatible.

Node 24 `pnpm verify` passed (243 main tests, one optional local concurrency skip; visitation 1; groups 12), and `pnpm build:web` passed. Domain and rendered screen coverage checks subset ordering, reordering across excluded rows, reset, re-inclusion, no empty generation, retained choices, cleared dirty state and unauthorized access. Chromium fixtures at 390×844 and 1440×900 generated every weekend using the selected subset, then re-included a deacon, with no overflow, page errors, ministry writes or notification permission calls. A hosted authenticated generation test with temporary deacons and a future year was fully rolled back; it confirmed subset ordering, omitted the excluded deacon and left zero test records. Live OAuth and physical native checks have not been performed; protected Preview interaction requires Vercel SSO.


## Family editor usability (2026-10-04)

The family editor now reuses Directory's `MemberRow` for both existing relatives and selection. Directory profile links keep their previous behavior; selection mode uses explicit checkbox/radio semantics, full patronymics, existing photos and initials, and compact remove actions. The screen follows the member editor's header and surface styles, with a reachable save footer and unsaved-change status.

Each category opens a searchable, virtualized picker. Multiple selections stay open until Done, selected rows can be toggled off, spouses use single selection, and creation retains the existing full-form draft handoff. Existing matching-member suggestions in the creation form now display patronymics too. Inferred siblings appear once alongside explicit siblings, retaining their supporting-parent explanation and existing save behavior. Phone keyboard avoidance is included; native behavior has not been physically tested.

Node 24 `pnpm verify` passed (239 main tests, one optional local concurrency skip; visitation 1; groups 12), and `pnpm build:web` passed. Chromium at 390×844 and 1440×900 verified patronymic search, checked selection semantics, multiple selections, Done, inline removal, unsaved-change confirmation, save payloads, failed auth callbacks, no overflow/page errors and zero notification permission calls. Browser checks caught missing web `aria-checked` output; shared rows now expose it explicitly. No new backend migration is required; the previous family RPC and shared-child patch remain compatible. Hosted Preview interaction requires Vercel SSO, and live OAuth/physical native checks are not claimed.


## Family patronymics and shared children (2026-10-04)

Family selection now displays and searches the full first name, patronymic and surname, retaining first/surname search compatibility. Management catalog hydration retains patronymics; selected relatives and supporting parents use the same formatter. Married editors explain that child additions/removals apply to both spouses.

Reviewed and manually applied `20261004020000_family_shared_children.sql` using an authenticated SQL query against the existing project, without `db push` or migration-history reconciliation. The writer keeps its signature, authorization, graph revision lock and safeupdate guard. New marriages combine existing children; edits to either spouse synchronize their child lists. Child-side parent edits include/remove both married parents. Unlinking spouses retains existing parent facts. A graph-wide ancestry check rolls back cycles introduced through propagation. The upgrade unions existing married-child facts; the hosted graph already shared its children, so its eight existing edges remained unchanged. The previous writer and graph were saved locally before applying the patch. Older clients use the same RPC and gain the shared-child behavior; a frontend rollback does not require a database rollback.

Node 24 `pnpm verify` passed (235 main tests, one optional local concurrency skip; visitation 1; groups 12), and `pnpm build:web` passed. Regression coverage includes distinct patronymics in English/Ukrainian, search and selection, marriage union, child additions/removals from both spouses and child-side parent edits, spouse changes, archival, stale snapshots and spouse-only ancestry cycles. The real PostgreSQL CI suite additionally covers concurrent shared-child saves with safeupdate enabled. A hosted authenticated RPC smoke test used disposable records in a rolled-back transaction and confirmed both parents and shared removals without retaining test data. Live OAuth and physical native checks have not been performed.


## Separate Member Name Fields

The member editor and server writer now round-trip `first_name`, `last_name`, and optional `patronymic`. Directory and profile formatting use the stored parts, preserving compound given names and surnames. Group, management, and visitation queries select the separate fields. The legacy `name` column is maintained by a database trigger as a display projection for existing RPCs, linked account synchronization, deletion confirmations, and older clients.

Before enabling this client, review and manually apply `20261004000000_member_name_fields.sql` through the existing Supabase SQL Editor workflow. Do not use `supabase db push`; hosted migration history is unreconciled. This work does not apply a hosted migration. Existing names are split at their first whitespace boundary; remaining tokens become the surname. Historical single-token names retain an empty surname and require correction when edited. Review compound given names after backfill because their original boundaries cannot be inferred. Previous clients remain compatible through the synchronized display projection. New clients require the migration before deployment.

Workbook exports now contain `first_name,last_name,patronymic` instead of a combined `name`. Regenerated main and group JSON/CSV and audit files are under `/home/ysalo/Documents/processed/main/<workbook>/` and `/home/ysalo/Documents/processed/groups/<workbook>/`; the combined audit is `groups/group_audit.json`. Export counts: main 850, groups 844, six main records unmatched to groups, zero group records unmatched to main. Gender remains null in source exports because the workbooks have no gender column. The separately maintained `members_gender_filled.csv` is not produced by these scripts.

Validation on Node 24: `pnpm verify` passed (208 main tests passed, one optional concurrency test skipped, plus visitation and group suites), including the new PostgreSQL-compatible name migration coverage. `pnpm build:web` passed with placeholder public backend configuration. Updated stale assertions to cover visible family names, the vertical deacon list, and removal of the current duty period before filtering the remaining list. No authenticated Preview, live OAuth, phone/desktop browser workflow, or physical iPhone check was performed. These remain release gates. No production release or hosted database write was performed.

The application uses Vercel's GitHub integration. GitHub Actions verifies code; it does not hold Vercel credentials or deploy the application.

## Management Usability and Family Avatars (issue #75)

The shared Expo client opens Management on Members with labeled Add member and Filters actions. Member entry has one page with named sections, required-field guidance, and Save/Cancel actions at both ends. Account status, role, and member linking now use explicit saves. Group and ministry editors guard unsaved changes; schedule reassignment requires a selected deacon and Save. Family pickers open in their relationship section, and creating a relative uses the full member form. The family draft is kept only in memory during this handoff; member creation and relationship saving remain separate operations. Profile family uses the existing 64px avatar-link treatment, accessible names, and browser name tooltips.

No database migration, Edge Function deployment, permission expansion, notification change, or offline private-data cache is introduced. The existing family schema and RPCs from issue #69, including the safe-update correction in PR #73, must be present before authenticated Preview or production use. The previous client remains compatible with these UI-only changes; retain the current production deployment as the rollback target. A created member persists if family editing is canceled, so an operator must remove an unintended member through the existing confirmed deletion flow.

Local focused behavior tests cover family draft handoff, category selection, avatar links, account draft/save and partial failure, account linking, photo/link retry, matching-relative discard, and navigation discard. Full `pnpm verify` passed (207 passed, one existing skipped), and `pnpm build:web` passed with placeholder public Supabase configuration. The production export was checked in Chromium at 390×844 and 1440×900 for unauthenticated management and member deep links, failed OAuth callback, no horizontal overflow, page errors, or notification calls. The unconfigured development fixture was checked at the same widths for the management list and member form, plus a 390×580 form for reachable footer actions and browser Back/Keep editing/Discard behavior. A short phone viewport also confirmed that Add: Siblings reveals the picker in view and that Edit family retains a real browser link. These checks do not establish authenticated service behavior.

Before merging the feature PR into `dev`, obtain CI and review approval, and validate the Vercel Preview at phone and desktop widths with authenticated Ukrainian and English management flows. Check real Google OAuth/callback, direct links and reloads, account and family saves, group/ministry/schedule edits, destructive confirmations on disposable records, large text, dark theme, keyboard use, and zero web notification side effects. Physical iPhone/native behavior and live OAuth have not been checked here. Production still requires a separate reviewed `dev` to protected `main` PR after backend readiness and rollback review.

## Family save write-guard hotfix

Production reported SQLSTATE `21000`, `UPDATE requires a WHERE clause`, when calling `save_member_family`. The statement-level family trigger incremented the singleton graph revision without a filter. API sessions enforcing `pg-safeupdate` reject that nested UPDATE even though the outer relationship DELETE is filtered. The previous plain PostgreSQL/PGlite tests did not enable this guard.

Manually apply `mobile/supabase/migrations/20260928020000_family_safeupdate.sql` through the SQL Editor after the family migration. It replaces only `app_private.family_changed()` with an explicit `where singleton = true`; keep safeupdate enabled. This applies to existing installations without rerunning the original table-creation migration, preserves saved family facts and privileges, and needs no frontend deployment. No hosted patch was applied by this fix. Do not use `supabase db push` against the unreconciled migration history.

The real PostgreSQL regression loads the upstream safeupdate extension, reproduces the original exact error before applying the corrective migration, then checks successful reciprocal saves, stale-writer rejection, and deletion-trigger invalidation. CI builds the extension from a pinned upstream revision and sets `FAMILY_TEST_SAFEUPDATE_LIBRARY=safeupdate`; local runs can point that variable to an installed library. Client rollback remains compatible; retain the corrected function during rollback. Retry saving family connections after applying the patch. Hosted save/reload and authenticated Preview remain to be verified separately.

## Family Relationships (issue #69)

Feature PR #70 targets `dev` from `feature/family-relationships`. The shared Expo application now has a dedicated Manage Family editor and a linked Family section immediately below profile Contact. Parents and children are inverse connections, spouses and explicit siblings are reciprocal, and shared recorded parents infer siblings without propagating explicit sibling links. English and Ukrainian labels are gender neutral. Inline member creation saves a separate durable Member; Cancel discards only relationship edits.

### Backend prerequisite and rollback

Review and manually apply `mobile/supabase/migrations/20260928010000_member_family.sql` after the existing management/role/gender migrations using the established SQL Editor process. Do not run `supabase db push`; hosted migration history remains unreconciled. No hosted migration or production release was performed by this implementation.

The additive migration introduces guarded `member_family` and `save_member_family` RPCs. Active Administrators and Member Administrators can write; active directory readers can read visible family. Tables deny direct client writes. Atomic saves reject self-links, ancestry cycles, conflicting spouses and stale revisions. A graph-wide revision deliberately requires refresh after any family edit, including an unrelated member's edit, to cover reciprocal changes and shared-parent inference. Permanent deletion cascades incident connections and invalidates stale family drafts; archival retains connections and profile reads hide archived relatives.

Previous clients remain compatible with the additive family schema and RPCs. Roll back the client to the retained Vercel deployment if needed; retain the family tables and recorded facts. Do not drop family data as a UI rollback. Existing prerequisite migrations, including the gender requirement, keep their own compatibility restrictions. Before production, verify the hosted RPCs and role boundaries, disposal-only creation/edit/deletion workflows, archival/restoration, and forward/rollback client behavior.

### Verification and remaining gates

`pnpm verify` passed all 214 tests (201 main, one visitation, 12 group tests), with no skipped tests, including rendered editor/profile workflows, repository contracts, PGlite authorization/graph behavior, and real competing PostgreSQL writes. `pnpm build:web` passed with placeholder public Supabase configuration. `FAMILY_TEST_DATABASE_URL` enables the concurrency suite and requires `psql` plus a disposable server with database-creation permission; the test creates and drops its own database. CI supplies an isolated PostgreSQL 18 service, without deployment credentials.

Local Chromium checks at 390×900 and 1440×900 exercised family saving, profile-relative navigation and reload, archived hiding, deletion-confirmation cancellation, callback failure and protected management deep links. Fixture backend responses isolated these checks from hosted member data. English and Ukrainian/large-text screens were inspected; body/action text scaling was measured, and no horizontal overflow, browser exceptions, or notification-permission calls were observed. Standards review's two findings and spec review's stale member/session draft finding were fixed and re-reviewed; browser validation additionally caught and resolved an SDK 57 link handler that reset locale on navigation. Worker worktrees were cleaned up.

The Vercel Preview URL redirects phone and desktop browsers to Vercel SSO. This confirms a deployment exists but does not validate authenticated Preview behavior. Required before merge: passing CI/review and authorized phone/desktop Preview checks covering family editing, profile links, confirmations, auth callbacks/deep links, and notification isolation after backend readiness. Live OAuth and physical iPhone/native checks were not performed. Production remains a separate reviewed `dev` → protected `main` PR.

## Required Member Gender (issue #64)

Before enabling this client against an existing Supabase project, review and manually apply `mobile/supabase/migrations/20260928000000_member_gender.sql` through the established SQL Editor process. Do not use `supabase db push`: migration history is unreconciled. The migration assigns Male to every existing Member whose gender is unset, including archived records, preserves any previously recorded values, then enforces a required two-value column. The requester must review and correct those placeholder assignments after migration. Filter results reflect the placeholders until corrected.

Apply and verify the migration before a backend-dependent client Preview or production release. Check Member Administrator and Administrator creation and edits, older-client edits that omit gender, rejection of older-client creation, and Directory reads under active and pending accounts. The old client cannot create Members after this migration because it omits required gender. Keep a current compatible client available for rollback or use a reviewed forward fix; reverting only the UI does not restore creation. No hosted migration was applied by this feature work.

Feature delivery is a PR into `dev`. CI, review, authenticated Vercel Preview at phone and desktop widths, callback and direct links, management confirmations, localization and large text, and notification isolation remain release checks. A separate reviewed `dev` to `main` PR is required for production. Physical iPhone and live OAuth verification must be recorded separately when performed.

Local PostgreSQL-compatible tests exercised backfill, validation, omission preservation, authorized management and Directory reads. Rendered screen tests exercised radio selection, missing-selection validation, match-any gender filters and counts. A local web export passed with placeholder public Supabase configuration. Chromium checks at 390×844 and 1440×900 found no horizontal overflow in the built sign-in, failed callback and unauthenticated management deep link, and no notification API calls. A rendered Directory fixture at both widths showed the count beneath controls, accessible gender checkboxes, and text scaling. These checks do not establish authenticated Preview behavior or a live migration.

Feature PR #65 passed GitHub CI and Vercel's deployment check. The Preview URL redirected an unauthenticated browser to Vercel SSO, so authenticated Preview workflows and the hosted gender migration could not be validated in this run. No human review was recorded at that point. Keep the PR open until those release gates are completed; do not merge a backend-dependent client into production without the migration and rollback readiness described above.

## Account Last Seen

The Expo account activity feature is implemented in `mobile/` for native and web. Before deploying a client that reads the new account contract, apply `mobile/supabase/migrations/20260927000000_account_last_seen.sql` to the existing Supabase project through the reviewed SQL Editor workflow. Do not run `supabase db push`; migration history remains unreconciled. The migration adds a nullable server timestamp, extends the Administrator-only `management_accounts()` RPC, and adds authenticated self-recording. No migration has been applied as part of this implementation. Verify administrator access, pending/denied/revoked self-recording, and Member read isolation in Preview before release. UI rollback remains compatible with the database addition.

## Supabase Advisor Hardening

Implemented on `feature/supabase-advisor-hardening`, based on current `dev`, for feature -> dev -> main delivery. No client contracts or public RPC signatures changed.

- `20260923030000_advisor_security.sql` makes both leadership views security-invoker. `person_leadership_ministries` uses existing table RLS; `ministry_accounts` calls the narrowly scoped `app_private.ministry_account_rows()` helper so approved users retain leader pickers without gaining access to other profiles. The helper has an empty search path, an active-account guard, four explicit output fields, and no anonymous execute grant. Keep `app_private` out of Data API exposed schemas.
- `20260923040000_advisor_performance.sql` caches identity checks in seven RLS policies and adds nine covering foreign-key indexes. It also fixes birthday-preference group correlation: the live policy previously compared `assignment.group_id` with itself, rather than the preference's group. The corrected policy requires the caller's assignment to that specific group.
- Both transactions use a five-second lock timeout and sixty-second statement timeout. Live preflight confirmed small affected tables and no index-name collisions. No existing index was dropped, RLS disabled, or notification scheduled.

Applied both migrations, in the order above, through the authenticated SQL Editor for `lxrrjrezpdzyqkevgwyx` (main Production) on 2026-09-23 local / 2026-09-24 UTC. Both succeeded and notified PostgREST. Do not rerun them or use `supabase db push`: CLI migration history is still unreconciled. The unrelated membership-date migration was not applied as part of this work.

Verification: `pnpm verify` passed (161 main tests plus visitation/group suites), `pnpm build:web` passed, and focused SQL tests cover member/editor/admin approval states, restricted profile access, anonymous grants, owner isolation, cross-owner write rejection, birthday-group isolation, index coverage, and public definer-RPC anonymous denial/fixed search paths. Live read-only transactions checked leadership projections and owner isolation using all four existing profiles, then rolled back. Catalog checks confirmed both invoker views, seven optimized policies, and zero uncovered public foreign keys. Counts remained 36 people, four profiles, two visits, and nine notification events; no application data writes were performed.

Advisor results after deployment: Security **0 errors, 27 warnings, 2 suggestions**; Performance **0 errors, 0 warnings, 9 suggestions**. Remaining security warnings are the 26 intentional, guarded public definer RPCs and leaked-password protection (requires Pro or above; this project is Free). Existing RPCs were not rewritten merely to suppress warnings; catalog checks and regression tests do not constitute a complete live role-by-role audit of every RPC. The two RLS-without-policy suggestions are intentional deny-by-default tables (`people_private`, `visit_notification_events`). Performance suggestions are unused indexes, including newly created indexes; retain these until representative workload evidence supports removal.

Rollback compatibility: current and previous clients keep the same view names, columns, and public RPC contracts. UI rollback does not require reversing these migrations. Prefer a forward fix if needed; never restore the erroneous birthday-policy correlation, broaden profile access, or disable RLS. If the view implementation must be reverted, restore the guarded view definitions from `20260917110000_leadership_ministries.sql` before removing the private helper, with a reviewed migration. Indexes and optimized policies can remain during a client rollback.

Delivery requires a feature PR into `dev`, CI/review and Vercel Preview validation, followed by a separate reviewed `dev` -> `main` release PR. No protected-branch merge or frontend production release was performed by this work. Authenticated Preview, live OAuth/callback/confirmation workflows, and physical-device checks remain release gates; read-only SQL verification is not a signed-in UI test.

## Editable Membership Start Date

Implemented on `feature/member-membership-date` for feature -> dev -> main delivery. The member editor loads and saves the existing `people.membership_joined_at` date through the revision-checked `save_person` RPC. Administrators and Member Administrators can set, change, or clear the date; the English "Member since" and Ukrainian "Дата вступу до церкви" controls reuse the native/web date field. Unknown dates stay null rather than being silently assigned today. Future or invalid dates are rejected.

Backend prerequisite: manually apply `20260923020000_membership_date.sql` after the role-permissions migration before enabling the client in production. This migration is NOT deployed by this feature work. It preserves the existing guarded writer, leadership restrictions, archival cleanup, and older-client omission behavior. Do not run an automatic database push. Older clients remain compatible with the new writer; rolling back the UI does not require reverting the migration.

Focused SQL coverage checks creation, editing, clearing, older-client preservation, single revision advancement, invalid/future dates, stale revisions, and unauthorized writes. Client regressions check payload/omission and editor hydration. Authenticated Preview, live save/reload, and physical-device checks remain release gates. Keep the feature PR targeted at dev and use a separate dev -> main PR for production.

Verification: `pnpm verify` passed (159 main tests plus visitation/group suites), `pnpm build:web` passed, and editor diagnostics/whitespace checks were clean. Built-app synthetic browser checks verified saved-date hydration, editing and reopening with the changed date, and clearing/reopening with null. Phone layout at 390x844 was visually inspected with no horizontal overflow. Desktop 1440x1000 hydration and keyboard-save checks passed, but the integrated-browser screenshot was clipped; full desktop visual and physical-device validation are not claimed. No live member data or database schema was changed.

## Bulk Member Deletion

Implemented on `feature/manage-member-bulk-delete`, based on current `dev`. The Members list supports administrator-only multi-selection, select-all-shown, clear selection, and a typed-confirmation review of every selected name. Search, filter, panel, account, and reload changes clear selection. The caller's linked member is excluded. Accounts-only deletion is not part of this feature.

The client calls the existing `delete-member` Edge Function sequentially with each reviewed name and revision. Existing server authorization, self-deletion, revision, and last-administrator guards remain authoritative. Processing stops on the first failure; the dialog reports confirmed deletions separately from unprocessed or uncertain records and reloads on close. A failed member may already have lost linked sign-in access or photos. No new migrations, Edge Function deployments, notification scheduling, or persistent data storage are introduced.

Verification: focused selection/confirmation/batch regressions, `pnpm verify`, and `pnpm build:web` passed. The built local app was checked with synthetic in-page backend responses at 1440x1000 and 390x844, including direct Manage load, self-selection exclusion, disabled confirmation, cancel with zero deletion requests, partial failure, and refreshed remaining rows. Desktop/mobile confirmation screenshots were inspected and no horizontal overflow was found. No real members were deleted. Physical-device, live OAuth, authenticated Vercel Preview, and live deletion checks remain unperformed.

Delivery is a feature PR into `dev`; CI/review and authenticated Preview remain merge gates. A separate reviewed `dev` to `main` PR is required for production. Verify the existing deletion endpoint on disposable records before production release, and retain the previous Vercel deployment for rollback; deleted member data itself cannot be recovered by rolling back the client.

## Member Administrator Permissions

Work in progress on `feature/member-administrator-permissions`, based on `dev` at `3803eeb`. Uncommitted changes were transferred from `main`, preserving the member-name and session-recovery changes already in `dev`. Neither protected branch was committed to or pushed.

Member Administrators (stored as `editor` for compatibility) manage members, groups, ministries, and duty schedules. Account management and permission-granting Pastor/Deacon assignments remain Administrator-only. Pastors and Deacons can plan visits; Administrators can manage all visits.

Local integration verification: `pnpm verify` passed (154 main tests plus visitation and group suites), and `pnpm build:web` passed. Authenticated browser/Preview and physical-device checks remain outstanding. VS Code reported workspace module-resolution diagnostics despite the passing project TypeScript check; these are not claimed resolved.

On 2026-09-23, applied `20260923000000_member_patronymic.sql`, then `20260923010000_role_permissions.sql`, through the user-authenticated Supabase SQL Editor for project `lxrrjrezpdzyqkevgwyx` (main Production). Preflight found both migrations absent; the patronymic prerequisite was applied and verified first. Both transactions completed successfully and notified PostgREST to reload its schema. Do not rerun either migration or use `supabase db push`; CLI migration history remains unreconciled. Older clients may receive authorization errors for newly restricted actions; UI rollback must not remove server restrictions.

Live catalog checks verified the preserved patronymic writer/directory return field, authenticated public member-RPC access, anonymous denial, private-writer denial for both client roles, security-definer wrapper with empty search path, leadership-assignment guard, administrator visitation guards, and administrator-only linked account name synchronization. A read-only transaction with locally simulated identity claims checked editor/admin/visitation helpers against all four existing profiles and rolled back; both visitation tables retain RLS, with two policies present. No member, visit, account, or notification records were changed by deployment verification. This is not a full signed-in client/RLS workflow test.

Feature PR #46 targets `dev`. Delivery still requires successful CI/review and Vercel Preview validation, then a separate release PR from `dev` into `main`. This database operation did not merge branches or deploy the frontend.

## Member Names and Mobile Recovery

Implemented on `feature/member-names-mobile-recovery`, branched from `dev`. Not deployed or merged.

- Optional patronymics are stored separately from the existing member name, editable in English/Ukrainian management forms, searchable in the directory, abbreviated in directory rows, and shown in full on member profiles. Existing names and surname sorting are unchanged.
- Session revalidation retries transient network/server failures once, preserves ready content during that attempt, and still blocks access after a persistent failure or account change. Contract-read network failures are no longer reported as backend-version mismatches. Recovery screens use localized reconnect copy and retry on foreground/online events; OAuth callbacks defer data work until after the auth callback returns.
- The opening screen uses a larger white church logo and white spinner without the sign-in checklist. Web form controls have a 16px minimum font size without disabling browser zoom. Navigation labels stay on one line with ellipsis and retain full accessible names/tooltips. Schedule no longer adds native bottom clearance or duplicate safe-area insets inside the web shell.

### Verification and Release Gates

- `pnpm verify` passed on the final source: TypeScript, 152 main tests, the visitation suite, and 12 group-suite entries. `pnpm build:web` passed. The design detector reported no findings.
- Local production-build checks used synthetic in-browser backend responses only: directory initial and full profile patronymic rendering, editor prefill, 16px inputs with small-text preference, deacon search, and Ukrainian large-text Schedule navigation. Phone (390x844) and desktop (1440x900) screenshots were inspected; measured layouts had no horizontal overflow, single-line navigation labels, and no gap between Schedule's content region and navigation. This does not establish physical iPhone focus behavior or live OAuth reliability.
- A simulated backend 503 on foreground revalidation displayed the localized reconnect state; restoring the fixture and dispatching an online event automatically restored the directory. These were synthetic requests, not a live token-expiry test.
- Applied `mobile/supabase/migrations/20260923000000_member_patronymic.sql` through the authenticated SQL Editor on 2026-09-23, before the role-permissions migration described above. Live column/writer/directory return-field checks passed. Signed-in editor add/update/clear, ordinary-member read access, unauthorized writes, and conflict-handling checks remain outstanding. Do not rerun the migration or use `supabase db push`. No live member mutation was performed in this deployment.
- The migration is additive for the previous client: omitted patronymics remain unchanged on edits, absent values remain null, and existing RPC arguments and permission checks are preserved. PGlite tests cover persistence, clearing, legacy writes, authorization, length constraints, and stale revisions. Retain the prior Vercel deployment for rollback; do not remove the column while clients may use it.
- Complete feature PR -> reviewed, CI-green `dev` Preview -> separate `dev` to `main` release PR, with the release version updated as part of that batch. Authenticated Preview, live idle/refresh behavior, callback/deep-link/confirmation smoke checks, and physical-device validation remain required before production release. Notification APIs and preferences are unchanged.

## Profile Portrait Loading Fix

Implemented on `fix/profile-avatar-flash`. Profiles with a known photo path reserve a neutral portrait area while the signed source is pending instead of briefly displaying initials. Details still render immediately, and retained portraits remain visible during same-member refreshes. Members without photos and failed signing/image requests retain the initials fallback. Portrait completion is independent of deacon-avatar loading and remains protected by the existing member/session request guards.

The focused screen-state regression covers desktop/mobile pending, successful, failed, and absent portraits plus obsolete responses. Physical-device and authenticated Preview checks are not implied by these tests.

## Home-Screen Icon and Name

Implemented on `feature/home-screen-icon-name`. New web installs suggest `Довідник` through both manifest names and Apple's home-screen title metadata. Standard 192/512px and Apple 180px icons use the existing church logo at 86% of tile height on white. Android has a separate maskable icon with the artwork inside the central 80%-diameter safe area. Native app names/icons and in-app language preferences are unchanged.

Verification: `pnpm verify` passed (146 main tests, visitation domain suite, 12 group-suite entries), and `pnpm build:web` passed. Built manifest/Apple metadata and all four icon decodes were checked in the browser. Pixel checks confirmed opaque artwork, standard logo height near 86%, and maskable ink within 38.8% of the tile width from its center. Apple and Android artwork was visually inspected. This change does not alter auth, confirmations, notifications, or backend behavior; live OAuth and physical-device installation were not exercised.

Existing home-screen shortcuts may retain their cached icon or user-selected name. After deployment, remove and re-add the shortcut to see the new defaults. Physical iPhone/Android installation remains a manual release check.

## Bounded Photos and Faster Profiles (1.3.0)

Local implementation on `feature/optimized-profile-photos`; not deployed. This supersedes the unchanged-original upload behavior described below.

- New uploads encode a JPEG portrait with a longest edge of at most 1280 pixels and a centered avatar of at most 256 pixels, without upscaling. Output limits are 512 KiB and 50 KiB respectively; encoding tries quality 0.8, 0.75, then 0.7 and rejects images that still exceed the limit. The existing 5 MiB input limit remains. The selected camera-resolution source is not uploaded.
- Both images upload to new versioned paths before revision-checked publication. Successful replacements/removals check for references before deleting the previous pair. Unconfirmed publication preserves attempted files; cleanup failures report a warning without undoing publication. Storage policy limits are unchanged, so older installed writers can still upload larger files.
- Profile details no longer wait for image signing. Portraits and responsible-deacon avatars hydrate independently. Same-member content remains visible during focused reloads; member/session changes hide old content and reject late responses. An unused account query was removed and deacon/member-ministry reads run concurrently. No new persistent private cache or database contract was added.

### Verification and Remaining Gates

- Focused tests passed for size limits, capped encoding retries, temporary-resource cleanup, paired publication, reference-aware deletion, uncertain publication, text-before-photo rendering, warm focus, and obsolete member/session responses. These encoder tests use mocks, not real-image visual validation.
- `pnpm verify` passed: TypeScript, 146 main tests, visitation domain suite, and 12 group-suite entries. `pnpm build:web` passed. Editor diagnostics and `git diff --check` were clean.
- The production web encoder generated two local portrait/thumbnail pairs from bundled, nonprivate PNG samples. Both decoded and were visually inspected: 1,935,724 input bytes became a 151,414-byte portrait and 11,730-byte avatar; 1,770,886 input bytes became a 128,833-byte portrait and 9,074-byte avatar. Portraits retained their 1254x1254 input dimensions; avatars were 256x256. Neither JPEG contained EXIF/XMP markers. These opaque PNG samples do not establish EXIF-rotation or transparency handling, nor do they measure live member-photo savings. No samples were uploaded.
- Before release, check two representative real image pairs for dimensions, bytes, sharpness, orientation, and metadata. Verify picking and replacement on physical iOS/Android. A consistent white transparency matte is not implemented or established by the SDK inspection; resolve that before declaring the agreed image-normalization work complete.
- Complete authenticated mobile/desktop Preview checks, including existing auth/deep-link/confirmation flows and no notification side effects. Native-device and live OAuth checks have not been performed for this change.
- Deploy the updated writers before converting existing storage. Conversion has not been run and no existing originals were deleted by this implementation. Inventory first, validate two representative converted pairs, then process remaining records with automatic upload/publication checks. Publish with the current member revision, check that old paths are unreferenced, and remove the old pair immediately after confirmed success. Failed or ambiguous publication must preserve the old pair. Finish with aggregate reference/object counts; no per-pair download verification or retention window is required.
- Follow feature PR -> reviewed, CI-green `dev` Preview -> separate `dev` to `main` release PR. Existing readers understand the same base-path/thumbnail convention, but deleted full-resolution sources cannot be recovered from the optimized files.

## Warm Tabs and Thumbnails (1.2.0)

Implemented on `feature/warm-tabs-thumbnails`, branched from `dev`. Not deployed or merged.

- Directory records, Groups list records, yearly duty periods, visit counts, and pending-approval badge counts have five-minute, bounded, session-only caches. Concurrent reads share requests. Manual refresh bypasses freshness; successful local mutations invalidate affected data. Birthday authorization is not cached.
- Directory, Groups, Schedule, and Duty Summary retain ready content during background refresh. Native pull-to-refresh and web refresh buttons remain available; failed warm refreshes retain rows with a retry action. Focus/unmount guards reject late UI updates. Foreground/four-minute active-view checks revalidate account access and renew photo sources; no background polling while hidden.
- Cache scope includes account ID, status, role, leadership, linked member, revision, and session generation. Access changes/sign-out clear caches. There is no private offline store, service worker, new backend service, or cross-account image key.
- Private photo URLs are signed in batches of at most 100 and reused for 240 seconds of their 300-second lifetime, independently of dataset freshness. Native image decoding uses memory-only caching with stable session/path keys. Browser HTTP caching remains browser-controlled.
- Every photo upload produces an unchanged selected original plus a centered JPEG thumbnail, at most 256x256 without upscaling. The thumbnail path is `<original-path>.avatar-256.jpg`. Both upload before the original path is published. Partial failures/conflicts clean the attempted pair; replacement/removal/member deletion clean both files. Generated temporary files and image handles are released.
- Small avatars, including Menu, use thumbnails; profile portraits and the large member editor portrait use originals. Missing/failed thumbnails show initials. There is no original-only compatibility branch, original-image fallback, backfill tool, or legacy-photo handling.

### Verification

- `pnpm verify`: passed (142 main tests, visitation domain suite, 12 group-suite entries). Covers freshness, bounded retention, request deduplication, account/permission changes, late responses, warm error state, signing renewal/batching, paired upload rollback, and crop/cleanup API behavior.
- `pnpm build:web`: passed. iOS and Android exports passed into ignored `.expo/warm-tabs-native`; exports are not physical-device tests.
- Built web app with an in-page synthetic backend fixture: ten warm Directory -> Groups -> Schedule cycles issued **zero additional backend requests**, including badges, and inserted **zero cold loading indicators**. Each dataset/count was requested once during warm-up. A forced failed manual refresh retained both visible directory rows. Phone (390x844) and desktop (1440x900) layout bounds had no horizontal overflow across those three views.
- Browser fixture uses initials, not signed private photos, and dispatched navigation events because embedded-browser pointer actionability was unreliable. Phone screenshot inspected; desktop captures were clipped by the embedded browser. This is not an authenticated Preview, real-photo transfer measurement, full desktop visual review, or live OAuth test.

### Release Gates

1. Manually deploy and verify the changed `delete-member` Edge Function before enabling paired uploads in production. No database schema/contract change or automatic migration push is required.
2. Build/distribute native binaries with the SDK 57 image-manipulator and file-system dependencies. Verify picking, orientation/transparency, thumbnail dimensions/bytes, replacement/removal/deletion, and cleanup on physical iOS/Android with disposable records.
3. In authenticated dev Preview and on devices, measure real photo transfers/decodes and sharpness at 1x/2x/3x. A typical <=50 KB thumbnail remains a measurement target, not a guarantee. Check image renewal after expiry, failed thumbnails, changed member photos, foreground revalidation, and sign-out/account switching.
4. Complete full mobile/desktop visual and existing auth/deep-link/confirmation/notification-side-effect smoke checks. Follow feature PR -> reviewed/CI-green `dev` Preview -> separate `dev` to `main` release PR. Keep the prior deployment as the rollback target; do not add legacy-photo code.

## Branch Model

Pull-to-refresh refinement: removed the added refresh icon from Directory, Groups, and Schedule. Native refresh controls remain; touch web refreshes on a downward gesture from the top, with a progress indicator only during refresh. Warm-refresh errors remain visible without a button. Validation was limited to TypeScript and a focused gesture check at the requester's direction; the full suite, production build, and device/browser smoke checks were not rerun for this refinement.

```text
feature/* -> dev -> main
			  |      |
			  |      +-- Vercel Production
			  +--------- Vercel Preview/staging
```

- Feature branches create Vercel Preview deployments through pull requests.
- Merging into `dev` creates the shared development/staging Preview deployment.
- Merging a reviewed release pull request from `dev` into `main` creates the Vercel Production deployment.
- The legacy `web/` application is not deployed. Its `web/vercel.json` disables Git deployments.
- GitHub Releases are optional release notes and audit records. They do not trigger deployment.

This model intentionally makes a merge into `main` a production release. Keep unreleased work in `dev`.

## Repository CI

`.github/workflows/ci.yml` runs `pnpm verify` for pull requests and pushes targeting `dev` or `main`. Protected branches must require this check. The workflow has no Vercel token, deploy command, or production secret.

Use Node 24 (tested with 24.21.0) and the package's pinned pnpm 12.4.1 from `mobile/`:

```sh
pnpm install --frozen-lockfile
pnpm verify
pnpm build:web
pnpm serve:web
```

The production preview is served at `http://localhost:4173`. `pnpm web` starts Expo development mode. Supply `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in an ignored `.env.local` or the hosting environment. Never include a service-role or secret key. Production builds reject absent backend configuration and recognizable privileged keys.

## Vercel Setup

1. Connect `ysalo/FUBC-Member-Directory` and set **Root Directory** to `mobile`.
2. Set the Vercel **Production Branch** to `main`.
3. Keep Git deployments enabled for `main`, `dev`, and feature branches as appropriate.
4. Optionally assign a stable staging domain to `dev`; never assign it to the production domain.
5. Configure Production variables for the live Supabase public URL and publishable key.
6. Configure Preview variables separately when possible, preferably against a staging Supabase project.
7. Remove Deploy Hooks and revoke retired external Vercel tokens or integrations.
8. Preserve the current Production deployment before cutover for emergency rollback.

The Vercel GitHub App manages deployment authentication. Do not add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID` to GitHub Actions.

No Vercel deployment or live Supabase configuration change was performed in this implementation session.

## Supabase Readiness

Supabase deployment remains manual and independent of Vercel:

- Apply and verify required SQL before merging backend-dependent client changes into `main`.
- Deploy and verify required Edge Functions separately.
- Do not run `supabase db push` until migration history has been inspected and reconciled in `mobile/supabase/CONNECT_EXISTING_PROJECT.md`.
- Keep `expo-directory-v3` separate from application SemVer.
- Confirm the current and rollback clients are compatible with the live backend.

## Release Procedure

For feature work, use this issue-to-release flow:

1. Run `/grill-with-docs` to shape the idea and record domain decisions.
2. Run `/to-spec` to publish the agreed specification as a GitHub issue. Keep the default triage labels below; a completed spec should be `ready-for-agent`.
3. Run `/implement` from that issue. Open an implementation PR from the feature branch into `dev` and link the issue in the PR's Development section.
4. After the feature PR is reviewed and merged into `dev`, include every shipped issue in the separate release PR from `dev` into `main` using `Closes #<issue-number>`.
5. Merge the release PR after review and production readiness checks, then verify each referenced issue closed. GitHub closes the issues when this PR merges into the default branch, `main`, if repository auto-close is enabled. A closing keyword on the implementation PR into `dev` does not close the issue. If an issue remains open, check the release PR body and the repository's **Auto-close issues with merged linked pull requests** setting; close it manually if the release PR has already merged without a closing keyword.

Use GitHub's default triage labels consistently:

- `needs-triage`: incoming issue has not been assessed.
- `needs-info`: work is waiting for information from the requester.
- `ready-for-agent`: the spec is ready for implementation.
- `ready-for-human`: a human decision or action is needed.
- `wontfix`: the issue will not be implemented.

Update labels as work changes state. Labels track triage state; PR references track implementation and release. Keep issue closure in the `dev` to `main` release PR.

### Release checklist

1. Wait for CI and inspect the Vercel Preview deployment.
2. Merge into `dev` after review and verify the shared staging Preview.
3. For a production batch, update `mobile/package.json` on `dev` using SemVer. `mobile/app.config.js` reads this value automatically.
4. Run `pnpm verify` and `pnpm build:web`.
5. Open a release pull request from `dev` into `main` with version, backend readiness, known issues, rollback target, and a `Closes #<issue-number>` entry for each issue being released.
6. Merge after required CI and review checks pass. This immediately deploys Production through Vercel and closes linked issues when repository auto-close is enabled.
7. Verify the production deployment, stable domain, authentication callback, app shell, critical read-only flows, and issue closure.
8. Optionally create a matching `vX.Y.Z` GitHub Release on the merged `main` commit. It is audit metadata, not a deployment trigger.

The semantic application version has one source: `mobile/package.json`. The initial release is `1.0.0`; later releases update that package version only.

The application version is separate from the `expo-directory-v3` Supabase compatibility contract. Change that contract only when coordinating a database/client contract revision, not during a routine application version bump.

## Rollback

If Production is unhealthy:

1. Check backend compatibility with the previous application version.
2. In Vercel, promote the retained previous Production deployment.
3. Verify the stable domain, authentication callback, and critical read-only routes.
4. Open a revert or fix pull request so `main` reflects production state.

Do not rebuild an old commit as an untracked deployment. Use a new PR through `dev` and `main` for the durable fix.

## Acceptance Checklist

- [ ] `dev` and `main` block force pushes and deletion.
- [ ] Both branches require the CI check before merge.
- [ ] Feature PRs target `dev`; production PRs target `main`.
- [ ] Vercel Root Directory is `mobile` and Production Branch is `main`.
- [ ] A dev merge creates Preview only; a main merge creates Production.
- [ ] No GitHub Actions Vercel token or deployment workflow exists.
- [ ] The previous Production deployment is retained for rollback.
- [ ] Manual Supabase readiness is complete before backend-dependent production merges.

## Verification History

- Full `pnpm verify` passed after integration: TypeScript, authorization/database tests, existing domain suites, and new web-auth/platform/build tests.
- Final web production export passed after the browser-discovered Link styling correction.
- iOS production bundle export passed (`expo export -p ios`); this confirms bundling, not physical native operation.
- Browser checks used the configured production sign-in page and a separate local development fixture session (with backend environment loading disabled). No fixture data was written to Supabase.
- Checked production sign-in, callback denial/recovery UI, direct-route HTTP serving, mobile bottom navigation, desktop sidebar, directory search/no-results/recovery, member navigation/profile, group list, visitation planning/required-person validation, browser date/time controls, and Menu language/theme/text-size controls.
- Reviewed phone (390×844) and desktop (1440×900) layouts. Fixed Expo Router Slot style merging discovered in the browser; phone directory and desktop profile verified afterward. Phone form and Ukrainian large-text Menu measurements showed no horizontal overflow; dark mode and localized installation help rendered correctly.
- Mechanical UI detector returned no findings. Dialog cleanup and stale callbacks, notification isolation, date bounds, sharing/cancellation, OAuth replay/return validation, session races, and missing/secret build configuration have automated regression coverage.

## Member Responsible Deacons (1.1.0)

- Member profiles show assigned membership-group deacons above Contact, reusing compact directory cards on native and web. Empty assignments hide the section; archived deacons are excluded and cards open member profiles.
- Uses existing `deacon_group_deacons` and `people` reads with existing RLS and private photo signing. No migration, backend deployment, or contract change is required; the previous client remains compatible.
- Local `pnpm verify`, `pnpm build:web`, and focused repository/layout regression tests passed. Live Vercel Preview, review, staging, and production verification remain release gates.
- Fixture browser checks passed at 390x844 and 1440x1000: section order, directory card appearance, no horizontal overflow, deacon profile navigation, direct-link reload, and hidden empty section. No live records were modified.
- Rollback target: the retained production deployment at `ecd361f` (application 1.0.14). Physical native and live OAuth checks have not been performed for this change.

## Responsible Deacon Avatars (1.1.1)

- Replaces responsible-deacon cards with 64px avatar links, preserving the section's original position above Contact on desktop and mobile. Links have accessible names, browser name tooltips, and existing initials fallbacks.
- No repository, backend, permissions, or notification changes. No migration is required and application 1.1.0 remains backend-compatible for rollback.
- Local `pnpm verify` and `pnpm build:web` passed, including avatar navigation markup and unchanged section-order regression coverage. Fixture browser checks covered 1440x900 and 390x844 layouts, avatar-only content, image asset loading, click and Enter navigation, and hidden empty sections. Authenticated Vercel Preview validation, CI, and review remain release gates. Physical native and live OAuth checks have not been performed.

## Member Profile Refinements (1.1.2)

- Moves Responsible deacons below Contact on desktop and mobile, while retaining avatar-only profile links without redundant Deacon badges.
- Renames the English visitation action from Request visit to Plan visit. The existing Ukrainian planning label is unchanged.
- No repository, backend, permissions, notification, or migration changes are required. Application 1.1.1 remains backend-compatible for rollback.
- Focused profile tests, full `pnpm verify`, and `pnpm build:web` are required before release. Browser and physical-device checks were omitted at the requester's direction.

## Native Performance Pass

- Delivered through feature PR #30 into `dev` and release PR #31 into `main` (merge `08dcfa2`). Deployment verification is separate from the merge record.
- Group detail now reuses the existing directory-summary RPC in bounded 100-ID batches instead of one private-profile RPC per member. Fixture data requests fall from 57 to 7 for 50 members and from 1,006 to 16 for 999 members. Photo-signing counts are unchanged.
- No new infrastructure, migration, RPC contract, permission, or notification changes are required. The previous client remains backend-compatible.
- Directory reads now use a 30-second memory-only, account/revision-scoped cache with in-flight deduplication and stale-response invalidation. Directory search keeps typing immediate while debouncing derived filtering and reuses a prepared normalized/sorted index. No private data is persisted.
- Visitation reads now support 50-record pages with continuation and duplicate protection; hydration uses keyed maps, and cold directory/visitation screens show accessible skeletons. The existing full-list compatibility method remains for detail/domain callers. Native visitation card virtualization remains a follow-up because the current screen container has not been replaced yet.
- Focused repository and real PostgreSQL projection/authorization tests passed, along with full `pnpm verify`, `pnpm build:web`, and iOS/Android bundle exports. Export success is not a physical-device performance check.
- A local public Lighthouse baseline completed: performance 0.46, accessibility 0.88, best practices 1.00, SEO 0.54, LCP 15.1s, TBT 760ms, CLS 0. Authenticated preview and desktop/mobile repeated audits remain release gates.
- Cleanup audit removed two unreachable files, four unused direct Expo dependencies, ignored avatar props, unused helper/export surfaces, and one tautological assertion. `@expo/ngrok` remains intentionally for `start:phone`; generated database types and deployment/runtime metadata were retained.
- See [performance evidence and remaining slices](performance-pass.md) for reproducible measurements, bundle baselines, and pending cache/list/startup/Lighthouse work.
- Authenticated Preview checks, group flags/order/photos, navigation/deep links, and native group-detail smoke checks require separate release evidence. Live OAuth and physical-device timing were not performed in this slice; the local public Lighthouse audit is recorded above. No hosted backend records were changed.
- Release only through a separate reviewed `dev -> main` PR after the remaining performance work and release gates. Keep the retained web deployment and existing native recovery path available; the first slice needs no database rollback.

## Loading Layout and Cleanup (1.1.3)

- Directory placeholders reuse the real row and section styles, 72px phone/56px desktop avatars, scaled typography, separators, and desktop ministry/phone columns. The centered empty-state wrapper and extra spinner are gone. Existing rows remain visible during refresh.
- Visitation placeholders use the actual visit-card and response-row styles. Tabs and authorized planning actions remain in place during loading; tabs are disabled until the initial request finishes. Web lists reserve scrollbar space to prevent width changes.
- Removed the unused generic skeleton, unreachable directory summary/filter UI, four unused domain models, unused domain type exports, and the broken reset-project script. Deleted two obsolete/vacuous source-only tests and fixed three missing-element order assertions. Cache and rendered loading-state tests now run in `pnpm verify`.
- Local full verification passed (129 main tests plus visitation/groups suites). Final web, iOS, and Android exports passed. Rendered fixture checks cover loading/loaded/error accessibility; browser measurements compare phone (390px) and desktop (1440px), standard/large text, light/dark themes, and English/Ukrainian variants. Representative row/card bounds match within 1px with no horizontal overflow.
- Fixtures isolate repositories, navigation, and the optional duty banner. Unknown badge counts, variable invitees, wrapping data, and optional banners can still affect final content height. These checks are not authenticated Preview, live OAuth, or physical-device verification.
- No backend changes, migration, permission changes, or new dependencies. Rollback target: retained production deployment from `08dcfa2` (application 1.1.2).
- Release gates: feature PR into `dev`, CI/review and authenticated Preview, then separate reviewed `dev -> main` PR and production smoke checks. No production release is claimed by these local checks.

## Still required before production use

- Complete real Google OAuth on the final HTTPS origin, including reload/relaunch and installed-iPhone return flow. Confirm pending/member/deacon/pastor/editor/admin authorization against live accounts.
- Exercise photo chooser/cancel/upload/removal and all management mutations with disposable authorized records, including Edge Function CORS and deployment checks. Local UI and SQL tests do not establish live service readiness.
- Physically verify iPhone Add to Home Screen, icon, standalone display, safe areas, keyboard-open forms, external links, and relaunch. Check Safari and Chrome independently.
- Smoke-test native iOS sign-in, tabs, date pickers, and birthday notifications on a device. A successful iOS export is not a device test.
- Confirm deployment cache headers, callback and record deep links on Vercel, and rollback behavior. Offline behavior requires reconnecting; notifications and offline editing are intentionally absent on web.

## Member CSV import (PR #90)

The administrator import route, name-field schema, transactional replacement, retryable metadata-only photo cleanup and minimal photo-write response ship together in PR #90 into dev. The confirmed test backend has both reviewed migrations and the `import-members` endpoint applied; its directory now matches the 850-row source, with six Auth accounts retained and all 134 old photo objects removed. See [deployment order, reset scope and evidence](member-csv-import.md). No automatic migration push or production frontend release was performed. Live OAuth, physical native checks and authenticated Preview remain separate release gates.

## Directory alphabet correction and release (PR #90)

Directory now uses stored `last_name`, preserving compound surnames. Latin lookalikes embedded in Cyrillic names are normalized for ordering/section headers. Ukrainian surnames use Ukrainian collation in both app languages; English surnames follow in their own A–Z sections, placing Andrew Waltmen under W. Corrected `Cавчук` → `Савчук` and `Pощук` → `Рощук` for the two specified members in the hosted DB and both maintained main CSVs; backed up the preceding CSVs. Originals remain untouched. No directory reimport or photo download was performed.

Node 24 verification passed (225 main tests, one optional skip; visitation 1 and groups 12), and the public-config web build passed. Browser fixtures at 390×844 and 1440×900 confirmed Р/С/Я/W section and member order, no overflow, page errors, Storage requests or notification permission calls. The fixture includes the original mixed-script surnames to verify defensive ordering. Hosted Preview requires Vercel SSO; authenticated Preview, live OAuth and physical native checks are not claimed. Backend name/import prerequisites are already deployed and remain compatible with older clients. Requested release sequence: merge the checked feature PR into dev, then create/check/merge a separate dev → main PR through Git integration.

## Group import identity matching (2026-10-05)

Group files accept plain full names or `{name, birth_date}` identities. Date-qualified identities require an exact full-name/date match, including the year, and remain unresolved when missing or ambiguous. The review picker and group assignment editor show full birth dates or an unavailable label beside people. One or two deacons are accepted, matching the existing editor/RPC limit. Reviewed omissions are preserved in a separate private issues file; `mobile/scripts/audit-group-names.py` reproducibly rebuilds local artifacts using an explicit decisions file without committing member details.

The additive `20261005010000_group_import_birth_dates.sql` RPC returns only active person IDs and birth dates to active directory managers. This preserves the private table's deny-by-default policy. It was manually applied through authenticated CLI SQL; migration history remains unreconciled, and no db push was used. Frontend rollback can retain this RPC.

Validation: full `pnpm verify` and `pnpm build:web` passed (production export used a public fixture key). Manager/ordinary-member/pending/anonymous access tests passed. Local Chromium fixtures at 390×844 and 1440×900 checked identical-name birth-date choices, automatic date-qualified matching, one-deacon role partitioning, manual selection, draft-only application, move confirmation/cancel, save failure/retry, management deep links, callback recovery and notification isolation. No horizontal overflow or browser exceptions occurred. These are synthetic browser checks, not live OAuth or physical native validation. PR #116 targets dev. The hosted Preview redirects phone and desktop Chromium to Vercel SSO, preventing authenticated Preview validation. CI/review and authenticated Preview remain merge/release gates; production frontend deployment is not claimed.

Group 2 private files are under `/home/ysalo/Documents/member_list_photos/group-2-viktor-roshuk/`. The file contains 52 existing members and one listed deacon; three user-omitted member names and the source's absent second-deacon entry are preserved in `group-2-issues.json`. The source-authorized deacon ministry assignment and group import use the existing revision-checked save RPCs; the rolled-back live dry run matched the requested older duplicate by birth date and confirmed exact counts without creating/deleting people or moving existing group assignments.

Group 2 import completed through the existing authenticated RPCs. Persisted verification confirmed 52 ordinary members, one eligible source-listed deacon, the selected older same-name record assigned and the younger record unassigned. The existing Group 3 remains at 45 members; the total roster remains 850. Private plan, dry-run/commit receipts, and verification are saved in the Group 2 folder.

## Deacon member editing (2026-10-05, version 1.6.1)

Active deacons can open Edit member from profiles belonging to their assigned membership group. The shared editor saves names, contact details, dates, gender and care flags. Group membership, ministry assignments, family relationships, photos, account linking, creation, departure/restoration and deletion remain managed through existing editor/admin permissions. Scoped backend reads and an additive `deacon_save_member` RPC independently enforce active-account, ministry, current assignment, active-group/member and revision checks; unsupported mutation fields are rejected. Ordinary members have no editing access.

Manually applied `20261005020000_deacon_member_edit.sql` through the authenticated CLI SQL query after checking the documented project. A rolled-back authenticated deacon smoke test verified personal-detail updates, preserved group assignment and denial of creation/removal. All 850 people remain; no smoke records persisted. Keep the additive RPCs and scoped care-detail function during frontend rollback to 1.6.0. CLI migration history remains unreconciled; do not run db push.

Validation: Node 24 `pnpm verify`, production web export, SQL authorization tests and phone/desktop Chromium fixtures. Fixtures cover Edit member, direct editor links, failed save/retry, restricted controls/routes, out-of-group denial, callbacks, overflow and zero notification calls. Hosted Preview may require Vercel SSO; physical-device/live OAuth checks are not claimed. Feature/release PRs carry CI, Preview and production evidence.

## Private member care notes (2026-10-05, version 1.7.0)

Responsible active deacons can add/edit a shared care note on each active member of their assigned membership group. The note is the first body section below the profile photo/identity, with a quiet labeled add/edit action. Pastors can read notes. Directory rows display a small Note indicator and leadership filters include Has a note; presence comes from a separate RLS-filtered ID query, never a public people column. Ordinary members, unrelated deacons, editors and admins without the required leadership scope receive neither note text nor presence. English/Ukrainian labels, multiline text, retryable saves, cancellation and draft navigation guards are included.

Reviewed and manually applied the additive `20261005030000_member_notes.sql` through authenticated CLI SQL to the existing documented project. Note reads enforce RLS; direct client writes are revoked; the save RPC checks current responsibility and serializes revision-checked writes against the member record. A rolled-back hosted smoke test verified scoped read/write, stale-write rejection and loss of visibility after unlinking leadership. No test notes persisted; the roster remains 850. Migration history remains unreconciled; no db push was used. Retain the table/functions on frontend rollback to 1.6.1.

Validation: `pnpm verify` and `pnpm build:web`, database authorization/revision tests and local phone/desktop browser fixtures covering leader/member visibility, edit, save failure/retry, cancel, row indicators, checkbox filtering, callbacks, overflow and zero notification requests. Physical native/live OAuth checks are not claimed. Hosted Preview accessibility, CI, review and production deployment evidence belong to feature/release PRs. Release uses feature → dev → main and Vercel Git integration.

## Note removal and subtle controls (2026-10-05, version 1.7.1)

The profile section is now named Note. A small add/edit note icon sits beside Edit member in the profile corner/desktop toolbar. The note editor aligns its actions to the right, with Cancel before Save note. The directory indicator is an accessible, orange note icon at the right edge, without visible text. Existing leadership-only text/presence/filter permissions remain enforced by the database.

Responsible deacons can remove a saved note after confirmation. Cancel sends no removal request. Failed removal preserves the note for retry; success clears its row/presence and restores Add note. The additive `remove_member_note` RPC locks the member, verifies current assignment and checks the expected revision. A private sequence/trigger gives recreated notes fresh revisions, rejecting stale removal or save requests against a replacement. Editing captures its original revision rather than adopting a background refresh. Pastors retain read-only access; direct table writes/deletes remain revoked.

Manually applied `20261005040000_remove_member_note.sql` through authenticated CLI SQL after checking the documented project. A rolled-back live smoke test verified removal, recreation with a new revision and stale-removal denial. All 850 members and the existing note were preserved; no test notes persisted. No db push or history reconciliation. Frontend rollback to 1.7.0 retains the additive RPC/trigger/sequence and remains compatible.

Validation: Node 24 verify, production web export, database permissions/revisions/removal/recreation checks, and local phone/desktop Chromium fixtures covering both themes, corner controls, right-aligned icon color, Cancel/Save note order, removal confirmation/cancel/failure/retry, filtering after removal, role restrictions, callbacks and zero overflow/errors/notification permission calls. Physical native/live OAuth are not claimed. Feature/release PRs record hosted Preview/CI and production evidence; release follows feature → dev → main.

## Notes on profiles and group rosters (2026-10-06, version 1.7.2)

Add note returns to the first profile body section below the photo. Saved notes place Edit note beside Remove note; the existing right-aligned Cancel → Save note editor order remains. The Note header includes the directory's orange note icon and accent text. The photo corner contains only the member-info editor.

Group member rows now display the same right-aligned orange note icon, and responsible active deacons/pastors have a Has a note checkbox in group member filters. Presence comes from RLS-filtered member_notes ID queries in batches of at most 100; note text is never loaded into group data. Group rosters refresh on return from a member record and on note changes through read-only requests that do not schedule notifications. Account permission changes gate the indicator/filter in addition to database rules.

No backend migration or live data mutation is required. Existing note read/write/removal RPCs remain prerequisites and frontend rollback to 1.7.1 is compatible. Validation: Node 24 verify, web export with fixture public configuration, batched group repository/denied-presence tests and phone/desktop light/dark browser fixtures for responsible deacon, pastor, ordinary member and unrelated deacon. Fixtures cover profile controls/header color, save/remove/retry/cancel, group/directory presence and filtering, group return after removal, callbacks and zero overflow/errors/notification permission calls. Browser backend data is synthetic. Physical native/live OAuth are not claimed. Feature/release PRs record CI, hosted Preview accessibility and production evidence; release uses feature → dev → main.

## Simpler member note section (2026-10-06, version 1.7.3)

An empty note now shows only a subtle Add note button below the photo. Saved notes have a quiet header, the existing orange note icon, and adjacent Edit/Remove text actions in the header. The note text is the main content. Removed the repeated visibility caption, card outline and persistent red removal action. Removal still requires the existing destructive confirmation. Editors keep right-aligned Cancel then Save note, accessible full action names and 44px minimum button heights. Header actions can wrap for larger text.

No database changes, migration, new dependency or permission changes. Existing member_notes RLS and save/removal RPCs remain required. Rollback to 1.7.2 is compatible. Impeccable was not installed or returned by the plugin search; the shared native/web component was simplified directly.

Validation: Node 24 pnpm verify (271 main passes, one optional skip; visitation 1; groups 13), production web export, and synthetic-backend Chromium fixtures on phone/desktop in both themes. Fixtures cover empty-state absence of heading/caption, adjacent actions, Cancel/Save order, save/remove failures and retries, confirmation cancellation, role restrictions, directory/group presence and filters, callbacks and zero overflow/page errors/notification calls. Screenshots inspected for the empty and saved states. Hosted Preview may require Vercel SSO; authenticated hosted Preview, physical native and live OAuth checks are not claimed. Feature/release PRs record CI, Preview and production deployment evidence. Release follows feature → dev → main.

## Add note in member details (2026-10-06, version 1.7.4)

The empty-state Add note action is now quiet text beside the Member details heading. The separate row below the photo is removed. The saved note/editor remains the first body section below the photo. A shared render slot lets the note controller supply the heading action only when the authorized responsible deacon has no note and is not editing. Add note is absent while creating/editing and when a note exists. New-note editors alone show “Only visible to pastors and group deacons.” in small secondary text, with a Ukrainian equivalent. Cancel restores the empty action; the existing right-aligned Cancel → Save note and adjacent Edit/Remove actions remain.

Used the official pbakaus/impeccable skill (4.5.0) from a temporary checkout for context, independent layout assessment, craft guidance and mechanical scans. Refinement preserves the shared Expo native/web design. Impeccable scans returned no findings for the changed UI. No skill files or tools are added to the app.

Validation: Node 24 pnpm verify (271 main passes, one optional skip; visitation 1; groups 13), pnpm build:web, and 16 phone/desktop light/dark synthetic-backend browser cases covering heading placement, action hiding, new-only privacy text, saved-note actions, save/remove/retry/cancel, role restrictions, directory/group filters and indicators, callbacks and zero overflow/errors/notification calls. Additional 320px/768px large-text English/Ukrainian fixtures and screenshot inspection cover wrapping and editor cancellation. Updated the existing profile-loading fixture to render the shared content slot so it continues to test photo/session isolation and family order.

No backend migration, new app dependency or permission change. Existing note RLS and save/removal RPCs remain required. Rollback to 1.7.3 is compatible. Hosted Preview may require Vercel SSO; authenticated hosted Preview, physical native and live OAuth checks are not claimed. Feature/release PRs record CI and deployment evidence; release follows feature → dev → main.

## Clear Add note action beside Contact (2026-10-06, version 1.7.5)

Moved the empty-state Add note action from Member details to the Contact heading. A plus icon, neutral outline/surface, stronger text and pressed feedback make it recognizable as a button while preserving the trailing heading layout. It keeps a 48px touch target and wraps right on narrow/large-text layouts. The action remains hidden during creation/editing and after save; new-note visibility text and saved-note controls remain unchanged.

No backend migration, app dependency or permission change; rollback to 1.7.4 is compatible. Validation: pnpm verify and pnpm build:web, synthetic-backend phone/desktop/light/dark note workflows and 320/768px large English/Ukrainian fixtures. Checks cover Contact placement, action hiding, privacy helper, save/remove retries/cancel, role restrictions, directory/group filtering, callbacks and no overflow/errors/notification calls. Hosted Preview may require Vercel SSO; authenticated hosted Preview, physical native and live OAuth are not claimed. PRs record CI, Preview and production evidence; release follows feature → dev → main.

## Menu redesign 1.8.4

Menu now gives preferences the primary desktop column, wraps full-name radio choices, and presents About in a bounded browser dialog. Native uses the same content with touch choices and a page sheet. Language persists in device storage; appearance writes are actually executed and pending reads cannot overwrite a newer choice. Manage's Other tools navigation rows regain disclosure arrows; ministry list entries do not.

Run synthetic browser acceptance after exporting, without rebuilding while the server is in use:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium FUBC_SITE_URL=http://localhost:4173 \
FUBC_BROWSER_OUT=/tmp/menu-evidence node tests/menu-browser.mjs
```

The harness intercepts Supabase, blocks unknown writes, checks 320/390/1023/1024/1440px in both themes with Ukrainian large text, and exercises radio keyboard behavior, persistence/reload, About version/focus/dismissal, account deletion guards, profile navigation, installation help and Manage tool navigation. Remote sign-out failure is tested against the installed Supabase library's behavior: local session is removed and sign-in appears. No real account mutations or notification calls occur.

`build:web` clears Metro cache so Expo Constants uses current release configuration. Preview may require Vercel SSO; unauthenticated Preview access is not validation of the application. Physical native devices and live OAuth remain unverified. No backend migrations are required.

## Menu corrections 1.8.5

The overall Menu layout is retained. Preference choices return to segmented controls with a filled selection, system/sun/moon appearance icons, and Small/Standard/Large Aa previews. Browser radios retain arrow-key selection and visible focus; shared native controls retain radio accessibility semantics. Full names remain whole; segments wrap rather than splitting labels in Ukrainian and at large text sizes.

Mobile browser About returns to the shared full-screen modal used before 1.8.4. Desktop keeps its bounded dialog when supported, with the full-screen modal as a fallback. With showModal unavailable, 1.8.4 threw and unmounted Menu; this compatibility failure was reproduced, although the user's exact device failure was not confirmed. Native page-sheet behavior is retained; physical native testing is not claimed.

Browser acceptance now uses touch below 1024px, checks filled selections and increasing text-size previews, and verifies About opening, focus, dismissal and reopening. Use FUBC_BROWSER_ENGINE=webkit for the Safari engine, or FUBC_DISABLE_DIALOG=1 to exercise unsupported-dialog About at 390/1440px. The latter disables the API only for About; unrelated confirmations keep their own dialog support. Synthetic responses include CORS headers for WebKit; pending read requests settle before full-document navigation. Unknown writes remain blocked. No backend migration or notification change is required; rollback to 1.8.4 is compatible.

Validation: pnpm verify passed 325 tests without skips; web export and iOS bundle export passed. Ten Chromium and ten WebKit responsive/theme cases plus four unsupported-dialog About fallback cases passed locally. Protected feature → dev → main release checks and production results are recorded in the PRs.

## Native About page 1.8.6

The user clarified that About opened a blank native screen with a horizontal divider. Browser fixes in 1.8.5 did not claim to resolve that native symptom. Native About now opens /menu/about inside a Menu Stack, matching the existing Groups stack structure; it no longer uses a separately presented native Modal. Shared AboutContent retains localized version/licenses and Done, with safe-area spacing, a non-shrinking header and a scrolling body. Done returns through history or falls back to /menu for a direct entry. Browser About still uses its existing dialog/modal adapter and the same shared content. The approved Menu layout and restored segmented controls remain in place.

Four behavioral native component tests exercise actual press/return/reopen handlers and rendered content in both languages with a platform boundary that cannot present a modal. pnpm verify passes 329 tests without skips. Web export and iOS/Android exports pass; native source maps confirm AboutLink.tsx, AboutContent.tsx and app/menu/about.tsx, with no Menu .web modules. Ten Chromium and ten WebKit cases pass, including the new About route, version/license content and Done return. These are component/bundle/shared-layout checks, not physical native-device validation. The original blank native screen could not be reproduced on this Linux host (no device/emulator attached), so native device confirmation remains outstanding; the change removes the modal presentation boundary rather than claiming a confirmed UIKit root cause.

No backend migration or permission changes; revert to 1.8.5 is compatible. Vercel deploys the web app; native clients must load the updated JavaScript via their development server or a new native release. No EAS Update/native release pipeline is configured in this repository. PRs record CI, Preview and production evidence.

## Deacon care notes and group family editing (2026-10-07)

Deacon notes are a separate, shared care note per member, available only to active deacons assigned to that member’s active membership group. Pastors, including administrators with a pastor designation, cannot read note bodies or presence through authenticated APIs. The existing pastor-visible notes retain their ownership rules. The member profile has a collapsed Deacon notes section; the group roster has a heart indicator and a separate Has deacon notes filter. English/Ukrainian copy and existing appearance/text-size tokens are reused. Note edits and removals check revisions, and all mutations recheck group scope while holding the member row lock. Notes are excluded from audit capture and notification work.

Deacons can open Edit family from the member editor for members in their group. The existing family editor uses active directory candidates for deacons and keeps member creation available to directory managers. Relatives may belong to other groups because family connections are reciprocal; only the edited subject must be in the assigned group. Existing ancestry/spouse validation, graph revision checks, archived relationship preservation, removed-member safeguards and the audit wrapper remain intact.

Backend readiness: on 2026-10-07, with explicit user authorization, manually applied `mobile/supabase/migrations/20261007000000_deacon_care_notes_and_family.sql` to the documented FUBC Member Directory project after a rolled-back live rehearsal. Post-deployment authenticated smoke checks verified deacon note access, pastor denial, stale/delete-recreate conflicts, group scope and reciprocal audited family edits. All test changes were rolled back; 850 people, 42 family edges, two existing notes and 1,053 audit events remained unchanged, with zero new care notes persisted. PR #157 remains unmerged at the user’s request. Do not use `db push`; migration history is unreconciled. The additive table may remain during frontend rollback; older clients continue using existing notes/family contracts. Restrict family authorization again if rolling back permissions is required. Do not drop the notes table after users have entered care notes.

Validation: `pnpm verify` passed 332 tests (two optional external PostgreSQL concurrency tests skipped); `pnpm build:web` passed with synthetic public configuration. The new PGlite permission tests additionally verify pastor/admin denial, shared editing by assigned deacons, revocation/group movement/archival, revision conflicts including delete/recreate, validation and audited reciprocal family edits. Four Chromium cases at 390/1440px passed for deacons and pastors, including save, cancel/delete confirmation, family selection/save, roster presence/filter, no horizontal overflow and zero notification calls. Screenshots are in `docs/deacon-care-images/`. Browser checks use fully intercepted synthetic accounts/data, not live OAuth or physical native devices.
