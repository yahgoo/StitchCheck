# StitchCheck Nosana SDK Contract Resolution

> **Status:** ALL CONTRACT DISPUTES RESOLVED — DOCUMENTATION ONLY
>
> **Date:** 2026-08-21
>
> **SDK:** `@nosana/kit@2.7.5` (installed at `smoke-tests/nosana/node_modules/@nosana/kit`)
>
> **Companion deliverable:** Expert B doc for the StitchCheck Nosana live-smoke integration

---

## 0. Verification Basis

Every resolution below was verified against the **installed** `@nosana/kit@2.7.5` source and its transitive dependencies `@nosana/api` and `@nosana/ipfs` under `smoke-tests/nosana/node_modules/`. File paths cited are relative to `smoke-tests/nosana/node_modules/` unless stated otherwise. Official Nosana documentation is cited only where noted.

---

## B1. Client Construction

**Resolution:** `createNosanaClient(network?, customConfig?)`. The usage

```ts
createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })
```

is **confirmed correct**.

| Evidence | Location |
|---|---|
| Signature `createNosanaClient(network?: NosanaNetwork, customConfig?: PartialClientConfig): NosanaClient` | `@nosana/kit/dist/NosanaClient.d.ts` (line 43) |
| `NosanaNetwork` re-export | `@nosana/kit/dist/index.d.ts` (line 186) |
| API-key config shape (`ipfs`, `api` partial config) | `@nosana/kit/dist/config/types.d.ts` |
| API-key-only client overload (no wallet required) | `@nosana/kit/dist/utils/createApiInstance.d.ts` |

---

## B2. IPFS Pin / Retrieve

**Resolution:** `client.ipfs.pin(jobDefinition)` returns the **hash string directly**. There is **no** `ipfs.add` method. Retrieval is via `client.ipfs.retrieve(hash)`.

| Evidence | Location |
|---|---|
| Client surface `pin: (data: object) => Promise<string>` and `retrieve: <T>(hash: string \| Array<number>) => Promise<T>` | `@nosana/ipfs/dist/index.d.ts` |
| `pin(data: object, client: FetchClient): Promise<string>` | `@nosana/ipfs/dist/actions/pin.d.ts` |
| `retrieve<T>(hash: string \| Array<number>, client: FetchClient): Promise<T>` | `@nosana/ipfs/dist/actions/retrieve.d.ts` |
| `client.ipfs: NosanaIpfsClient` on the client | `@nosana/kit/dist/NosanaClient.d.ts` |

---

## B3. Job Post

**Resolution:** Jobs are posted via

```ts
client.api.jobs.list(
  { ipfsHash, market, timeout, node? },
  { idempotencyKey? }
)
```

The response exposes the job as **`job` (the on-chain address)**, plus `run`, `tx`, `credits.creditsUsed`, and `credits.costUSD`. It is **NOT** `id` or `jobId`.

| Evidence | Location |
|---|---|
| `jobs.list` route implementation, `Idempotency-Key` header wiring | `@nosana/api/dist/routes/jobs/index.js` |
| Request/options types incl. `idempotencyKey?: string` | `@nosana/api/dist/routes/jobs/types.d.ts` |
| OpenAPI schema: "Create a job using credits … job is posted at most once per key" | `@nosana/api/dist/client/client-manager/schema.d.ts` (line 381) |

---

## B4. Job Polling and Result Retrieval

**Resolution:**

- Poll with `client.api.jobs.get(address)`; the response includes `address`, `state`, `jobStatus`, `ipfsResult`, `timeStart`, `timeEnd`.
- Poll until `ipfsResult` is set, then fetch the result with `client.ipfs.retrieve(job.ipfsResult)`.

| Evidence | Location |
|---|---|
| `jobs.get` route | `@nosana/api/dist/routes/jobs/index.js` |
| Job status/response schemas incl. `ipfsResult`, `timeStart`/`timeEnd` | `@nosana/api/dist/client/client-manager/schema.d.ts` |

