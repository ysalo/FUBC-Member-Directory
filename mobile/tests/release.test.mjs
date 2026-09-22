import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, RELEASE_ATTESTATION, validateRelease } from '../scripts/validate-release.mjs';

function release(overrides = {}) {
  return {
    tag_name: 'v1.0.14',
    target_commitish: '70aebfe',
    draft: false,
    prerelease: false,
    published_at: '2026-09-22T00:00:00Z',
    body: `Release notes\n${RELEASE_ATTESTATION}`,
    ...overrides,
  };
}

test('accepts a published stable release matching package version and main', () => {
  assert.deepEqual(validateRelease({ release: release(), packageVersion: '1.0.14', tagCommit: '70aebfe', mainCommits: ['70aebfe'] }), {
    version: '1.0.14',
    tag: 'v1.0.14',
    commit: '70aebfe',
  });
});

test('rejects drafts, prereleases, mismatched versions, and missing readiness', () => {
  for (const candidate of [
    release({ draft: true }),
    release({ prerelease: true }),
    release({ tag_name: 'v1.0.15' }),
    release({ body: 'Release notes' }),
  ]) {
    assert.throws(() => validateRelease({ release: candidate, packageVersion: '1.0.14', tagCommit: '70aebfe', mainCommits: ['70aebfe'] }));
  }
});

test('rejects a release commit that is not reachable from main', () => {
  assert.throws(() => validateRelease({ release: release(), packageVersion: '1.0.14', tagCommit: 'other', mainCommits: ['70aebfe'] }), /reachable from main/);
});

test('compares semantic versions numerically', () => {
  assert.equal(compareVersions('1.0.9', '1.0.10'), -1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
});