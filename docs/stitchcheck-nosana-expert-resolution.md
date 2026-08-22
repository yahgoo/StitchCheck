# StitchCheck Nosana Expert Resolution

> **Status:** OFFLINE PREPARATION COMPLETE — AWAITING HUMAN APPROVAL FOR LIVE EXECUTION
>
> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5`
>
> **Node:** >=20.18

---

## 1. Official SDK/Package Conclusion

- **Package:** `@nosana/kit@2.7.5`
- **Node requirement:** >=20.18
- **Installation (awaiting approval):** `npm install @nosana/kit@2.7.5`
- The SDK is **not currently installed** in this workspace. All code changes are offline-compatible and use a custom local validator that mirrors the official SDK's return shape.

## 2. Correct Initialisation

```javascript
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey: process.env.NOSANA_API_KEY },
});
```

- The API key is passed via the `api.apiKey` option.
- No wallet or private key is required for the `client.api` (credit-funded) path.

## 3. API Key vs Wallet Requirement

- **API key is sufficient** for the credit-funded `client.api` path.
- **No wallet/private key is required** for this path.
- A wallet (`generateKeyPairSigner()`) is only needed for the on-chain `client.jobs.post()` path (Solana transaction signing), which is not the intended integration path.

## 4. Correct IPFS / Post / Poll / Retrieve Flow

The official lifecycle is:

1. **Pin:** `const ipfsHash = await client.ipfs.pin(jobDefinitionJson);`
   - Returns the IPFS hash string directly.
2. **Post:** `const result = await client.api.jobs.list({ ipfsHash, market, timeout });`
   - `timeout` is in **seconds**; default is 3600.
   - Response: `result.job` (job address), `result.credits.creditsUsed`.
3. **Poll:** `const status = await client.api.jobs.get(jobId);`
   - Poll until `status.ipfsResult` is set or state is terminal.
4. **Retrieve:** `const output = await client.ipfs.retrieve(status.ipfsResult);`
   - Uses `retrieve()`, not `get()`.

## 5. Correct Job States

Official states (all **lowercase**):

| State | Terminal? |
|---|---|
| `pending` | No |
| `running` | No |
| `completed` | Yes |
| `failed` | Yes |
| `stopped` | Yes |

**Fix applied:** Previous code used uppercase `"FAILED"` / `"COMPLETED"`. Now uses lowercase and includes `"stopped"` as a terminal state.

## 6. Correct Schema and Validator Status

### Official SDK Validator

```javascript
import { validateJobDefinition } from '@nosana/kit';

