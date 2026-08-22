# StitchCheck — Final Submission Manifest

> **Generated:** 2026-08-21
> **Purpose:** Single-file inventory of everything included in this submission.
> **Constraint:** No existing project files were created, modified, or deleted to produce this manifest.

---

## 1. Project Title

**StitchCheck** — Review before you commit.

A local React/Vite/TypeScript demo that helps budget travellers understand the hidden risk of stitching two separately purchased flight tickets with a tight connection — before they pay.

---

## 2. README

| Item | Path |
|------|------|
| Repository README | `README.md` |

---

## 3. Slide Deck

| Item | Path |
|------|------|
| Eight-slide final copy | `docs/stitchcheck-deck-final-copy.md` |
| Deck file (to be attached) | _[PLACEHOLDER — slide recording or exported PDF to be provided separately]_ |

---

## 4. Demo Video

| Item | Path / Value |
|------|------|
| Primary video (full voiceover) | `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` |
| Duration | 131.000 s |
| Resolution | 1920 × 1080 (landscape, 16:9) |
| Codec | H.264 (libx264) |
| Frame rate | 30 fps |
| File size | 4,158,844 bytes (~4.0 MB) |
| Audio | AAC (LC), 24,000 Hz, mono |
| Voiceover | Produced locally via Kokoro ONNX v0.4.7 (`af_heart`, `en-us`, speed 0.95). No external TTS call. |
| Caption-overlay fix | Applied: semi-transparent RGBA gradient band (96px), per-row alpha 0→~0.55. Validated across all 6 scenes. |
| Validation | `docs/stitchcheck-final-video-validation.md` |
| Original caption-only video (preserved) | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` (120s, ~2.8MB, no voiceover) |
| Contact sheet | `output/demo-artifacts/stitchcheck-video/contact-sheet.png` |
| Video manifest | `output/demo-artifacts/stitchcheck-video/manifest.md` |
| Captions | `output/demo-artifacts/stitchcheck-video/captions.md` |

---

## 5. Evidence Paths

### 5.1 Verified Local Behavior

| Artifact | Path |
|----------|------|
| Demo readiness report | `docs/stitchcheck-demo-readiness-report.md` |
| Acceptance checklist | `docs/react-ui-acceptance-checklist.md` |
| Evidence index | `docs/stitchcheck-submission-evidence-index.md` |
| Application source | `app/src/` |
| Labels module | `app/src/data/labels.ts` |
| Package manifest | `app/package.json` |

### 5.2 Offline Contract and Test Verification

| Artifact | Path |
|----------|------|
| Gemini offline tests (92 passed) | `smoke-tests/gemini/adapter-offline-tests.mjs` |
| Gemini extraction contract | `smoke-tests/gemini/extraction-contract.mjs` |
| Gemini schema validator | `smoke-tests/gemini/schema-validator.mjs` |
| Gemini extraction validator | `smoke-tests/gemini/extraction-validator.mjs` |
| GEM-01 results | `smoke-tests/gemini/results/results.json` |
| GEM-01 evidence stub | `smoke-tests/gemini/results/evidence-stub.md` |
| Atlas offline tests (89 passed) | `smoke-tests/atlas/adapter-offline-tests.mjs` |
| Atlas read-only adapter | `smoke-tests/atlas/read-only-atlas-adapter.mjs` |
| Atlas comparison adapter | `smoke-tests/atlas/comparison-adapter.mjs` |
| Atlas schema validator | `smoke-tests/atlas/schema-validator.mjs` |
| Atlas duplicate-booking guard (48 passed) | `smoke-tests/atlas/duplicate-booking-guard-offline-tests.mjs` |
| Atlas duplicate-booking guard module | `smoke-tests/atlas/duplicate-booking-guard.mjs` |
| Nosana client offline tests (75 passed) | `smoke-tests/nosana/nosana-client-offline-tests.mjs` |
| Nosana client module | `smoke-tests/nosana/nosana-client.mjs` |
| Nosana workload skeleton | `smoke-tests/nosana/workload-skeleton.mjs` |
| Nosana schema validator | `smoke-tests/nosana/schema-validator.mjs` |
| Nosana integration boundary | `docs/nosana-integration-boundary.md` |
| Atlas duplicate-booking protection spec | `docs/atlas-duplicate-booking-protection.md` |
| Cross-provider invariant tests | `smoke-tests/cross-provider-invariant-tests.mjs` |

### 5.3 Provider Execution Status

| Artifact | Path |
|----------|------|
| GEM-01 OpenRouter results | `smoke-tests/gemini/results/results.json` |
| Nosana blocked attempt record | `smoke-tests/nosana/results/2026-08-20T15-53-43Z/` |

### 5.4 Demo Video Artifacts

| Artifact | Path |
|----------|------|
| Video | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo.mp4` |
| Contact sheet | `output/demo-artifacts/stitchcheck-video/contact-sheet.png` |
| Scene screenshots (6 × PNG) | `output/demo-artifacts/stitchcheck-video/scene-01-locked.png` through `scene-06-keep-switch-final.png` |
| Composition HTML | `output/demo-artifacts/stitchcheck-video/composition.html` |
| Hyperframes project | `output/demo-artifacts/stitchcheck-video/stitchcheck-demo/` |

