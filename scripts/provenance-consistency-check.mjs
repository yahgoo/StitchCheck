#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// StitchCheck — Provenance Consistency Checker
// ─────────────────────────────────────────────────────────────────────────────
// Offline read-only scanner that detects provenance drift and unsafe claims.
//
// Detection rules:
//   1. Capture/manifest assertions that don't match canonical labels in
//      core/provenance/labels.ts.
//   2. Manifests or docs claiming a live label while isLive is false or
//      executionMode is *-offline-mock.
//   3. Forbidden words in evidence files or manifests:
//      "Booked", "Switched", "Ticket issued", "Payment completed".
//   4. Missing "Not available from the current evidence" where a field is
//      null and rendered.
//
// Constraints:
//   - Does NOT access .env.local or any credentials.
//   - Does NOT call any provider.
//   - Does NOT modify any source, fixture, or output file.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = resolve(__dirname, '..');

// ── Helpers ──

function log(msg) { console.log(`[prov-check] ${msg}`); }
function logIssue(rule, msg) { console.log(`  [${rule}] ${msg}`); }

function safeReadJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function safeReadText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

/** Recursively collect all string values from a JSON object. */
function collectStrings(obj, path = '') {
  const results = [];
  if (obj === null || obj === undefined) return results;
  if (typeof obj === 'string') {
    results.push({ path, value: obj });
    return results;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...collectStrings(obj[i], `${path}[${i}]`));
    }
    return results;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      results.push(...collectStrings(value, path ? `${path}.${key}` : key));
    }
  }
  return results;
}

// ── Rule 0: Parse canonical labels from core/provenance/labels.ts ──

