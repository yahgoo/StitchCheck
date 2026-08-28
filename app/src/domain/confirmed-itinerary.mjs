/** Confirmed itinerary snapshot helpers (Node offline tests mirror). */

export function createConfirmedItinerarySnapshot(extraction, inputMode = 'default') {
  return {
    firstLeg: { ...extraction.firstLeg },
    secondLeg: { ...extraction.secondLeg },
    connectionDurationMinutes: extraction.connectionDurationMinutes,
    confirmedAt: new Date().toISOString(),
    inputMode,
  };
}

export function confirmedItineraryToContext(confirmed) {
  return {
    firstLegOrigin: confirmed.firstLeg.origin,
    firstLegDestination: confirmed.firstLeg.destination,
    secondLegOrigin: confirmed.secondLeg.origin,
    secondLegDestination: confirmed.secondLeg.destination,
  };
}

export function warnIfAtlasSearchRouteMismatch(offers, confirmed, leg) {
  if (process.env.NODE_ENV === 'production') return;
  const target = leg === 'first' ? confirmed.firstLeg : confirmed.secondLeg;
  const firstOffer = offers?.[0];
  const firstSeg = firstOffer?.segments?.[0];
  const lastSeg = firstOffer?.segments?.[firstOffer.segments.length - 1];
  if (firstSeg?.departure_airport && firstSeg.departure_airport !== target.origin) {
    console.warn('[route-continuity] Atlas search departure airport mismatch', {
      expected: target.origin,
      got: firstSeg.departure_airport,
      leg,
    });
  }
  if (lastSeg?.arrival_airport && lastSeg.arrival_airport !== target.destination) {
    console.warn('[route-continuity] Atlas search arrival airport mismatch', {
      expected: target.destination,
      got: lastSeg.arrival_airport,
      leg,
    });
  }
}