---

## 6. Gemini / OpenRouter Status

| Aspect | Status |
|--------|--------|
| Direct Gemini | **Not executed.** Pass/fail is intentionally blank. |
| OpenRouter temporary path | GEM-01 executed successfully via `google/gemini-3.7-flash`. Labelled: `OpenRouter temporary path — not direct Gemini validation`. |
| Extraction contract | Offline schema validation passes (92 offline tests, 0 failed). |
| What is proven | The extraction contract, validator, and offline regression suite are correctly implemented. |
| What is not proven | Direct Gemini API structured-output evidence does not exist. OpenRouter results are not transferable to the Gemini API. |

---

## 7. Atlas Status

| Aspect | Status |
|--------|--------|
| Authentication | Succeeded via official Atlas Flight Booking Skill (browser ATRIP authorization). |
| Live search | Two production searches: (1) PVG → Tokyo NRT/HND returned 5 real offers (2026-09-04, 1 adult); (2) SIN → BKK returned 8 real offers (ATL-LIVE-01, 2026-09-10, 1 adult). All offers are reference prices (`price_status: reference`, `bookable: false`) due to `TICKETING_ACTIVATION_REQUIRED`. Evidence: `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/atlas-live-result.md`. |
| Ticketing activation | **Pending** human action at ATRIP workspace. |
| Sandbox booking rehearsal | Not yet attempted. |
| Offline duplicate-booking guard | 48 offline tests passed. Offline-only; not live Atlas evidence. |
| Local fixtures | All labelled `Synthetic local placeholder — not Atlas Sandbox evidence`. |
| What is proven | Authentication via official Skill and CLI; live search returning real production-flight offers with normalized JSON. |
| What is not proven | No booking, payment, ticket, order, verification, or any write action was created. Production booking, payment, ticketing, and reliability remain unproven. |

---

## 8. Nosana Status

| Aspect | Status |
|--------|--------|
| Live execution | **Not executed, not deployed, not authenticated.** |
| Smoke-test attempt | Intentionally blocked before any network request (2026-08-20T15:53:43Z). Blocked record: `smoke-tests/nosana/results/2026-08-20T15-53-43Z/`. |
| Offline boundary | Credential-free, read-only validation implemented. 75 offline tests passed. |
| Local fixtures | All labelled `Synthetic local placeholder — not Nosana evidence`. |
| What is proven | Offline request-envelope construction, fixture normalization, sanitization, mutation rejection, and credential-free validation. |
| What is not proven | Authentication, deployment, funding, submission, polling, cancellation, network execution, or live provider behavior. |
| Remaining gates | Six prerequisites: (1) confirm official Nosana documentation and submission method, (2) identify target environment, (3) design and deploy risk workload, (4) implement submission adapter, (5) obtain explicit human authorization, (6) verify wallet/compute prerequisites. |

---

## 9. Known Limitations