function parseCanonicalLabels() {
  const labelsPath = resolve(WORKSPACE, 'core/provenance/labels.ts');
  const src = safeReadText(labelsPath);
  if (!src) {
    log('WARNING: core/provenance/labels.ts not found');
    return { gemini: [], atlas: [], nosana: [], all: [] };
  }

  const gemini = [];
  const atlas = [];
  const nosana = [];

  // Extract string literals from GEMINI_LABELS, ATLAS_UI_LABELS, NOSANA_UI_LABELS
  // Pattern: key: 'value'  or  key: "value"  with possible multi-line
  const extractLabelValues = (blockName) => {
    const blockRe = new RegExp(`(?:const\\s+${blockName}\\s*=\\s*\\{)([\\s\\S]*?)(?:\\}\\s+as\\s+const)`, 'm');
    const blockMatch = src.match(blockRe);
    if (!blockMatch) return [];
    const block = blockMatch[1];
    const values = [];
    // Match single-quoted string values (may contain unicode escapes)
    const strRe = /:\s*'([^']+)'/g;
    let m;
    while ((m = strRe.exec(block)) !== null) {
      // Decode unicode escapes like \u2014
      values.push(m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
    }
    return values;
  };

  gemini.push(...extractLabelValues('GEMINI_LABELS'));
  atlas.push(...extractLabelValues('ATLAS_UI_LABELS'));
  nosana.push(...extractLabelValues('NOSANA_UI_LABELS'));

  // Also extract OPENROUTER_HISTORICAL_LABEL, LABELS values, DISABLED_MESSAGE, FINAL_STATEMENT
  const additionalRe = /export\s+const\s+(?:OPENROUTER_HISTORICAL_LABEL|DISABLED_MESSAGE|FINAL_STATEMENT)\s*=\s*'([^']+)'/g;
  let am;
  while ((am = additionalRe.exec(src)) !== null) {
    gemini.push(am[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
  }

  const all = [...gemini, ...atlas, ...nosana];

  return { gemini, atlas, nosana, all };
}

/** Decode JS unicode escapes like \\u2014 in raw text. */
function decodeUnicodeEscapes(str) {
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ── Rule 1: Capture/manifest assertion drift ──

function checkCaptureAssertionDrift(canonicalLabels) {
  const issues = [];
  const canonicalSet = new Set(canonicalLabels.all);

  /** Check a single label string against canonical set; push issue if drift. */
  function checkLabel(relPath, candidate, context) {
    const decoded = decodeUnicodeEscapes(candidate).trim();
    if (decoded.length < 15) return;
    if (canonicalSet.has(decoded)) return;
    // Check substring match (partial labels are acceptable)
    const isSubstring = [...canonicalSet].some(cl =>
      cl.includes(decoded) || decoded.includes(cl)
    );
    if (isSubstring) return;
    issues.push({
      file: relPath,
      found: decoded,
      detail: context || 'Label assertion does not match any canonical label in core/provenance/labels.ts',
    });
  }

  // Files that contain label assertions
  const captureFiles = [
    'scripts/stitchcheck-demo-capture.mjs',
    'scripts/stitchcheck-recovery-animation-capture.mjs',
  ];

  for (const relPath of captureFiles) {
    const filePath = resolve(WORKSPACE, relPath);
    if (!existsSync(filePath)) continue;
    const src = safeReadText(filePath);

    // Strategy: extract string values from EVIDENCE_LABELS-like objects
    // and from nosanaVariants arrays. These are the actual assertion values.
    // Match single-line quoted strings only (no newlines).

    // 1. Extract EVIDENCE_LABELS object values
    const evBlockRe = /const\s+EVIDENCE_LABELS\s*=\s*\{([\s\S]*?)\};/;
    const evBlock = src.match(evBlockRe);
    if (evBlock) {
      // Extract key: 'value' pairs (single-line strings only)
      const kvRe = /\w+:\s*'([^'\n]+)'/g;
      let m;
      while ((m = kvRe.exec(evBlock[1])) !== null) {
        checkLabel(relPath, m[1], 'EVIDENCE_LABELS value does not match any canonical label');
      }
      // Extract arrays of label variants
      const arrRe = /\[([\s\S]*?)\]/g;
      let arrM;
      while ((arrM = arrRe.exec(evBlock[1])) !== null) {
        const strRe = /'([^'\n]+)'/g;
        let sm;
        while ((sm = strRe.exec(arrM[1])) !== null) {
          checkLabel(relPath, sm[1], 'EVIDENCE_LABELS variant does not match any canonical label');
        }
      }
    }

    // Note: assertText/assertTextVariant calls reference EVIDENCE_LABELS.*
    // which are already checked above. No need to scan them again.
  }

  // Check capture manifests in output/captures/
  const captureManifests = resolve(WORKSPACE, 'output/captures');
  if (existsSync(captureManifests)) {
    try {
      const dirs = require('node:fs').readdirSync(captureManifests, { withFileTypes: false });
      for (const dir of dirs) {
        const manifestPath = resolve(captureManifests, dir, 'capture-manifest.json');
        if (!existsSync(manifestPath)) continue;
        const manifest = safeReadJSON(manifestPath);
        if (!manifest) continue;

        // Check evidenceLabels block
        if (manifest.evidenceLabels) {
          const labels = manifest.evidenceLabels;
          if (typeof labels.gemini === 'string' && !canonicalSet.has(labels.gemini)) {
            const isSubstring = [...canonicalSet].some(cl =>
              cl.includes(labels.gemini) || labels.gemini.includes(cl)
            );
            if (!isSubstring) {
              issues.push({
                file: `output/captures/${dir}/capture-manifest.json`,
                found: labels.gemini,
                detail: 'Manifest gemini label does not match any canonical label',
              });
            }
          }
          if (Array.isArray(labels.nosanaVariants)) {
            for (const v of labels.nosanaVariants) {
              if (typeof v === 'string' && !canonicalSet.has(v)) {
                const isSubstring = [...canonicalSet].some(cl =>
                  cl.includes(v) || v.includes(cl)
                );
                if (!isSubstring) {
                  issues.push({
                    file: `output/captures/${dir}/capture-manifest.json`,
                    found: v,
                    detail: 'Manifest nosana variant does not match any canonical label',
                  });
                }
              }
            }
          }
          if (typeof labels.atlas === 'string' && !canonicalSet.has(labels.atlas)) {
            const isSubstring = [...canonicalSet].some(cl =>
              cl.includes(labels.atlas) || labels.atlas.includes(cl)
            );
            if (!isSubstring) {
              issues.push({
                file: `output/captures/${dir}/capture-manifest.json`,
                found: labels.atlas,
                detail: 'Manifest atlas label does not match any canonical label',
              });
            }
          }
        }
      }
    } catch { /* ignore readdir errors */ }
  }

  // Check fixture contract labels
  const fixtureContracts = [
    'app-fixture-contracts/stitchcheck-ui-copy-map.json',
    'app-fixture-contracts/stitchcheck-ui-demo-data.json',
  ];
  for (const relPath of fixtureContracts) {
    const filePath = resolve(WORKSPACE, relPath);
    if (!existsSync(filePath)) continue;
    const data = safeReadJSON(filePath);
    if (!data) continue;

    // Check meta.labels and labels blocks
    const labelBlocks = [];
    if (data.meta?.labels) labelBlocks.push({ path: 'meta.labels', obj: data.meta.labels });
    if (data.labels) labelBlocks.push({ path: 'labels', obj: data.labels });

    for (const block of labelBlocks) {
      for (const [key, value] of Object.entries(block.obj)) {
        if (typeof value === 'string' && !canonicalSet.has(value)) {
          const isSubstring = [...canonicalSet].some(cl =>
            cl.includes(value) || value.includes(cl)
          );
          if (!isSubstring) {
            issues.push({
              file: relPath,
              found: `${block.path}.${key} = "${value}"`,
              detail: 'Fixture contract label does not match any canonical label',
            });
          }
        }
      }
    }

    // Also check sourceLabel fields in states/uiStates
    const allStrings = collectStrings(data);
    for (const { path, value } of allStrings) {
      if (path.endsWith('sourceLabel') && value && !canonicalSet.has(value)) {
        const isSubstring = [...canonicalSet].some(cl =>
          cl.includes(value) || value.includes(cl)
        );
        if (!isSubstring && value.length > 15) {
          issues.push({
            file: relPath,
            found: `${path} = "${value}"`,
            detail: 'Fixture sourceLabel does not match any canonical label',
          });
        }
      }
    }
  }

  return issues;
}

