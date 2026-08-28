# StitchCheck Live Atlas Data Mode

## Discovery prerequisite

Before writing any proxy code, determine the exact Atlas Sandbox REST endpoint paths. The diagnosis docs confirm the pattern is `POST /<endpoint>.do` with JSON body, and the CLI maps `atlas-flight search` to "Shopping / FlightSearch" and `atlas-flight offer verify` to "Verification". The implementer must inspect the `atlas-flight` CLI source or Atlas API docs to confirm the exact path strings (e.g. `/flightSearch.do`, `/verification.do`). The proxy module will store these as named constants so they are easy to correct in one place.

---

## 1. Vite proxy middleware

**File: `app/vite.config.ts`** (modify)

Replace the current minimal config with a `configureServer` hook that registers custom middleware. Do NOT use Vite's built-in `server.proxy` (it is a generic passthrough and cannot enforce the allow-list).

```ts
// Pseudocode structure
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@core': resolve(__dirname, '../core') } },
  server: {
    fs: { allow: [resolve(__dirname, '..')] },
  },
  // Load .env.local for server-side middleware only
  // dotenv is already a Vite dependency
});
```

**File: `app/atlas-proxy.mjs`** (new)

A standalone middleware module imported by `vite.config.ts`. Responsibilities:

- **Allow-list** (hard-coded, exhaustive):
  ```js
  const ALLOWED_ROUTES = Object.freeze({
    '/api/atlas/search': '/flightSearch.do',   // exact path TBD from discovery
    '/api/atlas/verify': '/verification.do',    // exact path TBD from discovery
  });
  ```
  Any request to `/api/atlas/*` not matching a key returns 404. No other `/api/atlas/` path is forwarded. This is the architectural guarantee that booking/ticketing/payment endpoints are unreachable.

- **Credential injection**: Read `ATLAS_BASE_URL`, `ATLAS_CLIENT_ID`, `ATLAS_CLIENT_SECRET` from `process.env` (loaded via `dotenv` from `.env.local` at startup). Attach as headers:
  ```
  x-atlas-client-id: <from env>
  x-atlas-client-secret: <from env>
  Content-Type: application/json
  Accept: */*
  ```
  Credentials are never forwarded to the browser, never logged, never included in error responses.

- **Timeout**: 8000ms per upstream request using `AbortController`.

- **Retry**: One retry with exponential backoff (1s, 2s) on 5xx or timeout only. No retry on 4xx (including 429).

- **Response sanitization**: Strip any response header from Atlas that could leak internal routing. Forward the JSON body to the browser with `Content-Type: application/json`.

- **Error logging**: Server-side `console.warn` with redacted bodies (no credentials, no full request/response). Browser receives only `{ status, errorCode, message }` with sanitized messages.

- **429 handling**: Forward the 429 status code to the browser with a `Retry-After` header if Atlas provides one. The browser client interprets this into the "please wait and retry" UI state.

**Integration in `vite.config.ts`**:
```ts
import { createAtlasProxy } from './atlas-proxy.mjs';
// inside configureServer:
server.middlewares.use(createAtlasProxy());
```

---

## 2. Atlas client module (browser-side)

**File: `app/src/lib/atlasClient.ts`** (new)

Browser-side module that calls only the local proxy routes. Never constructs URLs to `sandbox.atriptech.com`.

**Typed interfaces** (derived from real sandbox response in `smoke-tests/atlas/results/sandbox-search-verify-2026-08-21T*.json`):

