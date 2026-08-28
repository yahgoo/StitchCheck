#!/usr/bin/env node
/**
 * secret-scan.mjs — Pre-commit / pre-push secret scanner
 *
 * Checks for credential-shaped patterns and refuses the operation if any
 * match.  Zero external dependencies.
 *
 * Usage:
 *   node scripts/secret-scan.mjs                # scan git-staged changes (default)
 *   node scripts/secret-scan.mjs --all          # scan ALL tracked file contents
 *   node scripts/secret-scan.mjs --working-tree # scan unstaged modifications
 *   node scripts/secret-scan.mjs --untracked    # scan untracked files
 *
 * Install as a pre-commit hook:
 *   cp scripts/secret-scan.mjs .git/hooks/pre-commit
 *   # — or —
 *   echo 'node scripts/secret-scan.mjs' >> .git/hooks/pre-commit
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// ── Patterns ────────────────────────────────────────────────────────
// Each entry: [regex, human label]
const PATTERNS = [
  [/AIza[0-9A-Za-z_-]{35}/, "Google API key (AIza…)"],
  [/sk-[A-Za-z0-9]{20,}/, "Secret key (sk-…)"],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/, "Bearer token"],
  [/NOSANA_API_KEY\s*=\s*[A-Za-z0-9]{20,}/, "Nosana API key assignment"],
  [/ATLAS_CLIENT_SECRET\s*=\s*\S+/, "Atlas client secret assignment"],
  [/dtn_[0-9a-f]{40,}/, "Daytona API key (dtn_…)"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key (AKIA…)"],
  [/ghp_[A-Za-z0-9]{36}/, "GitHub personal access token (ghp_…)"],
  [/glpat-[A-Za-z0-9_-]{20,}/, "GitLab personal access token (glpat-…)"],
  [/-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/, "PEM private key block"],
];

// ── Exclusion helpers ───────────────────────────────────────────────
// Extensions skipped in EVERY mode (binary / large / non-text).
const SKIP_EXTENSIONS = new Set([
  // Documents
  ".pdf", ".pptx", ".ppt", ".docx", ".doc",
  // Images
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
  // Audio / video
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm", ".ogg",
  // Archives
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  // Native binaries
  ".exe", ".dll", ".so", ".dylib",
  // Fonts
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  // Presentation (Apple Keynote)
  ".key",
]);

/**
 * Return true if `filePath` must never be scanned regardless of mode.
 *  - Any `.env*` filename  (hard secret-exclusion rule)
 *  - Binary / large / non-text extension
 */
export function isExcludedFilename(filePath) {
  const name = basename(filePath);
  // Hard-exclude .env* filenames (.env, .env.local, .env.production, …)
  if (name.startsWith(".env")) return true;
  // Skip by extension
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx >= 0) {
    const ext = name.slice(dotIdx).toLowerCase();
    if (SKIP_EXTENSIONS.has(ext)) return true;
  }
  return false;
}

// ── Core scanning functions (exported for offline tests) ────────────

/**
 * Scan raw text content against all secret patterns.
 * Returns an array of { file, label, match } objects.
 */
export function scanRawContent(content, filePath) {
  const findings = [];
  for (const [pattern, label] of PATTERNS) {
    const re = new RegExp(pattern.source, "g");
    const matches = content.match(re);
    if (matches) {
      for (const m of matches) {
        findings.push({
          file: filePath,
          label,
          match: m.length > 16 ? m.slice(0, 16) + "…" : m,
        });
      }
    }
  }
  return findings;
}

/**
 * Scan a unified-diff string, extracting only added lines per file.
 * Respects `.env*` / binary extension exclusions per file.
 */
