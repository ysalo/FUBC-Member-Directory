# Native-First Performance Pass

## Scope and Delivery

- Prioritize the native Expo app with fewer than 1,000 members; retain web regression checks.
- Use existing Supabase and Vercel infrastructure only. No new cache server, API proxy, SSR app, or deployment service.
- Deliver small `feature/*` branches from `dev`, review feature PRs into `dev`, then open one gated `dev -> main` release PR. No direct commits to either protected branch.
- The initial pass combined the group-query fix, directory caching/search, visitation paging, loading states, and cleanup. It was merged through feature PR #30 and release PR #31 (`main` merge `08dcfa2`). This records Git delivery, not independent production smoke verification.
- The pass changed client memory caching and removed unused direct dependencies. It did not add infrastructure or require a database migration or RPC contract change.
- The cache is memory-only, keyed by account ID and account revision, expires after 30 seconds, deduplicates in-flight reads, and clears on session-scope changes or explicit invalidation. It never persists private data and does not replace authorization checks.

## Environment

Directory and visible-visit-count repository reads now use separate typed caches. Concurrent callers share one request. A rejected request is never cached. Clearing the cache advances a generation, preventing a late response from an old account or invalidated session from repopulating it. An explicit `{ fresh: true }` option is available for mutation-driven refresh paths; normal focus loads can reuse a validated 30-second result.

The directory screen keeps text input immediate but delays only the expensive derived filtering by 150 ms. Clearing the field updates results immediately. A normalized search string and locale-sorted surname index are built once per dataset/locale; each search then filters that prepared index instead of rebuilding normalized strings and sorting on every keystroke. The directory remains a complete in-memory index because the expected member population is below 1,000 and search must not operate on an incomplete page.

Checks passed for cache TTL, concurrent deduplication, rejected loads, explicit clearing, and the stale in-flight response race. Typecheck, full `pnpm verify`, and `pnpm build:web` passed after the repository and screen changes. No native render-time or device latency gain is claimed until release-mode profiling is available.

## Slice 3: Visitation Paging and Loading States

The visitation repository now exposes `listPage(mode, offset, limit)` with a default page size of 50 in both the Supabase and in-memory adapters. The existing `list()` method remains as a compatibility wrapper for callers that genuinely need the complete history. The list screen loads the first page, appends later pages with ID deduplication, and exposes localized loading-more state. Hydration now uses keyed maps for accounts, people, leadership and recipients instead of repeated nested `find`/`filter` scans. The 1.1.3 follow-up replaces the generic skeleton with screen-specific placeholders sharing the loaded row/card styles; see `web-app-release.md` for measurements and limitations.

The current screen still uses its existing scroll container for card presentation. Page-sized fetching reduces payload and hydration work, but native virtualization of visitation cards remains a follow-up item and must be implemented with a section/list container without nesting virtualized and scrolling containers.

The visitation regression suite verifies bounded pages, continuation, stable scheduled ordering, and no duplicate IDs. Full verification and all platform exports passed after this slice.

## Cleanup Audit

The reachability audit removed two unreferenced source files, four unused direct Expo dependencies, ignored avatar color props, five unused helper/export surfaces, and one tautological avatar-tone assertion. `@expo/ngrok` remains because the `start:phone` tunnel workflow depends on it. Generated database contract types, Expo config metadata, Edge Function `npm:` imports, and dynamically selected in-memory adapters remain intentional. No tests were deleted solely because they are source-contract tests; retained tests protect behavior, permissions, accessibility, routing, or deployment configuration.

Measured September 22, 2026 on Windows with Node 24.21.0, pinned pnpm 12.4.1, Expo 57.0.23, React 19.2.3, and React Native 0.86.3. React Compiler is enabled.

Repository measurements use synthetic fixtures and the actual transpiled repository with an instrumented Supabase substitute. SQL checks use the existing PGlite database harness. No member data or tokens are included in reports, and no fixture records were written to hosted Supabase.

