# StitchCheck Nosana Container Image Resolution

> **Status:** AUDIT COMPLETE — RESOLUTION IDENTIFIED, NOT YET APPLIED
>
> **Date:** 2026-08-21
>
> **Scope:** Container image blocker only. No other Nosana subsystems changed.
>
> **Constraint:** No Nosana calls, no package installs, no job submissions, no credits spent. No Atlas, Gemini, UI, deck, or video files modified.

---

## 1. Verified `required_images` Allowlist

**Source:** Live read-only `client.api.markets.list()` executed during the approved preflight (see [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) §5.1).

**Market:** `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` (slug: `nvidia-3060`, type: PREMIUM).

| # | Fully Qualified Image | Notes |
|---|---|---|
| 1 | `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` | Python 3 included; Jupyter environment |
| 2 | `docker.io/nosana/anti-spoof:1.0.0` | Nosana anti-spoof verification; likely minimal |
| 3 | `docker.io/vllm/vllm-openai:v0.9.2` | vLLM inference server; Python-based but specialised |
| 4 | `docker.io/ollama/ollama:0.32.6` | Go binary; no Python |
| 5 | `docker.io/hoomanhq/oneclickllm:ollama01` | Ollama wrapper; no Python expected |
| 6 | `registry.hub.docker.com/ollama/ollama:0.15.4` | Go binary; no Python |
| 7 | `docker.io/vllm/vllm-openai:v0.10.2` | vLLM inference server; Python-based but specialised |

---

## 2. Image Selection Analysis

### Workload Requirements

The StitchCheck risk workload needs:

- **Python 3** interpreter (the script uses `json`, `os`, `sys`, `math`, `random` — stdlib only).
- **Bash** or POSIX shell (for the heredoc `python3 << 'PYEOF' ... PYEOF`).
- **No GPU libraries** needed at runtime (the script is pure CPU arithmetic).
- **No pip packages** needed (stdlib only).
- **Execution time:** < 5 seconds of actual compute within a 120-second timeout.

### Candidate Evaluation

| Image | Python 3? | Suitable? | Rationale |
|---|---|---|---|
| `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` | **Yes** (Python 3.10+) | **✅ YES** | Full Python environment; bash available; Jupyter implies robust shell support. |
| `docker.io/nosana/anti-spoof:1.0.0` | Unknown | ❌ Unlikely | Purpose-built for anti-spoof verification; minimal surface. |
| `docker.io/vllm/vllm-openai:v0.9.2` | Yes (Python-based) | ❌ Not recommended | Specialised LLM inference server; ENTRYPOINT may override `cmd`; large image. |
| `docker.io/ollama/ollama:0.32.6` | **No** (Go binary) | ❌ No | No Python interpreter available. |
| `docker.io/hoomanhq/oneclickllm:ollama01` | **No** (Ollama-based) | ❌ No | Ollama wrapper; no Python expected. |
| `registry.hub.docker.com/ollama/ollama:0.15.4` | **No** (Go binary) | ❌ No | No Python interpreter available. |
| `docker.io/vllm/vllm-openai:v0.10.2` | Yes (Python-based) | ❌ Not recommended | Same concerns as v0.9.2. |

### Selected Image

```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
```

**Rationale:**
- Only image in the allowlist that is a general-purpose Python environment.
- TensorFlow images include Python 3 (typically 3.10 for the 2.17.0 tag), bash, and standard Unix utilities.
- The workload's Python script uses only stdlib modules (`json`, `os`, `sys`, `math`, `random`), all of which are present in any Python 3 installation.
- No GPU calls are made; the script runs purely on CPU. The GPU-enabled image is larger but is the only compatible option in the allowlist.

---

## 3. Python vs Node — Workload Language Determination

**The workload requires Python.** The risk calculation script (`PYTHON_RISK_SCRIPT` in `nosana-risk-runner.m`) is a Python script that:

