# StitchCheck Repository Hygiene Plan

> **Status:** DRAFT — not applied. No files were modified, moved, or deleted.
> **Date:** 2026-08-23
> **Scope:** `.gitignore` additions + manual-review checklist for untracked artifacts.

---

## Part 1 — Current `.gitignore` Coverage (already present)

The following items are **already ignored** and must **not** be added again:

| Rule | Line | Covers |
|------|------|--------|
| `*.key` | 53 | `Agentic AI Hackathon 2H.key` |
| `*.pptx` | 54 | `Agentic AI Hackathon 2H.pptx`, `Agentic AI Hackathon.pptx` |
| `.cursor/` | 48 | `.cursor/debug-*.log` etc. |
| `.workbuddy-ai/` | 49 | memory/ working notes |
| `.qoder/` | 50 | repowiki/, specs/ |
| `*.log` | 17 | any stray log files |
| `output/` | 45 | capture/render output directory |
| `.env` / `.env.*` / `!.env.example` | 2–4 | all env files except the example template |

---

## Part 2 — Proposed `.gitignore` Diff (snippet, NOT applied)

Append the following block after line 55 of the current `.gitignore`:

```diff
+# ── Rollback snapshots (local safety copies, not needed in repo) ──
+.rollback-*/
+
+# ── Session / memory state files ──
+*.ses
+:memory:.ses
+
+# ── Smoke-test result artifacts (may contain secrets or large evidence) ──
+smoke-tests/*/results/
+
+# ── Reference PDFs in docs (large binaries, not required to reproduce demo) ──
+# Uncomment the next line if reference PDFs are consolidated into docs/reference/:
+# docs/reference/
```

### Rules explained

| New rule | Rationale |
|----------|-----------|
| `.rollback-*/` | Covers `.rollback-2026-08-22/` and `.rollback-2026-08-22-postdiag/`; glob is future-proof for any date suffix. |
| `*.ses` | Catches `:memory:.ses` and any other `.ses` session files that may appear. |
| `:memory:.ses` | Explicit entry for the unusual colon-prefixed filename; belt-and-suspenders with `*.ses`. |
| `smoke-tests/*/results/` | Covers `smoke-tests/nosana/results/`, `smoke-tests/gemini/results/`, `smoke-tests/atlas/results/` and everything beneath them (including `evidence/` sub-dirs). |
| `docs/reference/` (commented out) | Suggested for when the owner consolidates reference PDFs per the checklist below. |

### No-duplicate confirmation

- `*.pptx` already on line 54 — **not** re-added.
- `*.key` already on line 53 — **not** re-added.
- `.env.local` is already covered by `.env.*` on line 3 — **not** touched.

---

## Part 3 — Manual Review Checklist for Owner

### 3.1 PDFs / Documents: Move to `docs/reference/` vs. delete vs. keep

#### Root-level PDFs

| File | Recommendation | Notes |
|------|---------------|-------|
| `Atlas_Flight_Booking_Skill_Qoder_User_Guide.pdf` | **Keep** → move to `docs/reference/` | Duplicate of `docs/Atlas_Flight_Booking_Skill_Qoder_User_Guide.pdf`; keep one copy only. |
| `Agentic AI Hackathon 2H.pdf` | **Keep** → `docs/reference/` | Hackathon brief / context. Already `.pptx` and `.key` are gitignored. |
| `Agentic AI Hackathon.pdf` | **Review** — likely **duplicate** of `2H` version | See §3.3 duplicate analysis. |
| `Build with Gemini Hackathon 2026 · Luma.pdf` | **Keep** → `docs/reference/` | Event participant guide. |
| `Build with Gemini Hackathon 2026 — Participant Guide.pdf` | **Keep** → `docs/reference/` | Event participant guide. |
| `Gavel - Hackathon Judging.pdf` | **Keep** → `docs/reference/` | Judging criteria reference. |
| `Gmail - Your Qoder Access Is Ready _ Alibaba Cloud x Atlas Agentic AI Hackathon.pdf` | **Keep** → `docs/reference/` | Credential/access confirmation email capture. |
| `read attached. are we on the track_ anything else.pdf` | **Delete after confirmation** | Informal prompt-capture filename; see §3.2. |
| `stitchcheck-atlas-hackathon-must-do-plan-explained.pdf` | **Keep** → `docs/reference/` | Project-specific planning document. |

#### `docs/` PDFs

