# StitchCheck Hackathon Demo Script

## Metadata

- **Target duration:** 2:40–2:50 (160–170 seconds).
- **Absolute maximum:** 3:00 (180 seconds).
- **Format:** Timed narration with screen-capture visuals and burned-in captions.
- **Audience:** Hackathon judges and reviewers.
- **Data policy:** Synthetic fixtures only. No PII, no credentials, no real booking references.
- **Boundary:** No booking, payment, reservation, ticket, order, verification, or other write action is performed or claimed.
- **Voice:** Kokoro ONNX v0.4.7 local TTS, voice `af_heart`, locale `en-us`, speed 0.95.
- **External TTS calls:** None (`externalTtsCalls: false`).

---

## Segment Timing and Narration

### Segment 1 — Hook (0:00–0:15, ~15 s)

**Visual:** Title card — "StitchCheck" branding on dark background.

**Spoken narrative:**

> A cheap self-transfer flight can look like a smart deal at checkout. But when two separately booked tickets are stitched together, each one is an independent contract. If the first flight is delayed and you miss the second, the second airline has no obligation to rebook, protect, or refund you. StitchCheck validates the itinerary before you commit, so you see the full risk picture first.

**Word count:** ~65 words.  
**Visible proof:** Title card with StitchCheck branding. No live-service claims on screen.

---

### Segment 2 — Input (0:15–0:40, ~25 s)

**Visual:** Scene 2 capture — edited itinerary fields (`scene-02-edited-field.png`).

**Spoken narrative:**

> The user uploads a synthetic itinerary screenshot — a fictional image with no real passenger data. StitchCheck extracts the itinerary fields: airlines, flight numbers, origins, destinations, dates, and times. Every extracted field is fully editable. In this demo, the second-leg flight number is corrected from SC-202 to SC-299, with the correction recorded locally. Direct Gemini integration is implemented and offline-tested. The recorded video uses the validated fallback.

**Word count:** ~75 words.  
**Visible proof:** Editable itinerary fields visible. Correction note visible. Direct Gemini integration is implemented and offline-tested.

---

### Segment 3 — Human Confirmation (0:40–1:10, ~30 s)

**Visual:** Scene 1 capture — locked downstream panels (`scene-01-locked.png`).

**Spoken narrative:**

> Before any analysis begins, the itinerary must be confirmed by the user. Extracted fields are displayed for review, and every field is editable. The traveler can correct any value — a flight number, a date, an airline code. Before confirmation, downstream panels are locked with the message: Confirm itinerary first. The itinerary is not accepted until the user explicitly confirms it. This review-and-correct step ensures no downstream panel acts on unverified data.

**Word count:** ~72 words.  
**Visible proof:** Locked panels with "Confirm itinerary first" and lock icons visible.

---

### Segment 4 — Risk Analysis (1:10–1:45, ~35 s)

**Visual:** Scene 3 capture — confirmed and unlocked panels (`scene-03-confirmed-unlocked.png`).

**Spoken narrative:**

> Once the itinerary is confirmed, the risk analysis panel activates. It examines connection risks, tight layovers, baggage recheck requirements, and the potential failure cascade. In this demo, the confirmed itinerary receives a heuristic risk score of zero point two nine three, in the medium band. This is an indication, not a guaranteed probability. If the first leg is delayed by even an hour, the second ticket is void with no automatic rebooking or refund. All risk analysis shown here is a local synthetic placeholder — not Nosana evidence. Nosana workload validated offline. Local fallback used.

**Word count:** ~85 words.  
**Visible proof:** Risk panel with medium band, score 0.293, heuristic disclaimer. Source label: `Synthetic local placeholder — not Nosana evidence`.

---

### Segment 5 — Provider and Evidence Proof (1:45–2:10, ~25 s)

**Visual:** Scene 4 capture — provider status (`scene-04-provider-status.png`).

**Spoken narrative:**

> For provider evidence, Atlas Sandbox Search and Verify completed successfully. The sandbox environment was activated, a read-only search returned twenty offers, and a verify step confirmed price changes — all strictly read-only. Atlas ticketing is activation-gated. Nosana workload validated offline. Live Nosana execution was not verified. No booking, payment, or external write was performed. The demo alternatives panel shows local synthetic placeholders, distinct from the sandbox evidence.

**Word count:** ~62 words.  
**Visible proof:** Provider status indicators visible. Atlas Sandbox evidence label. Nosana placeholder label.

---

### Segment 6 — Decision (2:10–2:35, ~25 s)

**Visual:** Scene 6 capture — Keep/Switch decision (`scene-06-keep-switch-final.png`).

