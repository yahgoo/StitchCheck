## Current-State Diagnosis

The StitchCheck app (`app/src/App.tsx`) runs entirely on local fixtures:
- `handleConfirm` loads Nosana risk from a static JSON file or falls back to fixtures, and alternatives always come from `getAlternativesFixture()`.
- No server-side proxy exists in `vite.config.ts` (no `proxy` field, no middleware).
- Atlas interaction is CLI-only via `atlas-flight` (proven in `smoke-tests/atlas/run-sandbox-search-verify.mjs`). No direct REST endpoints are known or documented — the Skill/CLI abstracts them.
- Sandbox credentials exist in `.env.local`: `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`, `ATLAS_BASE_URL=https://sandbox.atriptech.com`.
- `DATA_MODE` is not wired into the app at all — it exists only in `.env.example`.
- Provenance labels are already implemented in `core/provenance/labels.ts` with correct Atlas Sandbox live label.

## Target Architecture

```
Browser (React)                 Vite Dev Server (Node.js)
  |                                |
  |-- fetch('/api/atlas/search') -->|-- execFile('atlas-flight search ...')
  |<-- JSON { offers, search_id } -|      |-- Atlas Sandbox API (via CLI)
  |                                |
  |-- fetch('/api/atlas/verify') -->|-- execFile('atlas-flight offer verify ...')
  |<-- JSON { verify status } ----|      |-- Atlas Sandbox API (via CLI)
```

- **DATA_MODE=live**: App calls `/api/atlas/*` proxy routes.
- **DATA_MODE=offline** (default): App uses existing local fixtures. No network calls.
- Proxy uses `atlas-flight` CLI (v0.3.12) — the proven integration path.
- Credentials read server-side from `.env.local` only. Never exposed to browser.

## Exact Files to Change

### New files

| File | Purpose |
|---|---|
| `app/server/atlas-proxy.mjs` | Vite middleware: `/api/atlas/search` and `/api/atlas/verify` with allowlist, CLI execution, credential handling, error sanitization, 8s timeout, single retry for 5xx/timeout. |
| `app/src/atlas/client.ts` | Typed browser client. Calls only `/api/atlas/search` and `/api/atlas/verify`. Never references `sandbox.atriptech.com` or credentials. |
| `app/src/atlas/types.ts` | TypeScript interfaces for Atlas Search/Verify request/response shapes, mapped from actual CLI output. |
| `app/src/atlas/adapter.ts` | Maps raw Atlas offer fields to the existing `SearchResult`/`Alternative` domain types used by `AlternativesPanel`. |
| `smoke-tests/atlas/live-app-runs/` | Evidence output directory (gitignored). |

### Modified files

| File | Change |
|---|---|
| `app/vite.config.ts` | Add `configureServer` hook to mount `atlas-proxy.mjs` middleware. |
| `app/src/App.tsx` | In `handleConfirm`: check `DATA_MODE`. If `live`, call Atlas Search via browser client, map results, then call Verify on selected offer. If `offline`, keep existing fixture path. Add provenance banner. |
| `app/src/components/AlternativesPanel.tsx` | Accept live Atlas offers (with real carrier, flight number, price from Atlas). Show "Not available from Atlas response" for missing fields. Enable retry button in live mode. Remove "local offline fixture" text when showing live data. |
| `app/src/components/RecoveryPlanAnimation.tsx` | Accept live Atlas data as the recommended plan source when in live mode. |
| `app/index.html` | Inject `__DATA_MODE__` from env via Vite `define` for browser-side mode detection. |
| `app/package.json` | Add `DATA_MODE` to vite `define` in config; add new test script entries. |

## Endpoint Mapping

### Local proxy routes (allowlist)

| Local Route | Atlas CLI Command | Method |
|---|---|---|
| `POST /api/atlas/search` | `atlas-flight search --origin X --destination Y --depart Z --adults 1 --currency USD --json` then `atlas-flight offer list --search-id ID --json` | POST |
| `POST /api/atlas/verify` | `atlas-flight offer verify --offer-id ID --json` | POST |

### Rejected routes (404)

