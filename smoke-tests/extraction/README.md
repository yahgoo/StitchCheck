# Gemini Smoke-Test Harness — Temporary OpenRouter Path

Label: `OpenRouter temporary path — not direct Gemini validation`.
Direct Gemini validation remains a separate hackathon-day path, and results
from the two paths are never merged or relabelled.

## Secret handling
- Place `OPENROUTER_API_KEY` only in the ignored root `.env.local`.
- Never place a key in source code, fixtures, results, evidence, reports,
  documentation, or console output.
- `.env.local` is never committed; the Saturday pre-commit gate applies.

## Offline dry-run (default)
From `smoke-tests/gemini/`, running the harness with no arguments performs
offline validation only:

    node run-smoke-test.mjs

The default run makes zero network requests, reads no key value beyond a
presence check, and writes redacted not-executed results plus an evidence
stub under `results/`.

## Execution (separate explicit approval required)
The harness accepts an explicit execution flag, but it is intentionally not
documented here as a copy-paste command. Before it may be used, a human must:
1. Place the key as described above.
2. Confirm the approved pinned model identifier in
   `provider-capabilities.json` still matches the human capability review.
3. Give explicit authorization to make external OpenRouter calls for the
   first execution round.

Without all three, execution is refused and the run stays not-executed.
One initial attempt per GEM case, at most two bounded retries, no
concurrency, and no silent model or provider switching.

## Fixtures
Synthetic fixtures live under `fixtures/` and are listed in
`fixtures/manifest.json`; all are fictional and contain no PII. Note: vision
endpoint acceptance of SVG is unverified; a runtime rejection is recorded as
an honest test outcome and may later require rasterised synthetic fixtures.

## No downstream services
This harness contains no downstream-service dependency, configuration,
endpoint, or code path of any kind. Extraction output requires explicit local
user confirmation before any downstream capability could ever exist, and no
such capability exists here.
