# StitchCheck Nosana Read-Only Preflight

> **Status:** READ-ONLY PREFLIGHT COMPLETE — NO JOB SUBMITTED
>
> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5`
>
> **Node:** v24.14.1

---

## 1. Approved Read-Only Calls

Two read-only SDK calls were executed with explicit human approval:

| # | SDK Method | Service | State-Creating? |
|---|---|---|---|
| 1 | `client.api.credits.balance()` | Credits | **No** — read-only balance query |
| 2 | `client.api.markets.list()` | Markets | **No** — read-only market listing |

**Neither call can create jobs, pin IPFS content, spend credits, or modify a wallet.**

---

## 2. Credit Balance

| Field | Value |
|---|---|
| Assigned credits | 110 |
| Reserved credits | 0 |
| Settled credits | 0.2 |

**Interpretation:** 110 credits are available for job submission. Well above the expected cost of the StitchCheck risk workload.

---

## 3. Market Verification

### 3.1 Configured Market Address

```
7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq
```

**Status: ✅ VALID — confirmed present in live `markets.list()` response.**

### 3.2 Market Metadata (Sanitized)

| Field | Value |
|---|---|
| Address | `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` |
| Slug | `nvidia-3060` |
| Name | NVIDIA 3060 |
| Type | PREMIUM |
| USD reward per hour | 0.0436 |
| NOS job price per second | 0.0000451 |
| Network fee percentage | 10% |
| Required images | 7 images (tensorflow, vllm, ollama, anti-spoof, oneclickllm) |
| Required remote resources | S3 (foldingAtHome models) |
| Client-only | false |
| Nodes | [] (empty at time of query) |

### 3.3 All Live Markets (Sanitized Summary)

| Slug | Type | USD/hr | Address |
|---|---|---|---|
| nvidia-8x-h100 | OTHER | (see live data) | `37VPcEfrA34vLRygFQd7bWiosBwv3a5jPv4hcXdumytC` |
| **nvidia-3060** | **PREMIUM** | **0.0436** | **`7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq`** |
| nvidia-3060-community | COMMUNITY | 0.0327 | `62bAk2ppEL2HpotfPZsscSq4CGEfY6VEqD5dQQuTo7JC` |
| nvidia-4090 | PREMIUM | 0.2909 | (see live data) |
| nvidia-5070-community | COMMUNITY | 0.1027 | `HnCwNsk1FTREgmp3BQ1A9WBE9UqzCkfPv9BybYA2y` |
| nvidia-6000-ada-community | COMMUNITY | 0.4773 | `5ZfPkACuAZgZVF1cobN4CeJdoXn2ze3azwtSv5ah9otV` |
| nvidia-h100-community | COMMUNITY | 1.0227 | `D9Pv7LthkwSYVJo5iGUPsAiosGwARj7eHTntuWFR1MK2` |
| nvidia-pro6000 | PREMIUM | 0.909 | `Ekro9NTNqLbnMkN7x7y2rY9AeTkazT1Cogz` |

**The configured market `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` is the cheapest PREMIUM market at US$0.0436/hr.**

---

## 4. Expected Cost for 120-Second Workload

| Parameter | Value |
|---|---|
| Market | NVIDIA 3060 (PREMIUM) |
| USD reward per hour | US$0.0436 |
| Job timeout | 120 seconds (2 minutes) |
| Expected cost (USD estimate) | ~US$0.00145 (0.0436 × 2/60) |
| NOS job price per second | 0.0000451 NOS |
| Expected NOS cost | ~0.00541 NOS (0.0000451 × 120) |
| Network fee | 10% (applied on top) |
| Hard ceiling | US$10 |

**The expected cost is well within the US$10 hard ceiling and within the 110 available credits.**

---

## 5. CRITICAL BLOCKER — Container Image Allowlist

### 5.1 Issue

The target market `nvidia-3060` enforces a `required_images` allowlist:

```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
docker.io/nosana/anti-spoof:1.0.0
docker.io/vllm/vllm-openai:v0.9.2
docker.io/ollama/ollama:0.32.6
docker.io/hoomanhq/oneclickllm:ollama01
registry.hub.docker.com/ollama/ollama:0.15.4
docker.io/vllm/vllm-openai:v0.10.2
```

The current StitchCheck job definition uses:

```
python:3.12-slim
```

**`python:3.12-slim` is NOT in the market's `required_images` allowlist.** The job will likely be rejected by the market if submitted as-is.

### 5.2 Resolution Options

1. **Change the container image** to one of the allowed images (e.g., `docker.io/ollama/ollama:0.32.6`) and adapt the workload command to run within that container's environment.
2. **Find or create a market** that accepts `python:3.12-slim` — but this requires market operator action and is outside our control.
3. **Adapt the workload** to run as a shell command within an allowed container that has Python available (e.g., the tensorflow image likely includes Python).

### 5.3 Recommendation

Before any live submission, the job definition's `ops[0].args.image` must be changed to an image in the market's allowlist. The most compatible option is likely `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` which includes Python 3.

---

## 6. Safety Confirmation

- **No API keys printed or persisted.** `NOSANA_API_KEY` was read from `.env.local` into `process.env` only.
- **No wallet created or modified.**
- **No job submitted.**
- **No IPFS pin created.**
- **No credits spent.**
- **No automatic retries.**
- **No Atlas, Gemini, or OpenRouter calls made.**

---

## 7. Preflight Summary

| Check | Result |
|---|---|
| SDK installed | ✅ `@nosana/kit@2.7.5` |
| Credit balance sufficient | ✅ 110 credits available |
| Market address valid | ✅ `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` confirmed in live listing |
| Market type | PREMIUM |
| Market hardware | NVIDIA 3060 |
| Expected cost (120s) | ~US$0.00145 |
| Container image compatible | ❌ **BLOCKED — `python:3.12-slim` not in market allowlist** |
| Live job approved | ❌ **Not approved — image compatibility must be resolved first** |

---

*This document is part of the StitchCheck Nosana expert approval packet.*