```ts
// -- Search --
export interface AtlasSearchRequest {
  origin: string;           // IATA e.g. "KUL"
  destination: string;      // IATA e.g. "SIN"
  departureDate: string;    // YYYY-MM-DD
  adults: number;
  currency: string;         // "USD"
}

export interface AtlasOfferSegment {
  departure_airport: string;
  arrival_airport: string;
  departure_time: string;   // "202609151500" format
  arrival_time: string;
  carrier: string;
  flight_number: string;
  duration_minutes: number;
  cabin_class: number;
  direction: string;
}

export interface AtlasOffer {
  offer_id: string;
  currency: string;
  total_price: number;
  segments: AtlasOfferSegment[];
  bookable: boolean;
  price_status: string;     // "current" | "reference" | etc.
  expire_time: string;      // ISO-8601
}

export interface AtlasSearchResponse {
  status: string;
  code: string;             // "FLIGHT_SEARCHED"
  data: {
    search_id: string;
    offer_count: number;
    offers: AtlasOffer[];
  };
}

// -- Verify --
export interface AtlasVerifyRequest {
  offerId: string;
  searchId: string;
}

export interface AtlasVerifyResponse {
  status: string;
  code: string;             // "PRICE_CONFIRMED" | "PRICE_CHANGED" | etc.
  data: {
    session_id?: string;
    offer_id: string;
    price_status: string;
    total_price?: number;
    currency?: string;
  };
}
```

**Functions**:
- `atlasSearch(req: AtlasSearchRequest): Promise<AtlasSearchResponse>` — POST to `/api/atlas/search`
- `atlasVerify(req: AtlasVerifyRequest): Promise<AtlasVerifyResponse>` — POST to `/api/atlas/verify`
- Both return a normalized error shape `{ status: 'error', errorCode: string, message: string }` on failure.
- Neither function has any fallback logic — fallback is handled by the caller (App.tsx).

---

## 3. Mode toggle and env config

**File: `app/vite.config.ts`** — no client-side env var needed; the proxy reads `process.env` directly.

**File: `app/src/lib/dataMode.ts`** (new)

```ts
// DATA_MODE is injected by Vite as a define constant, not via import.meta.env
// to avoid exposing any non-VITE_ vars.
export type DataMode = 'live' | 'offline';

export function getDataMode(): DataMode {
  // __DATA_MODE__ is defined in vite.config.ts define: { ... }
  return typeof __DATA_MODE__ !== 'undefined' && __DATA_MODE__ === 'live'
    ? 'live'
    : 'offline';
}
```

**In `vite.config.ts`**:
```ts
import { config } from 'dotenv';
config({ path: resolve(__dirname, '.env.local') }); // server-side only

export default defineConfig({
  define: {
    __DATA_MODE__: JSON.stringify(process.env.DATA_MODE ?? 'offline'),
  },
  // ...
});
```

Add to **`.env.example`** (the root one, line ~43 area):
```
# Atlas data mode: "live" calls Atlas Sandbox via proxy; "offline" uses local fixtures
DATA_MODE=offline
```

Also add placeholder entries if not present:
```
ATLAS_CLIENT_ID=
ATLAS_CLIENT_SECRET=
```

---

## 4. App.tsx integration — live data flow

**File: `app/src/App.tsx`** (modify)

The existing flow is: `handleConfirm` → loads Nosana risk fixture → loads alternatives fixture. In live mode, this changes to:

1. `handleConfirm` calls `atlasSearch()` via the proxy.
2. On success: map `AtlasSearchResponse.data.offers[]` into the existing `SearchResult` / `Alternative[]` types used by `AlternativesPanel` and `RecoveryPlanAnimation`.
3. On failure: set a new `atlasError` state → render "Live flight data unavailable — retry" with a retry button that re-calls `atlasSearch()`.
4. **Never** silently fall back to fixture data while in live mode. The fallback path is only used when `getDataMode() === 'offline'`.

**Re-verification before collapse** (Requirement 6):

In the `RecoveryPlanAnimation` component, the `candidates` → `collapse` transition is timer-driven. Before the collapse timer fires, insert an `atlasVerify()` call on the top candidate's `offer_id`. If the verify response indicates price changed or offer gone:
- Update the candidate's `priceDisplay` / `availabilityLabel` in the animation data.
- If the recommended plan's offer is stale, re-select from updated candidates or show "No safe plan found".