1. **Direct Gemini is not yet executed.** Only the OpenRouter temporary path has been tested (GEM-01).
2. **Nosana smoke-test was blocked before any network request.** No reviewed workload, submission mechanism, target environment, endpoint, SDK/CLI, or deployment method exists.
3. **Atlas ticketing activation is pending.** Authentication and one production search succeeded, but no booking, payment, ticket, or order was created.
4. **All risk and alternatives scenarios in the demo are local placeholders.** They demonstrate UI states only and do not represent live service behaviour.
5. **State resets on browser refresh.** All application state is in-memory; no persistence layer exists.
6. **No automated unit-test runner is installed.** Validation relies on manual browser testing against the acceptance checklist.
7. **Full voiceover video is produced.** `output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4` (131s, H.264 1920×1080, AAC 24kHz mono, ~4.0MB). Voiceover was synthesised locally by Kokoro ONNX v0.4.7 — no external TTS call. The original caption-only video (`stitchcheck-demo.mp4`) is preserved unchanged. |
8. **Deck file is a placeholder.** The eight-slide final copy exists as markdown; the exported slide recording or PDF is to be provided separately.

---

## 10. Exact Submission Disclosure

> **This submission demonstrates a review-first local workflow and offline contract safeguards. Provider execution status is reported separately and not overstated.**
>
> - **Gemini (direct):** Not executed. Pass/fail intentionally blank.
> - **Gemini (OpenRouter temporary path):** GEM-01 succeeded. Labelled `OpenRouter temporary path — not direct Gemini validation`. Not direct Gemini validation.
> - **Nosana:** Not executed, not deployed, not authenticated. All risk data is synthetic local placeholder, labelled `Synthetic local placeholder — not Nosana evidence`.
> - **Atlas:** Authentication and two production searches succeeded (PVG→NRT/HND: 5 offers; SIN→BKK: 8 offers via ATL-LIVE-01). All reference-price only. Ticketing activation pending. No booking, payment, ticket, or order was created. Atlas Sandbox Search + Verify (ATL-SBX-SV-01) partially succeeded: 20 offers KUL→SIN, verify returned PRICE_CONFIRMATION_REQUIRED; hard stop after Verify, no write call, environment restored to Production. All alternatives data in the demo UI is synthetic local placeholder, labelled `Synthetic local placeholder — not Atlas Sandbox evidence`.
> - **No booking, payment, reservation, ticket, order, verification, cancellation, or other external action was created.** Confirmed by `noOrderCreated: true`, `syntheticDemo: true`. The demo app makes no external calls (`externalCallsMade: false`); live-demo results (OpenRouter GEM-LIVE-01, Atlas ATL-LIVE-01) are separate from the demo app and recorded at `smoke-tests/live-demo-results/2026-08-21T05-37-31Z/`.
> - **No local placeholder is presented as a live provider result.**
> - **No credential values are included in this repository.**
> - **All fixtures are synthetic, fictional, and contain no PII.**

---

## 11. Final Human Sign-Off Checklist

- [ ] README is complete and accurate (`README.md`).
- [ ] Eight-slide deck final copy is reviewed (`docs/stitchcheck-deck-final-copy.md`).
- [ ] Deck file (PDF or recording) is attached or placeholder is replaced.
- [ ] Demo video renders and plays correctly (`output/demo-artifacts/stitchcheck-video/stitchcheck-full-voiceover-proof.mp4`).
- [ ] Contact sheet is present and correct (`output/demo-artifacts/stitchcheck-video/contact-sheet.png`).
- [ ] All three required evidence labels are visible in the demo UI and video.
- [ ] Provider status claims match the evidence index (`docs/stitchcheck-submission-evidence-index.md`).
- [ ] No local placeholder is called a live result.
- [ ] No credential or secret is included.
- [ ] No PII or raw provider output is included.
- [ ] No transaction capability is claimed.
- [ ] Direct Gemini is described as not executed.
- [ ] Nosana is described as not executed, not deployed, not authenticated.
- [ ] Atlas is described with ticketing activation pending; no booking created.
- [ ] OpenRouter temporary path is labelled as not direct Gemini validation.
- [ ] Atlas duplicate-booking guard is described as offline-only.
- [ ] `noOrderCreated: true`, `syntheticDemo: true`, `externalCallsMade: false` are confirmed.
- [ ] Evidence artifacts have not been modified.
- [ ] This manifest is the only new file created for the submission.
- [ ] Human has read and approved this manifest before submission.

---

## Changed-Files Verification

| File | Action |
|------|--------|
| `docs/stitchcheck-submission-manifest.md` | **Created** (this file) |
| All other files | **Not modified** |

**Verification:** No existing project files were created, modified, or deleted. `.env.local` was not accessed. No provider calls were made.
