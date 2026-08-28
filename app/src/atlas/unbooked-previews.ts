/* ── Unbooked ticket preview pipeline (read-only Atlas Search + Verify) ──
 *
 * Selects up to 5 offers per leg, verifies each sequentially with a delay,
 * and gates live provenance per card (never fabricates previews). */

import type { AtlasRawOffer, AtlasSearchRequest, AtlasSearchResponse, AtlasVerifyResponse } from './types';
import { mapSearchResponseToResult, mapVerifyResponse } from './adapter';
import type { VerifySummary } from './adapter';
import type { Alternative } from '../../../core/domain';
import { formatMissingField } from '../../../core/copy/missing-field-labels';
import { atlasSearch, atlasVerify } from './client';

export const UNBOOKED_PREVIEW_DISCLOSURE =
  'Unbooked preview · Not a real ticket · No booking, payment, or reservation created';

export const PLACEHOLDER_IATA_CODES = new Set(['AAA', 'BBB', 'CCC']);

export const MAX_PREVIEWS_PER_LEG = 5;

export const VERIFY_DELAY_MS = 300;

export const OFFER_SELECTION_RULE =
  'lowest total_price ascending, tie-break offer_id lexicographic';

export function compareOffersBySelectionRule(a: AtlasRawOffer, b: AtlasRawOffer): number {
  const pa = typeof a.total_price === 'number' ? a.total_price : Number.POSITIVE_INFINITY;
  const pb = typeof b.total_price === 'number' ? b.total_price : Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  return (a.offer_id || '').localeCompare(b.offer_id || '');
}

export function sortOffersBySelectionRule(offers: AtlasRawOffer[]): AtlasRawOffer[] {
  return [...offers].sort(compareOffersBySelectionRule);
}

/** Featured default card per leg — extends OFFER_SELECTION_RULE with Verify outcome. */
export const BEST_OPTION_SELECTION_RULE =
  'among up-to-5 offers for the leg (OFFER_SELECTION_RULE order): lowest total_price with successful Verify; if none verified, lowest total_price attempted with verify-failed status';

export function isPlaceholderLeg(origin: string, destination: string): boolean {
  const o = (origin || '').trim().toUpperCase();
  const d = (destination || '').trim().toUpperCase();
  return PLACEHOLDER_IATA_CODES.has(o) || PLACEHOLDER_IATA_CODES.has(d);
}

export function selectBestOptionCard(
  cards: UnbookedPreviewCard[],
): UnbookedPreviewCard | null {
  if (cards.length === 0) return null;
  const lowestVerified = cards.find((c) => c.status === 'verified' && c.isLiveVerified);
  if (lowestVerified) return lowestVerified;
  return cards[0];
}

export function splitPreviewCardsForDisplay(cards: UnbookedPreviewCard[]): {
  best: UnbookedPreviewCard | null;
  remaining: UnbookedPreviewCard[];
} {
  const best = selectBestOptionCard(cards);
  if (!best) return { best: null, remaining: [] };
  const bestIndex = cards.indexOf(best);
  return {
    best,
    remaining: cards.filter((_, index) => index !== bestIndex),
  };
}

export function selectOffersForPreview(
  offers: AtlasRawOffer[],
  maxCount = MAX_PREVIEWS_PER_LEG,
): AtlasRawOffer[] {
  return sortOffersBySelectionRule(offers).slice(0, maxCount);
}

