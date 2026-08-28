// secret-scan-offline-tests.mjs — Offline tests for the secret scanner
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests verify the secret scanner's core logic using synthetic
// in-memory fixtures. No real secrets, no real repo state, no git required.
//
// Hard guarantees:
//   - Zero network code: no fetch/http/https/net/socket imports.
//   - Zero credentials read: no .env or secret file is touched.
//   - Zero dependencies: Node.js built-ins and local module only.
//   - Deterministic: no randomness, no timing, no external calls.

import assert from "node:assert";
import {
  scanRawContent,
  scanDiff,
  isExcludedFilename,
  PATTERNS,
} from "./secret-scan.mjs";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${error.message}`);
  }
}

console.log("secret-scan offline tests\n");

// ── 1. --all mode: detects secret-shaped strings in raw content ─────
console.log("--all mode (raw content scanning):");

test("detects Google API key pattern in file content", () => {
  // Synthetic 35-char suffix after AIza — not a real key.
  const content = "const key = 'AIzaSYNFaKEfOrTeStInG1234567890abcDEFGH';";
  const findings = scanRawContent(content, "src/config.js");
  assert.ok(findings.length > 0, "should find at least one match");
  assert.ok(
    findings.some((f) => f.label.includes("Google API key")),
    "should label as Google API key",
  );
  assert.strictEqual(findings[0].file, "src/config.js");
});

test("detects sk- secret key pattern", () => {
  const content = "OPENAI_KEY=sk-FaKeKeYfOrTeStInGx1234567890abcd";
  const findings = scanRawContent(content, "config.ts");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("Secret key")));
});

test("detects Bearer token pattern", () => {
  const content =
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.fakepayloadvalue";
  const findings = scanRawContent(content, "api.js");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("Bearer")));
});

test("detects AWS access key pattern (AKIA)", () => {
  const content = "AWS_ACCESS_KEY_ID=AKIAFAKEKEY1234567890";
  const findings = scanRawContent(content, "config.js");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("AWS")));
});

test("detects GitHub PAT pattern (ghp_)", () => {
  const content = "GITHUB_TOKEN=ghp_FaKeToKeNfOrTeStInGx1234567890abcDEF";
  const findings = scanRawContent(content, "ci.yml");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("GitHub")));
});

test("detects GitLab PAT pattern (glpat-)", () => {
  const content = "GITLAB_TOKEN=glpat-FaKeToKeNfOrTeStInG1234567";
  const findings = scanRawContent(content, "ci.yml");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("GitLab")));
});

test("detects PEM private key block header", () => {
  const content =
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
  const findings = scanRawContent(content, "server.pem");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("PEM")));
});

test("detects Daytona key pattern (dtn_)", () => {
  const content =
    "DAYTONA_KEY=dtn_0123456789abcdef0123456789abcdef01234567";
  const findings = scanRawContent(content, "config.js");
  assert.ok(findings.length > 0);
  assert.ok(findings.some((f) => f.label.includes("Daytona")));
});

test("clean content produces zero findings", () => {
  const content = "const x = 42;\nconsole.log('hello world');";
  const findings = scanRawContent(content, "app.js");
  assert.strictEqual(findings.length, 0);
});

// ── 2. --all mode: .env.local exclusion ─────────────────────────────
console.log("\n--all mode (.env exclusion):");

test(".env.local is excluded from scanning", () => {
  assert.ok(isExcludedFilename(".env.local"));
});

test(".env is excluded from scanning", () => {
  assert.ok(isExcludedFilename(".env"));
});

test(".env.production is excluded from scanning", () => {
  assert.ok(isExcludedFilename(".env.production"));
});

test(".env.example is also excluded (safe hard-rule)", () => {
  assert.ok(isExcludedFilename(".env.example"));
});

test("path with .env.local basename is excluded", () => {
  assert.ok(isExcludedFilename("some/deep/path/.env.local"));
});

test("normal source files are NOT excluded", () => {
  assert.ok(!isExcludedFilename("src/config.js"));
  assert.ok(!isExcludedFilename("README.md"));
  assert.ok(!isExcludedFilename("scripts/secret-scan.mjs"));
});

// ── 3. --working-tree mode: detects synthetic unstaged change ───────
console.log("\n--working-tree mode (diff scanning):");

test("detects secret in a synthetic unstaged diff", () => {
  const syntheticDiff = [
    "diff --git a/src/config.js b/src/config.js",
    "index 1234567..abcdefg 100644",
    "--- a/src/config.js",
    "+++ b/src/config.js",
    "@@ -1,3 +1,4 @@",
    " const x = 42;",
    "+const key = 'AIzaSYNFaKEfOrTeStInG1234567890abcDEFGH';",
    " console.log(x);",
  ].join("\n");
  const findings = scanDiff(syntheticDiff);
  assert.ok(findings.length > 0, "should find secret in added diff line");
  assert.strictEqual(findings[0].file, "src/config.js");
  assert.ok(findings[0].label.includes("Google API key"));
});

test("diff scanning ignores removed lines (only scans '+' lines)", () => {
  const syntheticDiff = [
    "diff --git a/src/config.js b/src/config.js",
    "index 1234567..abcdefg 100644",
    "--- a/src/config.js",
    "+++ b/src/config.js",
    "@@ -1,3 +1,2 @@",
    "-const key = 'AIzaSYNFaKEfOrTeStInG1234567890abcDEFGH';",
    " const x = 42;",
  ].join("\n");
  const findings = scanDiff(syntheticDiff);
  assert.strictEqual(findings.length, 0, "removed lines must not trigger findings");
});

test("diff scanning skips .env files in diff", () => {
  const syntheticDiff = [
    "diff --git a/.env.local b/.env.local",
    "index 1234567..abcdefg 100644",
    "--- a/.env.local",
    "+++ b/.env.local",
    "@@ -1 +1,2 @@",
    "+SECRET_KEY=sk-FaKeKeYfOrTeStInGx1234567890abcd",
  ].join("\n");
  const findings = scanDiff(syntheticDiff);
  assert.strictEqual(findings.length, 0, ".env files must be skipped in diff mode");
});

test("diff scanning skips binary-extension files", () => {
  const syntheticDiff = [
    "diff --git a/report.pdf b/report.pdf",
    "index 1234567..abcdefg 100644",
    "--- a/report.pdf",
    "+++ b/report.pdf",
    "@@ -1 +1,2 @@",
    "+sk-FaKeKeYfOrTeStInGx1234567890abcd",
  ].join("\n");
  const findings = scanDiff(syntheticDiff);
  assert.strictEqual(findings.length, 0, "binary-extension files must be skipped");
});

// ── 4. --untracked mode: detects untracked file, skips .env* ───────
console.log("\n--untracked mode (untracked file scanning):");

test("detects secret in untracked file content", () => {
  const content = "GOOGLE_API=AIzaSYNFaKEfOrTeStInG1234567890abcDEFGH";
  const findings = scanRawContent(content, "new-config.js");
  assert.ok(findings.length > 0, "should detect secret in untracked file");
});

test("untracked file list filters out .env* files", () => {
  // Simulate the filtering that --untracked mode applies.
  const fakeUntracked = [
    "new-feature.js",
    ".env.local",
    ".env",
    "notes.md",
    ".env.production",
  ];
  const filtered = fakeUntracked.filter((f) => !isExcludedFilename(f));
  assert.deepStrictEqual(filtered, ["new-feature.js", "notes.md"]);
});

test("untracked file list filters out binary/PDF/PPTX/images", () => {
  const fakeUntracked = [
    "new-feature.js",
    "screenshot.png",
    "report.pdf",
    "slides.pptx",
    "photo.jpg",
    "data.csv",
    "font.woff2",
  ];
  const filtered = fakeUntracked.filter((f) => !isExcludedFilename(f));
  assert.deepStrictEqual(filtered, ["new-feature.js", "data.csv"]);
});

// ── 5. Binary/PDF-like extensions skipped without throwing ──────────
console.log("\nBinary / large-file extension skipping:");

test("PDF extension is excluded", () => {
  assert.ok(isExcludedFilename("document.pdf"));
});

test("PPTX extension is excluded", () => {
  assert.ok(isExcludedFilename("presentation.pptx"));
});

test("Image extensions are excluded", () => {
  assert.ok(isExcludedFilename("photo.png"));
  assert.ok(isExcludedFilename("photo.jpg"));
  assert.ok(isExcludedFilename("photo.jpeg"));
  assert.ok(isExcludedFilename("icon.gif"));
  assert.ok(isExcludedFilename("icon.svg"));
  assert.ok(isExcludedFilename("icon.webp"));
});

test("Font extensions are excluded", () => {
  assert.ok(isExcludedFilename("font.woff"));
  assert.ok(isExcludedFilename("font.woff2"));
  assert.ok(isExcludedFilename("font.ttf"));
  assert.ok(isExcludedFilename("font.otf"));
});

test("Archive extensions are excluded", () => {
  assert.ok(isExcludedFilename("archive.zip"));
  assert.ok(isExcludedFilename("archive.gz"));
  assert.ok(isExcludedFilename("archive.tar"));
});

test("Keynote extension is excluded", () => {
  assert.ok(isExcludedFilename("slides.key"));
});

test("scanRawContent does not throw on binary-like content", () => {
  // Simulate binary-ish content (non-UTF8-like bytes as string).
  const binaryish = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]).toString("latin1");
  assert.doesNotThrow(() => scanRawContent(binaryish, "fake.bin"));
  // Should find nothing because no pattern matches binary noise.
  const findings = scanRawContent(binaryish, "fake.bin");
  assert.strictEqual(findings.length, 0);
});

// ── Pattern coverage sanity check ───────────────────────────────────
console.log("\nPattern coverage:");

test("all expected pattern categories are present", () => {
  const labels = PATTERNS.map(([, label]) => label);
  const expected = [
    "Google API key",
    "Secret key",
    "Bearer token",
    "Nosana API key",
    "Atlas client secret",
    "Daytona API key",
    "AWS access key",
    "GitHub personal access token",
    "GitLab personal access token",
    "PEM private key",
  ];
  for (const exp of expected) {
    assert.ok(
      labels.some((l) => l.includes(exp)),
      `missing pattern category: ${exp}`,
    );
  }
});

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error(`\n${failed} test(s) failed!`);
  process.exit(1);
}
console.log("All tests passed ✓");
