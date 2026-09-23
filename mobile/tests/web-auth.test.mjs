import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeReturnPath, createCallbackCompleter, recoverRootOAuthCallback } from '../src/features/session/web-oauth.ts';
import { createSessionRevalidator, isTransientSessionError } from '../src/lib/session-revalidation.ts';

function sessionHarness() {
  const pending = [];
  const published = [];
  let state = 'loading';
  const publish = (status, value) => { state = status; published.push({ status, value }); };
  const resolver = createSessionRevalidator({
    isReady: () => state === 'ready',
    load: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    loading: () => publish('loading'), signedOut: () => publish('signed-out'),
    ready: (account) => publish('ready', account), error: (cause) => publish('error', cause.message),
  });
  return { resolver, pending, published };
}

test('same auth user refresh preserves ready content until new access is confirmed', async () => {
  const { resolver, pending, published } = sessionHarness();
  const initial = resolver.resolve('auth-user');
  pending.shift().resolve({ id: 'different-account-id', status: 'active' });
  await initial;
  published.length = 0;
  const refresh = resolver.resolve('auth-user');
  assert.deepEqual(published, []);
  pending.shift().resolve({ id: 'different-account-id', status: 'revoked' });
  await refresh;
  assert.deepEqual(published, [{ status: 'ready', value: { id: 'different-account-id', status: 'revoked' } }]);
});

test('identity changes clear content immediately and stale requests cannot restore it', async () => {
  const { resolver, pending, published } = sessionHarness();
  const initial = resolver.resolve('old-auth');
  pending.shift().resolve({ id: 'old' });
  await initial;
  const oldRequest = resolver.resolve('old-auth');
  const newRequest = resolver.resolve('new-auth');
  assert.equal(published.at(-1).status, 'loading');
  const old = pending.shift();
  pending.shift().resolve({ id: 'new' });
  await newRequest;
  old.resolve({ id: 'old' });
  await oldRequest;
  assert.deepEqual(published.at(-1), { status: 'ready', value: { id: 'new' } });
  const refreshing = resolver.resolve('new-auth');
  await resolver.resolve(null);
  assert.equal(published.at(-1).status, 'signed-out');
  pending.shift().resolve({ id: 'new' });
  await refreshing;
  assert.equal(published.at(-1).status, 'signed-out');
});

test('same-user revalidation failures fail closed and invalidation suppresses stale errors', async () => {
  const { resolver, pending, published } = sessionHarness();
  const initial = resolver.resolve('auth');
  pending.shift().resolve({ id: 'account' });
  await initial;
  const failed = resolver.resolve('auth');
  pending.shift().reject(new Error('Access unavailable'));
  await failed;
  assert.deepEqual(published.at(-1), { status: 'error', value: 'Access unavailable' });
  const stale = resolver.resolve('auth');
  const count = published.length;
  resolver.invalidate();
  pending.shift().reject(new Error('Stale failure'));
  await stale;
  assert.equal(published.length, count);
});

test('temporary idle connection failures retry once without replacing the ready screen', async () => {
  const published = [];
  let attempts = 0;
  let fail = false;
  const resolver = createSessionRevalidator({
    isReady: () => published.at(-1) === 'ready',
    loading: () => published.push('loading'), signedOut: () => published.push('signed-out'),
    ready: () => published.push('ready'), error: () => published.push('error'),
    load: async () => { attempts++; if (fail && attempts % 2 === 0) throw { message: 'Failed to fetch' }; return {}; },
  });
  await resolver.resolve('user');
  fail = true;
  await resolver.resolve('user');
  assert.equal(attempts, 3);
  assert.deepEqual(published, ['loading', 'ready', 'ready']);
});

