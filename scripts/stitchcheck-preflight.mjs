#!/usr/bin/env node
// Read-only submission preflight checker for StitchCheck.
// Validates submission packaging and evidence boundaries before recording.
// Uses only Node.js built-ins. No network, no credentials, no file modifications.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = join(__dirname, '..');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`✓ ${name}`);
    passed++;
  } else {
    console.log(`✗ ${name}`);
    failed++;
  }
}

function fileExists(relativePath) {
  const fullPath = join(workspaceRoot, relativePath);
  return existsSync(fullPath);
}

function readFile(relativePath) {
  const fullPath = join(workspaceRoot, relativePath);
  return readFileSync(fullPath, 'utf-8');
}

function containsString(relativePath, searchString) {
  try {
    const content = readFile(relativePath);
    return content.includes(searchString);
  } catch {
    return false;
  }
}

// Check 1: Required files exist
const requiredFiles = [
  'README.md',
  'docs/stitchcheck-demo-readiness-report.md',
  'docs/stitchcheck-local-demo-operator-guide.md',
  'docs/stitchcheck-slide-deck-outline.md',
  'docs/stitchcheck-demo-narrative-video-plan.md',
  'docs/stitchcheck-judge-qa.md',
  'docs/stitchcheck-submission-evidence-index.md',
  'docs/stitchcheck-final-submission-readiness-checklist.md',
  'docs/gemini-contract-alignment-record.md',
  'docs/nosana-integration-boundary.md',
  'docs/cross-provider-invariant-test-record.md'
];

console.log('Required files:');
for (const file of requiredFiles) {
  check(`${file} exists`, fileExists(file));
}

// Check 2: app/package.json contains required scripts
console.log('\nPackage scripts:');
try {
  const packageJson = JSON.parse(readFile('app/package.json'));
  const scripts = packageJson.scripts || {};
  check('verify:offline script exists', 'verify:offline' in scripts);
  check('typecheck script exists', 'typecheck' in scripts);
  check('build script exists', 'build' in scripts);
} catch (error) {
  check('app/package.json is valid JSON', false);
}

// Check 3: Exact evidence labels exist
console.log('\nEvidence labels:');
const evidenceLabelChecks = [
  {
    name: 'OpenRouter temporary path label',
    file: 'README.md',
    label: 'OpenRouter temporary path — not direct Gemini validation'
  },
  {
    name: 'Nosana placeholder label',
    file: 'docs/nosana-integration-boundary.md',
    label: 'Synthetic local placeholder — not Nosana evidence'
  },
  {
    name: 'Atlas placeholder label',
    file: 'docs/stitchcheck-submission-evidence-index.md',
    label: 'Synthetic local placeholder — not Atlas Sandbox evidence'
  }
];

for (const checkItem of evidenceLabelChecks) {
  check(checkItem.name, containsString(checkItem.file, checkItem.label));
}

// Check 4: Provider boundaries remain present
console.log('\nProvider boundaries:');
const boundaryChecks = [
  {
    name: 'Direct Gemini unexecuted statement',
    file: 'docs/stitchcheck-submission-evidence-index.md',
    phrase: 'Direct Gemini remains unexecuted'
  },
  {
    name: 'Nosana unexecuted statement',
    file: 'docs/nosana-integration-boundary.md',
    phrase: 'has not been executed against Nosana'
  },
  {
    name: 'Atlas unauthenticated statement',
    file: 'docs/stitchcheck-submission-evidence-index.md',
    phrase: 'Atlas remains unauthenticated'
  },
  {
    name: 'OpenRouter temporary path statement',
    file: 'docs/stitchcheck-submission-evidence-index.md',
    phrase: 'OpenRouter temporary path'
  }
];

for (const checkItem of boundaryChecks) {
  check(checkItem.name, containsString(checkItem.file, checkItem.phrase));
}

// Check 5: Confirmation-gate wording
console.log('\nConfirmation gate:');
check(
  'Confirm itinerary first wording',
  containsString('docs/stitchcheck-local-demo-operator-guide.md', 'Confirm itinerary first')
);

// Check 6: Forbidden content checks
console.log('\nForbidden content:');

// Files to scan for forbidden content
const filesToScan = [
  'README.md',
  'docs/stitchcheck-demo-readiness-report.md',
  'docs/stitchcheck-local-demo-operator-guide.md',
  'docs/stitchcheck-slide-deck-outline.md',
  'docs/stitchcheck-demo-narrative-video-plan.md',
  'docs/stitchcheck-judge-qa.md',
  'docs/stitchcheck-submission-evidence-index.md',
  'docs/stitchcheck-final-submission-readiness-checklist.md',
  'docs/gemini-contract-alignment-record.md',
  'docs/nosana-integration-boundary.md',
  'docs/cross-provider-invariant-test-record.md',
  'app/package.json'
];

// Credential patterns to detect
const credentialPatterns = [
  /API_KEY\s*=\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /Bearer\s+[A-Za-z0-9_\-\.]+/i,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /password\s*[:=]\s*["']?[^\s"']{8,}/i,
  /secret\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i
];

// Allowed phrases that should not be flagged
const allowedPhrases = [
  'OpenRouter temporary path — not direct Gemini validation',
  'Synthetic local placeholder — not Nosana evidence',
  'Synthetic local placeholder — not Atlas Sandbox evidence',
  'Direct Gemini remains unexecuted',
  'Nosana remains unexecuted',
  'Atlas remains unauthenticated',
  'OpenRouter is a temporary path'
];

let forbiddenContentFound = false;

for (const file of filesToScan) {
  try {
    const content = readFile(file);
    
    // Check for credential patterns
    for (const pattern of credentialPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Check if the match is part of an allowed phrase
        const matchStr = matches[0];
        const isAllowed = allowedPhrases.some(phrase => phrase.includes(matchStr) || matchStr.includes(phrase));
        if (!isAllowed) {
          console.log(`✗ Credential pattern found in ${file}`);
          forbiddenContentFound = true;
          failed++;
        }
      }
    }
    
    // Check for URLs (http:// or https://) but exclude localhost
    const urlPattern = /https?:\/\/(?!localhost)/;
    if (urlPattern.test(content)) {
      console.log(`✗ External URL found in ${file}`);
      forbiddenContentFound = true;
      failed++;
    }
  } catch (error) {
    // File read error is not a forbidden content issue
  }
}

if (!forbiddenContentFound) {
  check('No forbidden credentials or URLs in scanned files', true);
}

// Final summary
console.log('\n' + '='.repeat(60));
console.log(`Preflight check: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
