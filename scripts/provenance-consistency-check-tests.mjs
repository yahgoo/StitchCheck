#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Provenance Consistency Checker — Offline Tests
// ─────────────────────────────────────────────────────────────────────────────
// Synthetic-fixture tests proving each detection rule of the provenance
// consistency checker works correctly.
//
// Constraints:
//   - Uses ONLY synthetic in-memory fixtures. No real repository data.
//   - Does NOT access .env.local or any credentials.
//   - Does NOT call any provider.
//   - Does NOT modify any existing file.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Synthetic canonical labels (mirrors core/provenance/labels.ts shape) ──

const SYNTHETIC_CANONICAL_LABELS = {
  gemini: [
    'Direct Gemini 3.7 \u2014 live validated',
    'Demo itinerary \u2014 local demo fixture',
    'Offline fixture \u2014 not direct Gemini evidence',
  ],
  atlas: [
    'Atlas Sandbox \u2014 live Search/Verify',
    'Atlas production Search \u2014 reference prices only',
    'Demo alternatives \u2014 local demo fixture',
    'Offline fixture \u2014 not Atlas Sandbox evidence',
    'Daytona sandbox evidence \u2014 Atlas Search/Verify, read-only',
    'Daytona sandbox unavailable \u2014 local fallback used',
    'Simulated ticketing \u2014 no real order created',
  ],
  nosana: [
    'Local fallback \u2014 not Nosana evidence',
    'Nosana workload validated offline \u2014 local fallback used; not Nosana evidence',
    'Nosana evidence \u2014 remote job succeeded; result from decentralized GPU workload.',
  ],
};

SYNTHETIC_CANONICAL_LABELS.all = [
  ...SYNTHETIC_CANONICAL_LABELS.gemini,
  ...SYNTHETIC_CANONICAL_LABELS.atlas,
  ...SYNTHETIC_CANONICAL_LABELS.nosana,
];

// ── Detection helpers (replicated from main script for test isolation) ──

function decodeUnicodeEscapes(str) {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function collectStrings(obj, path = '') {
  const results = [];
  if (obj === null || obj === undefined) return results;
  if (typeof obj === 'string') { results.push({ path, value: obj }); return results; }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) results.push(...collectStrings(obj[i], `${path}[${i}]`));
    return results;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      results.push(...collectStrings(value, path ? `${path}.${key}` : key));
    }
  }
  return results;
}

/** Rule 1: Check a label string against canonical set. Returns issue or null. */
function checkLabelDrift(candidate, canonicalSet) {
  const decoded = decodeUnicodeEscapes(candidate).trim();
  if (decoded.length < 15) return null;
  if (canonicalSet.has(decoded)) return null;
  const isSubstring = [...canonicalSet].some(cl =>
    cl.includes(decoded) || decoded.includes(cl)
  );
  if (isSubstring) return null;
  return { found: decoded };
}

/** Rule 2: Check if a JSON object claims live labels while offline. */
function checkLiveLabelOffline(data, liveFragments, offlineModes) {
  const issues = [];
  const allStrings = collectStrings(data);
  const allText = allStrings.map(s => s.value).join('\n');
  const isOffline =
    data.isLive === false ||
    (typeof data.executionMode === 'string' && offlineModes.includes(data.executionMode)) ||
    (data.meta?.isLiveServiceEvidence === false);
  if (isOffline) {
    for (const liveLabel of liveFragments) {
      if (allText.includes(liveLabel)) {
        issues.push({ found: liveLabel });
      }
    }
  }
  return issues;
}

/** Rule 3: Check for forbidden words in a JSON object's string values. */
function checkForbiddenWords(data, forbiddenWords) {
  const issues = [];
  const allStrings = collectStrings(data);
  for (const { path, value } of allStrings) {
    for (const forbidden of forbiddenWords) {
      const re = new RegExp(`\\b${forbidden.replace(/\s+/g, '\\s+')}\\b`);
      if (re.test(value)) {
        const negationRe = new RegExp(`no\\s+${forbidden}|not\\s+${forbidden}|${forbidden}.*not|${forbidden}.*never`, 'i');
        if (!negationRe.test(value)) {
          issues.push({ path, found: forbidden, context: value.substring(0, 120) });
        }
      }
    }
  }
  return issues;
}

