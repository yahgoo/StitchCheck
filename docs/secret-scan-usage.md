# Secret Scanner Usage Guide

> **Script:** `scripts/secret-scan.mjs`
> **Zero dependencies** — uses only Node.js built-ins.

## Quick Start

```bash
# Scan git-staged changes (default — used by pre-commit hook)
npm run secret-scan

# Scan ALL tracked files (full repository audit)
npm run secret-scan:all

# Scan unstaged modifications to tracked files
npm run secret-scan:working-tree

# Scan untracked files (not yet added to git)
npm run secret-scan:untracked
```

## Mode Selection Quick Reference

| Mode | npm script | What is scanned | When to use |
|------|-----------|-----------------|-------------|
| **Staged** (default) | `npm run secret-scan` | Added lines in `git diff --cached` | Before every commit (pre-commit gate) |
| **Tracked HEAD** | `npm run secret-scan:all` | Full contents of every file at `HEAD` via `git show HEAD:<file>` | Full repository audit of committed code |
| **Working-tree** | `npm run secret-scan:working-tree` | Added lines in unstaged `git diff` for tracked files | Quick check on local edits before staging |
| **Untracked** | `npm run secret-scan:untracked` | Full contents of files not yet tracked by git | Catch secrets in new files before `git add` |

> **Key distinction:** `--all` reads from the **last committed snapshot** (HEAD). It will not see uncommitted changes — staged or unstaged. To scan work in progress, use `--staged`, `--working-tree`, or `--untracked` as appropriate.

## Scan Modes

### `npm run secret-scan` (default / `--staged`)

| Aspect        | Detail |
|---------------|--------|
| **Scope**     | Only files staged for the next commit (`git diff --cached`). |
| **What it checks** | Added lines (`+` prefix) in the staged diff. |
| **Use case**  | Pre-commit gate — prevents credentials from entering a commit. |
| **Exit code** | `0` = clean, `1` = findings detected, `2` = invalid mode. |

### `npm run secret-scan:all` (`--all`)

| Aspect        | Detail |
|---------------|--------|
| **Scope**     | Every file tracked by git (`git ls-files`), full content. |
| **What it checks** | Entire file contents retrieved via `git show HEAD:<file>`. |
| **Use case**  | Full repository audit — catches secrets committed in the past. |
| **Limitation** | Reads from **HEAD** only. Uncommitted staged changes are NOT included. Files not yet committed will not be scanned. |

### `npm run secret-scan:working-tree` (`--working-tree`)

| Aspect        | Detail |
|---------------|--------|
| **Scope**     | Tracked files with unstaged modifications (`git diff --diff-filter=ACMR`). |
| **What it checks** | Added lines in the unstaged diff. |
| **Use case**  | Quick check before staging — catches secrets in working edits. |

### `npm run secret-scan:untracked` (`--untracked`)

| Aspect        | Detail |
|---------------|--------|
| **Scope**     | Files not yet tracked by git (`git ls-files --others --exclude-standard`). |
| **What it checks** | Full file contents read directly from the filesystem. |
| **Use case**  | Catches secrets in new files before `git add`. |

## Detected Pattern Categories

| Pattern | Example shape |
|---------|---------------|
| Google API key | `AIza…` (36+ chars) |
| Secret key | `sk-…` (20+ chars) |
| Bearer token | `Bearer <20+ char token>` |
| Nosana API key | `NOSANA_API_KEY = <20+ chars>` |
| Atlas client secret | `ATLAS_CLIENT_SECRET = <value>` |
| Daytona API key | `dtn_…` (40+ hex chars) |
| AWS access key | `AKIA…` (16 uppercase alphanum) |
| GitHub PAT | `ghp_…` (36 chars) |
| GitLab PAT | `glpat-…` (20+ chars) |
| PEM private key | `-----BEGIN PRIVATE KEY-----` / `-----BEGIN RSA PRIVATE KEY-----` |

## File Exclusions

The scanner **always skips** the following, regardless of mode:

- **`.env*` filenames** — `.env`, `.env.local`, `.env.production`, etc. (hard exclusion to protect credential files from being scanned and accidentally surfaced in output).
- **Binary / non-text extensions** — `.pdf`, `.pptx`, `.docx`, `.png`, `.jpg`, `.mp3`, `.mp4`, `.zip`, `.exe`, `.key`, fonts, and other non-text formats.

