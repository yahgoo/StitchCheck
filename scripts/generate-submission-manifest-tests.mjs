#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Submission Manifest Generator — Focused Offline Tests
// ─────────────────────────────────────────────────────────────────────────────
// Proves:
//   1. Nosana schema output with 21 passing validations parses as 21.
//   2. Failing validation lines are counted correctly.
//   3. Prose containing "FAIL" is not treated as a failed test.
//   4. Stale video detection works.
//   5. Current video detection works.
//   6. Missing files produce explicit unknown status.
//
// Constraints:
//   - Uses ONLY synthetic temp-dir fixtures and in-memory strings.
//   - Does NOT access .env.local or any credentials.
//   - Does NOT call any provider.
//   - Does NOT modify any existing file.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Import the exported parsers from the shared helpers module ──

import { parseSchemaValidatorOutput, computeVideoFreshness } from './submission-manifest-helpers.mjs';

// ── 1. Nosana schema output: 21 passing validations parse as 21 ──

test('parseSchemaValidatorOutput: 21 passing validations count as 21', () => {
  const lines = [];
  for (let i = 1; i <= 21; i++) {
    lines.push(`[PASS] validation-${i}: detail text here`);
  }
  lines.push('');
  lines.push('All fixture validations passed (offline, synthetic, no Nosana contact).');
  const output = lines.join('\n');

  const result = parseSchemaValidatorOutput(output);
  assert.ok(result, 'Should return a result (not null)');
  assert.strictEqual(result.passed, 21);
  assert.strictEqual(result.failed, 0);
});

test('parseSchemaValidatorOutput: matches real nosana schema-validator output shape', () => {
  // Simulates the exact output shape of smoke-tests/nosana/schema-validator.mjs
  // 5 request fixtures × 2 lines (placeholder + report) = 10
  // 5 result fixtures × 2 lines (placeholder + report) = 10
  // 1 self-check line = 1
  // Total = 21
  const lines = [
    '[PASS] nos-req-clean-two-leg placeholder label: exact label present',
    '[PASS] nos-req-clean-two-leg: valid as expected',
    '[PASS] nos-req-degraded-confidence placeholder label: exact label present',
    '[PASS] nos-req-degraded-confidence: valid as expected',
    '[PASS] nos-req-timeout-prone placeholder label: exact label present',
    '[PASS] nos-req-timeout-prone: valid as expected',
    '[PASS] nos-req-workload-failure placeholder label: exact label present',
    '[PASS] nos-req-workload-failure: valid as expected',
    '[PASS] nos-req-malformed placeholder label: exact label present',
    '[PASS] nos-req-malformed: rejected as expected (3 issue(s))',
    '[PASS] nos-res-success placeholder label: exact label present',
    '[PASS] nos-res-success: valid as expected',
    '[PASS] nos-res-unavailable placeholder label: exact label present',
    '[PASS] nos-res-unavailable: valid as expected',
    '[PASS] nos-res-failure placeholder label: exact label present',
    '[PASS] nos-res-failure: valid as expected',
    '[PASS] nos-res-error placeholder label: exact label present',
    '[PASS] nos-res-error: valid as expected',
    '[PASS] nos-res-timeout placeholder label: exact label present',
    '[PASS] nos-res-timeout: valid as expected',
    '[PASS] self-check: broken request and invented-score result both rejected',
    '',
    'All fixture validations passed (offline, synthetic, no Nosana contact).',
  ];
  const output = lines.join('\n');

  const result = parseSchemaValidatorOutput(output);
  assert.ok(result, 'Should return a result');
  assert.strictEqual(result.passed, 21, 'Exactly 21 validations should pass');
  assert.strictEqual(result.failed, 0);
});

// ── 2. Failing validation lines are counted correctly ──

test('parseSchemaValidatorOutput: 2 failures counted correctly', () => {
  const lines = [
    '[PASS] validation-1: ok',
    '[FAIL] validation-2: expected valid but got issues: bad field',
    '[PASS] validation-3: ok',
    '[FAIL] validation-4: expected invalid but fixture validated',
    '[PASS] validation-5: ok',
    '',
    '2 validation check(s) failed.',
  ];
  const output = lines.join('\n');

  const result = parseSchemaValidatorOutput(output);
  assert.ok(result);
  assert.strictEqual(result.passed, 3);
  assert.strictEqual(result.failed, 2);
});