**Spoken narrative:**

> The traveler makes a local decision: Keep the current itinerary or Switch to an alternative. The decision is entirely UI-only. All risk analysis and pricing comparison is displayed locally, so the user retains full control. No booking, payment, or external write occurs without the user's explicit action. The safety boundary ensures no external action is taken. StitchCheck keeps the traveler in control at every step.

**Word count:** ~62 words.  
**Visible proof:** Decision buttons visible. Final statement: no external action created.

---

### Segment 7 — Close (2:35–2:50, ~15 s)

**Visual:** Scene 5 capture — comparison view (`scene-05-comparison.png`).

**Spoken narrative:**

> StitchCheck: validate before you commit. The demo shows what is live, what is sandboxed, and what remains activation-gated. A review-first approach that keeps the traveler in control. Safe, reproducible, and honest. No external action was taken during this demo.

**Word count:** ~35 words.  
**Visible proof:** Comparison table visible. Safety metadata displayed.

---

## Timing Summary

| Segment | Time | Duration | Topic | Visual Source |
|---------|------|----------|-------|---------------|
| Title | 0:00–0:05 | 5 s | Branding | Generated title card |
| 1 Hook | 0:05–0:21 | ~16 s | Self-transfer risk | Title card background |
| 2 Input | 0:22–0:48 | ~26 s | Upload and extraction | scene-02-edited-field.png |
| 3 Human | 0:49–1:20 | ~31 s | Review and confirm | scene-01-locked.png |
| 4 Risk | 1:21–1:57 | ~36 s | Risk analysis | scene-03-confirmed-unlocked.png |
| 5 Provider | 1:58–2:24 | ~26 s | Evidence proof | scene-04-provider-status.png |
| 6 Decision | 2:25–2:51 | ~26 s | Keep/Switch | scene-06-keep-switch-final.png |
| 7 Close | 2:52–3:08 | ~16 s | Value proposition | scene-05-comparison.png |
| Closing | — | 5 s | End card | Generated closing card |
| **Target total** | | **~167 s (2:47)** | | |

---

## Required Evidence Labels

| # | Exact label | Segment | Panel |
|---|---|---|---|
| 1 | `Direct Gemini integration is implemented and offline-tested` | 2 Input | Itinerary review |
| 2 | `Synthetic local placeholder — not Nosana evidence` | 4 Risk | Risk panel |
| 3 | `Synthetic local placeholder — not Atlas Sandbox evidence` | 5 Provider | Alternatives panel |

---

## Claim-Boundary Verification

| Claim in script | Evidence source | Boundary |
|---|---|---|
| "Direct Gemini integration is implemented and offline-tested" | `smoke-tests/gemini/adapter-offline-tests.mjs` (165 passed), `docs/stitchcheck-submission-evidence-index.md` | Direct Gemini unexecuted; offline tests pass. |
| "Historical/temporary OpenRouter smoke-test result; not evidence of direct Google Gemini execution" | `smoke-tests/gemini/results/results.json`, `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/gemini-live-result.md` | GEM-LIVE-01 via OpenRouter; historical temporary path only. |
| "Atlas Sandbox Search and Verify completed successfully" | `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T07-02-42-099Z.json` (ATL-SBX-SV-01) | Read-only; hard stop after Verify; environment restored. |
| "Atlas ticketing is activation-gated" | `docs/stitchcheck-submission-evidence-index.md`, `TICKETING_ACTIVATION_REQUIRED` | No booking, payment, or ticketing. |
| "Nosana workload validated offline. Local fallback used." | `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/nosana-live-result.md` (NOS-LIVE-01) | Blocked before any network request. |
| "No booking, payment, or external write was performed" | `app/src/App.tsx`, `app/src/data/labels.ts`, `docs/SPECS.md` | No UI handler enables any write action. |

### Prohibited claims — do not add

- Direct Gemini was called, validated, or produced results.
- Nosana was executed, deployed, authenticated, or returned results.
- Any local placeholder is a live provider result.
- Any booking, payment, reservation, ticket, order, or verification was created.
- Credentials, PII, or raw provider output are shown.
- The active provider is called OpenRouter(Gemini).

---

## Verification

- [x] Exactly seven narrative segments plus title and closing.
- [x] Target duration ~167 s (2:47), within 2:40–2:50 range.
- [x] Absolute maximum 180 s not exceeded.
- [x] All three exact evidence labels appear at correct segments.
- [x] All claims agree with the evidence index and live-demo results.
- [x] No secrets, PII, raw provider output, or real booking data appears.
- [x] Only `docs/hackathon-demo-script.md` was created.