// ── Rule 2: Live label claimed while isLive=false or executionMode=offline ──

function checkLiveLabelsWithOfflineMode() {
  const issues = [];

  // Live label fragments that should only appear when isLive=true
  const LIVE_LABEL_FRAGMENTS = [
    'Atlas Sandbox — live Search/Verify',
    'Nosana evidence — remote job succeeded',
    'Direct Gemini 3.7 — live validated',
    'Nosana evidence — remote job succeeded; result from decentralized GPU workload',
  ];

  // Offline execution modes that should NOT carry live labels
  const OFFLINE_MODES = ['daytona-offline-mock', 'local-fallback', 'nosana-offline'];

  // Scan all JSON files in output/, app-fixture-contracts/, smoke-tests/ (non-node_modules)
  const scanDirs = [
    resolve(WORKSPACE, 'output'),
    resolve(WORKSPACE, 'app-fixture-contracts'),
    resolve(WORKSPACE, 'smoke-tests'),
    resolve(WORKSPACE, 'app/public'),
  ];

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue;
    const jsonFiles = findJSONFiles(dir);
    for (const filePath of jsonFiles) {
      const data = safeReadJSON(filePath);
      if (!data) continue;
      const relPath = relative(WORKSPACE, filePath);

      const allStrings = collectStrings(data);
      const allText = allStrings.map(s => s.value).join('\n');

      // Check if file claims offline mode
      const isOffline =
        data.isLive === false ||
        (typeof data.executionMode === 'string' && OFFLINE_MODES.includes(data.executionMode)) ||
        (data.meta?.isLiveServiceEvidence === false);

      if (isOffline) {
        for (const liveLabel of LIVE_LABEL_FRAGMENTS) {
          if (allText.includes(liveLabel)) {
            issues.push({
              file: relPath,
              found: liveLabel,
              detail: `Live label claimed while file declares offline mode (isLive=${data.isLive}, executionMode=${data.executionMode})`,
            });
          }
        }
      }
    }
  }

  // Also scan .ts and .mjs source files in scripts/ and app/src/
  const sourceFiles = [
    ...findFiles(resolve(WORKSPACE, 'scripts'), '.mjs'),
    ...findFiles(resolve(WORKSPACE, 'app/src'), '.ts'),
    ...findFiles(resolve(WORKSPACE, 'app/src'), '.tsx'),
  ];

  for (const filePath of sourceFiles) {
    const src = safeReadText(filePath);
    if (!src) continue;
    const relPath = relative(WORKSPACE, filePath);

    // Check if the file declares offline execution
    const hasOfflineMode = OFFLINE_MODES.some(mode => src.includes(mode));
    const hasIsLiveFalse = /isLive\s*:\s*false/.test(src);

    if (hasOfflineMode || hasIsLiveFalse) {
      for (const liveLabel of LIVE_LABEL_FRAGMENTS) {
        if (src.includes(liveLabel)) {
          issues.push({
            file: relPath,
            found: liveLabel,
            detail: 'Live label in file that declares offline execution mode',
          });
        }
      }
    }
  }

  return issues;
}

