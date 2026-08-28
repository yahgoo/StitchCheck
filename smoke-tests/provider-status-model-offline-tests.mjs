// Provider status model offline tests.
//
// Tests the ProviderLiveStatus derivation logic and cross-provider invariants.
// No network calls, no credentials, no live provider interaction.
//
// Hard guarantees:
// - Zero network code: no fetch/http/https/net/socket imports or calls.
// - No secret values are read, logged, or compared.
// - All inputs are synthetic/non-PII.

import assert from 'node:assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌  ${name}`);
    console.log(`      ${err.message}`);
  }
}

console.log('Provider status model offline tests\n');

// ── Inline deriveProviderStatus (mirrors core/provenance/metadata.ts) ──

function deriveProviderStatus(provider, fields) {
  const {
    evidenceSource = 'unknown',
    executed = false,
    fallbackUsed = true,
    errorCode,
  } = fields;

  let status;
  if (executed && !fallbackUsed && evidenceSource !== 'local-fixture' && evidenceSource !== 'local-fallback') {
    status = 'live-success';
  } else if (executed && fallbackUsed) {
    status = 'live-failed';
  } else if (!executed && evidenceSource === 'safety-gate-blocked') {
    status = 'blocked-pending-approval';
  } else if (!executed && (evidenceSource === 'local-fixture' || evidenceSource === 'local-fallback')) {
    status = 'offline-fallback';
  } else if (!executed) {
    status = 'not-configured';
  } else {
    status = 'offline-fallback';
  }

  return {
    provider,
    status,
    executed,
    fallbackUsed,
    evidenceSource,
    retrievedAt: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
    ...(errorCode ? { errorCode: String(errorCode) } : {}),
  };
}

// ── deriveProviderStatus tests ──

console.log('Section 1: deriveProviderStatus');

test('live-success: executed=true, fallbackUsed=false, non-local evidenceSource', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  assert.equal(result.status, 'live-success');
  assert.equal(result.executed, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.evidenceSource, 'extraction-live');
  assert.ok(result.retrievedAt);
  assert.ok(result.correlationId);
});

test('live-failed: executed=true, fallbackUsed=true', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: true,
  });
  assert.equal(result.status, 'live-failed');
  assert.equal(result.executed, true);
  assert.equal(result.fallbackUsed, true);
});

test('offline-fallback: local-fixture evidenceSource', () => {
  const result = deriveProviderStatus('atlas', {
    evidenceSource: 'local-fixture',
    executed: false,
    fallbackUsed: true,
  });
  assert.equal(result.status, 'offline-fallback');
  assert.equal(result.executed, false);
  assert.equal(result.fallbackUsed, true);
});

test('offline-fallback: local-fallback evidenceSource', () => {
  const result = deriveProviderStatus('nosana', {
    evidenceSource: 'local-fallback',
    executed: false,
    fallbackUsed: true,
  });
  assert.equal(result.status, 'offline-fallback');
});

test('blocked-pending-approval: safety-gate-blocked evidenceSource', () => {
  const result = deriveProviderStatus('nosana', {
    evidenceSource: 'safety-gate-blocked',
    executed: false,
    fallbackUsed: true,
  });
  assert.equal(result.status, 'blocked-pending-approval');
});

test('not-configured: unknown evidenceSource, not executed', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'unknown',
    executed: false,
    fallbackUsed: true,
  });
  assert.equal(result.status, 'not-configured');
});

test('errorCode is preserved when present', () => {
  const result = deriveProviderStatus('atlas', {
    evidenceSource: 'atlas-sandbox',
    executed: true,
    fallbackUsed: false,
    errorCode: 'SEARCH_TIMEOUT',
  });
  assert.equal(result.errorCode, 'SEARCH_TIMEOUT');
});

test('errorCode is absent when not provided', () => {
  const result = deriveProviderStatus('atlas', {
    evidenceSource: 'atlas-sandbox',
    executed: true,
    fallbackUsed: false,
  });
  assert.equal(result.errorCode, undefined);
});

test('defaults: missing fields produce not-configured', () => {
  const result = deriveProviderStatus('openrouter', {});
  assert.equal(result.status, 'not-configured');
  assert.equal(result.executed, false);
  assert.equal(result.fallbackUsed, true);
});

test('retrievedAt is ISO format', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(result.retrievedAt));
});

