/* ── Atlas live client types ──
 *
 * Types for the browser-side Atlas client that communicates with the
 * Vite dev-server proxy. The proxy calls the atlas-flight CLI; the
 * browser never contacts Atlas directly.
 *
 * No credentials, tokens, or Atlas host URLs appear in this file. */

/* ── Raw Atlas CLI shapes (from proxy) ── */

/** Raw flight segment from the proxy response. */
export interface AtlasRawSegment {
  departure_airport: string;
  arrival_airport: string;
  departure_time: string; // YYYYMMDDHHmm
  arrival_time: string; // YYYYMMDDHHmm
  carrier: string;
  operating_carrier?: string | null;
  flight_number: string;
  duration_minutes: number;
  cabin_class?: number;
  direction?: string;
}

/** Raw offer as returned by the proxy /api/atlas/search endpoint. */
export interface AtlasRawOffer {
  offer_id: string;
  currency: string;
  total_price: number;
  transaction_fee_total?: number;
  passenger_prices?: Array<{
    passenger_type: string;
    count: number;
    base_fare_per_passenger: number;
    tax_per_passenger: number;
    subtotal: number;
  }>;
  segments: AtlasRawSegment[];
  ancillary_supported?: string[];
  bookable: boolean;
  price_status: string;
  refresh_time?: string;
  expire_time?: string;
}

/* ── Proxy response envelopes ── */

/** Proxy /api/atlas/search response envelope. */
export interface AtlasSearchResponse {
  searchId: string;
  offerCount: number;
  offers: AtlasRawOffer[];
  responseCode: string;
  timestamp: string;
}

/** Proxy /api/atlas/verify response envelope. */
export interface AtlasVerifyResponse {
  status: string;
  code: string | null;
  message: string | null;
  data: {
    booking_id?: string;
    previous_price?: number;
    current_price?: number;
    currency?: string;
    price_change?: string;
    requirements?: { required_fields: string[] };
    travelers?: Array<{ traveler_id: string; passenger_type: string }>;
    segments?: AtlasRawSegment[];
    baggage_supported?: boolean;
    seat_supported?: boolean;
  } | null;
  timestamp: string;
}

/* ── Request payloads ── */

/** Search request payload sent to the proxy. */
export interface AtlasSearchRequest {
  origin: string;
  destination: string;
  depart: string; // YYYY-MM-DD
  adults: number;
  currency: string;
}

/** Verify request payload sent to the proxy. */
export interface AtlasVerifyRequest {
  offerId: string;
}

/* ── Proxy error response ── */

export interface AtlasProxyError {
  error: string;
  message: string;
}

/* ── Atlas Sandbox write-scaffold contracts ──
 *
 * Typed request/response envelopes for the five exact scaffold routes
 * served by app/server/atlas-sandbox-writes.mjs:
 *   POST /api/atlas/sandbox/capabilities
 *   POST /api/atlas/sandbox/confirm-intent
 *   POST /api/atlas/sandbox/order
 *   POST /api/atlas/sandbox/pay
 *   POST /api/atlas/sandbox/status
 *
 * Field names mirror the server module's actual responses. The browser
 * never sends credentials, passenger identity, contact, or payment data
 * (the server rejects such keys with 400 browser_supplied_data_rejected).
 * Opaque identifiers (bookingId / orderNo / tokens / keys) are plain
 * strings ≤128 chars with no further structure. */

/** Machine-readable scaffold error envelope (any non-2xx response). */
export interface AtlasSandboxError {
  error: string;
  message?: string;
  /** Present when a response is replayed from a completed idempotency record. */
  replayed?: boolean;
}

/** Evidence metadata attached to sandbox scaffold operations. */
export interface AtlasSandboxEvidenceMetadata {
  correlationId?: string | null;
  searchId?: string | null;
  offerId?: string | null;
  bookingId?: string | null;
  orderNo?: string | null;
  providerResponseCode?: string | null;
  /** SHA-256 hex prefix of the idempotency key; the raw key is never stored. */
  idempotencyKeyHash?: string | null;
  latencyMs?: number | null;
  /** Compact gate result summary (name→ok); never carries secrets. */
  gateEvaluation?: Record<string, boolean> | null;
  orderStatusCode?: string | number | null;
  timestamp?: string;
  noRealBooking?: boolean;
  noRealCharge?: boolean;
  noAirlineTicketIssued?: boolean;
}

/* ── /capabilities (read-only) ── */

export interface AtlasSandboxCapabilitiesResponse {
  sandboxWritesEnabled: boolean;
  environment: 'sandbox' | string;
  /** Write execution status; always 'disabled_pending_contract_approval' in the scaffold. */
  writeExecution: string;
  /** Always false while execution is blocked pending spec approval. */
  executionApproved: boolean;
  passengerContract: string;
  ticketingActivation: string;
  gates: Record<string, boolean>;
  timestamp: string;
}

/* ── /confirm-intent ── */

export interface AtlasSandboxConfirmIntentRequest {
  operation: 'order' | 'pay';
  /** Opaque booking identifier (operation 'order'). */
  bookingId?: string;
  /** Opaque order number (operation 'pay'). */
  orderNo?: string;
}

export interface AtlasSandboxConfirmIntentResponse {
  confirmationToken: string;
  expiresInSeconds: number;
}

/* ── /order (fail closed: 503 sandbox_write_not_implemented) ── */

/** Opaque traveler reference from Verify data.travelers; the browser
 *  never holds passenger identity data. */
export interface AtlasSandboxTravelerRef {
  traveler_id: string;
  passenger_type: string;
}

export interface AtlasSandboxOrderRequest {
  bookingId: string;
  travelers?: AtlasSandboxTravelerRef[];
  confirmationToken: string;
  idempotencyKey: string;
}

/** Success envelope shape for a future approved implementation; the
 *  scaffold always answers 503 sandbox_write_not_implemented instead. */
export interface AtlasSandboxOrderResponse {
  orderNo: string;
  code: string;
  paymentSummary?: {
    currency: string;
    total: number;
    deadline?: string;
  };
  nextAction?: string;
  timestamp: string;
  evidence?: AtlasSandboxEvidenceMetadata;
  replayed?: boolean;
}

/* ── /pay (fail closed: 503 sandbox_write_not_implemented) ── */

/** The browser never holds the payment confirmation id; it only sends
 *  the order number plus a fresh human confirmation token. */
export interface AtlasSandboxPayRequest {
  orderNo: string;
  confirmationToken: string;
  idempotencyKey: string;
}

export interface AtlasSandboxPayResponse {
  orderNo: string;
  code: string;
  nextAction?: string;
  duplicate?: boolean;
  timestamp: string;
  evidence?: AtlasSandboxEvidenceMetadata;
  replayed?: boolean;
}

/* ── /status (read-only) ── */

export interface AtlasSandboxStatusRequest {
  orderNo: string;
}

export type AtlasSandboxOrderStatus =
  | 'unpaid'
  | 'ticketing'
  | 'ticketed-simulated'
  | 'cancelled'
  | 'unknown';

export interface AtlasSandboxStatusResponse {
  orderNo: string;
  status: AtlasSandboxOrderStatus;
  cliCode: string | null;
  rawCode?: string | number | null;
  terminal: boolean;
  /** True for the default scaffold response (execution disabled). */
  scaffold?: boolean;
  reason?: string;
  timestamp: string;
}