`/api/atlas/order`, `/api/atlas/booking`, `/api/atlas/payment`, `/api/atlas/ticket`, `/api/atlas/cancel`, `/api/atlas/refund`, any other `/api/atlas/*` path.

### Upstream Atlas access

Via `atlas-flight` CLI only. The CLI manages auth internally. No direct REST endpoint mapping is needed or attempted (the Skill abstracts them, per `docs/stitchcheck-opus-nosana-atlas-resolution-plan.md` L241).

## Data Contracts

### Search request (browser -> proxy)

```typescript
{ origin: "KUL", destination: "SIN", departureDate: "2026-09-15", adults: 1, currency: "USD" }
```

### Search response (proxy -> browser)

Mapped from CLI JSON output (`data.offers[]`):

```typescript
{
  searchId: string,
  offers: [{
    offerId: string,
    carrier: string,          // segments[0].carrier
    flightNumber: string,     // segments[0].flight_number
    departureAirport: string, // segments[0].departure_airport
    arrivalAirport: string,   // segments[0].arrival_airport
    departureTime: string,    // formatted from "202609151500"
    arrivalTime: string,      // formatted from "202609151600"
    durationMinutes: number,
    totalPrice: number,
    currency: string,
    bookable: boolean,
    priceStatus: string,
    refreshTime: string,
    expireTime: string,
  }],
  retrievedAt: string,        // ISO timestamp
  provenance: { evidenceSource: "atlas-sandbox", provider: "atlas", executed: true, fallbackUsed: false }
}
```

### Verify request (browser -> proxy)

```typescript
{ offerId: "off_xxx" }
```

### Verify response (proxy -> browser)

```typescript
{
  verifyStatus: string,       // e.g. "PRICE_CONFIRMATION_REQUIRED"
  previousPrice: number | null,
  currentPrice: number | null,
  currency: string,
  priceChange: string | null,
  retrievedAt: string,
  provenance: { ... }
}
```

## Failure Handling

- **CLI not found**: Proxy returns 502 with `{ error: "atlas_cli_not_available" }`. Browser shows error banner with retry.
- **CLI timeout (>8s)**: Proxy kills process, returns 504. Browser shows timeout.
- **CLI 5xx/non-zero exit**: Retry once. If still failing, return sanitized error.
- **4xx from Atlas** (including 429): No retry. Return sanitized error.
- **Live mode + Atlas fails**: Show actual failure state in UI. Do NOT silently fall back to fixtures.
- **Offline mode**: Always uses fixtures. Deterministic.

## Provenance Rules

- **Live mode success**: Label = `"Atlas Sandbox — live Search + Verify, read-only"`. Show actual `retrievedAt` timestamp.
- **Live mode failure**: Label = `"Atlas Sandbox — failure state"`. Show error.
- **Offline mode**: Label = `"Demo alternatives — local demo fixture"` (existing).
- Provenance requires: `evidenceSource === 'atlas-sandbox'`, `executed === true`, `fallbackUsed === false`.

## Security Boundary

- Credentials (`ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET`) read from `.env.local` by Vite middleware only.
- Never in browser bundle, never in error responses, never logged.
- Vite `define` excludes all `ATLAS_*` and secret env vars.
- Proxy allowlist is explicit and default-deny.
- Write paths (`order`, `booking`, `payment`, `ticket`, `cancel`, `refund`) return 404.
- 8-second timeout. Single retry for 5xx/timeout only.
- Error responses sanitized (no URLs, headers, credentials, PII).

## Implementation Steps

### Step 1: Vite server middleware (`app/server/atlas-proxy.mjs`)

- Export a function that receives the Vite dev server and registers `server.middlewares.use`.
- Match `POST /api/atlas/search` and `POST /api/atlas/verify` only.
- Reject all other `/api/atlas/*` with 404.
- Read credentials from `process.env` (loaded by Vite from `.env.local`).
- Execute `atlas-flight` CLI via `child_process.execFile` with 8s timeout.
- For search: run `atlas-flight environment use sandbox --json`, then `atlas-flight search ...`, then `atlas-flight offer list --search-id ...`.
- For verify: run `atlas-flight offer verify --offer-id ...`.
- Parse JSON stdout, sanitize, return to browser.
- Retry once on 5xx/timeout.

