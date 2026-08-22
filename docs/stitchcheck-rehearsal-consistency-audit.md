# StitchCheck — Rehearsal Consistency Audit

> **Date:** 2026-08-21  
> **Scope:** Cross-check the rehearsal pack against the evidence index, submission manifest, final readiness checklist, and pitch-claim corrections.  
> **Constraint:** Read-only audit. No files outside this report were modified.

---

## Files Compared

| # | File | Role |
|---|------|------|
| 1 | `docs/stitchcheck-tomorrow-rehearsal-pack.md` | Rehearsal pack (presenter reference) |
| 2 | `docs/stitchcheck-submission-evidence-index.md` | Evidence index (source of truth for provider status) |
| 3 | `docs/stitchcheck-submission-manifest.md` | Submission manifest |
| 4 | `docs/stitchcheck-final-submission-readiness-final.md` | Final readiness checklist (most recent consolidation) |
| 5 | `docs/stitchcheck-pitch-claim-corrections-applied.md` | Pitch-claim corrections log |
| 6 | `app/src/data/labels.ts` | Code truth for on-screen labels and final statement |

---

## Checked Items — Summary

| # | Check | Verdict | Details |
|---|-------|---------|---------|
| 1 | Atlas Sandbox Search → Verify wording | **PASS** | All five documents agree: 20 offers KUL→SIN, PRICE_CONFIRMATION_REQUIRED, hard stop after Verify, no write call, environment restored to Production. |
| 2 | 20-offer count | **PASS** | Consistently "20 offers" across rehearsal pack (lines 43, 148, 219), evidence index (line 53, 100), and submission manifest (line 172). |
| 3 | PRICE_CONFIRMATION_REQUIRED | **PASS** | Exact token used consistently in rehearsal pack (lines 43, 148, 220), evidence index (lines 53, 100), and submission manifest (line 172). Price change $64.38→$203.99 also consistent. |
| 4 | No-write wording | **FINDINGS** | Three sub-issues found. See §4 below. |
| 5 | Nosana offline/live wording | **PASS** | All documents consistently state: not executed, not deployed, not authenticated, blocked before any network request, 75 offline tests. |
| 6 | OpenRouter / direct-Gemini wording | **PASS** | All documents consistently state: OpenRouter temporary path executed (GEM-01, GEM-LIVE-01), labelled accordingly; direct Gemini not executed, SDK not installed, model not approved. |
| 7 | Ticket versus candidate-checkout wording | **PASS** | "Ticketing activation pending" used consistently. "Ticket" appears only in the domain-problem context (airline tickets) or in the no-write denial list. No confusion between flight tickets and ticketing activation. |
| 8 | PII / privacy wording | **PASS** | All documents consistently state: synthetic fixtures, no PII, no credentials, no real booking references. Pitch-claim audit confirmed "fully privacy-preserving" has zero occurrences. |
| 9 | Final video path | **PASS** | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` — consistent across all five documents and confirmed present on disk. |

---

## Detailed Findings

### Finding 1 — Stale Build Module Count (Medium)

The production build module count changed from **37** to **39** across sessions. Three documents in audit scope still carry the older "37 modules" figure.

| File | Line | Stale Value | Authoritative Value |
|------|------|-------------|---------------------|
| `stitchcheck-tomorrow-rehearsal-pack.md` | 35 | "37 modules, 74 ms" | "39 modules, 70 ms" |
| `stitchcheck-submission-evidence-index.md` | 38 | "Production build passes (37 modules)" | "Production build passes (39 modules)" |
| `stitchcheck-submission-evidence-index.md` | 86 | "Production build: passed, 37 modules" | "Production build: passed, 39 modules" |

**Authoritative source:** `stitchcheck-final-submission-readiness-final.md` (line 101) and `stitchcheck-pitch-claim-corrections-applied.md` (line 100), both from the most recent consolidation pass, report **39 modules**.

**Risk:** A presenter quoting "37 modules" would state a stale number. A judge running `npm run build` would see 39.

**Note:** `stitchcheck-demo-readiness-report.md` (line 12) also shows "37 modules, 68 ms" but is outside the five-file audit scope.

---

### Finding 2 — Stale Capture Path in Rehearsal Pack (Low)

The Verified Evidence Summary in the rehearsal pack references an earlier capture directory.

| File | Line | Referenced Path | Latest Capture |
|------|------|-----------------|----------------|
| `stitchcheck-tomorrow-rehearsal-pack.md` | 37 | `output/captures/capture-2026-08-21T07-04-43/` | `output/captures/capture-2026-08-21T15-29-19/` |

The fallback section (line 348) correctly references the full voiceover video as primary fallback, which mitigates this. The capture path in the evidence summary is informational only — both captures are valid and all scenes passed in both.

**Risk:** Minimal. If a judge asks for the latest capture manifest, the path in the rehearsal pack would point to an older (but still valid) run.

---

### Finding 3 — Two-Minute Script Omits "Cancellation" from No-Write List (Low)

The 2-minute spoken script (rehearsal pack line 100) lists:
> "No booking, payment, reservation, ticket, order, or verification occurs."

Compared to the code-truth final statement in `app/src/data/labels.ts` (line 18–19):
> "No booking, payment, reservation, ticket, order, verification, **or other write action** has been created."

And the 3-minute script (rehearsal pack line 155):
> "No booking, payment, reservation, ticket, order, verification, **or other external action** occurs."

**Missing:** "cancellation" is not in any version explicitly, but the 2-minute script additionally drops the catch-all "or other write/external action" phrase, making it the narrowest denial. The 3-minute script and the code-truth label both include the catch-all.

**Risk:** A judge listening carefully might note the 2-minute denial is less comprehensive than the on-screen final statement. The on-screen text is authoritative and correct.

---

### Finding 4 — "Write Action" vs "External Action" Terminology (Low)

Two terms are used interchangeably across documents:

| Term | Used In |
|------|---------|
| "write action" | `app/src/data/labels.ts` (FINAL_STATEMENT), rehearsal pack lines 6 & 176, submission manifest section 9 line 173 |
| "external action" | Evidence index line 55, submission manifest section 10 line 173, rehearsal pack 3-minute script line 155 |

The code truth (`labels.ts`) uses **"write action"**. The evidence index uses **"external action"**. The submission manifest uses both in adjacent sections.

**Risk:** Minimal — both terms convey the same meaning. However, exact-match consistency with the on-screen label would favour "write action" throughout.

---

### Finding 5 — Stale Atlas Wording in Demo Readiness Report (Out of Scope, Noted)

`docs/stitchcheck-demo-readiness-report.md` line 43 contains:
> "Atlas production search has been executed via the official Skill CLI. (Atlas authentication succeeded; two live production searches returned real offers. **Atlas Sandbox was not used.** …)"

The bolded parenthetical ("Atlas Sandbox was not used") contradicts the evidence index, which records ATL-SBX-SV-01 (Atlas Sandbox Search + Verify) as partially succeeded. This was corrected in the submission manifest during the consolidation pass but the source statement in the readiness report was not updated.

This file is **outside the five-file audit scope** but is noted for completeness.

---

## Passing Checks — Detail

### Check 1: Atlas Sandbox Search → Verify Wording

All five documents describe ATL-SBX-SV-01 identically:
- Environment switch to Sandbox: succeeded
- Search: 20 offers KUL→SIN (2026-09-15)
- Verify: returned PRICE_CONFIRMATION_REQUIRED (price changed $64.38→$203.99)
- Hard stop after Verify; no write call made
- Environment restored to Production afterward

No document overstates or understates this evidence.

### Check 2: 20-Offer Count

Consistently "20" across:
- Rehearsal pack verified evidence table (line 43)
- Rehearsal pack 3-minute script (line 148)
- Rehearsal pack §5 (line 219)
- Evidence index claim-to-evidence matrix (line 53)
- Evidence index provider status table (line 100)
- Submission manifest disclosure (line 172)

### Check 3: PRICE_CONFIRMATION_REQUIRED

Exact token used in all relevant documents. Price change detail ($64.38→$203.99) present in rehearsal pack and evidence index; omitted from submission manifest (acceptable — the manifest references the evidence index for detail).

### Check 5: Nosana Offline/Live Wording

All documents consistently state:
- Not executed, not deployed, not authenticated
- Blocked before any network request
- Missing infrastructure: no `@nosana/kit`, no credit account, market address unverified
- 75 offline tests pass (contract shapes, sanitization, mutation rejection)
- Job definition corrected to official schema v0.1
- Approval packet ready for when human authorization is granted
- Demo panel is a local placeholder with exact label

No document implies Nosana is live or functional.

### Check 6: OpenRouter / Direct-Gemini Wording

All documents consistently state:
- GEM-01 and GEM-LIVE-01 executed via OpenRouter temporary path
- On-screen label: `OpenRouter temporary path — not direct Gemini validation`
- Interface-level evidence only; not direct Gemini validation
- Direct Gemini: not executed, SDK not installed, model not approved
- Offline: 92 tests pass

No document says "Gemini validated" or "Gemini works" without the OpenRouter qualifier.

### Check 7: Ticket vs Candidate-Checkout Wording

- "Ticketing activation" is consistently described as "pending human action at ATRIP workspace"
- "Ticket" appears in the no-write denial list (flight tickets domain) and in "no ticket was created"
- No document confuses flight-ticket domain language with ticketing-activation status
- All documents correctly state `bookable: false` and `TICKETING_ACTIVATION_REQUIRED`

### Check 8: PII / Privacy Wording

- All documents state fixtures are synthetic and fictional
- No PII, no credentials, no real booking references
- Nosana boundary enforces PII sanitization (75 offline tests)
- Pitch-claim audit confirmed "fully privacy-preserving" has zero occurrences
- No raw provider output with personal data is included

### Check 9: Final Video Path

`output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` — confirmed:
- Present on disk (file exists)
- Referenced identically in all five documents
- Duration: 131s, H.264 1920×1080, AAC 24kHz mono, ~4.0MB
- Voiceover: Kokoro ONNX v0.4.7, fully local, no external TTS call

---

## On-Screen Label Verification (Code Truth)

| # | Required Label | `labels.ts` Key | `labels.ts` Value | Match? |
|---|----------------|------------------|--------------------|--------|
| 1 | `OpenRouter temporary path — not direct Gemini validation` | `geminiExtraction` | `OpenRouter temporary path — not direct Gemini validation` | ✅ |
| 2 | `Synthetic local placeholder — not Nosana evidence` | `nosanaRisk` | `Synthetic local placeholder — not Nosana evidence` | ✅ |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | `atlasAlternatives` | `Synthetic local placeholder — not Atlas Sandbox evidence` | ✅ |
| 4 | `Confirm itinerary first` | `DISABLED_MESSAGE` | `Confirm itinerary first` | ✅ |
| 5 | Final no-write statement | `FINAL_STATEMENT` | `No booking, payment, reservation, ticket, order, verification, or other write action has been created. This is a synthetic demo only.` | ✅ |

All three required evidence labels and the final statement match between the code and the rehearsal pack's expected screen text.

---

## Summary of Findings

| # | Finding | Severity | File(s) Affected | Recommended Fix |
|---|---------|----------|-------------------|-----------------|
| 1 | Build module count stale (37 → 39) | **Medium** | Rehearsal pack line 35; Evidence index lines 38, 86 | Update to "39 modules" |
| 2 | Capture path stale | **Low** | Rehearsal pack line 37 | Update to `capture-2026-08-21T15-29-19/` |
| 3 | 2-min script omits catch-all denial phrase | **Low** | Rehearsal pack line 100 | Add "or other write action" to match on-screen FINAL_STATEMENT |
| 4 | "Write action" vs "external action" mixed | **Low** | Evidence index, submission manifest, rehearsal pack | Standardise on "write action" (matches `labels.ts`) |
| 5 | Demo readiness report: "Atlas Sandbox was not used" | **Out of scope** | `stitchcheck-demo-readiness-report.md` line 43 | Note for next pass; corrected in manifest and evidence index |

---

## Verdict

**Seven of nine checked items pass cleanly.** The two items with findings are build-statistics staleness (medium) and minor wording variations (low). No factual provider claim is overstated. No offline result is presented as live evidence. No credential or PII boundary is violated. The rehearsal pack is safe to use for the live demo with the caveat that the presenter should quote **39 modules** (not 37) if citing build statistics verbally.

---

- **Created:** 2026-08-21
- **Files read:** 6 (five docs + `labels.ts`)
- **Files modified:** 0 (this report only)
- **Findings:** 5 (1 medium, 3 low, 1 out-of-scope)
- **Provider claims overstated:** 0
- **Evidence boundary violations:** 0
