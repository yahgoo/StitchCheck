import type { ExtractionResult } from '../../../core/domain';

/** Supervised-rehearsal sample route (2026-08-29): CGK→DPS (Jakarta) is on the Atlas Sandbox supported test route list; legs verified live via read-only Search. */
export const SAMPLE_ITINERARY_DEPARTURE_DATE = '2026-10-01';

export const SAMPLE_ITINERARY_ROUTE_LABEL = 'Jakarta → Denpasar → Jakarta';

export function getSampleItineraryExtraction(): ExtractionResult {
  return {
    extractionStatus: 'success',
    firstLeg: {
      origin: 'CGK',
      destination: 'DPS',
      departureDate: SAMPLE_ITINERARY_DEPARTURE_DATE,
      airline: 'Sample carrier',
      flightNumber: 'SC-101',
      departureTime: '08:00',
      arrivalTime: '09:15',
    },
    secondLeg: {
      origin: 'DPS',
      destination: 'CGK',
      departureDate: SAMPLE_ITINERARY_DEPARTURE_DATE,
      airline: 'Sample carrier',
      flightNumber: 'SC-202',
      departureTime: '12:30',
      arrivalTime: '13:45',
    },
    connectionDurationMinutes: 195,
    missingFields: [],
    fieldConfidence: {
      overall: 'high',
      note: 'Sample itinerary input — not uploaded or extracted',
    },
    validationMessages: [],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    evidenceSource: 'local-fixture',
    provider: 'local',
    executed: false,
    fallbackUsed: true,
    validationOutcome: 'valid',
    provenanceMode: 'fictional-local',
  };
}