1. Reads `RISK_INPUT_DATA` and `HISTORICAL_DELAY_DATA` from environment variables.
2. Parses JSON using Python's `json` module.
3. Performs Monte Carlo simulation using `random.gauss()`.
4. Outputs a single JSON line via `print(json.dumps(result))`.

**Node.js cannot run this script** — it is Python syntax, not JavaScript.

**Could the workload be rewritten in Node.js?** Yes, the logic is simple enough. However:

- The `ollama` images (the only non-Python options) are Go binaries designed to serve LLM inference, not execute arbitrary shell commands. Their `ENTRYPOINT` is the `ollama` binary, which would not accept a shell script.
- The `vllm` images similarly have a Python-based ENTRYPOINT for serving models.
- Even if Node.js were available in one of these images, the heredoc command pattern would need complete restructuring.

**Conclusion:** Python is the correct language for this workload. The tensorflow image is the only compatible choice.

---

## 4. Fully Qualified Image Name

**Yes, the fully qualified name is required.**

The market's `required_images` allowlist uses fully qualified references. The Nosana container runtime performs an exact string match between the job definition's `ops[].args.image` and the market's allowlist entries.

| Form | Matches allowlist? |
|---|---|
| `python:3.12-slim` | ❌ Not in allowlist |
| `tensorflow/tensorflow:2.17.0-gpu-jupyter` | ❌ Missing registry prefix |
| `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` | **✅ Exact match with allowlist entry #1** |

**The image field must use the exact string from the allowlist:**
```
docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
```

---

## 5. Exact Minimal Code Changes Required

**Only one file changes:** `smoke-tests/nosana/nosana-risk-runner.mjs`

**Three lines change** (all are string literal updates; no logic, structure, or behaviour changes):

### Change 1 — Line 50 (comment)

```diff
- // Container image: python:3.12-slim
+ // Container image: docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter
```

### Change 2 — Line 152 (image field in `buildRiskJobDefinition()`)

```diff
-          image: "python:3.12-slim",
+          image: "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
```

### Change 3 — Line 362 (fallback in `jobMetadata.containerImage`)

```diff
-          containerImage: jobDef.ops?.[0]?.args?.image || "python:3.12-slim",
+          containerImage: jobDef.ops?.[0]?.args?.image || "docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter",
```

### No other files change

| File | Change? | Reason |
|---|---|---|
| `smoke-tests/nosana/nosana_run_job.mjs` | **No** | Does not reference the image string. |
| `smoke-tests/nosana/run-risk-job.mjs` | **No** | Does not reference the image string. |
| `smoke-tests/nosana/nosana-client.mjs` | **No** | Offline boundary; no image reference. |
| `smoke-tests/nosana/schema-validator.mjs` | **No** | Validates input/output shape, not image. |
| `smoke-tests/nosana/workload-skeleton.mjs` | **No** | Local simulator; no image reference. |
| `smoke-tests/nosana/nosana-client-offline-tests.mjs` | **No** | Tests offline boundary. |
| `app/` (any file) | **No** | UI does not reference container image. |
| `docs/` (any other file) | **No** | Documentation updated separately. |
| Deck/video/media files | **No** | Out of scope. |

---

## 6. Command Validity

**The existing command remains valid.**

The current command is:

```bash
python3 << 'PYEOF'
import json, os, sys, math, random
... (risk script) ...
print(json.dumps(result))
PYEOF
```

### Compatibility with tensorflow image

| Requirement | `python:3.12-slim` | `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` |
|---|---|---|
| `python3` binary in PATH | ✅ | ✅ (Python 3.10+) |
| `bash` for heredoc (`<<`) | ✅ | ✅ (Ubuntu-based) |
| `json` module | ✅ stdlib | ✅ stdlib |
| `os` module | ✅ stdlib | ✅ stdlib |
| `sys` module | ✅ stdlib | ✅ stdlib |
| `math` module | ✅ stdlib | ✅ stdlib |
| `random` module | ✅ stdlib | ✅ stdlib |
| `random.gauss()` | ✅ | ✅ |
| `random.seed()` | ✅ | ✅ |

