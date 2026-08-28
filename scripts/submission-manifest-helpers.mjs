// StitchCheck Submission Manifest — Shared Pure Functions
//
// Pure, side-effect-free helpers shared by the manifest generator and its
// focused tests.  This module NEVER executes commands, writes files, or
// accesses credentials.  It only exports string/object parsing functions.
//
// Constraints:
//   - Does NOT read .env.local or any credential file.
//   - Does NOT call any provider.
//   - Does NOT modify any file.

import { statSync } from 'node:fs';

/**
 * Parse schema-validator style output by counting individual [PASS]/[FAIL]
 * validation lines.  Only lines beginning with the literal prefix [PASS] or
 * [FAIL] are counted — prose containing the words PASS / FAIL is ignored.
 * Returns { passed, failed } or null when no validation lines are found.
 */
export function parseSchemaValidatorOutput(text) {
  const passMatches = text.match(/^\[PASS\]/gm);
  const failMatches = text.match(/^\[FAIL\]/gm);
  const passed = passMatches ? passMatches.length : 0;
  const failed = failMatches ? failMatches.length : 0;
  if (passed === 0 && failed === 0) return null;
  return { passed, failed };
}

/**
 * Compute video freshness metadata by comparing the video modification time
 * against the newest capture-relevant source file.
 *
 * @param {object|null} latestVideoInfo    – { modificationTimestamp, modificationTimeMs } or null
 * @param {string[]}    captureSourcePaths – absolute paths of capture-relevant source files
 * @returns freshness metadata object
 */
export function computeVideoFreshness(latestVideoInfo, captureSourcePaths) {
  const result = {
    sourceNewestMtime: null,
    sourceNewestMtimeISO: null,
    videoMtime: latestVideoInfo?.modificationTimestamp || null,
    videoMtimeMs: latestVideoInfo?.modificationTimeMs || null,
    isStaleRelativeToSource: null,
    newerSourceFiles: [],
  };

  if (!latestVideoInfo) return result;
  if (!captureSourcePaths || captureSourcePaths.length === 0) return result;

  let newestSourceMs = 0;
  for (const fp of captureSourcePaths) {
    const st = statSync(fp);
    if (st.mtimeMs > newestSourceMs) newestSourceMs = st.mtimeMs;
  }

  result.sourceNewestMtime = newestSourceMs;
  result.sourceNewestMtimeISO = new Date(newestSourceMs).toISOString();
  result.isStaleRelativeToSource = latestVideoInfo.modificationTimeMs < newestSourceMs;

  if (result.isStaleRelativeToSource) {
    for (const fp of captureSourcePaths) {
      const st = statSync(fp);
      if (st.mtimeMs > latestVideoInfo.modificationTimeMs) {
        result.newerSourceFiles.push(fp);
      }
    }
  }

  return result;
}
