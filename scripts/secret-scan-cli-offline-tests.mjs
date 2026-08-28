// secret-scan-cli-offline-tests.mjs — CLI integration tests for the secret scanner
//
// STATUS: OFFLINE-ONLY — ZERO PROVIDER EXECUTION
//
// These tests exercise the actual CLI entry point (scripts/secret-scan.mjs)
// as a child process, using synthetic temporary Git repositories created under
// the system temporary directory.  Each temporary repository is initialised
// with `git init`, contains only synthetic files, holds no real credentials,
// and is deleted in cleanup.
//
// Hard guarantees:
//   - Zero network code: no fetch/http/https/net/socket imports.
//   - Zero credentials read: no .env.local or secret file is touched.
//   - Zero dependencies: Node.js built-ins and local scanner module only.
//   - Deterministic: synthetic fixtures generated programmatically.
//   - Isolated: each test creates its own temp Git repo, cleaned up after.
//   - The real StitchCheck repository is never modified or scanned.

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

// ── Paths ─────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const SCANNER_PATH = join(PROJECT_ROOT, "scripts", "secret-scan.mjs");

// ── Synthetic fixture generators ──────────────────────────────────────────
// Deterministic, clearly-fake strings that match scanner patterns.
// Generated programmatically so no realistic-looking credential is hardcoded
// in this source file.

const FIXTURES = {
  /** AIza + 35 alphanumeric chars → matches "Google API key (AIza…)" */
  googleKey: () => "AIza" + "S".repeat(35),

  /** sk- + 24 alphanumeric chars → matches "Secret key (sk-…)" */
  skKey: () => "sk-" + "F".repeat(24),

  /** Bearer + 24 alphanumeric chars → matches "Bearer token" */
  bearerToken: () => "Bearer " + "T".repeat(24),

  /** AKIA + 16 uppercase/digit chars → matches "AWS access key (AKIA…)" */
  awsKey: () => "AKIA" + "A".repeat(16),

  /** PEM private key header → matches "PEM private key block" */
  pemHeader: () => "-----BEGIN RSA PRIVATE KEY-----",
};

// ── Test harness ──────────────────────────────────────────────────────────

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

/**
 * Create a temporary directory with `git init` and an initial clean commit
 * so that HEAD exists.  Returns the absolute path to the temp directory.
 */
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "secret-scan-cli-test-"));
  const exec = (cmd, args) =>
    spawnSync(cmd, args, { cwd: dir, encoding: "utf-8", stdio: "pipe" });

  exec("git", ["init"]);
  exec("git", ["config", "user.email", "test@test.com"]);
  exec("git", ["config", "user.name", "Test User"]);

  // Initial clean commit so HEAD exists (required for `git show HEAD:`).
  writeFileSync(join(dir, "README.md"), "# synthetic test repo\n");
  exec("git", ["add", "."]);
  exec("git", ["commit", "-m", "initial commit"]);

  return dir;
}

/**
 * Run the scanner CLI as a child process in the given directory.
 * Returns { status, stdout, stderr }.
 */
function runScanner(cwd, ...args) {
  const result = spawnSync("node", [SCANNER_PATH, ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

/**
 * Execute a git command in the given directory.  Throws on failure.
 */
function git(cwd, ...args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Create a temp repo, run the test function, then clean up in `finally`.
 */
function withTempRepo(fn) {
  const dir = createTempRepo();
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

console.log("secret-scan CLI integration tests\n");
console.log("=".repeat(60));

// ── 1. Default staged mode ────────────────────────────────────────────────
console.log("\n1. Default staged mode:");

test("clean staged content exits 0", () => {
  withTempRepo((dir) => {
    writeFileSync(join(dir, "README.md"), "# updated clean content\n");
    git(dir, "add", ".");
    const { status } = runScanner(dir);
    assert.strictEqual(status, 0, "expected exit 0 for clean staged content");
  });
});

test("staged synthetic secret-shaped content exits 1", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, "config.js"), `const key = '${key}';\n`);
    git(dir, "add", ".");
    const { status } = runScanner(dir);
    assert.strictEqual(status, 1, "expected exit 1 for staged secret");
  });
});

test("only added lines are scanned", () => {
  withTempRepo((dir) => {
    // Commit a clean file first.
    writeFileSync(join(dir, "app.js"), "const x = 42;\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add clean file");

    // Add a line with a synthetic secret.
    const key = FIXTURES.skKey();
    writeFileSync(join(dir, "app.js"), `const x = 42;\nconst k = '${key}';\n`);
    git(dir, "add", ".");

    const { status } = runScanner(dir);
    assert.strictEqual(status, 1, "added secret line should be detected");
  });
});

