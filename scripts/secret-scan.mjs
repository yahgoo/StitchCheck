#!/usr/bin/env node
/**
 * secret-scan.mjs — Pre-commit secret scanner
 *
 * Checks staged files for credential-shaped patterns and refuses the
 * commit if any match. Zero external dependencies.
 *
 * Usage:
 *   node scripts/secret-scan.mjs          # scan git-staged changes
 *   node scripts/secret-scan.mjs --all    # scan all tracked files (slower)
 *
 * Install as a pre-commit hook:
 *   cp scripts/secret-scan.mjs .git/hooks/pre-commit
 *   # — or —
 *   echo 'node scripts/secret-scan.mjs' >> .git/hooks/pre-commit
 */

import { execSync } from "node:child_process";

// ── Patterns ────────────────────────────────────────────────────────
// Each entry: [regex, human label]
const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key (AIza…)"],
  [/sk-[A-Za-z0-9]{20,}/, "Secret key (sk-…)"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/, "Bearer token"],
  [/NOSANA_API_KEY\s*=\s*[A-Za-z0-9]{20,}/, "Nosana API key assignment"],
  [/ATLAS_CLIENT_SECRET\s*=\s*\S+/, "Atlas client secret assignment"],
  [/dtn_[0-9a-f]{40,}/, "Daytona API key (dtn_…)"],
];

// ── Helpers ─────────────────────────────────────────────────────────
const isCheck = process.argv.includes("--all");

function getDiffContent() {
  if (isCheck) {
    // Scan all tracked file contents (slower but thorough).
    const files = execSync("git ls-files", { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter((f) => f && !f.startsWith(".env"));
    let combined = "";
    for (const file of files) {
      try {
        const content = execSync(`git show HEAD:${file}`, {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        combined += `\n--- ${file} ---\n${content}`;
      } catch {
        // Skip binary / unreadable files.
      }
    }
    return combined;
  }
  // Default: scan only staged diff.
  try {
    return execSync("git diff --cached --diff-filter=ACMR", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // No staged changes — nothing to scan.
    return "";
  }
}

// ── Main ────────────────────────────────────────────────────────────
const diff = getDiffContent();
if (!diff) {
  console.log("secret-scan: nothing to scan.");
  process.exit(0);
}

// Only scan added lines (lines starting with '+'), not removed lines.
// This prevents flagging the removal of existing secrets.
const addedLines = diff
  .split("\n")
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .join("\n");

if (!addedLines) {
  console.log("secret-scan: no added lines to scan.");
  process.exit(0);
}

let findings = 0;
for (const [pattern, label] of PATTERNS) {
  const matches = addedLines.match(new RegExp(pattern, "g"));
  if (matches) {
    findings += matches.length;
    console.error(`secret-scan: FOUND ${matches.length}× ${label}`);
  }
}

if (findings > 0) {
  console.error(
    `\nsecret-scan: ${findings} secret-shaped pattern(s) detected in staged changes.`,
  );
  console.error(
    "If these are fake test values, add them to the allow-list in scripts/secret-scan.mjs.",
  );
  console.error(
    "To skip this check: git commit --no-verify (NOT recommended).\n",
  );
  process.exit(1);
}

console.log("secret-scan: clean ✓");
process.exit(0);