Implementation: Add an `onBeforeCollapse` async callback prop to `RecoveryPlanAnimation` that the parent uses to trigger verify. The animation component calls it before transitioning from `candidates` to `collapse` phase.

**New state variables in App.tsx**:
```ts
const [atlasSearchState, setAtlasSearchState] = useState<'idle'|'loading'|'success'|'error'>('idle');
const [atlasSearchError, setAtlasSearchError] = useState<string|null>(null);
const [atlasVerifyState, setAtlasVerifyState] = useState<'idle'|'loading'|'success'|'error'|'price-changed'>('idle');
const [idempotencyKey] = useState(() => crypto.randomUUID());
const [submitDisabled, setSubmitDisabled] = useState(false);
```

**Submit button** (Requirement 7):
- `onClick` sets `submitDisabled = true` immediately (one-shot).
- Always resolves to `confirmationPhase = 'request-submitted'` with `verifiedOutcome = null`.
- The UI then shows "Request submitted — awaiting verified supplier outcome".
- No Atlas endpoint beyond Search/Verify is called.

---

## 5. Provenance label updates

**File: `core/provenance/labels.ts`** (modify)

Add new labels for live proxy-sourced data:
```ts
export const ATLAS_UI_LABELS = {
  // ... existing labels ...
  /** Live Atlas Sandbox data via the dev-server proxy — real search/verify. */
  liveSearch: 'Live flight data \u2014 Atlas Sandbox, retrieved',
  /** Live Atlas Verify result — real price/availability check. */
  liveVerify: 'Live price verification \u2014 Atlas Sandbox',
};
```

Add a function to generate timestamped labels:
```ts
export function getLiveAtlasSearchLabel(timestamp: string): string {
  return `${ATLAS_UI_LABELS.liveSearch} ${formatUtcTimestamp(timestamp)}`;
}
```

**File: `core/domain/execution-mode.ts`** (modify)

Add a new execution mode:
```ts
| 'atlas-live-search-verify'
```
With label:
```ts
case 'atlas-live-search-verify':
  return {
    mode,
    provenanceLabel: 'Atlas Sandbox \u2014 live Search + Verify, read-only, via dev-server proxy',
    isLive: true,
  };
```

---

## 6. UI string cleanup — remove "Fictional/Synthetic/Mock"

Files to modify (all in `app/src/`):

| File | Lines | Change |
|------|-------|--------|
| `components/RiskPanel.tsx` | L127, L130, L134, L152, L156, L174, L178 | Replace "fictional demo" with "demo" in aria-labels and visible text |
| `components/AlternativesPanel.tsx` | L73, L105 | Replace "fictional" wording |
| `components/useNarration.ts` | L22, L24 | Replace "fictional demo with a fictional itinerary" with neutral wording |
| `components/SafetyNotice.tsx` | L15-28 | Update to say "demo itinerary" instead of implying all data is fictional; keep the safety constraints |
| `data/fixtures.ts` | L158 | Change `provenanceMode: 'fictional-local'` to `provenanceMode: 'offline-local'` (internal value, not user-facing, but remove the word) |
| `App.tsx` | L263 | Update StatusBanner message |
| `App.tsx` | L324-325 | Update footer text |

**Important**: Do NOT change labels in `core/provenance/labels.ts` that are test-asserted literals (e.g. the `GEMINI_LABELS.localFixture` value) unless the corresponding test assertions are updated in the same change. The goal is to remove "Fictional/Synthetic/Mock" from **user-facing** strings; internal provenance constants that tests assert on should be updated in tandem.

---

## 7. Tests

**File: `smoke-tests/atlas/proxy-allowlist-offline-tests.mjs`** (new)