const result = validateJobDefinition(jobDefJson);
// result.success === true  → result.data is a typed JobDefinition
// result.success === false → result.errors is [{ path, expected, value }]
```

### Offline Fallback (current state)

The local `validateJobDefinition()` in `nosana_run_job.mjs` has been updated to return the **same shape** as the official SDK:

```javascript
{ success: boolean, data: object|null, errors: Array<{path, expected, value}> }
```

**This is NOT the official validator.** It is a local offline guard that mirrors the SDK's return shape. When `@nosana/kit` is installed, the import should be switched to the official SDK export.

### Job Definition Meta

The `meta` object must contain only permitted schema keys:
- `trigger`: `"cli"` | `"dashboard"` | `"api"` | `"deployment-manager"`
- `system_resources`: `Record<string, string|number>`

**Fix applied:** Removed custom metadata (`workload`, `version`, `syntheticDemo`, `nonPiiDeclaration`) from the `meta` object. Only `trigger: "api"` remains.

## 7. Files Changed

| File | Owner | Changes |
|---|---|---|
| `smoke-tests/nosana/nosana_run_job.mjs` | Expert A | Job ID field (`job.job`), `ipfs.retrieve()`, lowercase states, `stopped` terminal, validator return shape `{success,data,errors}`, evidence metadata (`observedStates`, `creditsUsed`), timeout documentation |
| `smoke-tests/nosana/nosana-risk-runner.mjs` | Expert B | Meta schema cleanup, `validateRiskResult()` gate before `nosana-evidence`, metadata propagation (`observedStates`, `creditsUsed`), timestamped evidence artifacts (`results/<UTC>/result.json`, `summary.md`, `job-definition.json`) |

**No other files were modified.** In particular:
- No `app/src/` files modified.
- No Atlas, Gemini, deck, or video files modified.
- No `.env.local` values read or printed.

## 8. Offline Test Results

| Test | Result |
|---|---|
| `node smoke-tests/nosana/schema-validator.mjs` | **All fixture validations passed** |
| `node smoke-tests/nosana/nosana-client-offline-tests.mjs` | **75 passed, 0 failed** |
| `node smoke-tests/nosana/workload-skeleton.mjs` | **5 simulated runs, all schema valid** |
| `node smoke-tests/cross-provider-invariant-tests.mjs` | **40 passed, 0 failed** |
| `cd app && npm run typecheck` | **Passed (zero errors)** |
| `cd app && npm run build` | **Built successfully** |

### Label Verification

- `"Synthetic local placeholder — not Nosana evidence"` — **present and unchanged** in all outputs.
- `"Nosana unavailable — local fallback used; not Nosana evidence"` — **present and unchanged** in all outputs.

### Credential/PII Scan

- **Zero credentials found** in any generated output.
- **Zero PII fields found** in any generated output.

## 9. Security/Cost Review

See: [`docs/stitchcheck-nosana-expert-security-review.md`](./stitchcheck-nosana-expert-security-review.md)

Summary:
- No credentials logged or persisted.
- No PII in workload.
- Maximum timeout: 120 seconds.
- Estimated cost: ~US$0.0016.
- Hard ceiling: US$10.
- One attempt, zero automatic retries.
- Full fallback to local computation on any failure.

## 10. Live-Readiness Verdict

**READY FOR LIVE EXECUTION — PENDING HUMAN APPROVAL**

All offline code fixes have been applied and validated. The integration is ready for:
1. SDK installation.
2. Read-only preflight (credit balance, market verification).
3. Live job submission.

### Prerequisites for Live Execution

1. **SDK installation** (requires approval):
   ```bash
   npm install @nosana/kit@2.7.5
   ```

2. **Read-only preflight** (requires approval):
   ```javascript
   // Credit balance check
   const credits = await client.api.credits.balance();
   
   // Market lookup (verify market address and cost)
   const markets = await client.api.markets.list();
   ```

3. **Market address verification:**
   - Current default: `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq`
   - **UNVERIFIED** — must be confirmed via read-only market lookup before any paid submission.

## 11. Exact Package-Install Command Awaiting Approval

```bash
npm install @nosana/kit@2.7.5
```

## 12. Exact Read-Only Preflight Awaiting Approval

```javascript
// After SDK installation:
import { createNosanaClient, NosanaNetwork } from '@nosana/kit';

const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey: process.env.NOSANA_API_KEY },
});

// 1. Check credit balance
const balance = await client.api.credits.balance();
console.log('Credit balance:', balance);

// 2. List available markets and verify the target market
const markets = await client.api.markets.list();
console.log('Available markets:', markets);
```

## 13. Exact Live Command Awaiting Approval

```bash
cd smoke-tests/nosana && node run-risk-job.mjs
```

This will:
1. Load `NOSANA_API_KEY` from `.env.local`.
2. Build and validate the risk job definition.
3. Pin the definition to IPFS.
4. Post the job to the verified market.
5. Poll until completion or timeout (120 seconds).
6. Retrieve the result from IPFS.
7. Validate the output and risk result.
8. Write evidence artifacts to `results/<UTC-timestamp>/`.

## 14. Unresolved Questions

1. **Market address:** Is `7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq` the correct and cheapest market? Must be verified via read-only API call.
2. **Actual cost:** The ~US$0.0016 estimate is based on publicly available information. The actual cost may differ and will be confirmed by `result.credits.creditsUsed` after the first live job.
3. **SDK `validateJobDefinition()`:** The local offline validator mirrors the official shape but is not the official validator. After SDK installation, the import should be switched to `import { validateJobDefinition } from '@nosana/kit'` for full schema validation.
4. **Idempotency key:** The SDK ships `generateIdempotencyKey()`. The current code does not use it (no local compatible helper existed). After SDK installation, consider adding idempotency key support for the post call.

## 15. Explicit Statements

> - **No job submitted.** No `client.api.jobs.list()` call was made.
> - **No credits spent.** Zero credit expenditure during this task.
> - **No wallet changed.** No wallet was created, modified, or used.
> - **No non-local provider called.** No Nosana, Atlas, Gemini, or OpenRouter call was made.

---

## Approval Packet Summary

| Parameter | Value |
|---|---|
| SDK | `@nosana/kit@2.7.5` |
| Node | >=20.18 |
| Auth | API key via `client.api` |
| Wallet | Not required for this path |
| Timeout | 120 seconds |
| Market | Pending read-only verification |
| Expected cost | ~US$0.0016 |
| Hard ceiling | US$10 |
| Attempts | One (zero retries) |
| Fallback | Local heuristic result |
| Evidence output | `smoke-tests/nosana/results/<UTC-timestamp>/` |

---

*This document is part of the StitchCheck Nosana expert approval packet.*
