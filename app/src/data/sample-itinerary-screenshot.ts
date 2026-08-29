import screenshotData from '../../../app-fixture-contracts/sample-itinerary-screenshot-data.json';
import type { ExtractionResult } from '../../../core/domain';

/** Expected fields embedded in the sample itinerary screenshot (Atlas-sourced demo data). */
export const SAMPLE_SCREENSHOT_ROUTE_LABEL = 'Jakarta → Denpasar → Jakarta';

export const SAMPLE_SCREENSHOT_ATLAS_SOURCES = screenshotData.meta.sources;

export const SAMPLE_SCREENSHOT_EXPECTED = {
  departureDate: screenshotData.departureDate,
  connectionDurationMinutes: screenshotData.connectionDurationMinutes,
  firstLeg: {
    origin: screenshotData.firstLeg.origin,
    destination: screenshotData.firstLeg.destination,
    flightNumber: screenshotData.firstLeg.flightNumber,
    departureTime: screenshotData.firstLeg.departureTime,
    arrivalTime: screenshotData.firstLeg.arrivalTime,
    priceDisplay: screenshotData.firstLeg.priceDisplay,
  },
  secondLeg: {
    origin: screenshotData.secondLeg.origin,
    destination: screenshotData.secondLeg.destination,
    flightNumber: screenshotData.secondLeg.flightNumber,
    departureTime: screenshotData.secondLeg.departureTime,
    arrivalTime: screenshotData.secondLeg.arrivalTime,
    priceDisplay: screenshotData.secondLeg.priceDisplay,
  },
} as const;

/** Review-card seed matching the sample screenshot. Not MiniMax output. */
export function getSampleScreenshotExtraction(): ExtractionResult {
  return {
    extractionStatus: 'success',
    firstLeg: {
      origin: screenshotData.firstLeg.origin,
      destination: screenshotData.firstLeg.destination,
      departureDate: screenshotData.departureDate,
      airline: screenshotData.firstLeg.carrier,
      flightNumber: screenshotData.firstLeg.flightNumber,
      departureTime: screenshotData.firstLeg.departureTime,
      arrivalTime: screenshotData.firstLeg.arrivalTime,
    },
    secondLeg: {
      origin: screenshotData.secondLeg.origin,
      destination: screenshotData.secondLeg.destination,
      departureDate: screenshotData.departureDate,
      airline: screenshotData.secondLeg.carrier,
      flightNumber: screenshotData.secondLeg.flightNumber,
      departureTime: screenshotData.secondLeg.departureTime,
      arrivalTime: screenshotData.secondLeg.arrivalTime,
    },
    connectionDurationMinutes: screenshotData.connectionDurationMinutes,
    missingFields: [],
    fieldConfidence: {
      overall: 'high',
      note: 'Sample screenshot itinerary — fields match the demo image, not a MiniMax response',
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

export const SAMPLE_SCREENSHOT_BANNER =
  'Sample demo screenshot loaded — not a real ticket. Extraction runs when you check your itinerary.';

export const SAMPLE_SCREENSHOT_WELCOME_NOTE =
  'See the upload and extraction step in action';
