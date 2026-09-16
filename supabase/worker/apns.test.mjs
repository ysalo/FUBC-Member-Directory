import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { payloadFor, providerToken, sendAPNs } from './apns.mjs';

test('APNs provider token is a verifiable P-256 JWT with correct issuer/time', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const token = providerToken({ teamID: 'TESTTEAM', keyID: 'TESTKEY', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) }, 1720000000000);
  const [header, claims, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'ES256', kid: 'TESTKEY' });
  assert.deepEqual(JSON.parse(Buffer.from(claims, 'base64url')), { iss: 'TESTTEAM', iat: 1720000000 });
  assert.equal(verify('sha256', Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
});

test('lock-screen payload cannot leak a job title, notes, name, address or birthday', () => {
  const payload = payloadFor({ kind: 'visit_updated', entity_id: 'visit-id', payload: { title: 'SECRET', notes: 'SECRET', member_name: 'SECRET', address: 'SECRET', birthday: 'SECRET' } });
  assert.equal(JSON.stringify(payload).includes('SECRET'), false);
  assert.equal(payload.visit_id, 'visit-id');
  assert.equal(payload.aps.alert.title, 'Visit update');
  assert.throws(() => payloadFor({ kind: 'unknown' }));
});

test('database reminder and birthday kinds route correctly and respect Ukrainian preference', () => {
  const reminder = payloadFor({ kind: 'personal_reminder', entity_id: 'reminder-id', payload: { language: 'uk' } });
  assert.equal(reminder.kind, 'reminder');
  assert.equal(reminder.reminder_id, 'reminder-id');
  assert.equal(reminder.aps.alert.title, 'Особисте нагадування');
  const birthday = payloadFor({ kind: 'birthday', entity_id: 'member-id' });
  assert.equal(birthday.member_id, 'member-id');
  assert.equal(birthday.kind, 'birthday');
});

function mockConnection(status, reason, capture) {
  return origin => {
    capture.origin = origin;
    const client = new EventEmitter();
    client.close = () => { capture.closed = true; };
    client.destroy = () => {};
    client.request = headers => {
      capture.headers = headers;
      const request = new EventEmitter();
      request.setEncoding = () => {};
      request.end = body => {
        capture.body = JSON.parse(body);
        queueMicrotask(() => {
          request.emit('response', { ':status': status });
          if (reason) request.emit('data', JSON.stringify({ reason }));
          request.emit('end');
        });
      };
      return request;
    };
    return client;
  };
}

const args = { token: 'a'.repeat(64), environment: 'sandbox', topic: 'org.example.test', authorization: 'signed-token', payload: { aps: {} } };
test('HTTP2 request uses selected APNs environment and correct signing headers', async () => {
  const capture = {};
  const result = await sendAPNs(args, { connectHTTP2: mockConnection(200, null, capture) });
  assert.equal(result.accepted, true);
  assert.equal(capture.origin, 'https://api.sandbox.push.apple.com');
  assert.equal(capture.headers['apns-topic'], args.topic);
  assert.equal(capture.headers['apns-push-type'], 'alert');
  assert.equal(capture.headers.authorization, 'bearer signed-token');
  assert.equal(capture.closed, true);
});

test('invalid tokens are terminal, throttling is retryable, topic errors do not erase tokens', async () => {
  for (const [status, reason, invalidToken, retryable] of [[410, 'Unregistered', true, false], [429, 'TooManyRequests', false, true], [400, 'DeviceTokenNotForTopic', false, false]]) {
    const result = await sendAPNs(args, { connectHTTP2: mockConnection(status, reason, {}) });
    assert.equal(result.accepted, false);
    assert.equal(result.invalidToken, invalidToken);
    assert.equal(result.retryable, retryable);
  }
  await assert.rejects(sendAPNs({ ...args, environment: 'development' }), /environment/);
});
