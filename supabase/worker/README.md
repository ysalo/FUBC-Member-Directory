# APNs delivery worker

This new Node.js 22+ worker uses HTTP/2 and ES256 provider authentication to send private notifications. It has no npm runtime dependencies. Database jobs are leased per installation and reauthorized immediately before every attempt. The app/backend still need configured Apple credentials and an actual running scheduler; checked-in code alone does not enable delivery.

Set secrets in the server's environment (never in the mobile app or Git):

- `SUPABASE_URL`: HTTPS staging or production project origin.
- `SUPABASE_SERVICE_ROLE_KEY`: trusted backend key authorized to execute worker RPCs.
- `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`: Apple provider signing credentials; private key is PEM, actual or escaped newlines accepted.
- `APNS_TOPIC`: bundle identifier of the signed application.

Run once with `node supabase/worker/worker.mjs`. Schedule it every minute on a trusted Node-capable server/job platform with these secrets. A batch claims ten jobs to keep sequential sends within the five-minute lease. Scale by independent workers as needed; SQL leases prevent concurrent claims of the same job. Configure monitoring for nonzero exit codes, retry/failed jobs and lack of recent successful runs. No scheduler or credentials have been deployed by this repository.

The database generates due jobs, selects eligible devices and handles preferences/authorization. Each device's sandbox/production environment selects the APNs host. Payloads contain generic text and identifiers, never names, addresses, private notes or birthday values. Generic alert copy follows the account's English/Ukrainian preference supplied by the claim RPC.

Invalid tokens are invalidated via the finalization RPC. Transient or configuration failures receive bounded database retries; fix signing/topic problems promptly. After successful APNs acceptance, the job is marked dispatched, not read/delivered. A crash after acceptance but before finalization may produce another attempt; APNs identifiers/collapse IDs reduce pending duplication but do not guarantee exactly-once display. Foreground app data is authoritative.

Run new isolated tests with `node --test supabase/worker/*.test.mjs`. These exercise signing, privacy, transport outcomes, authorization-before-send and failure handling without Apple credentials. Real APNs delivery remains a separate device acceptance test.
