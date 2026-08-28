import screenshotData from '../../../app-fixture-contracts/sample-itinerary-screenshot-data.json';

/** Expected fields embedded in the sample itinerary screenshot (Atlas-sourced demo data). */
export const SAMPLE_SCREENSHOT_ROUTE_LABEL = 'Kuala Lumpur → Singapore → Bangkok';

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

export const SAMPLE_SCREENSHOT_BANNER =
  'Sample demo screenshot loaded — not a real ticket. Extraction runs when you check your itinerary.';

export const SAMPLE_SCREENSHOT_WELCOME_NOTE =
  'See the upload and extraction step in action';
