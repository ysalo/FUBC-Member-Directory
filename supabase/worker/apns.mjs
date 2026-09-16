import { createPrivateKey, sign } from 'node:crypto';
import { connect } from 'node:http2';

export function providerToken({ teamID, keyID, privateKey }, now = Date.now()) {
  if (!teamID || !keyID || !privateKey) throw new Error('APNs signing configuration is incomplete.');
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'ES256', kid: keyID })}.${encode({ iss: teamID, iat: Math.floor(now / 1000) })}`;
  const key = createPrivateKey(privateKey.replace(/\\n/g, '\n'));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('APNs requires a P-256 signing key.');
  }
  return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

export function payloadFor(job) {
  const english = {
    visit: ['Visit update', 'Open the app to review your visit.'],
    birthday: ['Birthday reminder', 'Open the app to see upcoming birthdays.'],
    reminder: ['Personal reminder', 'Open the app to review your reminder.'],
  };
  const ukrainian = {
    visit: ['Оновлення відвідування', 'Відкрийте застосунок, щоб переглянути відвідування.'],
    birthday: ['Нагадування про день народження', 'Відкрийте застосунок, щоб переглянути дні народження.'],
    reminder: ['Особисте нагадування', 'Відкрийте застосунок, щоб переглянути нагадування.'],
  };
  const messages = job.payload?.language === 'uk' ? ukrainian : english;
  const category = job.kind.startsWith('visit') ? 'visit' : job.kind === 'birthday' ? 'birthday' : job.kind === 'personal_reminder' ? 'reminder' : null;
  if (!category) throw new Error('Unsupported notification kind.');
  const [title, body] = messages[category];
  // Never serialize job.payload: it may contain private member data.
  return { aps: { alert: { title, body }, sound: 'default' }, kind: category,
    ...(category === 'visit' ? { visit_id: job.entity_id } : {}),
    ...(category === 'reminder' ? { reminder_id: job.entity_id } : {}),
    ...(category === 'birthday' ? { member_id: job.entity_id } : {}) };
}

export function sendAPNs({ token, environment, topic, authorization, payload, expiration = 0, jobID }, { timeout = 15000, connectHTTP2 = connect } = {}) {
  if (!['sandbox', 'production'].includes(environment)) return Promise.reject(new Error('Unknown APNs environment.'));
  if (!/^[a-f0-9]{64,200}$/i.test(token)) return Promise.reject(new Error('Invalid APNs device token.'));
  if (!topic || !authorization) return Promise.reject(new Error('Missing APNs topic or authorization.'));
  const origin = environment === 'sandbox' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com';
  return new Promise((resolve, reject) => {
    let settled = false;
    const client = connectHTTP2(origin);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.close();
      client.destroy();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('APNs request timed out.')), timeout);
    client.on('error', () => finish(new Error('APNs connection failed.')));
    const request = client.request({ ':method': 'POST', ':path': `/3/device/${token}`,
      authorization: `bearer ${authorization}`, 'apns-topic': topic, 'apns-push-type': 'alert',
      'apns-priority': '10', 'apns-expiration': String(expiration), 'content-type': 'application/json',
      ...(jobID ? { 'apns-id': jobID, 'apns-collapse-id': jobID } : {}) });
    let status = 0;
    let body = '';
    request.on('response', headers => { status = Number(headers[':status']); });
    request.setEncoding('utf8');
    request.on('data', chunk => { if (body.length < 8192) body += chunk; });
    request.on('error', () => finish(new Error('APNs request failed.')));
    request.on('end', () => {
      let reason;
      try { reason = JSON.parse(body).reason; } catch { /* An empty body is expected on success. */ }
      finish(null, { accepted: status === 200, status, reason,
        invalidToken: status === 410 || (status === 400 && reason === 'BadDeviceToken'),
        retryable: status === 429 || status >= 500 });
    });
    request.end(JSON.stringify(payload));
  });
}