test("removed lines are not reported", () => {
  withTempRepo((dir) => {
    // Commit a file containing a synthetic secret.
    const key = FIXTURES.googleKey();
    writeFileSync(
      join(dir, "config.js"),
      `const key = '${key}';\nconst x = 42;\n`,
    );
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add config");

    // Remove the secret line and stage the change.
    writeFileSync(join(dir, "config.js"), "const x = 42;\n");
    git(dir, "add", ".");

    const { status } = runScanner(dir);
    assert.strictEqual(status, 0, "removed secret line should NOT be reported");
  });
});

test("output includes file path and finding label", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, "src-config.js"), `const key = '${key}';\n`);
    git(dir, "add", ".");

    const { stderr } = runScanner(dir);
    assert.ok(
      stderr.includes("src-config.js"),
      "output should include the file path",
    );
    assert.ok(
      stderr.includes("Google API key"),
      "output should include the finding label",
    );
  });
});

// ── 2. --all mode ─────────────────────────────────────────────────────────
console.log("\n2. --all mode:");

test("committed synthetic secret-shaped content exits 1", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.skKey();
    writeFileSync(join(dir, "secret.js"), `const k = '${key}';\n`);
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add secret file");

    const { status } = runScanner(dir, "--all");
    assert.strictEqual(status, 1, "expected exit 1 for committed secret");
  });
});

test("clean committed content exits 0", () => {
  withTempRepo((dir) => {
    const { status } = runScanner(dir, "--all");
    assert.strictEqual(
      status,
      0,
      "expected exit 0 for clean committed content",
    );
  });
});

test("raw file content is scanned without requiring + prefixes", () => {
  withTempRepo((dir) => {
    // Commit a file with a secret embedded in normal code (no diff context).
    const token = FIXTURES.bearerToken();
    writeFileSync(
      join(dir, "api.js"),
      `// normal code\nconst auth = '${token}';\nconsole.log('hello');\n`,
    );
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add api file");

    const { status, stderr } = runScanner(dir, "--all");
    assert.strictEqual(status, 1, "raw content should be scanned in --all mode");
    assert.ok(
      stderr.includes("Bearer"),
      "should detect Bearer token in raw content",
    );
  });
});

test(".env.local-named files are excluded without being opened", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, ".env.local"), `KEY=${key}\n`);
    git(dir, "add", "-f", ".env.local");
    git(dir, "commit", "-m", "add env file");

    const { status } = runScanner(dir, "--all");
    assert.strictEqual(status, 0, ".env.local should be excluded from --all scan");
  });
});

test("binary/PDF-like files are skipped", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.skKey();
    // Write secret-shaped text into a .pdf file; the extension triggers exclusion.
    writeFileSync(join(dir, "report.pdf"), `secret: ${key}\n`);
    git(dir, "add", "-f", "report.pdf");
    git(dir, "commit", "-m", "add pdf file");

    const { status } = runScanner(dir, "--all");
    assert.strictEqual(status, 0, ".pdf files should be skipped in --all mode");
  });
});

// ── 3. --working-tree mode ────────────────────────────────────────────────
console.log("\n3. --working-tree mode:");

test("unstaged added secret-shaped content exits 1", () => {
  withTempRepo((dir) => {
    // Modify a tracked file without staging.
    const key = FIXTURES.googleKey();
    writeFileSync(
      join(dir, "README.md"),
      `# title\nconst key = '${key}';\n`,
    );

    const { status } = runScanner(dir, "--working-tree");
    assert.strictEqual(status, 1, "expected exit 1 for unstaged secret");
  });
});

test("removed-only content is not reported", () => {
  withTempRepo((dir) => {
    // Commit a file with a synthetic secret.
    const key = FIXTURES.googleKey();
    writeFileSync(
      join(dir, "config.js"),
      `const key = '${key}';\nconst x = 42;\n`,
    );
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add config");

    // Remove the secret line (unstaged).
    writeFileSync(join(dir, "config.js"), "const x = 42;\n");

    const { status } = runScanner(dir, "--working-tree");
    assert.strictEqual(
      status,
      0,
      "removed-only content should NOT be reported",
    );
  });
});

test("clean working tree exits 0", () => {
  withTempRepo((dir) => {
    const { status } = runScanner(dir, "--working-tree");
    assert.strictEqual(status, 0, "expected exit 0 for clean working tree");
  });
});

test(".env* and binary files are excluded", () => {
  withTempRepo((dir) => {
    // Track .env.test and report.pdf with clean content.
    writeFileSync(join(dir, ".env.test"), "CLEAN=value\n");
    writeFileSync(join(dir, "report.pdf"), "clean content\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add env and pdf");

    // Modify both to include secrets (unstaged).
    const key = FIXTURES.skKey();
    writeFileSync(join(dir, ".env.test"), `SECRET=${key}\n`);
    writeFileSync(join(dir, "report.pdf"), `secret: ${key}\n`);

    const { status } = runScanner(dir, "--working-tree");
    assert.strictEqual(
      status,
      0,
      ".env* and binary files should be excluded in --working-tree mode",
    );
  });
});

