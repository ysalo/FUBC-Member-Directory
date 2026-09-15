# Visitation

Active accounts designated as pastors can select **Request visit** from directory or group member profiles. Date/time is required and uses `CHURCH_TIMEZONE` (default `America/Los_Angeles`), independently of the browser timezone. Nonexistent or ambiguous daylight-saving times must be replaced with another time.

The form displays the member address and defaults the separate visit location to it. Pastors select one or two active deacons; the member's group deacons are preselected when available. Recipients can belong to other groups or have no group assignment. Missing group assignments do not prevent manual selection.

Pastors and deacons have a Visitation tab. Pastors see their own requests; selected deacons see invitations. Accounts with both designations see both sections. Acceptance and decline are independent, reversible responses while the request is open. One acceptance confirms a companion. Completion requires an accepted companion and the scheduled time to have arrived. Cancelled/completed requests are read-only.

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
- `node --test tests/unit/*.test.mjs`: timezone/DST conversion and existing birthday calculations.
- `node scripts/test-visitation-ui.mjs`: isolated fictional fixtures rendering real form/control components, recipient defaults/overrides, failure/recovery, editing, response changes, Ukrainian, light/dark, large text, and 320/375/460px widths. Uses the latest build's generated CSS and writes screenshots only into ignored `work/visitation-ui`.
- Run TypeScript, lint, production build, and existing group regression checks.

Browser fixture tests stub the transport/navigation. Real cross-account Supabase integration, concurrent database sessions, notification delivery, and physical-phone keyboard/Safari checks still require rollout validation.
