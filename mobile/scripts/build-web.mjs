import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.env.NODE_ENV = 'production';
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve('expo/package.json'));
expoRequire('@expo/env').load(root);
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Web production requires EXPO_PUBLIC_SUPABASE_URL and a public Supabase key. Configure them before building.');
if (new URL(url).protocol !== 'https:') throw new Error('Production Supabase must use HTTPS.');
if (key.startsWith('sb_secret_')) throw new Error('A secret key must never be included in a web build.');
if (key.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role === 'service_role') throw new Error('SERVICE_ROLE');
  } catch (error) {
    if (error.message === 'SERVICE_ROLE') throw new Error('A service-role key must never be included in a web build.');
  }
}
const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
const result = spawnSync(process.execPath, [cli, 'export', '-p', 'web'], { cwd: root, env: process.env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