// ── 4. --untracked mode ──────────────────────────────────────────────────
console.log("\n4. --untracked mode:");

test("untracked source-like file with synthetic secret exits 1", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, "new-config.js"), `const key = '${key}';\n`);

    const { status } = runScanner(dir, "--untracked");
    assert.strictEqual(status, 1, "expected exit 1 for untracked secret file");
  });
});

test("clean untracked source file exits 0", () => {
  withTempRepo((dir) => {
    writeFileSync(join(dir, "new-feature.js"), "const x = 42;\n");

    const { status } = runScanner(dir, "--untracked");
    assert.strictEqual(status, 0, "expected exit 0 for clean untracked file");
  });
});

test("ignored files are not scanned", () => {
  withTempRepo((dir) => {
    // Add .gitignore to ignore ignored-dir/.
    writeFileSync(join(dir, ".gitignore"), "ignored-dir/\n");
    git(dir, "add", ".");
    git(dir, "commit", "-m", "add gitignore");

    // Create a file with a secret inside the ignored directory.
    mkdirSync(join(dir, "ignored-dir"), { recursive: true });
    const key = FIXTURES.googleKey();
    writeFileSync(
      join(dir, "ignored-dir", "secret.js"),
      `const key = '${key}';\n`,
    );

    const { status } = runScanner(dir, "--untracked");
    assert.strictEqual(status, 0, "ignored files should NOT be scanned");
  });
});

test(".env.local and binary files are excluded", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, ".env.local"), `KEY=${key}\n`);
    writeFileSync(join(dir, "report.pdf"), `secret: ${key}\n`);

    const { status } = runScanner(dir, "--untracked");
    assert.strictEqual(
      status,
      0,
      ".env.local and binary files should be excluded in --untracked mode",
    );
  });
});

// ── 5. Invalid mode ──────────────────────────────────────────────────────
console.log("\n5. Invalid mode:");

test("invalid flag exits 2", () => {
  withTempRepo((dir) => {
    const { status } = runScanner(dir, "--invalid-mode");
    assert.strictEqual(status, 2, "expected exit 2 for invalid mode");
  });
});

test("error output lists valid modes", () => {
  withTempRepo((dir) => {
    const { stderr } = runScanner(dir, "--invalid-mode");
    assert.ok(stderr.includes("--staged"), "should list --staged");
    assert.ok(stderr.includes("--all"), "should list --all");
    assert.ok(
      stderr.includes("--working-tree"),
      "should list --working-tree",
    );
    assert.ok(stderr.includes("--untracked"), "should list --untracked");
  });
});

// ── 6. Output and determinism ─────────────────────────────────────────────
console.log("\n6. Output and determinism:");

test("findings include scan mode label", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey();
    writeFileSync(join(dir, "config.js"), `const key = '${key}';\n`);
    git(dir, "add", ".");

    const { stderr } = runScanner(dir);
    assert.ok(
      stderr.includes("staged changes"),
      "output should include mode label 'staged changes'",
    );
  });
});

test("repeated scans produce same exit code and equivalent output", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.skKey();
    writeFileSync(join(dir, "config.js"), `const key = '${key}';\n`);
    git(dir, "add", ".");

    const run1 = runScanner(dir);
    const run2 = runScanner(dir);

    assert.strictEqual(run1.status, run2.status, "exit codes should match");
    assert.strictEqual(run1.stderr, run2.stderr, "stderr output should match");
    assert.strictEqual(run1.stdout, run2.stdout, "stdout output should match");
  });
});

test("no secret value is printed in full (truncation)", () => {
  withTempRepo((dir) => {
    const key = FIXTURES.googleKey(); // 39 chars — well above the 16-char threshold
    writeFileSync(join(dir, "config.js"), `const key = '${key}';\n`);
    git(dir, "add", ".");

    const { stderr } = runScanner(dir);
    assert.ok(
      !stderr.includes(key),
      "full secret value should NOT appear in output",
    );
    // The truncated version (first 16 chars + horizontal ellipsis) should appear.
    const truncated = key.slice(0, 16) + "\u2026";
    assert.ok(
      stderr.includes(truncated),
      "truncated secret should appear in output",
    );
  });
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(
  `Results: ${passed} passed, ${failed} failed, ${passed + failed} total`,
);
if (failed > 0) {
  console.error(`\n${failed} test(s) failed!`);
  process.exit(1);
}
console.log("All CLI integration tests passed ✓");
