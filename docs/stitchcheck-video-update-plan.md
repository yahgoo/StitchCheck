# Video Update Plan — Post-Reconciliation

**Status:** PLAN ONLY — No video changes made in this task.
**Date:** 2026-08-22

---

## 1. Purpose

After the Nosana parser fix and live-evidence reconciliation, the existing demo video shows the old local score `0.293` while the reconciled live Nosana result is `0.2895`. This plan specifies the exact changes needed to bring the video into alignment with the verified live evidence.

---

## 2. Required Frame Changes

### Segment 4 — Risk Analysis (current: ~1:13–1:41)

| Item | Current | Required |
|------|---------|----------|
| Risk score displayed | `0.293` (local fallback) | Must visibly show `0.2895` if claiming live Nosana result |
| Source label | `Local fallback — not Nosana evidence` | If showing live evidence: `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` |
| Fallback indicator | `Fallback used: yes` | `Fallback used: no` (if showing live evidence) |
| Simulation count | May show local value | Must show `800` if displaying live Nosana result |

**Decision required:** Either (a) keep the browser walkthrough as-is with local fixture label and add a separate frame showing the reconciled Nosana evidence, or (b) rebuild the risk panel to display the live evidence directly.

### Segment 5 — Provider and Evidence Proof (current: ~1:42–2:04)

| Item | Current | Required |
|------|---------|----------|
| Nosana status text | "Nosana workload validated offline. Live Nosana execution was not verified." | "Nosana live job accepted and completed; result recovered offline. Risk score 0.2895, cost US$0.044." |
| Nosana label | Placeholder label | `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` |

### New Frame — Live Nosana Evidence (to insert)

Show the reconciled evidence artifact with:
- `riskScore: 0.2895`
- `riskBand: medium`
- `simulationCount: 800`
- `evidenceSource: nosana-evidence`
- `fallbackUsed: false`
- `costUsd: 0.044`
- Job ID: `BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY`
- IPFS result hash: `QmbCmtmcbfwRKyU8vE6axGvTMZ6YA1AWkLzVVNpYPZrNHE`

### Atlas Sandbox Evidence Frame

Keep existing Atlas Sandbox evidence frame unchanged. Label: `Atlas Sandbox — live Search/Verify`.

### Gemini Live Evidence Frame

Keep existing Gemini live evidence frame. Label: `Direct Gemini 3.7 — live validated`.

### Human-Confirmation Frame

Keep unchanged. Shows the confirmation gate with locked panels.

### Keep/Switch Frame

Keep unchanged. Shows the decision UI with fictional local data.

---

## 3. Narration Changes

### Segment 4 — Risk Analysis (current narration)

**Current:**
> "…the confirmed itinerary receives a heuristic risk score of zero point two nine three, in the medium band. … All risk analysis shown here is a local fallback — not Nosana evidence. Nosana workload validated offline. Local fallback used."

**Required (if showing live evidence):**
> "…the reconciled Nosana result shows a heuristic risk score of zero point two eight nine five, in the medium band, from 800 Monte Carlo simulations. This is an indication, not a guaranteed probability. Nosana live job completed; result validated offline."

**Required (if keeping browser walkthrough as-is):**
> "…the browser walkthrough shows a local fixture risk score of zero point two nine three. Separately, a Nosana live job was completed with a risk score of zero point two eight nine five — reconciled offline as evidence."

### Segment 5 — Provider and Evidence Proof (current narration)

**Current:**
> "…Nosana workload validated offline. Live Nosana execution was not verified. …"

**Required:**
> "…Nosana live job was accepted and completed; the result was recovered offline with a risk score of zero point two eight nine five at a cost of US$0.044. …"

---

## 4. Required Provenance Labels

| Label | Segment | When |
|-------|---------|------|
| `Direct Gemini 3.7 — live validated` | 2 Input | If showing Gemini evidence |
| `Nosana evidence — remote job succeeded; result from decentralized GPU workload.` | 4 Risk or 5 Provider | If showing reconciled Nosana evidence |
| `Local fallback — not Nosana evidence` | 4 Risk | If keeping browser walkthrough with local fixture |
| `Atlas Sandbox — live Search/Verify` | 5 Provider | When showing Atlas sandbox evidence |
| `Fictional itinerary — local demo fixture` | 2 Input | Browser walkthrough extraction |

---

## 5. Critical Constraint

The future video must **never** show the old local score `0.293` while claiming it is the live Nosana result. If the video is rebuilt, the live Nosana result must visibly show `0.2895`.

---

## 6. Expected Duration

| Segment | Current | Expected After |
|---------|---------|----------------|
| Title | 4s | 4s (unchanged) |
| 1 Hook | 16s | 16s (unchanged) |
| 2 Input | 26s | 26s (unchanged) |
| 3 Human | 24s | 24s (unchanged) |
| 4 Risk | 27s | 27–30s (may extend slightly for new narration) |
| 5 Provider | 22s | 22–25s (updated Nosana narration) |
| 6 Decision | 21s | 21s (unchanged) |
| 7 Close | 15s | 15s (unchanged) |
| Closing | 4s | 4s (unchanged) |
| **Total** | **~166s** | **~166–175s** (within 180s max) |

---

## 7. Files to Modify When Rebuilding

- `docs/hackathon-demo-script.md` — narration text (already updated in this task)
- `output/demo-artifacts/stitchcheck-video/hackathon-submission/voice/seg-04-*.txt` — Segment 4 narration text
- `output/demo-artifacts/stitchcheck-video/hackathon-submission/voice/seg-05-*.txt` — Segment 5 narration text
- `output/demo-artifacts/stitchcheck-video/hackathon-submission/voice/captions.srt` — caption timings
- Re-generate voice WAVs via Kokoro for segments 4 and 5
- Re-build video with updated frames and audio

---

## 8. Safety Confirmations for Future Rebuild

- [ ] No new Nosana submission during video rebuild
- [ ] No Gemini request during video rebuild
- [ ] No Atlas write during video rebuild
- [ ] No credentials exposed in any video asset
- [ ] Score `0.2895` shown when claiming live Nosana result
- [ ] Score `0.293` labelled as local fixture if still shown
- [ ] All provenance labels match the updated `labels.ts`
- [ ] Fallback videos preserved unchanged