export function scanDiff(diffText) {
  const findings = [];
  // Split into per-file sections on "diff --git " boundaries.
  const sections = diffText.split(/^diff --git /m).filter(Boolean);
  for (const section of sections) {
    // Extract destination file path from "b/<path>" in the header line.
    const headerMatch = section.match(/b\/(\S+)/);
    const filePath = headerMatch ? headerMatch[1] : "(unknown)";
    if (isExcludedFilename(filePath)) continue;

    // Only scan added lines (prefix "+", but not the "+++" header).
    const addedLines = section
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");
    if (!addedLines) continue;

    findings.push(...scanRawContent(addedLines, filePath));
  }
  return findings;
}

// Re-export PATTERNS so tests can verify coverage.
export { PATTERNS };

// ── Mode detection ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const mode = args.find((a) => a.startsWith("--")) || "--staged";
const VALID_MODES = ["--all", "--working-tree", "--untracked", "--staged"];

const MODE_LABELS = {
  "--staged": "staged changes",
  "--all": "all tracked files",
  "--working-tree": "unstaged modifications",
  "--untracked": "untracked files",
};

// ── Main (only when executed directly, NOT when imported) ───────────
const isMainModule = resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  if (!VALID_MODES.includes(mode)) {
    console.error(
      `secret-scan: unknown mode '${mode}'. Valid: ${VALID_MODES.join(", ")}`,
    );
    process.exit(2);
  }

  let allFindings = [];

  switch (mode) {
    // ── --all: scan every tracked file's full content ──────────────
    case "--all": {
      let files;
      try {
        files = execSync("git ls-files", { encoding: "utf-8" })
          .trim()
          .split("\n")
          .filter(Boolean);
      } catch {
        files = [];
      }
      files = files.filter((f) => !isExcludedFilename(f));
      for (const file of files) {
        try {
          const content = execSync(`git show HEAD:${file}`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          allFindings.push(...scanRawContent(content, file));
        } catch {
          // Skip binary / unreadable files silently.
        }
      }
      break;
    }

    // ── --working-tree: scan unstaged modifications to tracked files ─
    case "--working-tree": {
      try {
        const diff = execSync("git diff --diff-filter=ACMR", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        allFindings = scanDiff(diff);
      } catch {
        // No unstaged changes — nothing to scan.
      }
      break;
    }

    // ── --untracked: scan files not yet tracked by git ─────────────
    case "--untracked": {
      let files;
      try {
        files = execSync("git ls-files --others --exclude-standard", {
          encoding: "utf-8",
        })
          .trim()
          .split("\n")
          .filter(Boolean);
      } catch {
        files = [];
      }
      files = files.filter((f) => !isExcludedFilename(f));
      for (const file of files) {
        try {
          const content = readFileSync(file, { encoding: "utf-8" });
          allFindings.push(...scanRawContent(content, file));
        } catch {
          // Skip binary / unreadable files silently.
        }
      }
      break;
    }

    // ── default (--staged): scan only staged diff ──────────────────
    default: {
      try {
        const diff = execSync("git diff --cached --diff-filter=ACMR", {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        allFindings = scanDiff(diff);
      } catch {
        // No staged changes — nothing to scan.
      }
      break;
    }
  }

  // ── Output ──────────────────────────────────────────────────────
  const scopeLabel = MODE_LABELS[mode];

  if (allFindings.length === 0) {
    console.log(`secret-scan: clean ✓ — scanned ${scopeLabel}`);
    process.exit(0);
  }

  // Group findings by pattern label for summary output.
  const grouped = {};
  for (const f of allFindings) {
    if (!grouped[f.label]) grouped[f.label] = [];
    grouped[f.label].push(f);
  }

  for (const [label, items] of Object.entries(grouped)) {
    console.error(`secret-scan: FOUND ${items.length}× ${label}`);
    for (const item of items) {
      console.error(`  in ${item.file}: ${item.match}`);
    }
  }

  console.error(
    `\nsecret-scan: ${allFindings.length} secret-shaped pattern(s) detected in ${scopeLabel}.`,
  );
  console.error(
    "If these are fake test values, add them to the allow-list in scripts/secret-scan.mjs.",
  );
  console.error(
    "To skip this check: git commit --no-verify (NOT recommended).\n",
  );
  process.exit(1);
}
