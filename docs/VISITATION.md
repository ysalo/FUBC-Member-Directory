# Visitation

Active accounts designated as pastors can select **Request visit** from the Visitation page or directory/group member profiles. Creation from Visitation starts with date/time, then a person selector, then that person's preselected group deacons and editable location/notes. Changing the person resets the address and recipients while retaining the date/time. Date/time is required and uses fixed PDT (UTC−07:00) year-round, independently of browser timezone and `CHURCH_TIMEZONE`. The UI shows dates/times without timezone labels. Existing scheduled timestamps remain unchanged; their display follows fixed PDT, including winter dates. Directory birthday calculations still use the configured church timezone.

The form defaults the visit location to the member address. Only the actual meeting location appears on visitation screens; the member address snapshot is retained in storage. Pastors select one or two active deacons; the member's group deacons are preselected when available. Recipients can belong to other groups or have no group assignment. Missing group assignments do not prevent manual selection.

Pastors and deacons have a Visitation tab. Pastors see their own requests; selected deacons see invitations. Pastor and deacon designations are mutually exclusive in account management and PostgreSQL. Legacy dual accounts retain pastor; removing deacon also clears their deacon group assignment through the existing audited trigger. Acceptance and decline are independent, reversible responses while the request is open. One acceptance confirms a companion. The requesting pastor can complete an open visit at any time, with any recipient response. A database-only job completes remaining open visits six hours after scheduled time, checked every minute. Cancelled and already-completed visits are preserved. Automatic completion is audited and clients cannot invoke the worker. Cancelled/completed requests are read-only.

The Visitation tab has a red numeric badge for open requests awaiting a response: a deacon's own pending invitations and a pastor's requests with any pending deacon response. The badge hides at zero (and when unavailable), caps the visual label at 99+, and refreshes on navigation, successful visit mutations, window focus, and every 60 seconds while visible. It uses protected count-only queries, not notification delivery or cached private request data.

Details use grouped meeting rows and deacon response pills. Accept/Decline share a response row with an optional decline-reason disclosure. Pastor Edit/Complete controls form a separate management section, with Cancel separated below and a compact refresh icon. Only the current response has a filled background and selection ring; other responses are neutral. The meeting location opens Google Maps search in a new tab.

Pastors may edit time, location, and notes. Edits preserve recipient responses and increment the revision. Unseen revisions show an Updated details indicator. Viewing details records the deacon's seen revision. Member and recipients stay fixed; use cancellation and a new request to change them.

## Storage and security

`visit_requests` stores request details and name/address snapshots. `visit_recipients` stores selected accounts, responses, optional decline reasons, and last-viewed revisions. Group reassignment does not reroute existing invitations. Only the requesting active pastor and selected active designated deacons can read requests or notes; editor/admin access alone is insufficient. Removing a required ministry designation or revoking access blocks that account immediately.

All mutations use signed-in Supabase RPCs with database authorization, transaction locking shared with group/ministry management, and atomic audit events. Sensitive notes/reasons are excluded from audit metadata. A per-pastor submission UUID prevents duplicate requests on retry. Detail revisions reject stale edits and responses; terminal requests reject mutations.

`visit_notification_events` queues one pending event per recipient/revision when requests are created or updated. No client read/write access or delivery worker exists. A future server-side worker should recheck account status/designation, claim events, deduplicate delivery by event ID, and retrieve content through authorized access. No push permissions, subscriptions, device tokens, phone delivery, or claim of successful delivery is included.

## Rollout

Apply `web/supabase/migrations/20260915060000_visitation.sql` after the existing ministry/group migrations, before deploying the UI. It is additive and does not modify users, ministry designations, or existing member records. The clean baseline includes visitation for fresh local databases; **never apply the destructive baseline to a live project**.

The additive visitation migration was applied successfully to the live Supabase project on September 15, 2026 with explicit user authorization. Verification confirmed all 34 existing members were preserved, all three visitation tables have RLS enabled, the save RPC exists, and authenticated clients cannot read the notification queue. Deploy the UI by pushing main to the connected GitHub/Vercel project. Approve/designate pastor accounts through account management; no hardcoded account emails are needed.

## Verification

- `node scripts/test-visitation.mjs`: fresh baseline, additive upgrade, RLS, mutation permissions, response changes, revisions, revocation, notification/audit rollback, cancellation, and duplicate creation.
- `node --test tests/unit/*.test.mjs`: fixed PDT conversion across summer/winter/year boundaries, pending count role/duplicate/error scenarios, and existing birthday calculations.
- `node scripts/test-visitation-ui.mjs`: isolated fictional fixtures rendering real form/control components, recipient defaults/overrides, failure/recovery, editing, response changes, Ukrainian, light/dark, large text, and 320/375/460px widths. Uses the latest build's generated CSS and writes screenshots only into ignored `work/visitation-ui`.
- Run TypeScript, lint, production build, and existing group regression checks.

Browser fixture tests stub the transport/navigation. Real cross-account Supabase integration, concurrent database sessions, notification delivery, and physical-phone keyboard/Safari checks still require rollout validation.

The lifecycle update is in `20260915181500_visitation_lifecycle.sql` and was applied to the live project on September 15, 2026. It installs one named `pg_cron` job (`visitation-auto-complete`). See [Supabase Cron](https://supabase.com/docs/guides/cron) for scheduler monitoring. Local embedded PostgreSQL tests exercise the same worker and six-hour cutoff, omitting only the hosted extension/job registration.