Request counts are not network latency, database execution time, or native-device performance measurements. Native startup, frame time, render profiles, and memory baselines remain pending release-mode physical-device access. Lighthouse measures the web app, not native performance.

## Slice 1: Group Detail Queries

Previously, `SupabaseGroupsRepository.getGroup()` loaded all group metadata, fetched its members, called `member_profile_details` once per member, and separately fetched leadership rows. It consumed only orphan/widow flags from the private profile responses.

It now keeps the database-ordered active membership query and reads `id,leadership_ministry,is_orphan,is_widow` from the existing `directory_active_members` RPC in batches of at most 100 IDs. Summaries are associated by ID rather than response order. The membership lookup uses the group ID instead of embedding every member ID in its URL. `listGroups()` already restricts results to membership groups.

The 100-ID bound limits PostgREST filter URL length and avoids a single very large request. This removes the per-member RPC pattern, not all query growth: nonempty groups use six fixed data reads plus one summary request per 100 members. No RPC contract or permissions have changed.

| Group members | Before: data requests | After: data requests |
| --- | ---: | ---: |
| 0 | 5 | 5 |
| 1 | 8 | 7 |
| 50 | 57 | 7 |
| 999 | 1,006 | 16 |

Baseline and post-change counts above were executed against the same harness. Boundary checks also cover 100, 101, 500, and 1,000 members. The supported product size remains below 1,000; these tests do not establish support beyond Supabase's configured row limit.

Photo signing is excluded from those data-request counts. The nonempty fixture has one photographed deacon and uses two signing batches before and after: one for group-list deacons and one for detail members. No photo-cache improvement is claimed. Empty fixtures need no signing requests.

Behavioral checks cover database order, excluded archived/unrelated members, flags, leadership, responsible deacons, photo mapping, missing groups, denied authorization, and summary-read errors. PostgreSQL checks exercise the real directory projection for active/pending/denied/revoked members, editors, and admins; missing identity and anonymous execution privileges; archived members; missing private rows; and exclusion of raw private columns.

### Reproduce

Run from the repository root:

```powershell
node --experimental-loader ./mobile/src/features/visitation/test-loader.mjs --test ./mobile/tests/groups-display.test.mjs
node --test mobile/supabase/tests/leadership-ministries.test.mjs
pnpm --dir mobile verify
pnpm --dir mobile build:web
pnpm --dir mobile exec expo export --platform ios --output-dir .expo/perf-ios
pnpm --dir mobile exec expo export --platform android --output-dir .expo/perf-android
```

The focused group suite prints dataset size, data requests, and photo-signing batches. CI already runs both changed test files through `pnpm verify`; no new runner or test script is needed.

## Export Baseline

Production exports succeeded before and after the query change on web. Native exports were recorded after the change only and are starting points for later native bundle work, not evidence of a native size reduction.

| Artifact | Before bytes | After bytes | After local gzip bytes | After local Brotli bytes |
| --- | ---: | ---: | ---: | ---: |
| Web entry JS | 2,202,291 | 2,202,002 | 578,084 | 442,089 |
| Web global CSS | 7,321 | 7,321 | 2,141 | 1,809 |
| Web native-tabs CSS | 2,540 | 2,540 | 811 | 638 |
| iOS Hermes bytecode | Not measured | 4,087,159 | 1,760,857 | 1,405,887 |
| Android Hermes bytecode | Not measured | 4,175,849 | 1,828,365 | 1,463,320 |

The web baseline gzip/Brotli estimates were 578,134/442,201 bytes for entry JS. Compression estimates use Node's `gzipSync` and `brotliCompressSync` defaults on exported files; they do not establish actual HTTP Content-Encoding, CDN cache behavior, download totals, or installed application size. Public build configuration can affect bundle hashes and byte counts.

Recompute the web artifact sizes after `build:web`:

