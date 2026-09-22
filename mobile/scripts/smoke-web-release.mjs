const baseUrl = process.env.RELEASE_URL;
if (!baseUrl) throw new Error('RELEASE_URL is required.');

const checks = [
  { path: '/', expected: 200, includes: '<!DOCTYPE html' },
  { path: '/manifest.webmanifest', expected: 200, includes: '"display"' },
  { path: '/directory', expected: 200, includes: '<!DOCTYPE html' },
];

for (const check of checks) {
  const response = await fetch(new URL(check.path, baseUrl));
  const body = await response.text();
  if (response.status !== check.expected) throw new Error(`${check.path} returned ${response.status}.`);
  if (!body.includes(check.includes)) throw new Error(`${check.path} did not contain the expected response marker.`);
}

const response = await fetch(new URL('/', baseUrl));
if (!response.headers.get('cache-control')?.includes('no-store')) throw new Error('The production app shell must not be cached.');
process.stdout.write(`Smoke checks passed for ${baseUrl}\n`);