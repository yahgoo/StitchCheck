/* ── Pure unbooked preview helpers (Node offline tests + live check mirror)
 * Keep selection / sequential-verify logic aligned with unbooked-previews.ts */

import { formatMissingField } from '../../../core/copy/missing-field-labels.mjs';

export const UNBOOKED_PREVIEW_DISCLOSURE =
  'Unbooked preview · Not a real ticket · No booking, payment, or reservation created';

export const PLACEHOLDER_IATA_CODES = new Set(['AAA', 'BBB', 'CCC']);

export const MAX_PREVIEWS_PER_LEG = 5;

export const VERIFY_DELAY_MS = 300;

export const OFFER_SELECTION_RULE =
  'lowest total_price ascending, tie-break offer_id lexicographic';

export const BEST_OPTION_SELECTION_RULE =
  'among up-to-5 offers for the leg (OFFER_SELECTION_RULE order): lowest total_price with successful Verify; if none verified, lowest total_price attempted with verify-failed status';

export function selectBestOptionCard(cards) {
  if (cards.length === 0) return null;
  const lowestVerified = cards.find((c) => c.status === 'verified' && c.isLiveVerified);
  if (lowestVerified) return lowestVerified;
  return cards[0];
}

export function splitPreviewCardsForDisplay(cards) {
  const best = selectBestOptionCard(cards);
  if (!best) return { best: null, remaining: [] };
  const bestIndex = cards.indexOf(best);
  return {
    best,
    remaining: cards.filter((_, index) => index !== bestIndex),
  };
}

export function isPlaceholderLeg(origin, destination) {
  const o = (origin || '').trim().toUpperCase();
  const d = (destination || '').trim().toUpperCase();
  return PLACEHOLDER_IATA_CODES.has(o) || PLACEHOLDER_IATA_CODES.has(d);
}

export function compareOffersBySelectionRule(a, b) {
  const pa = typeof a.total_price === 'number' ? a.total_price : Number.POSITIVE_INFINITY;
  const pb = typeof b.total_price === 'number' ? b.total_price : Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return (a.offer_id || '').localeCompare(b.offer_id || '');
}

export function sortOffersBySelectionRule(offers) {
  return [...offers].sort(compareOffersBySelectionRule);
}

export function selectOffersForPreview(offers, maxCount = MAX_PREVIEWS_PER_LEG) {
  return sortOffersBySelectionRule(offers).slice(0, maxCount);
}

function parseAlternativeTotalPrice(alt) {
  const parts = alt.priceDisplay?.trim().split(/\s+/);
  if (parts && parts.length >= 2) {
    const parsed = parseFloat(parts[parts.length - 1]);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number.POSITIVE_INFINITY;
}

export function sortAlternativesBySelectionRule(alternatives) {
  return [...alternatives].sort((a, b) => {
    const pa = parseAlternativeTotalPrice(a);
    const pb = parseAlternativeTotalPrice(b);
    if (pa !== pb) return pa - pb;
    return (a.offerReference || '').localeCompare(b.offerReference || '');
  });
}

export function splitAlternativesForDisplay(alternatives) {
  const sorted = sortAlternativesBySelectionRule(alternatives);
  if (sorted.length === 0) return { featured: null, remaining: [] };
  return {
    featured: sorted[0],
    remaining: sorted.slice(1),
  };
}

export function shouldSelectPlanAfterVerify(status) {
  return status === 'success';
}

export function buildSectionLiveSourceLabel(liveVerifiedCount) {
  if (liveVerifiedCount < 1) return null;
  const noun = liveVerifiedCount === 1 ? 'offer' : 'offers';
  return `Source: Atlas Sandbox · live (${liveVerifiedCount} ${noun} verified individually)`;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @param {Array<{ offer_id?: string; total_price?: number; currency?: string; segments?: unknown[]; bookable?: boolean; price_status?: string }>} offers
 * @param {(offerId: string) => Promise<{ status: string; code?: string | null; message?: string | null; data?: Record<string, unknown> | null; timestamp?: string }>} verifyFn
 * @param {(offer: object) => { offerReference: string; routeSummary: string; departureTime: string; arrivalTime: string; priceDisplay: string; currency: string; connectionType: string }} mapOffer
 * @param {(offerId: string, response: object) => { status: string; currentPrice?: string; currency?: string }} mapVerify
 * @param {number} [delayMs]
 * @param {(offerId: string) => void} [onVerifyStart]
 */
export async function verifyOffersSequentially(
  offers,
  verifyFn,
  mapOffer,
  mapVerify,
  delayMs = VERIFY_DELAY_MS,
  onVerifyStart,
) {
  const cards = [];

  for (let i = 0; i < offers.length; i += 1) {
    const offer = offers[i];
    const alt = mapOffer(offer);
    const offerId = alt.offerReference;
    const NOT_AVAILABLE_CRITICAL = formatMissingField('critical');

    if (offerId === NOT_AVAILABLE_CRITICAL || !offerId) {
      cards.push({
        offerReference: offerId || NOT_AVAILABLE_CRITICAL,
        routeSummary: alt.routeSummary,
        departureTime: alt.departureTime,
        arrivalTime: alt.arrivalTime,
        priceDisplay: alt.priceDisplay,
        currency: alt.currency,
        connectionType: alt.connectionType,
        status: 'verify-failed',
        failureMessage: 'Could not verify this offer',
        isLiveVerified: false,
      });
      continue;
    }

    onVerifyStart?.(offerId);

    try {
      const response = await verifyFn(offerId);
      const summary = mapVerify(offerId, response);
      if (summary.status === 'success') {
        cards.push({
          offerReference: offerId,
          routeSummary: alt.routeSummary,
          departureTime: alt.departureTime,
          arrivalTime: alt.arrivalTime,
          priceDisplay: alt.priceDisplay,
          currency: alt.currency,
          connectionType: alt.connectionType,
          status: 'verified',
          verifySummary: summary,
          isLiveVerified: true,
        });
      } else {
        cards.push({
          offerReference: offerId,
          routeSummary: alt.routeSummary,
          departureTime: alt.departureTime,
          arrivalTime: alt.arrivalTime,
          priceDisplay: alt.priceDisplay,
          currency: alt.currency,
          connectionType: alt.connectionType,
          status: 'verify-failed',
          failureMessage: 'Could not verify this offer',
          isLiveVerified: false,
        });
      }
    } catch {
      cards.push({
        offerReference: offerId,
        routeSummary: alt.routeSummary,
        departureTime: alt.departureTime,
        arrivalTime: alt.arrivalTime,
        priceDisplay: alt.priceDisplay,
        currency: alt.currency,
        connectionType: alt.connectionType,
        status: 'verify-failed',
        failureMessage: 'Could not verify this offer',
        isLiveVerified: false,
      });
    }

    if (i < offers.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return cards;
}

export function createEmptyLegSection(legKey, origin, destination, loading = false) {
  const title = legKey === 'first'
    ? 'First flight — unbooked previews (up to 5)'
    : 'Second flight — unbooked previews (up to 5)';
  return {
    legKey,
    title,
    origin,
    destination,
    loading,
    placeholderBlocked: false,
    searchUnavailable: false,
    offersReturned: 0,
    offersSelected: 0,
    liveVerifiedCount: 0,
    verifyFailures: 0,
    cards: [],
    fallbackMessage: null,
  };
}