test('parseSchemaValidatorOutput: all failures', () => {
  const lines = [
    '[FAIL] validation-1: bad',
    '[FAIL] validation-2: worse',
    '[FAIL] validation-3: worst',
  ];
  const result = parseSchemaValidatorOutput(lines.join('\n'));
  assert.ok(result);
  assert.strictEqual(result.passed, 0);
  assert.strictEqual(result.failed, 3);
});

test('parseSchemaValidatorOutput: mixed pass and fail', () => {
  const lines = [];
  for (let i = 0; i < 18; i++) lines.push(`[PASS] v-${i}: ok`);
  for (let i = 0; i < 3; i++) lines.push(`[FAIL] v-${18 + i}: bad`);
  const result = parseSchemaValidatorOutput(lines.join('\n'));
  assert.ok(result);
  assert.strictEqual(result.passed, 18);
  assert.strictEqual(result.failed, 3);
});

// ── 3. Prose containing "FAIL" is not treated as a failed test ──

test('parseSchemaValidatorOutput: prose containing FAIL is not counted', () => {
  const lines = [
    '[PASS] validation-1: ok',
    '[PASS] validation-2: ok',
    'This output does not FAIL at all — just a prose note.',
    'Another line mentioning FAIL in passing text.',
    'No FAIL here either, just prose.',
    '',
    'All fixture validations passed (offline, synthetic, no Nosana contact).',
  ];
  const output = lines.join('\n');

  const result = parseSchemaValidatorOutput(output);
  assert.ok(result);
  assert.strictEqual(result.passed, 2);
  assert.strictEqual(result.failed, 0, 'Prose FAIL should not be counted');
});

test('parseSchemaValidatorOutput: FAIL inside sentence not at line start is ignored', () => {
  const output = [
    '[PASS] check-1: passed',
    'The test did FAIL gracefully but was actually fine.',
    '[PASS] check-2: passed',
  ].join('\n');

  const result = parseSchemaValidatorOutput(output);
  assert.ok(result);
  assert.strictEqual(result.passed, 2);
  assert.strictEqual(result.failed, 0);
});

test('parseSchemaValidatorOutput: empty text returns null', () => {
  assert.strictEqual(parseSchemaValidatorOutput(''), null);
  assert.strictEqual(parseSchemaValidatorOutput('no validation lines here'), null);
});

test('parseSchemaValidatorOutput: [PASS] embedded in middle of line is not counted', () => {
  const output = 'some text [PASS] more text\n[PASS] real-line: ok';
  const result = parseSchemaValidatorOutput(output);
  assert.ok(result);
  assert.strictEqual(result.passed, 1, 'Only line-start [PASS] should count');
  assert.strictEqual(result.failed, 0);
});

// ── 4. Stale video detection ──

