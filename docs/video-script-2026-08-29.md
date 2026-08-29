# StitchCheck — Demo Video Script (Timestamped Shot List, ~3:00)

Captions in brackets reference the Block 6A screenshots in
`demo-evidence/2026-08-29-submission-final/` (same images embedded in `deck/index.html`).
All numbers below are from the verified live run of 2026-08-29 — say them exactly, they are all traceable.

---

## [0:00–0:15] Cold open — Welcome screen
**Visual:** `01-welcome.png` — hold on the first screen, cursor idle.
**VO:** "A self-transfer is a bet nobody priced for the traveller. StitchCheck prices it — live, on four sponsor stacks: MiniMax M3 for extraction, Nosana for risk, Atlas Sandbox for real fares, and Daytona for sandboxed computation."

## [0:15–0:45] Upload + live extraction — Review screen
**Visual:** Click "Extract with MiniMax M3" on the Welcome screen; live on the Review screen while extraction runs; land on `02-review.png` showing the "Extracted by MiniMax M3" provenance tag.
**VO:** "This isn't a form demo — I'm handing it a screenshot of a real ticket. MiniMax M3 is reading the image right now and turning it into an editable itinerary. When it settles, the extracted fields carry a provenance tag computed from what actually ran. The UI never claims 'live' unless the evidence says live."

## [0:45–1:15] The verdict — Options screen
**Visual:** Click "Continue to alternatives"; Atlas live search runs; land on `03-options.png`.
**VO:** "Here's the verdict: a 29 out of 100 risk of this connection failing you — computed by Nosana, verified live. And right under it: 18 single-ticket alternatives that remove this risk entirely. Why do we dare put a number on it? In our Atlas evidence capture, one price-verified fare moved from 64 to 204 dollars — plus 217 percent — between Search and Verify. Fares drift. Connections fail. Now it's on screen before you board."

## [1:15–1:45] Who did what — "How this works" modal
**Visual:** Open the provider status bar detail; `04-how-this-works.png` (MiniMax M3 → Nosana → Atlas Sandbox → Daytona).
**VO:** "Four integrations, four distinct jobs. MiniMax M3: screenshot to structured itinerary. Nosana: decentralized GPU computes the risk score — a real job, IPFS-anchored evidence. Atlas Sandbox: read-only search and fare verification. Daytona: isolated sandbox where the recovery plan is computed. Each one shows its own live or replayed status."

## [1:45–2:15] Show your work — "How this was calculated"
**Visual:** Expand "See why this is risky" → "How this was calculated"; `05-how-this-was-calculated.png`.
**VO:** "And we show our work: risk band, inputs, and the Daytona sandboxed computation behind the score. You can audit exactly how 29 out of 100 was produced — no black box."

## [2:15–2:45] Ablation — why all four (spoken over Options or provider bar)
**Visual:** Re-hold `03-options.png` or `04-how-this-works.png`.
**VO:** "Remove any one and something specific dies. No MiniMax M3, no screenshot path. No Nosana, no real risk number — the headline drops to 'at risk' with no score. No Atlas, no alternatives and no fare-drift proof. No Daytona, the recovery plan is asserted, not computed. All four are load-bearing."

## [2:45–3:00] Close — judge verification line
**Visual:** Card with the command, or terminal.
**VO:** "Don't take our word for it: run `npm --prefix app run verify:offline` — zero API keys, no network, about 14 seconds, 369 assertions, all passing. StitchCheck: price the risk before you board it."

---

## Timing notes for the dry run
- Spine (never cut): extraction → risk number → alternatives (0:15–1:15).
- If over 3:00, trim in this order: ablation section (2:15–2:45 → 15 s summary), then "How this was calculated" (2:15 mark), never the close.
- Live extraction is the variable step (~6–8 s in the verified run); talk through it, don't skip.

## Dry run record (2026-08-29, DATA_MODE=live, scripted Playwright walkthrough)

- Path: `scripts/stitchcheck-submission-capture.mjs` follows this shot list exactly; all assertions PASS, gate = PASS.
- Measured interaction + navigation time (Date.now() deltas): Welcome +1.5 s → Review (live extraction) +10.4 s → Options (live search) +2.7 s → modals +1.8 s = **17.6 s total**.
- Narration budget: 3:00 − 0:18 interaction headroom ≈ 2:42 of VO over 7 sections — comfortably inside 3 minutes. No section needs cutting; keep the spine as written.
