// Recovery-plan animation accessibility offline tests.
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// Verifies:
//   1. Contrast: heading colour reaches WCAG AA on its background.
//   2. aria-live: component source contains a polite live region.
//   3. Heading hierarchy: no h2→h4 skip (PlanCard uses h3).
//   4. Timestamp formatting: readable UTC, original ISO preserved.
//   5. Freshness wording: no misleading "refreshed" language.
//   6. data-rpa-phase and terminal values are preserved.
//   7. Reduced-motion support is present.
//   8. No forbidden provider or booking wording was introduced.
//
// Hard guarantees:
// - Zero network code.
// - Zero credentials read.
// - Deterministic: reads source files only.

import assert from 'node:assert';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
  }
}

/* ── Load source files ── */

const tsxPath = fileURLToPath(
  new URL('../app/src/components/RecoveryPlanAnimation.tsx', import.meta.url),
);
const cssPath = fileURLToPath(
  new URL('../app/src/components/RecoveryPlanAnimation.css', import.meta.url),
);

const tsx = fs.readFileSync(tsxPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

/* ══════════════════════════════════════════════════════════
   1. Contrast correction
   ══════════════════════════════════════════════════════════ */

test('recommended heading uses #1e3a8a (darkened for WCAG AA)', () => {
  // The heading colour must be #1e3a8a, not the old #1e40af.
  assert.ok(
    css.includes('#1e3a8a'),
    'CSS must contain #1e3a8a for the recommended heading',
  );
  // Check the actual colour declaration (not comments) in the heading rule.
  const headingRule = css.match(
    /\.rpa-recommended__heading\s*\{[^}]*\}/,
  );
  assert.ok(headingRule, '.rpa-recommended__heading rule must exist');
  assert.ok(
    headingRule[0].includes('#1e3a8a'),
    'Heading rule must use #1e3a8a',
  );
  // Strip CSS comments before checking for the old colour.
  const ruleWithoutComments = headingRule[0].replace(/\/\*[^*]*\*\//g, '');
  assert.ok(
    !ruleWithoutComments.includes('#1e40af'),
    'Heading rule must not use the old #1e40af (excluding comments)',
  );
});

/* ══════════════════════════════════════════════════════════
   2. aria-live implementation
   ══════════════════════════════════════════════════════════ */

test('aria-live="polite" live region is present', () => {
  assert.ok(
    tsx.includes('aria-live="polite"'),
    'TSX must contain aria-live="polite"',
  );
});

test('live region uses role="status"', () => {
  assert.ok(
    tsx.includes('role="status"'),
    'TSX must contain a role="status" element',
  );
});

test('live region is visually hidden (rpa-sr-only class)', () => {
  assert.ok(
    css.includes('.rpa-sr-only'),
    'CSS must define .rpa-sr-only class',
  );
  // Check for standard visually-hidden properties.
  const srOnlyRule = css.match(/\.rpa-sr-only\s*\{[^}]*\}/);
  assert.ok(srOnlyRule, '.rpa-sr-only rule must exist');
  assert.ok(
    srOnlyRule[0].includes('position: absolute'),
    'Must use position: absolute',
  );
  assert.ok(
    srOnlyRule[0].includes('clip'),
    'Must use clip for visual hiding',
  );
});

test('terminal no-plan state retains role="alert"', () => {
  // The terminal error div must still have role="alert".
  assert.ok(
    tsx.includes('role="alert"'),
    'Terminal no-plan state must use role="alert"',
  );
});

test('phaseAnnouncement function exists with all phases', () => {
  assert.ok(
    tsx.includes('function phaseAnnouncement'),
    'phaseAnnouncement helper must exist',
  );
  for (const phase of [
    'trigger',
    'cascade',
    'candidates',
    'collapse',
    'freshness',
    'done',
  ]) {
    assert.ok(
      tsx.includes(`'${phase}'`),
      `phaseAnnouncement must handle '${phase}'`,
    );
  }
});

/* ══════════════════════════════════════════════════════════
   3. Heading hierarchy
   ══════════════════════════════════════════════════════════ */

test('no h4 elements in PlanCard (h2→h3→h3 hierarchy)', () => {
  // After the fix, the TSX must not contain any <h4> tags.
  assert.ok(
    !tsx.includes('<h4'),
    'TSX must not contain any <h4> elements',
  );
  assert.ok(
    !tsx.includes('</h4>'),
    'TSX must not contain any </h4> closing tags',
  );
});

test('PlanCard leg titles use h3', () => {
  const h3Count = (tsx.match(/<h3 /g) || []).length;
  // At least 3 PlanCard h3s + confirmation headings.
  assert.ok(
    h3Count >= 3,
    `Expected at least 3 h3 elements, found ${h3Count}`,
  );
});

