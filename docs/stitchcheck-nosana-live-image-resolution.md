# StitchCheck Nosana Live Image Resolution

> **Status:** IMAGE BLOCKER RESOLVED — DOCUMENTATION ONLY
>
> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5`
>
> **Supersedes:** the container-image blocker recorded in [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) §5 and [`docs/stitchcheck-nosana-final-live-approval.md`](./stitchcheck-nosana-final-live-approval.md)

---

## 1. Old Image — Rejected

| Field | Value |
|---|---|
| Previous image | `python:3.12-slim` |
| Verdict | ❌ **REJECTED** |
| Reason | Not present in the target market's `required_images` allowlist |

The read-only preflight (2026-08-21) established that the target market enforces a `required_images` allowlist, and `python:3.12-slim` is not a member of that allowlist. A job submitted with that image would be at risk of market-side rejection.

---

## 2. Target Market

| Field | Value |
|---|---|
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| Slug | `nvidia-3060` |
| Tier | PREMIUM |
| USD reward per hour | ~US$0.0436 |
| Assigned credits | 110 |

---

## 3. Verified `required_images` Allowlist (Verbatim)

Reproduced verbatim from [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) lines 104–112:

```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
docker.io/nosana/anti-spoof:1.0.0
docker.io/vllm/vllm-openai:v0.9.2
docker.io/ollama/ollama:0.32.6
docker.io/hoomanhq/oneclickllm:ollama01
registry.hub.docker.com/ollama/ollama:0.15.4
docker.io/vllm/vllm-openai:v0.10.2
```

Observations:

- The allowlist supports **no** plain `python`, `node`, `alpine`, or `ubuntu` images.
- Only `docker.io/nosana/anti-spoof:1.0.0` is a Nosana-org image, and it is a purpose-built model image, not a general runtime.
- The same image family appears under two different registry prefixes (`docker.io/ollama/ollama:0.32.6` and `registry.hub.docker.com/ollama/ollama:0.15.4`), which indicates **exact-string matching** against fully qualified image references.

---

## 4. Verified Allowed Replacement

```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
```

This is the fully qualified image string, verbatim, as it appears in the allowlist. It is the only allowlisted image suitable as a general Python-capable runtime for the StitchCheck workload.

---

## 5. Compatibility Proof (with honest caveats)

The StitchCheck workload command is:

```
sh -c "python3 << 'PYEOF' … PYEOF"
```

and uses **only Python standard-library imports**: `json`, `os`, `sys`, `math`, `random`. No third-party packages are required.

Compatibility reasoning:

- The TensorFlow image (`tensorflow/tensorflow:2.17.0-gpu-jupyter`) is Ubuntu-based.
- It ships Python 3 (TensorFlow itself is a Python package) and a POSIX shell.
- Therefore `sh -c "python3 << …"` with stdlib-only imports is expected to execute unmodified.

**Caveats, stated honestly:**

1. Python presence is **inferred from the known base image**; the image was **not pulled or verified locally** during this task.
2. At preflight time the market's `nodes` array was **empty**, so even a compatible job may queue beyond the 120-second window (scheduling risk).
3. This is a GPU market being used for a CPU-only workload; the GPU capability is unused (cost immaterial at this price point).

---

## 6. `required_images` Enforcement Analysis

| Aspect | Finding |
|---|---|
| Enforcement location | **Market/node-side only** — a cached-resource availability mechanism |
| Checked by SDK client at submission | **No** |
| Checked by `validateJobDefinition()` | **No** — the official validator does not inspect market allowlists |
| Image string format | Must be **fully qualified** (the allowlist stores fully qualified refs; exact-string matching is indicated by the dual registry prefixes) |
| Documented semantics | Official docs describe cached image **availability**, not an explicit hard reject — see §11 |

Consequence: an allowlist violation would **not** fail client-side validation; it would only surface at market/node scheduling time. This is why the image change was made before any submission rather than relying on validation to catch it.

---

## 7. Change Applied (documented as fact; applied by the code specialist)

- `ops[0].args.image` replaced with `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter`.
- The environment-variable override of the image was **removed from the runner**, so a non-allowlisted image can never be submitted through configuration.
- The output contract is **unchanged**: `riskScore`, `riskBand`, `assumptions`, `simulationCount`, `explanation`.

No other field of the job definition changed as part of the image resolution.

---

## 8. Cost Envelope

| Parameter | Value |
|---|---|
| Expected cost for a 120-second job | **~US$0.00145** (0.0436 × 2/60) |
| Hard maximum cost | **US$10** |
| Available credits | 110 (0 reserved, 0.2 settled) |

The expected cost is orders of magnitude below the hard ceiling.

---

## 9. One-Attempt Rule

**Exactly ONE live submission attempt.** Any failure, timeout, or abnormal result stops all further attempts pending human review. No automatic retries exist in any code path.

---

## 10. Evidence Fields to Capture

Evidence must be written to a **timestamped** output path and must include:

| Evidence Field | Description |
|---|---|
| Job ID / address | `job` address returned by the post response |
| Observed states | All state transitions observed during polling |
| Latency | End-to-end duration of the job |
| Credits used | Credits reported by the post response |
| Market address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| IPFS hash — job definition | Hash returned by `client.ipfs.pin()` |
| IPFS hash — result | `ipfsResult` from the completed job |
| Sanitized result | Validated output with no credentials or PII |
| UTC timestamp | ISO 8601 |

---

## 11. UI Gating and Fallback Wording

The app may show Nosana evidence **only** after all three conditions hold:

1. Job completion.
2. Result validation.
3. Sanitized evidence creation.

Until then, labels remain fallback/synthetic. The exact fallback wording is:

- `Synthetic local placeholder — not Nosana evidence`
- `Nosana unavailable — local fallback used; not Nosana evidence`

---

## 12. Exact Stop Conditions

The live submission must be aborted (and not retried) if any of the following holds:

1. Allowlist mismatch.
2. Validation failure.
3. Timeout ambiguity.
4. Cost above the US$10 ceiling.
5. Missing credential.
6. Any wallet/IPFS/credit side effect that was not part of the approved single job post.
7. Empty market node pool persisting (scheduling risk).
8. Any unexpected error.

---

## 13. Known Risks (disclosed honestly)

| # | Risk | Detail |
|---|---|---|
| 1 | Allowlist provenance | The sole record of the allowlist is the preflight markdown; the raw `markets.list()` payload was not persisted. A separate, approved read-only re-verification before submission is **recommended but not executed** here. |
| 2 | Empty node pool | The market `nodes` array was empty at preflight; a posted job may queue past the 120 s window. |
| 3 | GPU market, CPU workload | The workload is CPU-only; GPU capability is unused (cost immaterial). |
| 4 | `required_images` semantics | Docs describe cached availability, not an explicit hard reject; the exact rejection behaviour is not fully documented. |

---

## 14. Explicit Confirmation

> This task was documentation only. No code was edited here, no tests were run, no network call was made, and no credential values were read or printed.

---

*This document is part of the StitchCheck Nosana expert approval packet.*

No live Nosana job was submitted during this task.