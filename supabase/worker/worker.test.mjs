import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverBatch, configuration, database } from './worker.mjs';

const job = { job_id: 'job', lease_token: 'lease', kind: 'visit_created', entity_id: 'visit', device_token: 'a'.repeat(64), apns_environment: 'sandbox' };
function scenario(authorized, sendResult) {
  const events = [];
  const rpc = async (name, params) => {
    events.push([name, params]);
    if (name === 'claim_notification_jobs') return [job];
    if (name === 'revalidate_notification_job') return authorized;
    return null;
  };
  const send = async options => { events.push(['send', options]); return sendResult; };
  return { events, rpc, send, topic: 'org.example.test', authorization: 'jwt' };
}

test('revoked/stale notification is discarded without contacting APNs', async () => {
  const setup = scenario(false);
  const result = await deliverBatch(setup);
  assert.equal(result.discarded, 1);
  assert.equal(setup.events.some(([name]) => name === 'send'), false);
  assert.equal(setup.events.at(-1)[1].outcome, 'discarded');
});

test('delivery reauthorizes immediately before send and records APNs acceptance only', async () => {
  const setup = scenario(true, { accepted: true, status: 200 });
  const result = await deliverBatch(setup);
  assert.deepEqual(setup.events.map(([name]) => name), ['queue_due_notifications', 'claim_notification_jobs', 'revalidate_notification_job', 'send', 'finish_notification_job']);
  assert.equal(result.dispatched, 1);
  assert.equal(setup.events.at(-1)[1].lease, 'lease');
});

test('network failures retry; invalid token requests invalidation; neither counts as delivery', async () => {
  const setup = scenario(true, { accepted: false, status: 410, reason: 'Unregistered', invalidToken: true });
  assert.equal((await deliverBatch(setup)).invalid_token, 1);
  const retry = scenario(true);
  retry.send = async () => { throw new Error('private data that must not be logged'); };
  const result = await deliverBatch(retry);
  assert.equal(result.retry, 1);
  assert.equal(result.dispatched, 0);
  assert.equal(retry.events.at(-1)[1].failure_reason, 'APNs_transport_or_payload_failure');
});

test('database authorization failure prevents sending and does not fabricate completion', async () => {
  const setup = scenario(true);
  const base = setup.rpc;
  setup.rpc = async (name, params) => { if (name === 'revalidate_notification_job') throw new Error('database unavailable'); return base(name, params); };
  await assert.rejects(deliverBatch(setup));
  assert.equal(setup.events.some(([name]) => name === 'send' || name === 'finish_notification_job'), false);
});

test('worker configuration fails closed; database errors hide response secrets', async () => {
  assert.throws(() => configuration({}), /Missing worker configuration/);
  const rpc = database({ url: 'https://example.supabase.co', serviceKey: 'private' }, async () => ({ ok: false, status: 403, text: async () => 'SECRET' }));
  await assert.rejects(rpc('claim_notification_jobs'), error => !error.message.includes('SECRET') && error.message.includes('403'));
});