/* ══════════════════════════════════════════════════════════
   4. Timestamp formatting
   ══════════════════════════════════════════════════════════ */

test('formatUtcTimestamp helper exists', () => {
  assert.ok(
    tsx.includes('function formatUtcTimestamp'),
    'formatUtcTimestamp helper must exist',
  );
});

test('timestamp element has dateTime attribute', () => {
  assert.ok(
    tsx.includes('dateTime='),
    '<time> must have a dateTime attribute for machine readability',
  );
});

test('timestamp element has title attribute for tooltip', () => {
  assert.ok(
    tsx.includes('title={data.freshnessTimestamp}'),
    '<time> must have a title attribute with the original ISO value',
  );
});

test('formatted timestamp uses UTC suffix', () => {
  assert.ok(
    tsx.includes('UTC'),
    'formatUtcTimestamp must append "UTC" to the display',
  );
});

/* ══════════════════════════════════════════════════════════
   5. Freshness wording
   ══════════════════════════════════════════════════════════ */

test('no "Availability refreshed just now" wording', () => {
  assert.ok(
    !tsx.includes('Availability refreshed just now'),
    'Misleading "Availability refreshed just now" must be removed',
  );
});

test('freshness headline says "Recovery plan computed"', () => {
  assert.ok(
    tsx.includes('Recovery plan computed'),
    'Freshness headline must say "Recovery plan computed"',
  );
  assert.ok(
    !tsx.includes('Offline recovery plan computed'),
    'Freshness headline must not use stale "Offline recovery plan computed" wording',
  );
});

/* ══════════════════════════════════════════════════════════
   6. data-rpa-phase preservation
   ══════════════════════════════════════════════════════════ */

test('data-rpa-phase attribute is preserved', () => {
  assert.ok(
    tsx.includes('data-rpa-phase={exposedPhase}'),
    'data-rpa-phase must remain on the root section',
  );
});

test('terminal phase values are preserved', () => {
  assert.ok(
    tsx.includes("'no-safe-plan'"),
    "Terminal 'no-safe-plan' value must be preserved",
  );
  assert.ok(
    tsx.includes("'error'"),
    "Terminal 'error' value must be preserved",
  );
});

/* ══════════════════════════════════════════════════════════
   7. Reduced-motion support
   ══════════════════════════════════════════════════════════ */

test('prefers-reduced-motion media query is present', () => {
  assert.ok(
    css.includes('prefers-reduced-motion: reduce'),
    'CSS must contain prefers-reduced-motion: reduce query',
  );
});

/* ══════════════════════════════════════════════════════════
   8. No forbidden wording
   ══════════════════════════════════════════════════════════ */

const forbiddenWords = [
  'Booked',
  'Switched',
  'Ticket issued',
  'Payment completed',
];

for (const word of forbiddenWords) {
  test(`no forbidden wording: "${word}"`, () => {
    // Check TSX source, excluding all comments (block and line).
    // Strip block comments first, then filter line comments.
    const stripped = tsx
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    assert.ok(
      !stripped.includes(word),
      `Found forbidden word "${word}" in non-comment TSX source`,
    );
  });
}

/* ── Preserved safety wording ── */

const daytonaOfflineRiskPath = fileURLToPath(
  new URL('../app/src/data/daytona-offline-risk.ts', import.meta.url),
);
const daytonaRisk = fs.readFileSync(daytonaOfflineRiskPath, 'utf8');

const missingFieldLabelsPath = fileURLToPath(
  new URL('../core/copy/missing-field-labels.ts', import.meta.url),
);
const missingFieldLabels = fs.readFileSync(missingFieldLabelsPath, 'utf8');

const requiredPhrases = [
  { text: 'Daytona sandbox \\u2014 risk analysis computed locally, no live risk service called', source: daytonaRisk },
  { text: 'Simulated delay trigger — downstream impact is analysis only', source: tsx },
  { text: "We don't have this yet", source: missingFieldLabels },
  { text: '—', source: missingFieldLabels },
  { text: 'Request submitted — awaiting verified supplier outcome', source: tsx },
  { text: 'formatMissingField', source: tsx },
];

for (const { text, source } of requiredPhrases) {
  test(`preserved safety wording: "${text.slice(0, 40)}…"`, () => {
    assert.ok(
      source.includes(text),
      `Required phrase "${text}" must be present`,
    );
  });
}

/* ── Summary ── */

console.log(
  `\nRecovery animation accessibility offline tests: ${passed} passed, ${failed} failed`,
);
if (failed > 0) process.exit(1);
