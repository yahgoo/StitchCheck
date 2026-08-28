/* ── Atlas Sandbox browser client ──
 *
 * Calls only the local Vite proxy endpoints:
 *   POST /api/atlas/search
 *   POST /api/atlas/verify
 *   POST /api/atlas/sandbox/capabilities | confirm-intent | order | pay | status
 *     (write-scaffold routes; fail closed — order/pay execution is
 *     disabled server-side pending contract approval)
 *
 * This client NEVER contains:
 *   - Atlas host URLs
 *   - Client IDs or secrets
 *   - Tokens
 *   - Environment file references
 *   - Direct Atlas SDK imports
 *
 * All credentials are handled server-side by the proxy. */

import type {
  AtlasSearchRequest,
  AtlasSearchResponse,
  AtlasVerifyResponse,
  AtlasProxyError,
  AtlasSandboxCapabilitiesResponse,
  AtlasSandboxConfirmIntentRequest,
  AtlasSandboxConfirmIntentResponse,
  AtlasSandboxOrderRequest,
  AtlasSandboxOrderResponse,
  AtlasSandboxPayRequest,
  AtlasSandboxPayResponse,
  AtlasSandboxStatusRequest,
  AtlasSandboxStatusResponse,
} from './types';

/* ── Search ── */

export async function atlasSearch(params: AtlasSearchRequest): Promise<AtlasSearchResponse> {
  const res = await fetch('/api/atlas/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Search returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSearchResponse>;
}

/* ── Verify ── */

export async function atlasVerify(offerId: string): Promise<AtlasVerifyResponse> {
  const res = await fetch('/api/atlas/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offerId }),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Verify returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasVerifyResponse>;
}

/* ── Atlas Sandbox write-scaffold routes ──
 *
 * Five exact relative routes served by the local dev-server scaffold
 * (app/server/atlas-sandbox-writes.mjs). No absolute URLs, no proxy
 * bypass, no credentials. The scaffold fails closed: order/pay answer
 * 503 `sandbox_write_not_implemented`, which these functions surface as
 * an AtlasClientError exactly like the read routes surface errors. */

export async function atlasSandboxCapabilities(): Promise<AtlasSandboxCapabilitiesResponse> {
  const res = await fetch('/api/atlas/sandbox/capabilities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Sandbox capabilities returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSandboxCapabilitiesResponse>;
}

export async function atlasSandboxConfirmIntent(
  params: AtlasSandboxConfirmIntentRequest,
): Promise<AtlasSandboxConfirmIntentResponse> {
  const res = await fetch('/api/atlas/sandbox/confirm-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Sandbox confirm-intent returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSandboxConfirmIntentResponse>;
}

export async function atlasSandboxOrder(
  params: AtlasSandboxOrderRequest,
): Promise<AtlasSandboxOrderResponse> {
  const res = await fetch('/api/atlas/sandbox/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Sandbox order returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSandboxOrderResponse>;
}

export async function atlasSandboxPay(
  params: AtlasSandboxPayRequest,
): Promise<AtlasSandboxPayResponse> {
  const res = await fetch('/api/atlas/sandbox/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Sandbox pay returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSandboxPayResponse>;
}

export async function atlasSandboxStatus(
  params: AtlasSandboxStatusRequest,
): Promise<AtlasSandboxStatusResponse> {
  const res = await fetch('/api/atlas/sandbox/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody: AtlasProxyError = await res.json().catch(() => ({
      error: 'unknown',
      message: `Atlas Sandbox status returned HTTP ${res.status}`,
    }));
    throw new AtlasClientError(errBody.error, errBody.message, res.status);
  }

  return res.json() as Promise<AtlasSandboxStatusResponse>;
}

/* ── Error type ── */

export class AtlasClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'AtlasClientError';
  }
}
