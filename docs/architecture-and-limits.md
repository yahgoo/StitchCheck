# StitchCheck — Provider Ablation & Honest Limits (2026-08-29)

## Ablation — what breaks if each provider is removed

- **MiniMax M3 (extraction):** No screenshot → structured itinerary. The Review screen can't
  populate editable flight/date fields from an uploaded ticket image; only the ready-made
  sample path (`Use sample — no extraction`) survives. Provenance tag
  "Extracted by MiniMax M3" and the loading state have no source.
- **Nosana (risk analysis):** No heuristic connection-risk band/score. `riskScore` and
  `riskBand` fall back to `local-fallback` (or `unavailable`), so the Options headline has no
  real number to render and drops to the "Your connection is at risk" fallback — the quantified
  risk (the core value) is gone.
- **Atlas Sandbox (search):** No alternative offers. `searchResult.alternatives` is empty, the
  "{n} single-ticket alternatives that remove this risk" line disappears, and there is no
  Search→Verify fare-drift evidence (e.g. the +217% metric in `docs/quantified-metric-2026-08-29.md`).
- **Daytona (risk computation / recovery):** No sandboxed computation of the recovery plan and
  the "How this was calculated" detail. The RecoveryPlanAnimation and `howCalculated` block lose
  their execution substrate; risk would be asserted, not computed in isolation.

## Honest limits (framed as design decisions)

- **Offline-reconciled by default.** The browser demo ships deterministic local fixtures; the
  default provenance is "replayed evidence", not "verified live". The UI never labels a
  replayed screen as live.
- **`DATA_MODE=live` gate.** Live provider calls only run behind the explicit `DATA_MODE=live`
  flag; the shipped/proxied default keeps sockets off.
- **Provenance is state-derived.** "— verified live" vs "— replayed evidence" and every
  `Source:` tag are computed from real `evidenceSource`/`fallbackUsed`/`executed`, never
  hardcoded and never inferred from the global mode alone.
- **Read-only safety boundary.** No booking, payment, reservation, order, or ticketing write.
  Atlas stops hard after Verify (`AFTER_VERIFY`).
- **Mock-ticketing branch is separate.** `feature/atlas-sandbox-mock-ticketing` and its
  `TICKETING_ACTIVATION_REQUIRED` gate are unmerged and activation-gated — not part of this
  demo's executed path.
- **No invented metrics.** Every figure (e.g. +217%) traces to a named evidence file and offer
  ID; single-verify results are described as single-verify, not extrapolated.