function parseAlternativeTotalPrice(alt: Alternative): number {
  const parts = alt.priceDisplay?.trim().split(/\s+/);
  if (parts && parts.length >= 2) {
    const parsed = parseFloat(parts[parts.length - 1]);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number.POSITIVE_INFINITY;
}

export function sortAlternativesBySelectionRule(alternatives: Alternative[]): Alternative[] {
  return [...alternatives].sort((a, b) => {
    const pa = parseAlternativeTotalPrice(a);
    const pb = parseAlternativeTotalPrice(b);
    if (pa !== pb) return pa - pb;
    return (a.offerReference || '').localeCompare(b.offerReference || '');
  });
}

export function splitAlternativesForDisplay(alternatives: Alternative[]): {
  featured: Alternative | null;
  remaining: Alternative[];
} {
  const sorted = sortAlternativesBySelectionRule(alternatives);
  if (sorted.length === 0) return { featured: null, remaining: [] };
  return {
    featured: sorted[0],
    remaining: sorted.slice(1),
  };
}

/** Whether a successful Verify outcome may proceed to plan selection. */
export function shouldSelectPlanAfterVerify(status: string): boolean {
  return status === 'success';
}

export type UnbookedPreviewCardStatus = 'verified' | 'verify-failed';

export interface UnbookedPreviewCard {
  offerReference: string;
  routeSummary: string;
  departureTime: string;
  arrivalTime: string;
  priceDisplay: string;
  currency: string;
  connectionType: string;
  status: UnbookedPreviewCardStatus;
  verifySummary?: VerifySummary;
  failureMessage?: string;
  isLiveVerified: boolean;
}

export interface LegUnbookedPreviewSection {
  legKey: 'first' | 'second';
  title: string;
  origin: string;
  destination: string;
  loading: boolean;
  placeholderBlocked: boolean;
  searchUnavailable: boolean;
  offersReturned: number;
  offersSelected: number;
  liveVerifiedCount: number;
  verifyFailures: number;
  cards: UnbookedPreviewCard[];
  fallbackMessage: string | null;
}

function criticalMissing(): string {
  return formatMissingField('critical');
}

function nonCriticalMissing(): string {
  return formatMissingField('nonCritical');
}

const NOT_AVAILABLE_CRITICAL = criticalMissing();

function mapSingleOffer(offer: AtlasRawOffer): Alternative {
  const mapped = mapSearchResponseToResult({
    searchId: 'unbooked-preview',
    offerCount: 1,
    offers: [offer],
    responseCode: 'OK',
    timestamp: new Date().toISOString(),
  });
  return mapped.alternatives[0] ?? {
    offerReference: offer.offer_id || NOT_AVAILABLE_CRITICAL,
    routeSummary: criticalMissing(),
    departureTime: nonCriticalMissing(),
    arrivalTime: nonCriticalMissing(),
    duration: nonCriticalMissing(),
    connectionType: nonCriticalMissing(),
    connectionDurationMinutes: 0,
    priceDisplay: criticalMissing(),
    currency: criticalMissing(),
    availabilityLabel: nonCriticalMissing(),
  };
}

export function buildSectionLiveSourceLabel(liveVerifiedCount: number): string | null {
  if (liveVerifiedCount < 1) return null;
  const noun = liveVerifiedCount === 1 ? 'offer' : 'offers';
  return `Source: Atlas Sandbox · live (${liveVerifiedCount} ${noun} verified individually)`;
}

export function createEmptyLegSection(
  legKey: 'first' | 'second',
  origin: string,
  destination: string,
  loading = false,
): LegUnbookedPreviewSection {
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function verifyOffersSequentially(
  offers: AtlasRawOffer[],
  verifyFn: (offerId: string) => Promise<AtlasVerifyResponse>,
  delayMs = VERIFY_DELAY_MS,
  onVerifyStart?: (offerId: string) => void,
): Promise<UnbookedPreviewCard[]> {
  const cards: UnbookedPreviewCard[] = [];

  for (let i = 0; i < offers.length; i += 1) {
    const offer = offers[i];
    const alt = mapSingleOffer(offer);
    const offerId = alt.offerReference;

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
      const summary = mapVerifyResponse(offerId, response);
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

export async function loadLegUnbookedPreviews(params: {
  legKey: 'first' | 'second';
  origin: string;
  destination: string;
  depart: string;
  searchFn?: (request: AtlasSearchRequest) => Promise<AtlasSearchResponse>;
  verifyFn?: (offerId: string) => Promise<AtlasVerifyResponse>;
  delayMs?: number;
  onVerifyStart?: (offerId: string) => void;
}): Promise<LegUnbookedPreviewSection> {
  const {
    legKey,
    origin,
    destination,
    depart,
    searchFn = atlasSearch,
    verifyFn = atlasVerify,
    delayMs = VERIFY_DELAY_MS,
    onVerifyStart,
  } = params;

  const section = createEmptyLegSection(legKey, origin, destination, false);

  if (isPlaceholderLeg(origin, destination)) {
    return {
      ...section,
      placeholderBlocked: true,
      fallbackMessage: criticalMissing(),
    };
  }

  try {
    const response = await searchFn({
      origin,
      destination,
      depart,
      adults: 1,
      currency: 'USD',
    });

    const offersReturned = response.offers?.length ?? 0;
    section.offersReturned = offersReturned;

    if (offersReturned === 0) {
      return {
        ...section,
        searchUnavailable: true,
        fallbackMessage: criticalMissing(),
      };
    }

    const selected = selectOffersForPreview(response.offers ?? []);
    section.offersSelected = selected.length;

    const cards = await verifyOffersSequentially(selected, verifyFn, delayMs, onVerifyStart);
    section.cards = cards;
    section.liveVerifiedCount = cards.filter((c) => c.isLiveVerified).length;
    section.verifyFailures = cards.filter((c) => c.status === 'verify-failed').length;

    return section;
  } catch {
    return {
      ...section,
      searchUnavailable: true,
      fallbackMessage: criticalMissing(),
    };
  }
}
