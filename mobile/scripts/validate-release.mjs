import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const packageVersion = require('../package.json').version;

export const RELEASE_ATTESTATION = '- [x] Backend readiness verified (or no backend changes)';

export function parseStableVersion(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value ?? '');
  if (!match) throw new Error(`Expected a stable SemVer version, received "${value}".`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), value: `${match[1]}.${match[2]}.${match[3]}` };
}

export function compareVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function validateRelease({ release, packageVersion: expectedVersion = packageVersion, tagCommit, mainCommits = [] }) {
  if (!release || release.draft || release.prerelease) throw new Error('Only a published stable release may deploy.');
  if (!release.published_at) throw new Error('The release must be published.');
  const version = parseStableVersion(release.tag_name);
  const expected = parseStableVersion(expectedVersion);
  if (version.value !== expected.value) throw new Error(`Release ${version.value} does not match package version ${expected.value}.`);
  if (!release.body?.includes(RELEASE_ATTESTATION)) throw new Error(`Release notes must include: ${RELEASE_ATTESTATION}`);
  if (!tagCommit) {
    throw new Error('The release tag could not be resolved to its immutable commit.');
  }
  if (mainCommits.length > 0 && !mainCommits.includes(tagCommit)) {
    throw new Error('The release commit is not reachable from main.');
  }
  return { version: version.value, tag: `v${version.value}`, commit: tagCommit };
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required in CI.');
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const release = event.release;
  const tagCommit = process.env.RELEASE_TAG_COMMIT;
  const mainCommits = process.env.MAIN_COMMITS ? JSON.parse(process.env.MAIN_COMMITS) : [];
  const result = validateRelease({ release, tagCommit, mainCommits });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();