## Known Limitations

1. **Synthetic fixture findings** — The scanner may flag synthetic/placeholder values in test fixtures or documentation examples (e.g., example API keys in smoke-test data). These are not real secrets but match the pattern shapes. Review findings manually to distinguish real credentials from fixtures.

2. **HEAD-only `--all` mode** — The `--all` mode reads file contents from `git show HEAD:<file>`. This means:
   - Only the **last committed version** of each file is scanned.
   - Uncommitted changes (staged or unstaged) are invisible to `--all`.
   - To scan uncommitted work, use `--staged`, `--working-tree`, or `--untracked` as appropriate.

3. **No built-in allow-list mechanism** — The scanner has no built-in allow-list or ignore-list for known-safe values. If synthetic fixtures trigger findings, they must be addressed by:
   - Restructuring fixture values to not match credential patterns, or
   - Using `git commit --no-verify` to bypass the pre-commit hook (not recommended except for confirmed false positives).
   - **Note:** The CLI output may suggest "add them to the allow-list in scripts/secret-scan.mjs." This refers to a potential future feature. Currently, no allow-list exists in the scanner; the message is advisory only.

4. **Silent unreadable-file skipping** — If a file cannot be read (binary content that passes extension filtering, permission errors, encoding issues), the scanner silently skips it without warning. There is no summary of skipped files.

5. **No recursive `.env` directory exclusion** — Only filenames starting with `.env` are excluded. A directory named `.env-config/` with non-`.env`-prefixed files inside would not be excluded.

6. **Single-match-per-line per pattern** — If the same pattern matches multiple times on one line, each match is reported separately, but the line context is not shown.

## Pre-Commit Hook Installation (Manual)

> **Important:** The scanner does **not** install a pre-commit hook automatically. No git hook exists until you create one yourself using one of the methods below. Without a hook, `git commit` will proceed without any secret scanning.

### Option A — Copy as the hook script

```bash
cp scripts/secret-scan.mjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

This makes the scanner itself the pre-commit hook. It will run in `--staged` mode (the default) on every `git commit`.

### Option B — Append to an existing hook

If you already have a `.git/hooks/pre-commit` script, add this line to it:

```bash
echo 'node scripts/secret-scan.mjs' >> .git/hooks/pre-commit
```

### Option C — Symlink (auto-updates with script changes)

```bash
ln -sf ../../scripts/secret-scan.mjs .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

This symlinks to the source script, so any future updates to `scripts/secret-scan.mjs` are automatically picked up.

### Verifying the hook

After installation, stage a file and run a test commit:

```bash
git add package.json
git commit -m "test: verify pre-commit hook" --dry-run
```

If the hook is installed correctly, you will see `secret-scan: clean ✓` or a findings report before the commit proceeds.

### Bypassing the hook (emergency only)

```bash
git commit --no-verify -m "your message"
```

**Do not** use `--no-verify` to skip real findings. Only use it for confirmed false positives (e.g., synthetic fixture values that cannot be restructured).

## What the Scanner Does NOT Do

- **No pre-commit hook is installed automatically.** Running `npm run secret-scan` does not wire anything into git. The hook must be installed manually (see [Pre-Commit Hook Installation](#pre-commit-hook-installation-manual) above). Until you do, commits proceed without any secret scanning.
- **No automatic or continuous credential scanning.** The scanner is a manual, on-demand CLI tool. It does not run as a background service, a file-watcher, or a CI step unless you explicitly configure one.
- **No credential reading or exfiltration.** The scanner never opens `.env.local`, `.env`, or any `.env*` file. It never sends data over the network. It never calls any provider API.
- **No secret decryption or validation.** Findings are pattern matches only. The scanner cannot tell whether a matched string is a real, active credential or a synthetic placeholder — that requires human review.

## Safety Guarantees

- **No credentials are read from `.env.local`** or any `.env*` file.
- **No provider APIs are called** — the scanner is fully offline.
- **No network access** — uses only `git` commands and local filesystem reads.
- **Detection logic is pattern-only** — no heuristic or ML-based scanning.
- **Match output is truncated** — only the first 16 characters of each match are shown, preventing full secret leakage in logs.