| File | Recommendation | Notes |
|------|---------------|-------|
| `docs/Atlas_Flight_Booking_Skill_Qoder_User_Guide.pdf` | **Keep** in place | Duplicate of root copy; delete root copy. |
| `docs/Current progress.pdf` | **Review** — may be outdated | Snapshot of progress at a point in time; likely superseded by docs/ plans. |
| `docs/Gemini Hackathon 2026_ Official Selection Panel Evaluation Report.pdf` | **Keep** → `docs/reference/` | Useful judging context. |
| `docs/Use sandboxed Experts safely.pdf` | **Keep** → `docs/reference/` | Safety reference. |
| `docs/explain how to resolve atlas VCC and 318.pdf` | **Review** — informal prompt-capture filename | See §3.2. |
| `docs/summarize this budget plan in a table.pdf` | **Delete after confirmation** | Informal prompt-capture filename; see §3.2. |
| `docs/while i am awake then we can code with qwen3.7-plu.pdf` | **Delete after confirmation** | Informal prompt-capture filename; see §3.2. |

#### Root-level non-PDF documents

| File | Recommendation | Notes |
|------|---------------|-------|
| `Atlas_Flight_Booking_Skill_Qoder_User_Guide.docx` | **Delete after confirmation** | Duplicate of the `.pdf` version; `.docx` is the editable source but likely not needed in the submission repo. |
| `provide context to codex product design plugin to.md` | **Delete after confirmation** | Informal prompt-capture filename; see §3.2. |
| `read attached. are we on the track_ anything else.md` | **Delete after confirmation** | Informal prompt-capture filename; see §3.2. |

---

### 3.2 Files That Look Like Accidental Prompt-Captures (delete after owner confirmation)

These files have informal, conversational filenames that strongly suggest they were created by pasting a chat prompt into a file or saving a quick screen capture of a conversation. They do not belong in a professional submission repository.

| File | Reason |
|------|--------|
| `read attached. are we on the track_ anything else.md` (root) | Informal prompt filename; conversational content. |
| `read attached. are we on the track_ anything else.pdf` (root) | PDF export of the same prompt/conversation. |
| `provide context to codex product design plugin to.md` (root) | Informal instruction/prompt filename. |
| `docs/explain how to resolve atlas VCC and 318.pdf` | Informal prompt filename. |
| `docs/summarize this budget plan in a table.pdf` | Informal prompt filename; content likely superseded. |
| `docs/while i am awake then we can code with qwen3.7-plu.pdf` | Informal prompt filename; truncated model name in title. |
| `docs/Current progress.pdf` | Possibly a snapshot export; likely superseded by markdown plans in `docs/plans/`. |

---

### 3.3 Likely Duplicate Copies

| Group | Files | Recommendation |
|-------|-------|---------------|
| **Agentic AI Hackathon brief** | `Agentic AI Hackathon.pdf` (root) vs. `Agentic AI Hackathon 2H.pdf` (root) | Same event document in two versions. `2H` likely = "second half" updated version. Keep `2H`, delete the other after owner confirms. |
| **Agentic AI Hackathon slides** | `Agentic AI Hackathon.pptx` (root) vs. `Agentic AI Hackathon 2H.pptx` (root) | Same presentation in two versions. Both already gitignored by `*.pptx`. Keep `2H`, delete the other. |
| **Atlas User Guide** | `Atlas_Flight_Booking_Skill_Qoder_User_Guide.pdf` (root) vs. `docs/Atlas_Flight_Booking_Skill_Qoder_User_Guide.pdf` | Identical file (same line count: 9319). Delete root copy; keep the `docs/` copy. |
| **Atlas User Guide source** | `Atlas_Flight_Booking_Skill_Qoder_User_Guide.docx` (root) | Editable source of the PDF. Consider deleting from repo if the PDF is kept. |
| **"are we on the track" prompt** | `read attached. are we on the track_ anything else.md` + `.pdf` (root) | Same content in two formats. Both are prompt-captures; delete both after confirmation. |

---

### 3.4 Rollback Directories (already covered by proposed `.gitignore`)

| Directory | Contents | Action |
|-----------|----------|--------|
| `.rollback-2026-08-22/` | Backup copies of `config.json`, `direct-gemini-adapter.mjs`, `interactions-api-offline-tests.mjs`, `evidence-sha256.txt` | No action needed beyond `.gitignore` rule. Owner may delete manually if satisfied rollbacks are no longer needed. |
| `.rollback-2026-08-22-postdiag/` | Backup copies of `direct-gemini-adapter.mjs`, `live-interactions-verification-runner.mjs` | Same as above. |

---

## Part 4 — Confirmation

- **No files were modified, moved, or deleted.** ✓
- **No credentials or `.env.local` were accessed.** ✓ (`.env.local` was not read; it is already covered by the existing `.env.*` rule on line 3 of `.gitignore`.)
- **No provider was called.** ✓
- **This plan was not applied.** ✓

---

## Summary of Suggested Next Steps (owner action required)

1. **Apply the `.gitignore` diff** from Part 2 to the file.
2. **Confirm and delete** the 7 prompt-capture files listed in §3.2.
3. **Confirm duplicates** in §3.3 and delete the older/redundant copies.
4. **Move** remaining reference PDFs into `docs/reference/` (create the folder).
5. **Optionally** uncomment the `docs/reference/` line in `.gitignore` if those PDFs should also be excluded from version control.