// ── Rule 3: Forbidden words in evidence/manifest files ──

function checkForbiddenWords() {
  const issues = [];

  const FORBIDDEN_WORDS = ['Booked', 'Switched', 'Ticket issued', 'Payment completed'];

  const scanDirs = [
    resolve(WORKSPACE, 'output'),
    resolve(WORKSPACE, 'app-fixture-contracts'),
    resolve(WORKSPACE, 'smoke-tests'),
    resolve(WORKSPACE, 'app/public'),
  ];

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue;
    const jsonFiles = findJSONFiles(dir);
    for (const filePath of jsonFiles) {
      const data = safeReadJSON(filePath);
      if (!data) continue;
      const relPath = relative(WORKSPACE, filePath);
      const allStrings = collectStrings(data);

      for (const { path, value } of allStrings) {
        for (const forbidden of FORBIDDEN_WORDS) {
          // Case-sensitive exact word match (not inside another word)
          const re = new RegExp(`\\b${forbidden.replace(/\s+/g, '\\s+')}\\b`);
          if (re.test(value)) {
            // Skip if it's inside a clear negation context
            const negationRe = new RegExp(`no\\s+${forbidden}|not\\s+${forbidden}|${forbidden}.*not|${forbidden}.*never`, 'i');
            if (!negationRe.test(value)) {
              issues.push({
                file: relPath,
                path,
                found: forbidden,
                context: value.substring(0, 120),
                detail: `Forbidden word "${forbidden}" found in evidence/manifest file`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

// ── Rule 4: Missing "Not available from the current evidence" for null fields ──

function checkMissingNullFallback() {
  const issues = [];

  const EXPECTED_FALLBACK = 'Not available from the current evidence';

  // Fields that when null should carry the fallback text
  const NULLABLE_RENDERED_FIELDS = [
    'failureCascadeExplanation',
    'riskBand',
    'heuristicDisclaimer',
  ];

  // Scan risk result fixtures and evidence files
  const scanDirs = [
    resolve(WORKSPACE, 'smoke-tests/nosana/fixtures'),
    resolve(WORKSPACE, 'smoke-tests/atlas/fixtures'),
    resolve(WORKSPACE, 'app/public'),
    resolve(WORKSPACE, 'app-fixture-contracts'),
  ];

  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue;
    const jsonFiles = findJSONFiles(dir);
    for (const filePath of jsonFiles) {
      const data = safeReadJSON(filePath);
      if (!data) continue;
      const relPath = relative(WORKSPACE, filePath);

      // Check nested riskResult objects
      const riskResults = [];
      if (data.riskResult) riskResults.push({ path: 'riskResult', obj: data.riskResult });
      if (data.uiStates) {
        for (const [stateKey, stateVal] of Object.entries(data.uiStates)) {
          if (stateVal && typeof stateVal === 'object' && stateVal.riskResult) {
            riskResults.push({ path: `uiStates.${stateKey}.riskResult`, obj: stateVal.riskResult });
          }
        }
      }

      for (const { path, obj } of riskResults) {
        for (const field of NULLABLE_RENDERED_FIELDS) {
          if (obj[field] === null || obj[field] === undefined) {
            // Check if the fallback text is present elsewhere in the same object
            const allValues = collectStrings(obj).map(s => s.value).join(' ');
            if (!allValues.includes(EXPECTED_FALLBACK)) {
              issues.push({
                file: relPath,
                path: `${path}.${field}`,
                detail: `Field is null but "${EXPECTED_FALLBACK}" fallback text is not present`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

// ── File discovery helpers ──

function findJSONFiles(dir) {
  const results = [];
  try {
    const entries = require('node:fs').readdirSync(dir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.includes('node_modules')) {
        results.push(resolve(dir, entry.parentPath || dir, entry.name));
      }
    }
  } catch {
    // Fallback: manual recursive walk
    walkDir(dir, results, '.json');
  }
  return results;
}

function findFiles(dir, ext) {
  const results = [];
  walkDir(dir, results, ext);
  return results;
}

function walkDir(dir, results, ext) {
  try {
    const entries = require('node:fs').readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walkDir(fullPath, results, ext);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch { /* ignore */ }
}

// ── Main ──

function main() {
  log('StitchCheck Provenance Consistency Checker');
  log('==========================================');
  log('');

  let totalIssues = 0;

  // Parse canonical labels
  const canonicalLabels = parseCanonicalLabels();
  log(`Canonical labels parsed: ${canonicalLabels.all.length}`);
  log(`  Gemini: ${canonicalLabels.gemini.length}`);
  log(`  Atlas:  ${canonicalLabels.atlas.length}`);
  log(`  Nosana: ${canonicalLabels.nosana.length}`);
  log('');

  // Rule 1: Capture/manifest assertion drift
  log('── Rule 1: Capture/manifest assertion drift ──');
  const rule1Issues = checkCaptureAssertionDrift(canonicalLabels);
  if (rule1Issues.length === 0) {
    log('  No issues found.');
  } else {
    for (const issue of rule1Issues) {
      logIssue('R1', `${issue.file}`);
      logIssue('R1', `  Found: "${issue.found}"`);
      logIssue('R1', `  ${issue.detail}`);
    }
    log(`  ${rule1Issues.length} issue(s) found.`);
  }
  totalIssues += rule1Issues.length;
  log('');

  // Rule 2: Live labels with offline mode
  log('── Rule 2: Live label claimed while offline ──');
  const rule2Issues = checkLiveLabelsWithOfflineMode();
  if (rule2Issues.length === 0) {
    log('  No issues found.');
  } else {
    for (const issue of rule2Issues) {
      logIssue('R2', `${issue.file}`);
      logIssue('R2', `  Found: "${issue.found}"`);
      logIssue('R2', `  ${issue.detail}`);
    }
    log(`  ${rule2Issues.length} issue(s) found.`);
  }
  totalIssues += rule2Issues.length;
  log('');

  // Rule 3: Forbidden words
  log('── Rule 3: Forbidden words in evidence/manifests ──');
  const rule3Issues = checkForbiddenWords();
  if (rule3Issues.length === 0) {
    log('  No issues found.');
  } else {
    for (const issue of rule3Issues) {
      logIssue('R3', `${issue.file} (${issue.path})`);
      logIssue('R3', `  Found: "${issue.found}"`);
      logIssue('R3', `  Context: "${issue.context}"`);
    }
    log(`  ${rule3Issues.length} issue(s) found.`);
  }
  totalIssues += rule3Issues.length;
  log('');

  // Rule 4: Missing null fallback text
  log('── Rule 4: Missing null-field fallback text ──');
  const rule4Issues = checkMissingNullFallback();
  if (rule4Issues.length === 0) {
    log('  No issues found.');
  } else {
    for (const issue of rule4Issues) {
      logIssue('R4', `${issue.file} (${issue.path})`);
      logIssue('R4', `  ${issue.detail}`);
    }
    log(`  ${rule4Issues.length} issue(s) found.`);
  }
  totalIssues += rule4Issues.length;
  log('');

  // Summary
  log('==========================================');
  log(`Total issues: ${totalIssues}`);
  log(`  Rule 1 (label drift):          ${rule1Issues.length}`);
  log(`  Rule 2 (live label + offline): ${rule2Issues.length}`);
  log(`  Rule 3 (forbidden words):      ${rule3Issues.length}`);
  log(`  Rule 4 (missing null fallback): ${rule4Issues.length}`);
  log('');
  log('Scan complete. No files were modified. No credentials accessed. No providers called.');

  // Exit with non-zero if issues found (useful for CI)
  if (totalIssues > 0) {
    process.exit(1);
  }
}

main();
