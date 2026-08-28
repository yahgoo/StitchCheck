/* ── Atlas Sandbox response adapter ──
 *
 * Maps actual Atlas CLI JSON output to the app's SearchResult
 * and Alternative interfaces. Uses only Atlas-derived data —
 * never falls back to local fixture values for live results.
 *
 * Missing fields render as "Not available from Atlas response". */

import type { AtlasRawOffer, AtlasSearchResponse, AtlasVerifyResponse } from './types';
import type { SearchResult, Alternative } from '../../../core/domain';

const NOT_AVAILABLE = 'Not available from Atlas response';

/* ── Time formatting ── */

/** Parse "YYYYMMDDHHmm" → "HH:MM" (UTC). */
function formatTime(raw: string | undefined): string {
  if (!raw || raw.length < 12) return NOT_AVAILABLE;
  const hh = raw.slice(8, 10);
  const mm = raw.slice(10, 12);
  if (!hh || !mm) return NOT_AVAILABLE;
  return `${hh}:${mm}`;
}

/** Format duration_minutes → "Xh Ym". */
function formatDuration(minutes: number | undefined): string {
  if (typeof minutes !== 'number' || minutes < 0) return NOT_AVAILABLE;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Parse YYYYMMDDHHmm → minutes since midnight (for connection gap calc). */
function parseTime(raw: string): number | null {
  if (!raw || raw.length < 12) return null;
  const hh = parseInt(raw.slice(8, 10), 10);
  const mm = parseInt(raw.slice(10, 12), 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return hh * 60 + mm;
}

/* ── Map one Atlas offer → app Alternative ── */

function mapOfferToAlternative(offer: AtlasRawOffer): Alternative {
  const segments = offer.segments || [];
  const first = segments[0];
  const last = segments[segments.length - 1];

  const depAirport = first?.departure_airport ?? NOT_AVAILABLE;
  const arrAirport = last?.arrival_airport ?? NOT_AVAILABLE;
  const routeSummary = segments.length > 1
    ? `${depAirport} → ${arrAirport} (${segments.length - 1}-stop)`
    : `${depAirport} → ${arrAirport}`;

  const carrier = first?.carrier || NOT_AVAILABLE;
  const flightNo = first?.flight_number || '';

  const departureTime = formatTime(first?.departure_time);
  const arrivalTime = formatTime(last?.arrival_time);
  const totalDuration = segments.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const duration = formatDuration(totalDuration);

  const connectionType = segments.length <= 1
    ? 'nonstop'
    : `${segments.length - 1}-stop`;

  // Connection duration: gap between segments (if multi-segment)
  let connectionDurationMinutes = 0;
  if (segments.length > 1) {
    for (let i = 0; i < segments.length - 1; i++) {
      const arrTime = parseTime(segments[i].arrival_time);
      const depTime = parseTime(segments[i + 1].departure_time);
      if (arrTime !== null && depTime !== null) {
        connectionDurationMinutes += Math.max(0, depTime - arrTime);
      }
    }
  }

  const priceDisplay = typeof offer.total_price === 'number'
    ? `${offer.currency} ${offer.total_price.toFixed(2)}`
    : NOT_AVAILABLE;

  const currency = offer.currency || NOT_AVAILABLE;

  const availabilityLabel = offer.bookable === true
    ? 'Available'
    : offer.price_status === 'current'
      ? 'Price confirmed'
      : 'Unavailable';

  return {
    offerReference: offer.offer_id || NOT_AVAILABLE,
    routeSummary: `${routeSummary} (${carrier}${flightNo ? ' ' + flightNo : ''})`,
    departureTime,
    arrivalTime,
    duration,
    connectionType,
    connectionDurationMinutes,
    priceDisplay,
    currency,
    availabilityLabel,
  };
}

/* ── Map full search response → SearchResult ── */

function sortOffersBySelectionRule(offers: AtlasRawOffer[]): AtlasRawOffer[] {
  return [...offers].sort((a, b) => {
    const pa = typeof a.total_price === 'number' ? a.total_price : Number.POSITIVE_INFINITY;
    const pb = typeof b.total_price === 'number' ? b.total_price : Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return (a.offer_id || '').localeCompare(b.offer_id || '');
  });
}

export function mapSearchResponseToResult(
  response: AtlasSearchResponse,
): SearchResult {
  const alternatives = sortOffersBySelectionRule(response.offers ?? []).map(mapOfferToAlternative);

  return {
    correlationId: response.searchId,
    searchStatus: alternatives.length > 0 ? 'completed' : 'empty',
    sourceEnvironment: 'atlas-sandbox',
    alternatives,
    errorCode: null,
    errorMessage: null,
    fallbackUsed: false,
    evidenceSource: 'atlas-sandbox',
    provider: 'atlas',
    executed: true,
  };
}

/* ── Map error → SearchResult ── */

export function mapErrorToResult(error: { code: string; message: string }): SearchResult {
  const isTimeout = error.code === 'CLI_TIMEOUT' || error.message?.includes('timed out');
  return {
    correlationId: `error-${Date.now()}`,
    searchStatus: isTimeout ? 'timeout' : 'error',
    sourceEnvironment: 'atlas-sandbox',
    alternatives: [],
    errorCode: error.code || 'UNKNOWN',
    errorMessage: error.message || 'Atlas Search failed',
    fallbackUsed: false,
    evidenceSource: 'atlas-sandbox',
    provider: 'atlas',
    executed: true,
  };
}

/* ── Verify response summary ── */

export interface VerifySummary {
  offerId: string;
  status: string;
  code: string | null;
  message: string | null;
  previousPrice: string;
  currentPrice: string;
  currency: string;
  priceChange: string;
  timestamp: string;
  /** Opaque booking identifier passed through from Verify data.booking_id
   *  (Atlas Sandbox write-scaffold scaffolding; absent when not returned). */
  bookingId?: string;
  /** Opaque traveler references passed through from Verify data.travelers.
   *  No passenger identity data — identifiers only. */
  travelers?: Array<{ travelerId: string; passengerType: string }>;
}

export function mapVerifyResponse(
  offerIdOrResponse: string | AtlasVerifyResponse,
  response?: AtlasVerifyResponse,
): VerifySummary {
  // Support both (offerId, response) and legacy (response) signatures
  const actualResponse = response ?? (typeof offerIdOrResponse === 'string' ? null : offerIdOrResponse);
  const offerId = typeof offerIdOrResponse === 'string' ? offerIdOrResponse : 'unknown';
  if (!actualResponse) {
    return {
      offerId,
      status: 'error',
      code: 'invalid_response',
      message: 'No response data',
      previousPrice: NOT_AVAILABLE,
      currentPrice: NOT_AVAILABLE,
      currency: NOT_AVAILABLE,
      priceChange: NOT_AVAILABLE,
      timestamp: new Date().toISOString(),
    };
  }
  const data = actualResponse.data;
  return {
    offerId,
    status: actualResponse.status,
    code: actualResponse.code,
    message: actualResponse.message,
    previousPrice: data?.previous_price !== undefined
      ? String(data.previous_price)
      : NOT_AVAILABLE,
    currentPrice: data?.current_price !== undefined
      ? String(data.current_price)
      : NOT_AVAILABLE,
    currency: data?.currency || NOT_AVAILABLE,
    priceChange: data?.price_change || NOT_AVAILABLE,
    timestamp: actualResponse.timestamp,
    // Additive pass-through for the Atlas Sandbox write-scaffold: opaque
    // booking identifier and traveler references only. Existing field
    // mappings above are unchanged.
    ...(data?.booking_id !== undefined ? { bookingId: data.booking_id } : {}),
    // Guarded with Array.isArray so a non-array/null travelers value in
    // the CLI payload can never throw on .map().
    ...(Array.isArray(data?.travelers)
      ? {
          travelers: data.travelers.map((t) => ({
            travelerId: t.traveler_id,
            passengerType: t.passenger_type,
          })),
        }
      : {}),
  };
}

/* ── Legacy aliases for backward compatibility ── */

/** @deprecated Use mapSearchResponseToResult */
export const mapSearchResponse = mapSearchResponseToResult;

/** Legacy verify status type */
export interface VerifyStatus {
  status: string;
  code: string;
  message: string;
  verified: boolean;
}

/** Legacy verify response mapper (single-argument) */
export function mapVerifyResponseLegacy(response: AtlasVerifyResponse): VerifyStatus {
  if (response.status === 'success') {
    return {
      status: 'Verified',
      code: response.code || 'OFFER_VERIFIED',
      message: 'Offer price confirmed by Atlas Sandbox',
      verified: true,
    };
  }
  if (response.code === 'PRICE_CONFIRMATION_REQUIRED') {
    return {
      status: response.code,
      code: response.code,
      message: response.message || 'Price confirmation required',
      verified: false,
    };
  }
  return {
    status: 'Verification failed',
    code: response.code || 'verify_failed',
    message: response.message || 'Atlas Verify did not succeed',
    verified: false,
  };
}