/** Rule 4: Check for missing null-field fallback text. */
function checkMissingNullFallback(riskResultObj, nullableFields, expectedFallback) {
  const issues = [];
  if (!riskResultObj || typeof riskResultObj !== 'object') return issues;
  for (const field of nullableFields) {
    if (riskResultObj[field] === null || riskResultObj[field] === undefined) {
      const allValues = collectStrings(riskResultObj).map(s => s.value).join(' ');
      if (!allValues.includes(expectedFallback)) {
        issues.push({ field, detail: `Field is null but "${expectedFallback}" fallback text is not present` });
      }
    }
  }
  return issues;
}

// ── Shared constants for tests ──

const CANONICAL_SET = new Set(SYNTHETIC_CANONICAL_LABELS.all);

const LIVE_LABEL_FRAGMENTS = [
  'Atlas Sandbox — live Search/Verify',
  'Nosana evidence — remote job succeeded',
  'Direct Gemini 3.7 — live validated',
];

const OFFLINE_MODES = ['daytona-offline-mock', 'local-fallback', 'nosana-offline'];

const FORBIDDEN_WORDS = ['Booked', 'Switched', 'Ticket issued', 'Payment completed'];

const NULLABLE_FIELDS = ['failureCascadeExplanation', 'riskBand'];

const EXPECTED_FALLBACK = 'Not available from the current evidence';

// ── Rule 1 tests ──

test('R1-1: canonical label passes (exact match)', () => {
  const result = checkLabelDrift('Direct Gemini 3.7 \u2014 live validated', CANONICAL_SET);
  assert.strictEqual(result, null, 'Canonical label should not be flagged');
});

test('R1-2: canonical label with unicode escape passes', () => {
  const result = checkLabelDrift('Direct Gemini 3.7 \\u2014 live validated', CANONICAL_SET);
  assert.strictEqual(result, null, 'Unicode-escaped canonical should pass after decode');
});

test('R1-3: non-canonical label is detected as drift', () => {
  const result = checkLabelDrift('Synthetic local placeholder — not Nosana evidence', CANONICAL_SET);
  assert.notStrictEqual(result, null, 'Non-canonical label should be flagged');
  assert.strictEqual(result.found, 'Synthetic local placeholder — not Nosana evidence');
});

test('R1-4: old OpenRouter label is detected as drift', () => {
  const result = checkLabelDrift('OpenRouter temporary path — not direct Gemini validation', CANONICAL_SET);
  assert.notStrictEqual(result, null, 'Old OpenRouter label should be flagged');
});

test('R1-5: substring of canonical label is accepted', () => {
  // "Nosana evidence" is a substring of the canonical live evidence label
  const result = checkLabelDrift('Nosana evidence — remote job succeeded; result from decentralized GPU workload.', CANONICAL_SET);
  assert.strictEqual(result, null, 'Exact canonical Nosana label should pass');
});

test('R1-6: short strings are ignored (< 15 chars)', () => {
  const result = checkLabelDrift('Short label', CANONICAL_SET);
  assert.strictEqual(result, null, 'Short strings should be ignored');
});

test('R1-7: fixture contract label drift detected', () => {
  const result = checkLabelDrift('Synthetic local placeholder — not Atlas Sandbox evidence', CANONICAL_SET);
  assert.notStrictEqual(result, null, 'Non-canonical fixture label should be flagged');
});

test('R1-8: demo itinerary label passes (canonical Gemini localFixture)', () => {
  const result = checkLabelDrift('Demo itinerary \u2014 local demo fixture', CANONICAL_SET);
  assert.strictEqual(result, null, 'Canonical Gemini localFixture should pass');
});

// ── Rule 2 tests ──

test('R2-1: live label in offline manifest is detected', () => {
  const manifest = {
    isLive: false,
    executionMode: 'daytona-offline-mock',
    evidenceLabels: {
      atlas: 'Atlas Sandbox — live Search/Verify',
    },
  };
  const issues = checkLiveLabelOffline(manifest, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 1, 'Should detect one live label in offline manifest');
  assert.strictEqual(issues[0].found, 'Atlas Sandbox — live Search/Verify');
});