**No command change is required.** The heredoc pattern, the Python interpreter invocation, and all stdlib imports are fully compatible with the tensorflow image.

---

## 7. Summary

| Question | Answer |
|---|---|
| Verified image | `docker.io/tensorflow/tensorflow:2.17.0-gpu-jupyter` |
| Evidence source | Live read-only `client.api.markets.list()` during approved preflight — [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) §5.1 (2026-08-21) |
| Files that would change | `smoke-tests/nosana/nosana-risk-runner.mjs` (3 lines: L50, L152, L362) |
| Command change needed? | **No** — `python3 << 'PYEOF'` works in the tensorflow image |
| Workload needs Python? | **Yes** — Monte Carlo risk script is Python stdlib only |
| Can it run with Node/another image? | **No** — no other allowlisted image provides Python; ollama images are Go binaries |
| Fully qualified name needed? | **Yes** — exact string match against market allowlist |
| Unresolved risks | See §8 below |

---

## 8. Unresolved Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | **Image pull size / time.** The tensorflow GPU image is ~2–4 GB. If the Nosana node has a pull timeout, the large image could cause a timeout before the script even runs. | MEDIUM | The 120-second job timeout applies to execution, not pull. If pull time is counted, the timeout may need increasing. However, nodes likely cache common images. |
| R-02 | **Market node availability.** At preflight time, the market's `nodes` array was empty (`[]`). If no nodes are online, the job will remain in `pending` state until timeout regardless of image compatibility. | MEDIUM | This is independent of the image fix. The fallback path (`local-fallback`) handles this gracefully. |
| R-03 | **ENTRYPOINT override behaviour.** If the tensorflow image has a custom `ENTRYPOINT` (e.g., Jupyter's `tini` or `start.sh`), the `cmd` field may be passed as arguments to the entrypoint rather than executed as a shell command. | LOW | The `2.17.0-gpu-jupyter` tag typically uses `tini -- start-notebook.py` as entrypoint. Nosana's container runtime should override the entrypoint with the `cmd` field per the job definition schema. If not, the command would fail and the fallback path would activate. |
| R-04 | **Herdoc quoting in container runtime.** The `<< 'PYEOF'` heredoc requires bash. If the Nosana runtime uses `/bin/sh` (which may be `dash` on some images), the heredoc should still work (POSIX-compliant), but this has not been verified against the Nosana container runtime. | LOW | TensorFlow images are Ubuntu-based; `/bin/sh` is `dash` which supports heredocs. |
| R-05 | **No live verification performed.** This resolution is based on static analysis of the allowlist and the known contents of the tensorflow image. No live job has been submitted with this image. | INFORMATIONAL | The fallback path ensures that if the image fails, the system degrades gracefully to local calculation with correct evidence labelling. |

---

## 9. No-Job Confirmation

> **No Nosana job was submitted during this audit.**
>
> No `client.api.jobs.list()` call was made. No IPFS pin was created. No credits were spent. No wallet was created or modified. No network call was made to any Nosana endpoint.
>
> This document is a static analysis of the container image blocker based on the allowlist evidence captured during the previously approved read-only preflight.

---

## 10. Evidence Boundary

| Evidence Type | Status |
|---|---|
| Market allowlist | **Live evidence** — captured during approved read-only preflight (2026-08-21) |
| Image compatibility analysis | **Static analysis** — based on known public image metadata; not verified via live job |
| Command compatibility | **Static analysis** — based on known image contents; not verified via live execution |
| Risk assessment | **Offline assessment** — no live execution performed |

**This document does not upgrade any offline or synthetic result to live evidence.** All compatibility conclusions are static analysis pending live verification.

---

*This document is part of the StitchCheck Nosana expert approval packet.*