Tests that run against the proxy module directly (no real Atlas calls):
1. `/api/atlas/search` is forwarded (mock upstream returns 200).
2. `/api/atlas/verify` is forwarded (mock upstream returns 200).
3. `/api/atlas/order` returns 404 (blocked by allow-list).
4. `/api/atlas/ticket` returns 404.
5. `/api/atlas/payment` returns 404.
6. `/api/atlas/anything-else` returns 404.
7. Credentials are not present in the forwarded response body or headers.

**File: `smoke-tests/atlas/live-mode-offline-tests.mjs`** (new)

Mock the proxy responses and test the browser-side `atlasClient.ts` logic:
1. Search success path — returns typed `AtlasSearchResponse`.
2. Verify success path — returns typed `AtlasVerifyResponse`.
3. Timeout — returns error after 8s.
4. 5xx error — one retry then error.
5. 429 rate-limit — no retry, returns rate-limit error.
6. Re-verification price-changed — verify returns `PRICE_CHANGED`, caller updates candidate.
7. Empty result — returns empty offers array, triggers "no alternatives" UI state.

**File: `smoke-tests/banned-words-offline-tests.mjs`** (new or extend existing)

Assert that the strings "Booked", "Switched", "Ticket issued", "Payment completed" do not appear in:
- Any component render path in live mode (given no verified outcome exists).
- The `RecoveryPlanAnimation` component output when `verifiedOutcome === null`.

**Existing tests**: All existing `verify:offline` tests must continue to pass unmodified. The new `DATA_MODE` defaults to `offline`, so no existing behavior changes.

---

## 8. Config and secrets verification

- `.env.local` is already gitignored (confirmed: `.gitignore` line 3: `.env.*` with exception for `.env.example`).
- Add `ATLAS_CLIENT_ID=` and `ATLAS_CLIENT_SECRET=` as empty placeholders to `.env.example` if not already present.
- Add `DATA_MODE=offline` to `.env.example`.
- The Vite proxy loads `.env.local` via `dotenv` at server startup only. The `define: { __DATA_MODE__ }` injects only the mode string, not credentials.
- Post-build verification: after `npm run build`, grep the `dist/` output for `ATLAS_CLIENT` and `sandbox.atriptech.com` — neither should appear.

---

## 9. Adapter mapping — Atlas offers to existing UI types

The existing `Alternative` type (from `core/domain`) and `RecoveryOption` type (from `app/src/types/recovery-plan.ts`) need an adapter function to map real Atlas offers into the UI shape.

**File: `app/src/lib/atlasAdapter.ts`** (new)

```ts
export function atlasOfferToRecoveryOption(offer: AtlasOffer): RecoveryOption {
  // Map segments[0] to routeSummary, departure/arrival times
  // Map total_price + currency to priceDisplay
  // Map bookable + price_status to availabilityLabel
  // Normalize time format from "202609151500" to "15:00"
}

export function atlasSearchToSearchResult(response: AtlasSearchResponse): SearchResult {
  // Map offers[] to alternatives[]
  // Set searchStatus, correlationId, evidenceSource
}
```

---

## Execution order

1. Discovery: confirm exact Atlas REST endpoint paths from CLI source or docs.
2. `app/atlas-proxy.mjs` — proxy middleware with allow-list.
3. `app/vite.config.ts` — wire proxy + `__DATA_MODE__` define + dotenv loading.
4. `app/src/lib/atlasClient.ts` — browser client module.
5. `app/src/lib/atlasAdapter.ts` — Atlas-to-UI type adapter.
6. `app/src/lib/dataMode.ts` — mode toggle.
7. `core/provenance/labels.ts` + `core/domain/execution-mode.ts` — new labels/mode.
8. `app/src/App.tsx` — integrate live flow, re-verification, submit guard.
9. `app/src/components/RecoveryPlanAnimation.tsx` — add `onBeforeCollapse` hook.
10. UI string cleanup across components (table in section 6).
11. `.env.example` updates.
12. Tests: proxy allow-list, live-mode mock, banned-words.
13. Post-build secret scan: verify no credentials in `dist/`.