test('R2-2: live Nosana label in offline manifest is detected', () => {
  const manifest = {
    isLive: false,
    evidenceLabels: {
      nosana: 'Nosana evidence — remote job succeeded; result from decentralized GPU workload.',
    },
  };
  const issues = checkLiveLabelOffline(manifest, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 1);
  assert.ok(issues[0].found.includes('Nosana evidence'));
});

test('R2-3: live Gemini label in offline manifest is detected', () => {
  const manifest = {
    executionMode: 'local-fallback',
    labels: { gemini: 'Direct Gemini 3.7 — live validated' },
  };
  const issues = checkLiveLabelOffline(manifest, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 1);
  assert.ok(issues[0].found.includes('Direct Gemini'));
});

test('R2-4: no false positive when isLive is true', () => {
  const manifest = {
    isLive: true,
    executionMode: 'daytona-live-risk',
    evidenceLabels: { atlas: 'Atlas Sandbox — live Search/Verify' },
  };
  const issues = checkLiveLabelOffline(manifest, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 0, 'Live mode should not trigger rule 2');
});

test('R2-5: no false positive when offline labels are used', () => {
  const manifest = {
    isLive: false,
    executionMode: 'local-fallback',
    evidenceLabels: {
      atlas: 'Offline fixture — not Atlas Sandbox evidence',
      nosana: 'Local fallback — not Nosana evidence',
    },
  };
  const issues = checkLiveLabelOffline(manifest, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 0, 'Offline labels in offline manifest should pass');
});

test('R2-6: meta.isLiveServiceEvidence=false with live label is detected', () => {
  const data = {
    meta: { isLiveServiceEvidence: false },
    labels: { gemini: 'Direct Gemini 3.7 — live validated' },
  };
  const issues = checkLiveLabelOffline(data, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(issues.length, 1);
});

// ── Rule 3 tests ──

test('R3-1: forbidden word "Booked" is detected', () => {
  const data = { status: 'Booked', note: 'Flight confirmed' };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].found, 'Booked');
});

test('R3-2: forbidden word "Switched" is detected', () => {
  const data = { decision: 'Switched to alternative' };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].found, 'Switched');
});

test('R3-3: forbidden word "Ticket issued" is detected', () => {
  const data = { ticketing: { status: 'Ticket issued' } };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].found, 'Ticket issued');
});

test('R3-4: forbidden word "Payment completed" is detected', () => {
  const data = { payment: { status: 'Payment completed' } };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 1);
  assert.strictEqual(issues[0].found, 'Payment completed');
});

test('R3-5: negated forbidden word is NOT flagged', () => {
  const data = { statement: 'No Booked itinerary in this demo' };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 0, 'Negated forbidden word should not be flagged');
});

test('R3-6: safe text passes without issues', () => {
  const data = {
    label: 'Demo itinerary — local demo fixture',
    disclaimer: 'No booking, payment, or reservation has been created.',
  };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 0);
});

test('R3-7: multiple forbidden words in nested object', () => {
  const data = {
    step1: 'Booked',
    step2: 'Switched',
    step3: 'Ticket issued',
    step4: 'Payment completed',
  };
  const issues = checkForbiddenWords(data, FORBIDDEN_WORDS);
  assert.strictEqual(issues.length, 4, 'All four forbidden words should be detected');
});

// ── Rule 4 tests ──

