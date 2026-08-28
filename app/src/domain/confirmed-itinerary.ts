/* ── Confirmed itinerary snapshot ──
 *
 * Immutable route context set once at "Check my itinerary". Downstream
 * risk, Atlas Search/Verify, recovery plan, and previews read only this
 * snapshot — never live extraction state after confirmation. */

import type { ExtractionResult, FlightLeg } from '../../../core/domain';
import type { ItineraryContext } from '../../../core/domain/risk-computation';

export type ItineraryInputMode = 'default' | 'upload' | 'sample' | 'sample-screenshot';

export interface ConfirmedItinerary {
  firstLeg: FlightLeg;
  secondLeg: FlightLeg;
  connectionDurationMinutes: number;
  confirmedAt: string;
  inputMode: ItineraryInputMode;
}

export function createConfirmedItinerarySnapshot(
  extraction: ExtractionResult,
  inputMode: ItineraryInputMode = 'default',
): ConfirmedItinerary {
  return {
    firstLeg: { ...extraction.firstLeg },
    secondLeg: { ...extraction.secondLeg },
    connectionDurationMinutes: extraction.connectionDurationMinutes,
    confirmedAt: new Date().toISOString(),
    inputMode,
  };
}

export function confirmedItineraryToContext(confirmed: ConfirmedItinerary): ItineraryContext {
  return {
    firstLegOrigin: confirmed.firstLeg.origin,
    firstLegDestination: confirmed.firstLeg.destination,
    secondLegOrigin: confirmed.secondLeg.origin,
    secondLegDestination: confirmed.secondLeg.destination,
  };
}

/** Dev-only guard: warn if Atlas offer airports diverge from confirmed route. */
export function warnIfAtlasSearchRouteMismatch(
  offers: Array<{ segments?: Array<{ departure_airport?: string; arrival_airport?: string }> }> | undefined,
  confirmed: ConfirmedItinerary,
  leg: 'first' | 'second',
): void {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  const target = leg === 'first' ? confirmed.firstLeg : confirmed.secondLeg;
  const firstOffer = offers?.[0];
  const firstSeg = firstOffer?.segments?.[0];
  const lastSeg = firstOffer?.segments?.[firstOffer.segments.length - 1];
  if (!firstSeg || !lastSeg) return;

  if (firstSeg.departure_airport && firstSeg.departure_airport !== target.origin) {
    console.warn(
      '[route-continuity] Atlas search departure airport mismatch',
      { expected: target.origin, got: firstSeg.departure_airport, leg },
    );
  }
  if (lastSeg.arrival_airport && lastSeg.arrival_airport !== target.destination) {
    console.warn(
      '[route-continuity] Atlas search arrival airport mismatch',
      { expected: target.destination, got: lastSeg.arrival_airport, leg },
    );
  }
}