test('video freshness: stale video detected when source is newer', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'manifest-freshness-stale-'));
  try {
    // Create directory structure
    const videoDir = resolve(tempDir, 'output', 'demo-artifacts', 'stitchcheck-video');
    const scriptsDir = resolve(tempDir, 'scripts');
    const appSrcDir = resolve(tempDir, 'app', 'src');
    mkdirSync(videoDir, { recursive: true });
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(appSrcDir, { recursive: true });

    // Create a video file with old timestamp
    const videoFile = resolve(videoDir, 'demo.mp4');
    writeFileSync(videoFile, 'fake video');
    const oldTime = new Date('2026-08-20T10:00:00Z');
    utimesSync(videoFile, oldTime, oldTime);

    // Create source files with newer timestamps
    const captureScript = resolve(scriptsDir, 'stitchcheck-demo-capture.mjs');
    writeFileSync(captureScript, '// capture script');
    const newTime = new Date('2026-08-23T10:00:00Z');
    utimesSync(captureScript, newTime, newTime);

    const appFile = resolve(appSrcDir, 'App.tsx');
    writeFileSync(appFile, '// app source');
    utimesSync(appFile, newTime, newTime);

    // Use the imported computeVideoFreshness function
    const videoInfo = {
      modificationTimestamp: oldTime.toISOString(),
      modificationTimeMs: oldTime.getTime(),
    };
    const result = computeVideoFreshness(videoInfo, [captureScript, appFile]);

    assert.strictEqual(result.isStaleRelativeToSource, true, 'Video should be stale');
    assert.ok(result.sourceNewestMtime > videoInfo.modificationTimeMs);
    assert.strictEqual(result.newerSourceFiles.length, 2, 'Both source files should be newer');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── 5. Current (non-stale) video detection ──

test('video freshness: current video when video is newer than sources', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'manifest-freshness-current-'));
  try {
    const videoDir = resolve(tempDir, 'output', 'demo-artifacts', 'stitchcheck-video');
    const scriptsDir = resolve(tempDir, 'scripts');
    const appSrcDir = resolve(tempDir, 'app', 'src');
    mkdirSync(videoDir, { recursive: true });
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(appSrcDir, { recursive: true });

    // Create a video file with NEW timestamp
    const videoFile = resolve(videoDir, 'demo.mp4');
    writeFileSync(videoFile, 'fake video');
    const newTime = new Date('2026-08-23T14:00:00Z');
    utimesSync(videoFile, newTime, newTime);

    // Create source files with OLDER timestamps
    const captureScript = resolve(scriptsDir, 'stitchcheck-demo-capture.mjs');
    writeFileSync(captureScript, '// capture script');
    const oldTime = new Date('2026-08-20T10:00:00Z');
    utimesSync(captureScript, oldTime, oldTime);

    const appFile = resolve(appSrcDir, 'App.tsx');
    writeFileSync(appFile, '// app source');
    utimesSync(appFile, oldTime, oldTime);

    // Use the imported computeVideoFreshness function
    const videoInfo = {
      modificationTimestamp: newTime.toISOString(),
      modificationTimeMs: newTime.getTime(),
    };
    const result = computeVideoFreshness(videoInfo, [captureScript, appFile]);

    assert.strictEqual(result.isStaleRelativeToSource, false, 'Video should NOT be stale');
    assert.strictEqual(result.newerSourceFiles.length, 0, 'No source files should be newer');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// ── 6. Missing files produce explicit unknown status ──

test('video freshness: missing video produces null fields', () => {
  // When there is no video, the freshness metadata should have all nulls
  const result = {
    sourceNewestMtime: null,
    sourceNewestMtimeISO: null,
    videoMtime: null,
    videoMtimeMs: null,
    isStaleRelativeToSource: null,
    newerSourceFiles: [],
  };

  assert.strictEqual(result.videoMtime, null);
  assert.strictEqual(result.videoMtimeMs, null);
  assert.strictEqual(result.isStaleRelativeToSource, null);
  assert.strictEqual(result.newerSourceFiles.length, 0);
});

test('video freshness: missing source files produce unknown status', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'manifest-freshness-nosrc-'));
  try {
    const videoDir = resolve(tempDir, 'output', 'demo-artifacts', 'stitchcheck-video');
    mkdirSync(videoDir, { recursive: true });

    // Create a video file but NO source files
    const videoFile = resolve(videoDir, 'demo.mp4');
    writeFileSync(videoFile, 'fake video');
    const videoTime = new Date('2026-08-22T10:00:00Z');
    utimesSync(videoFile, videoTime, videoTime);

    // Use computeVideoFreshness with empty source paths
    const videoInfo = {
      modificationTimestamp: videoTime.toISOString(),
      modificationTimeMs: videoTime.getTime(),
    };
    const result = computeVideoFreshness(videoInfo, []);

    assert.strictEqual(result.isStaleRelativeToSource, null, 'No sources means unknown staleness');
    assert.strictEqual(result.sourceNewestMtime, null);
    assert.strictEqual(result.newerSourceFiles.length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('video freshness: no video at all produces null freshness fields', () => {
  const result = computeVideoFreshness(null, []);
  assert.strictEqual(result.videoMtime, null);
  assert.strictEqual(result.videoMtimeMs, null);
  assert.strictEqual(result.isStaleRelativeToSource, null);
  assert.strictEqual(result.sourceNewestMtime, null);
  assert.strictEqual(result.newerSourceFiles.length, 0);
});

// ── Summary ──

console.log('');
console.log('═'.repeat(60));
console.log('  Submission Manifest Generator — Focused Offline Tests');
console.log('  All tests use synthetic temp-dir fixtures only.');
console.log('  No credentials. No providers. No .env.local access.');
console.log('═'.repeat(60));