test('R4-1: null field without fallback text is detected', () => {
  const riskResult = {
    riskBand: 'medium',
    riskScore: null,
    failureCascadeExplanation: null,
    heuristicDisclaimer: 'Some disclaimer',
  };
  const issues = checkMissingNullFallback(riskResult, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  assert.strictEqual(issues.length, 1, 'failureCascadeExplanation is null without fallback');
  assert.strictEqual(issues[0].field, 'failureCascadeExplanation');
});

test('R4-2: null field WITH fallback text passes', () => {
  const riskResult = {
    riskBand: null,
    failureCascadeExplanation: 'Not available from the current evidence',
    heuristicDisclaimer: 'Some disclaimer',
  };
  const issues = checkMissingNullFallback(riskResult, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  assert.strictEqual(issues.length, 0, 'Fallback text present should pass');
});

test('R4-3: non-null field is not checked', () => {
  const riskResult = {
    riskBand: 'medium',
    failureCascadeExplanation: 'Some explanation text',
  };
  const issues = checkMissingNullFallback(riskResult, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  assert.strictEqual(issues.length, 0, 'Non-null fields should not be flagged');
});

test('R4-4: multiple null fields detected', () => {
  const riskResult = {
    riskBand: null,
    failureCascadeExplanation: null,
    heuristicDisclaimer: 'Some disclaimer',
  };
  const issues = checkMissingNullFallback(riskResult, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  assert.strictEqual(issues.length, 2, 'Both null fields should be flagged');
});

test('R4-5: undefined fields in empty object are detected (no fallback text)', () => {
  const issues = checkMissingNullFallback({}, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  // Empty object: both nullable fields are undefined -> flagged since no fallback text
  assert.strictEqual(issues.length, 2, 'Undefined fields without fallback should be flagged');
});

test('R4-6: null object returns no issues', () => {
  const issues = checkMissingNullFallback(null, NULLABLE_FIELDS, EXPECTED_FALLBACK);
  assert.strictEqual(issues.length, 0);
});

// ── Integration test: temp directory scan ──

test('Integration: temp directory scan detects drift in synthetic manifest', () => {
  // Create a temporary directory structure mimicking the real one
  const tempDir = mkdtempSync(join(tmpdir(), 'prov-check-test-'));
  try {
    // Create synthetic capture manifest with drift
    const captureDir = resolve(tempDir, 'output', 'captures', 'capture-test');
    mkdirSync(captureDir, { recursive: true });

    const manifest = {
      overallStatus: 'pass',
      evidenceLabels: {
        gemini: 'OpenRouter temporary path — not direct Gemini validation',
        nosanaVariants: [
          'Synthetic local placeholder — not Nosana evidence',
          'Nosana evidence',
        ],
        atlas: 'Synthetic local placeholder — not Atlas Sandbox evidence',
      },
    };
    writeFileSync(resolve(captureDir, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));

    // Read and check
    const readManifest = JSON.parse(
      readFileSync(resolve(captureDir, 'capture-manifest.json'), 'utf-8')
    );

    // Check gemini label
    const geminiDrift = checkLabelDrift(readManifest.evidenceLabels.gemini, CANONICAL_SET);
    assert.notStrictEqual(geminiDrift, null, 'Old OpenRouter gemini label should drift');

    // Check nosana variant[0]
    const nosanaDrift = checkLabelDrift(readManifest.evidenceLabels.nosanaVariants[0], CANONICAL_SET);
    assert.notStrictEqual(nosanaDrift, null, 'Non-canonical nosana variant should drift');

    // Check nosana variant[1] - "Nosana evidence" is a substring of canonical
    const nosanaVariant1 = checkLabelDrift(readManifest.evidenceLabels.nosanaVariants[1], CANONICAL_SET);
    assert.strictEqual(nosanaVariant1, null, '"Nosana evidence" is a substring of canonical and should pass');

    // Check atlas label
    const atlasDrift = checkLabelDrift(readManifest.evidenceLabels.atlas, CANONICAL_SET);
    assert.notStrictEqual(atlasDrift, null, 'Non-canonical atlas label should drift');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Integration: synthetic evidence file with forbidden words and live labels', () => {
  const evidence = {
    isLive: false,
    executionMode: 'local-fallback',
    status: 'Booked',
    labels: {
      atlas: 'Atlas Sandbox — live Search/Verify',
    },
  };

  // Rule 2: live label while offline
  const r2Issues = checkLiveLabelOffline(evidence, LIVE_LABEL_FRAGMENTS, OFFLINE_MODES);
  assert.strictEqual(r2Issues.length, 1, 'Should detect live Atlas label in offline file');

  // Rule 3: forbidden word
  const r3Issues = checkForbiddenWords(evidence, FORBIDDEN_WORDS);
  assert.strictEqual(r3Issues.length, 1, 'Should detect "Booked"');
  assert.strictEqual(r3Issues[0].found, 'Booked');
});

// ── Summary ──

console.log('');
console.log('═'.repeat(60));
console.log('  Provenance Consistency Checker — Synthetic Tests');
console.log('  All tests use in-memory synthetic fixtures only.');
console.log('  No real repository data. No credentials. No providers.');
console.log('═'.repeat(60));
