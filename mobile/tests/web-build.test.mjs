import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('production build fails closed without backend settings', () => {
  const env = { ...process.env, EXPO_NO_DOTENV: '1' };
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  delete env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const result = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: new URL('../', import.meta.url), env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Web production requires/);
});

test('production build rejects a Supabase secret key', () => {
  const result = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test-only' }, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /secret key must never/);
});

test('home-screen manifest references correctly sized PNG assets', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(`../public${icon.src}`, import.meta.url));
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
});

test('Vercel does not cache the installed app shell across deployments', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const routeHeaders = config.headers.find((entry) => entry.source === '/(.*)').headers;
  const cacheControl = routeHeaders.find((header) => header.key === 'Cache-Control');
  const staticHeaders = config.headers.find((entry) => entry.source === '/_expo/static/(.*)').headers;
  const staticCacheControl = staticHeaders.find((header) => header.key === 'Cache-Control');

  assert.equal(cacheControl.value, 'private, no-store, max-age=0, must-revalidate');
  assert.match(staticCacheControl.value, /immutable/);
});

test('the active Vercel project uses Git integration for dev and main', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git?.deploymentEnabled?.main ?? true, true);
  assert.equal(config.git?.deploymentEnabled?.dev ?? true, true);
});

test('the legacy web project remains disabled', async () => {
  const config = JSON.parse(await readFile(new URL('../../web/vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, false);
});