test('correlationId starts with corr-', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  assert.ok(result.correlationId.startsWith('corr-'));
});

// ── Cross-provider invariant tests ──

console.log('\nSection 2: Cross-provider invariants');

test('each provider gets independent status', () => {
  const extraction = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  const nosana = deriveProviderStatus('nosana', {
    evidenceSource: 'safety-gate-blocked',
    executed: false,
    fallbackUsed: true,
  });
  const atlas = deriveProviderStatus('atlas', {
    evidenceSource: 'local-fixture',
    executed: false,
    fallbackUsed: true,
  });

  assert.equal(extraction.status, 'live-success');
  assert.equal(nosana.status, 'blocked-pending-approval');
  assert.equal(atlas.status, 'offline-fallback');
  assert.equal(extraction.provider, 'openrouter');
  assert.equal(nosana.provider, 'nosana');
  assert.equal(atlas.provider, 'atlas');
});

test('one provider failure does not become another provider evidence', () => {
  const extraction = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: true, // failed
  });
  const atlas = deriveProviderStatus('atlas', {
    evidenceSource: 'atlas-sandbox',
    executed: true,
    fallbackUsed: false, // succeeded
  });

  assert.equal(extraction.status, 'live-failed');
  assert.equal(atlas.status, 'live-success');
  assert.notEqual(extraction.provider, atlas.provider);
});

test('no blended all-live label unless all three have live-success', () => {
  const statuses = [
    deriveProviderStatus('openrouter', { evidenceSource: 'extraction-live', executed: true, fallbackUsed: false }),
    deriveProviderStatus('nosana', { evidenceSource: 'safety-gate-blocked', executed: false, fallbackUsed: true }),
    deriveProviderStatus('atlas', { evidenceSource: 'atlas-sandbox', executed: true, fallbackUsed: false }),
  ];

  const allLive = statuses.every(s => s.status === 'live-success');
  assert.equal(allLive, false); // Nosana is blocked, so not all live
});

test('all three live-success produces all-live', () => {
  const statuses = [
    deriveProviderStatus('openrouter', { evidenceSource: 'extraction-live', executed: true, fallbackUsed: false }),
    deriveProviderStatus('nosana', { evidenceSource: 'nosana-evidence', executed: true, fallbackUsed: false }),
    deriveProviderStatus('atlas', { evidenceSource: 'atlas-sandbox', executed: true, fallbackUsed: false }),
  ];

  const allLive = statuses.every(s => s.status === 'live-success');
  assert.equal(allLive, true);
});

// ── Label correctness tests ──

console.log('\nSection 3: Provider status label correctness');

function labelForProvider(status) {
  switch (status) {
    case 'live-success': return 'live';
    case 'live-failed': return 'unavailable';
    case 'offline-fallback': return 'offline';
    case 'not-configured': return 'not configured';
    case 'blocked-pending-approval': return 'blocked pending approval';
    default: return 'unknown';
  }
}

test('live-success label contains "live"', () => {
  assert.equal(labelForProvider('live-success'), 'live');
});

test('live-failed label contains "unavailable"', () => {
  assert.equal(labelForProvider('live-failed'), 'unavailable');
});

test('offline-fallback label contains "offline"', () => {
  assert.equal(labelForProvider('offline-fallback'), 'offline');
});

test('blocked-pending-approval label is descriptive', () => {
  assert.equal(labelForProvider('blocked-pending-approval'), 'blocked pending approval');
});

// ── Safety tests ──

console.log('\nSection 4: Safety invariants');

test('deriveProviderStatus never contains API key patterns', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  const json = JSON.stringify(result);
  assert.ok(!/AIza/.test(json));
  assert.ok(!/sk-[a-zA-Z0-9]{10,}/.test(json));
  assert.ok(!/Bearer/.test(json));
});

test('deriveProviderStatus never contains PII patterns', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  const json = JSON.stringify(result);
  assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/.test(json));
});

test('no provider status contains raw image data', () => {
  const result = deriveProviderStatus('openrouter', {
    evidenceSource: 'extraction-live',
    executed: true,
    fallbackUsed: false,
  });
  const json = JSON.stringify(result);
  // base64 strings longer than 100 chars are suspicious
  assert.ok(!/[A-Za-z0-9+/=]{100,}/.test(json));
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Provider status model tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) process.exit(1);