### Step 2: Wire middleware into `app/vite.config.ts`

- Import `atlas-proxy.mjs` in `configureServer` hook.
- Add `define` for `__DATA_MODE__` from `process.env.DATA_MODE || 'offline'`.

### Step 3: Browser Atlas client (`app/src/atlas/client.ts`)

- `searchAtlas(params)` -> `fetch('/api/atlas/search', { method: 'POST', body: JSON.stringify(params) })`
- `verifyOffer(offerId)` -> `fetch('/api/atlas/verify', { method: 'POST', body: JSON.stringify({ offerId }) })`
- Typed responses. No SDK import. No credential reference. No `sandbox.atriptech.com`.

### Step 4: Atlas adapter (`app/src/atlas/adapter.ts`)

- Map Atlas offer fields to `Alternative[]` for `AlternativesPanel`.
- Map missing fields to `"Not available from Atlas response"`.
- Build `SearchResult` with `searchStatus: 'completed'`, real `sourceEnvironment: 'atlas-sandbox'`.

### Step 5: App integration (`app/src/App.tsx`)

- In `handleConfirm`: if `__DATA_MODE__ === 'live'`, call `searchAtlas()`, map via adapter, set `alternativesResult`. Then auto-select top offer and call `verifyOffer()`.
- Add loading states for search and verify.
- Add error states with retry.
- Pass provenance to `AlternativesPanel`.
- Keep `RecoveryPlanAnimation` flow but feed from live Atlas data.

### Step 6: AlternativesPanel updates

- When `searchResult.sourceEnvironment === 'atlas-sandbox'`, show live provenance label and actual retrieval timestamp.
- Enable retry button in live mode.
- Show `"Not available from Atlas response"` for missing fields.
- Remove "local offline fixture" disclaimer when showing live data.

### Step 7: Tests

Add to `smoke-tests/atlas/`:
- `live-proxy-offline-tests.mjs` — Tests 1-8, 10-15 from the spec using mocked CLI responses.
- Update `app/package.json` `verify:offline` script.

### Step 8: Terminology scan

- Grep for `synthetic`, `fictional`, `mock` in current user-facing app strings.
- Remove unnecessary occurrences from `app/src/` display text.
- Retain internal identifiers (`syntheticDemo`, `daytona-offline-mock`) only where changing them breaks contracts.

### Step 9: Build verification

```bash
npm run typecheck
npm run build
npm run verify:offline  # all existing + new tests
```

## Offline/ Rollback Preservation

- `DATA_MODE=offline` (default) preserves 100% of existing behavior.
- All existing fixtures, tests, and components remain untouched when offline.
- No fixture data is deleted or modified.

## Test Plan

1. Proxy route allowed: search, verify.
2. Unknown routes rejected (404).
3. Write routes rejected (order, booking, payment, ticket, cancel, refund).
4. Browser client uses only `/api/atlas/*` local paths.
5. Live search maps actual Atlas carriers/offers/prices.
6. Verify maps actual status.
7. Missing fields render "Not available from Atlas response".
8. Live provenance requires `executed === true`, `fallbackUsed === false`.
9. Live mode does not silently fall back.
10. Offline mode still works.
11. Forbidden success claims absent.
12. Submit does not call write endpoints.
13. Credentials absent from browser bundle.
14. Credentials absent from evidence files.

## Browser Verification Plan

1. Start `DATA_MODE=live npm run dev`.
2. Walk through safety notice -> upload -> review -> confirm.
3. Confirm Atlas offers render in AlternativesPanel.
4. Confirm Verify status renders.
5. Confirm provenance label and timestamp visible.
6. Confirm submit button remains read-only.
7. Confirm no write endpoint called (check network tab).

## Assumptions

- `atlas-flight` CLI v0.3.12+ is installed and on PATH.
- Atlas authorization is current (credentials in `.env.local` are valid for sandbox).
- The sandbox environment is accessible from the dev machine.
- The existing 2026-08-21 evidence baseline may differ from a fresh run; fresh run is authoritative.
