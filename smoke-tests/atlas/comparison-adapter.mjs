// Local-only comparison adapter for the StitchCheck Atlas search-only
// smoke-test fixtures, matching docs/smoke-test-atlas.md (ATL-04, ATL-08,
// ATL-11). Style reference: smoke-tests/gemini/schema-validator.mjs.
//
// Pure local function: transforms an original synthetic itinerary plus a
// result fixture into a UI-ready comparison structure. Every output is
// labelled as a sandbox placeholder. Strictly search-only — no offer
// verification or any other write action is represented, triggered, or
// implied. No network, authentication, SDK, or request code exists here.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DISCLAIMER_LABEL =
  "Synthetic local placeholder — not Atlas Sandbox evidence";

export const SOURCE_LABEL = "Atlas Sandbox (placeholder)";
export const SANDBOX_MARKER = "sandbox-placeholder";

const PRICE_PLACEHOLDER = "— placeholder —";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function formatMinutes(totalMinutes) {
  if (
    typeof totalMinutes !== "number" ||
    !Number.isFinite(totalMinutes) ||
    totalMinutes < 0
  ) {
    return "unknown";
  }
  if (totalMinutes === 0) {
    return "none (nonstop)";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function minutesBetween(sameDayDeparture, sameDayArrival) {
  const toMinutes = (value) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = toMinutes(sameDayDeparture);
  const end = toMinutes(sameDayArrival);
  if (start === null || end === null || end < start) return null;
  return end - start;
}

function describeOriginal(itinerary) {
  const legs = Array.isArray(itinerary?.legs) ? itinerary.legs : [];
  const routeLabel = legs
    .map((leg) => `${leg.origin} → ${leg.destination}`)
    .join(" | ");
  let durationLabel = "unknown";
  if (legs.length > 0) {
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (first.date && first.date === last.date) {
      const total = minutesBetween(first.departureTime, last.arrivalTime);
      if (total !== null) durationLabel = formatMinutes(total);
    }
  }
  return {
    routeLabel: routeLabel || "unknown route",
    legs: legs.map((leg) => ({
      origin: leg.origin,
      destination: leg.destination,
      date: leg.date,
      departureTime: leg.departureTime,
      arrivalTime: leg.arrivalTime,
    })),
    connectionLabel: formatMinutes(itinerary?.connectionDurationMinutes),
    durationLabel,
    // P0 compares displayed prices only; no purchase action is represented.
    priceDisplay: PRICE_PLACEHOLDER,
  };
}

function describeAlternative(alternative) {
  return {
    offerReference: alternative.offerReference,
    routeSummary: alternative.routeSummary,
    departureTime: alternative.departureTime,
    arrivalTime: alternative.arrivalTime,
    duration: alternative.duration,
    connectionType: alternative.connectionType,
    connectionLabel: formatMinutes(alternative.connectionDurationMinutes),
    priceDisplay: alternative.priceDisplay,
    currency: alternative.currency,
    availabilityLabel: alternative.availabilityLabel,
  };
}

const STATUS_MESSAGES = {
  loading: "Search in progress. Results will be labelled as Atlas Sandbox output.",
  completed: "Completed search. Alternatives below are display-only.",
  empty:
    "No safer alternatives were returned. Nothing is fabricated; retry or replay is available.",
  timeout:
    "The search did not finish in time. Retry or replay is available.",
  error:
    "The search could not be completed. Retry or replay is available.",
};

// buildSearchComparison(originalItinerary, resultFixture) → UI-ready,
// sandbox-labelled, search-only comparison structure.
//
// originalItinerary: synthetic itinerary with legs[] and
//   connectionDurationMinutes (see fixtures/query-atl-*.json syntheticContext).
// resultFixture: a parsed result fixture (see fixtures/result-atl-*.json).
// Throws TypeError on malformed input; never touches the network.
export function buildSearchComparison(originalItinerary, resultFixture) {
  if (!isPlainObject(originalItinerary)) {
    throw new TypeError("originalItinerary must be an object");
  }
  if (!isPlainObject(resultFixture) || !isPlainObject(resultFixture.searchResult)) {
    throw new TypeError("resultFixture must contain a searchResult object");
  }

  const result = resultFixture.searchResult;
  const status = result.searchStatus;
  const alternatives =
    status === "completed" && Array.isArray(result.alternatives)
      ? result.alternatives.map(describeAlternative)
      : [];

  return {
    kind: "search-only-comparison",
    // Sandbox markers required on every UI-ready output of this preparation.
    sandbox: true,
    environment: SANDBOX_MARKER,
    disclaimer: DISCLAIMER_LABEL,
    sourceLabel: SOURCE_LABEL,
    sourceEnvironment: result.sourceEnvironment ?? SANDBOX_MARKER,
    correlationId: result.correlationId ?? null,
    searchStatus: status,
    statusMessage: STATUS_MESSAGES[status] ?? "Unknown search state.",
    showAlternatives: status === "completed" && alternatives.length > 0,
    honestEmptyState:
      status === "empty" || status === "timeout" || status === "error",
    original: describeOriginal(originalItinerary),
    alternatives,
    // ATL-11: the comparison supports Keep/Switch display only. Choosing
    // "Switch" in a future flow must start a new, separately authorized
    // process; this adapter never produces an actionable state.
    comparisonNote:
      "Display-only comparison. No write action is represented or initiated.",
  };
}

// ---------------------------------------------------------------------------
// CLI demo: builds a sample comparison from local fixtures and prints it.
// ---------------------------------------------------------------------------

function runCli() {
  const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
  const queryFixture = JSON.parse(
    readFileSync(join(fixturesDir, "query-atl-normal-two-leg.json"), "utf8"),
  );
  const resultFixture = JSON.parse(
    readFileSync(join(fixturesDir, "result-atl-success.json"), "utf8"),
  );
  const comparison = buildSearchComparison(
    queryFixture.syntheticContext,
    resultFixture,
  );
  console.log(JSON.stringify(comparison, null, 2));
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runCli();
}