test('session retries are bounded and cannot restore access after sign-out', async () => {
  for (const signOut of [false, true]) {
    const published = [];
    let attempts = 0;
    const resolver = createSessionRevalidator({
      isReady: () => false, loading: () => published.push('loading'),
      signedOut: () => published.push('signed-out'), ready: () => published.push('ready'), error: () => published.push('error'),
      load: async () => { attempts++; throw { status: 503, message: 'Unavailable' }; },
    });
    const pending = resolver.resolve('user');
    await Promise.resolve();
    if (signOut) await resolver.resolve(null);
    await pending;
    assert.equal(attempts, signOut ? 1 : 2);
    assert.equal(published.at(-1), signOut ? 'signed-out' : 'error');
  }
  assert.equal(isTransientSessionError({ code: '42501', message: 'Permission denied' }), false);
  assert.equal(isTransientSessionError({ status: 401, message: 'Expired JWT' }), false);
  assert.equal(isTransientSessionError(new Error('The church connection needs an update')), false);
  assert.equal(isTransientSessionError({ code: '', message: 'TypeError: Load failed' }), true);
});

test('native callback leaves the callback route without another token exchange', async () => {
  const route = await readFile(new URL('../src/app/auth/callback.tsx', import.meta.url), 'utf8');
  assert.match(route, /if \(Platform\.OS !== "web"\) \{ router\.replace\("\/"\); return; \}/);
});

test('Google OAuth always asks which account to use after sign-out', async () => {
  const session = await readFile(new URL('../src/lib/session.ts', import.meta.url), 'utf8');
  assert.match(session, /provider === "google"\s*\? \{ prompt: "select_account" \}\s*: undefined/);
});

test('OAuth preserves deep links but rejects external and callback destinations', () => {
  const origin = 'https://directory.example.org';
  assert.equal(safeReturnPath('/members/123?view=family#phone', origin), '/members/123?view=family#phone');
  for (const unsafe of [null, 'https://evil.example/', '//evil.example/', '/\\evil.example/', '/ /evil', '/auth/callback?code=secret', '/auth/callback/', '/groups/../auth/callback', 'javascript:alert(1)']) {
    assert.equal(safeReturnPath(unsafe, origin), '/', String(unsafe));
  }
});

test('OAuth responses sent to the Site URL recover through the callback route', () => {
  assert.equal(recoverRootOAuthCallback('https://directory.example.org/?code=one&state=two'), '/auth/callback?code=one&state=two');
  assert.equal(recoverRootOAuthCallback('https://directory.example.org/?error=access_denied&error_description=Canceled'), '/auth/callback?error=access_denied&error_description=Canceled');
  assert.equal(recoverRootOAuthCallback('https://directory.example.org/?view=family'), null);
  assert.equal(recoverRootOAuthCallback('https://directory.example.org/members?code=one'), null);
});

test('React remounts share one PKCE exchange and successful completion', async () => {
  const codes = [];
  const complete = createCallbackCompleter(async (code) => { codes.push(code); });
  const first = complete('https://directory.example.org/auth/callback?code=one');
  const remount = complete('https://directory.example.org/auth/callback?code=one');
  assert.equal(first, remount);
  await Promise.all([first, remount]);
  await complete('https://directory.example.org/auth/callback?code=one');
  assert.deepEqual(codes, ['one']);
  await complete('https://directory.example.org/auth/callback?code=two');
  assert.deepEqual(codes, ['one', 'two']);
});

test('denied, canceled, and expired sign-in do not exchange a code', async () => {
  let calls = 0;
  const complete = createCallbackCompleter(async () => { calls++; });
  await assert.rejects(complete('https://directory.example.org/auth/callback?error=access_denied&error_description=User%20canceled'), /User canceled/);
  await assert.rejects(complete('https://directory.example.org/auth/callback'), /expired/);
  assert.equal(calls, 0);
});

test('failed one-use codes remain failed on remount; a new sign-in can succeed', async () => {
  let calls = 0;
  const complete = createCallbackCompleter(async (code) => { calls++; if (code === 'expired') throw new Error('Code expired'); });
  await assert.rejects(complete('https://directory.example.org/auth/callback?code=expired'), /Code expired/);
  await assert.rejects(complete('https://directory.example.org/auth/callback?code=expired'), /Code expired/);
  assert.equal(calls, 1);
  await complete('https://directory.example.org/auth/callback?code=fresh');
  assert.equal(calls, 2);
});
