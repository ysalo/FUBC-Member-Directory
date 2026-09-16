import { pathToFileURL } from 'node:url';
import { payloadFor, providerToken, sendAPNs } from './apns.mjs';

export function configuration(environment = process.env) {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APNS_TEAM_ID', 'APNS_KEY_ID', 'APNS_PRIVATE_KEY', 'APNS_TOPIC'];
  const missing = required.filter(key => !environment[key]?.trim());
  if (missing.length) throw new Error(`Missing worker configuration: ${missing.join(', ')}`);
  const url = new URL(environment.SUPABASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SUPABASE_URL must be a plain HTTPS project origin.');
  }
  return { url: url.origin, serviceKey: environment.SUPABASE_SERVICE_ROLE_KEY,
    topic: environment.APNS_TOPIC, teamID: environment.APNS_TEAM_ID,
    keyID: environment.APNS_KEY_ID, privateKey: environment.APNS_PRIVATE_KEY };
}

export function database(config, fetcher = fetch) {
  return async (name, params = {}) => {
    const response = await fetcher(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: config.serviceKey, authorization: `Bearer ${config.serviceKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(params), signal: AbortSignal.timeout(20000),
    });
    // Do not print body/headers: backend errors may contain private values.
    if (!response.ok) throw new Error(`Notification database operation failed (${response.status}).`);
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  };
}

export async function deliverBatch({ rpc, send, topic, authorization, batchSize = 10 }) {
  await rpc('queue_due_notifications');
  const jobs = await rpc('claim_notification_jobs', { batch_size: batchSize });
  const results = { claimed: jobs.length, dispatched: 0, retry: 0, discarded: 0, invalid_token: 0 };
  for (const job of jobs) {
    let outcome = 'retry';
    let failure = null;
    const lease = { target: job.job_id, lease: job.lease_token };
    // An authorization-check failure must not be interpreted as permission to send.
    if (!await rpc('revalidate_notification_job', lease)) {
      outcome = 'discarded';
    } else {
      try {
        const result = await send({ token: job.device_token, environment: job.apns_environment,
          topic, authorization, jobID: job.job_id, payload: payloadFor(job) });
        outcome = result.accepted ? 'dispatched' : result.invalidToken ? 'invalid_token' : 'retry';
        // Configuration failures are retried with bounded backoff and remain observable.
        failure = result.accepted ? null : `APNs_${result.status}_${String(result.reason ?? 'Unknown').replace(/[^A-Za-z0-9_]/g, '').slice(0, 80)}`;
      } catch {
        outcome = 'retry';
        failure = 'APNs_transport_or_payload_failure';
      }
    }
    // If finalization fails after a send, the lease expires and may retry. Never claim exactly-once delivery.
    await rpc('finish_notification_job', { ...lease, outcome, failure_reason: failure });
    results[outcome] += 1;
  }
  return results;
}

async function main() {
  const config = configuration();
  const authorization = providerToken(config);
  const results = await deliverBatch({ rpc: database(config), send: sendAPNs, topic: config.topic, authorization });
  console.log(JSON.stringify(results)); // Counts only, never tokens, member data or private payloads.
  if (results.retry) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Notification worker failed. Check configuration, database permissions and delivery metrics.'); process.exitCode = 1; });
}