---

## B5. Idempotency

**Resolution:**

- `generateIdempotencyKey()` is a no-argument UUID helper.
- The `Idempotency-Key` header is **optional** on `jobs.list`, `jobs.extend`, and `jobs.stop`.
- It is **REQUIRED** on the batch endpoints.
- A `409` response carries a machine-readable control code: `IDEMPOTENCY_KEY_IN_PROGRESS` / `IDEMPOTENCY_KEY_EXPIRED` / `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`. Branch on the code, never on the HTTP status alone.

| Evidence | Location |
|---|---|
| UUID helper and code constants (`IN_PROGRESS` / `EXPIRED` / `PAYLOAD_MISMATCH`) | `@nosana/api/dist/utils/idempotency.js` and `idempotency.d.ts` |
| Header injection only when a key is provided (`jobs.list/extend/stop`) | `@nosana/api/dist/routes/jobs/index.js` |
| Batch endpoint: "Requires an `Idempotency-Key` header (one key per batch)" | `@nosana/api/dist/client/client-manager/schema.d.ts` (line 401) |
| `IdempotencyCode` union and "branch on this, not the HTTP status alone" | `@nosana/api/dist/client/client-manager/schema.d.ts` (lines 687–695) |

---

## B6. Timeout Unit — Minutes vs Seconds Dispute, Definitively Resolved

**Verdict: the `timeout` parameter is in SECONDS.** The older note stating "minutes" is **superseded**.

Evidence chain (all agree):

| # | Source | Statement |
|---|---|---|
| 1 | Installed SDK OpenAPI schema — `@nosana/api/dist/client/client-manager/schema.d.ts` (lines 1933, 1943, 1953, 2029, 2040, 2051) | `/** @description Job timeout in seconds (default: 3600) */` |
| 2 | Installed `@nosana/kit` README (`@nosana/kit/README.md`) | Timeout expressed in seconds |
| 3 | Official Nosana Jobs API page | `timeout: 600 // seconds` |
| 4 | Official first-job guide | Timeout in seconds |
| 5 | Approved preflight doc — [`docs/stitchcheck-nosana-readonly-preflight.md`](./stitchcheck-nosana-readonly-preflight.md) §4 | "Job timeout | 120 seconds (2 minutes)" |

Five independent sources agree on seconds; the lone "minutes" note is contradicted by the installed SDK's own OpenAPI schema, which is the authoritative contract for `@nosana/kit@2.7.5`.

**Approved timeout: 120 seconds** (SDK default is 3600 seconds; StitchCheck overrides to 120).

---

## Summary Table

| ID | Contract Point | Verdict |
|---|---|---|
| B1 | Client construction | `createNosanaClient(NosanaNetwork.MAINNET, { api: { apiKey } })` ✅ |
| B2 | IPFS | `client.ipfs.pin()` → hash string; `client.ipfs.retrieve(hash)`; no `ipfs.add` ✅ |
| B3 | Job post | `client.api.jobs.list({ ipfsHash, market, timeout, node? }, { idempotencyKey? })`; response key is `job` (address), not `id`/`jobId` ✅ |
| B4 | Poll / result | `client.api.jobs.get(address)` until `ipfsResult` set, then `client.ipfs.retrieve(job.ipfsResult)` ✅ |
| B5 | Idempotency | UUID helper; optional on list/extend/stop, required on batch; 409 codes `IN_PROGRESS` / `EXPIRED` / `PAYLOAD_MISMATCH` ✅ |
| B6 | Timeout unit | **SECONDS** — dispute resolved; approved timeout 120 s ✅ |

---

## Explicit Confirmation

> This task was documentation only. All contract resolutions were verified by reading installed SDK source; no tests were run by this task, no network call was made, and no credential values were read or printed.

---

*This document is part of the StitchCheck Nosana expert approval packet.*

No live Nosana job was submitted during this task.