```powershell
node -e "const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');for(const dir of ['mobile/dist/_expo/static/js/web','mobile/dist/_expo/static/css'])for(const name of fs.readdirSync(dir)){const data=fs.readFileSync(path.join(dir,name));console.log(JSON.stringify({file:name,bytes:data.length,gzipBytes:zlib.gzipSync(data).length,brotliBytes:zlib.brotliCompressSync(data).length}));}"
```

Exports also include four demo portrait PNGs of roughly 1.8-2 MB each. Trace their production reachability in the startup/cleanup slice before changing or removing demo behavior; asset inclusion alone does not establish initial network download cost.

## Verification Status

- Passed `pnpm verify`: typecheck, 127 main tests, visitation suite, and group suite including request-budget regressions.
- Passed `pnpm build:web`, iOS export, and Android export. Exports do not prove signed release builds or physical-device behavior.
- No new editor diagnostics in changed code/tests.
- Not performed: live authenticated Supabase/Storage checks, Vercel Preview, browser interaction checks, physical-device profiling, live OAuth, or Lighthouse.
- The repository's existing experimental-loader/module-type warnings remain; they are not failures and were not changed as part of this slice.

## Remaining Feature Slices

1. **Data access:** reduce visitation snapshot/row overfetching and repeated array joins, use count-only management badge reads, and inspect real authorized query plans before proposing indexes. Existing primary keys already index several candidate columns; do not duplicate them or index ordinary views. Any necessary SQL is additive and manually reviewed.
2. **Cache follow-up:** connect the repository cache's internal clear/invalidation path to successful member/group/account/visit/photo mutations, foreground authorization revalidation, and signed-photo expiry margins. The current directory cache is intentionally conservative and does not persist private data.
3. **Native lists and loading:** 50-record server pages for growing visit history, stable cursor ordering, native virtualization, cached normalized/sorted data, and accessible cold-load skeletons. Preserve existing content during a same-authorized-session refresh and never across identity changes. Directory search debounce/indexing is now implemented for the small complete directory dataset.
4. **Startup and cleanup:** measure deferred mounting/module initialization and optional media work; inspect existing production minification and platform shaking; consider web-only splitting. Production native async-route splitting is unsupported here. Audit dependency/config/plugin/script/test reachability before removals; PGlite and ngrok are used. Replace brittle source assertions with behavioral checks, and delete only proven dead/duplicate/tautological tests without losing unique coverage.
5. **Transport and web audit:** verify actual gzip/Brotli and cache headers on existing providers, retain private no-store and immutable hashed assets, defer only genuinely blocking optional scripts, and run repeated mobile/desktop Lighthouse audits on production-mode public and authenticated pages. A local public audit on September 23, 2026 scored performance `0.46`, accessibility `0.88`, best practices `1.00`, SEO `0.54`, LCP `15.1 s`, TBT `760 ms`, and CLS `0`; this is the baseline to improve, not an acceptance result. Private server-side response caching requiring new infrastructure is intentionally excluded.
6. **Release:** require CI/review/Preview per feature PR; one separate `dev -> main` release with backend compatibility and rollback evidence. Version changes also travel through a feature PR. Main deploys web only; native distribution uses the existing separate process.

Each remaining slice must add its own before/after evidence, focused checks, and unresolved gates here. Proposed native acceptance targets include responsive typing (p95 feedback <=100 ms on the chosen device), no sustained scroll jank, no unbounded retained-memory growth, and no duplicate warm-navigation dataset requests within a valid cache TTL. These are targets awaiting device baselines, not achieved results.

Before release, confirm the existing summary RPC's hosted contract and actual signed-photo behavior with an authorized disposable account. Follow [the release procedure](web-app-release.md) and [the migration-history gate](../mobile/supabase/CONNECT_EXISTING_PROJECT.md); do not automatically push migrations. Retain current and rollback native/client compatibility.