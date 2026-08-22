// TypeScript definitions for the UI-ready, sandbox-labelled, search-only
// Atlas smoke-test shapes (local preparation only).
// Matches docs/smoke-test-atlas.md and the fixtures in ./fixtures/.
// Every value these shapes describe is a synthetic local placeholder;
// nothing here implies that Atlas search, authentication, or any
// integration works. Search-only: no write action is representable.

/** Exact disclaimer label required on every fixture and UI-facing output. */
export type DisclaimerLabel =
  "Synthetic local placeholder — not Atlas Sandbox evidence";

/** Sandbox placeholder marker carried by every result. */
export type SandboxMarker = "sandbox-placeholder";

/** Observable search states from docs/smoke-test-atlas.md. */
export type SearchStatus =
  | "loading"
  | "completed"
  | "empty"
  | "timeout"
  | "error";

/** One synthetic itinerary leg (AAA/BBB/CCC style codes only — zero PII). */
export interface SyntheticLeg {
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  departureTime: string; // HH:MM
  arrivalTime: string; // HH:MM
}

/** Synthetic confirmed itinerary used as the comparison baseline. */
export interface OriginalItinerary {
  legs: SyntheticLeg[];
  connectionDurationMinutes: number;
}

/** One display-only alternative entry as returned in a result fixture. */
export interface AlternativeOption {
  /** Display/search context only; never an actionable reference. */
  offerReference: string;
  routeSummary: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  connectionType: string;
  connectionDurationMinutes?: number;
  priceDisplay: string;
  currency: string;
  availabilityLabel: string;
}

/** The raw search result carried inside a result fixture. */
export interface SearchResult {
  correlationId: string;
  searchStatus: SearchStatus;
  /** Must be "sandbox-placeholder" for all local fixtures. */
  sourceEnvironment: SandboxMarker | string;
  alternatives: AlternativeOption[];
  errorCode: string | null;
  errorMessage: string | null;
  fallbackUsed: boolean;
}

/** A result fixture file (fixtures/result-atl-*.json). */
export interface SearchResultFixture {
  fixtureId: string;
  testCases: string[];
  scenarioNote: string;
  disclaimer: DisclaimerLabel;
  searchResult: SearchResult;
  expectedUiBehavior?: string;
}

/** A query fixture file (fixtures/query-atl-*.json). */
export interface SearchQueryFixture {
  fixtureId: string;
  testCases: string[];
  scenarioNote: string;
  disclaimer: DisclaimerLabel;
  searchQuery: {
    correlationId: string;
    origin: string;
    destination: string;
    departureDate: string;
    earliestDepartureTime: string;
    latestArrivalTime: string;
    searchIntent: "safer-alternative";
    sandboxOnly: true;
    syntheticDemo: true;
    confirmedItinerary: true;
  };
  syntheticContext: OriginalItinerary;
  expectedOutcomeFixture?: string;
}

// ---------------------------------------------------------------------------
// UI-ready comparison structure produced by comparison-adapter.mjs
// ---------------------------------------------------------------------------

/** Baseline side of the comparison view. */
export interface ComparisonOriginal {
  routeLabel: string;
  legs: SyntheticLeg[];
  connectionLabel: string;
  durationLabel: string;
  /** Placeholder price for display comparison only. */
  priceDisplay: string;
}

/** Alternative side of the comparison view. */
export interface ComparisonAlternative {
  offerReference: string;
  routeSummary: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  connectionType: string;
  connectionLabel: string;
  priceDisplay: string;
  currency: string;
  availabilityLabel: string;
}

/**
 * UI-ready, Sandbox-labelled, search-only comparison structure:
 * original itinerary vs alternatives (legs, durations, connection time,
 * price placeholder). Display-only; no write action is representable.
 */
export interface SearchComparisonView {
  kind: "search-only-comparison";
  /** Sandbox marker: every UI-ready output is a local sandbox placeholder. */
  sandbox: true;
  environment: SandboxMarker;
  disclaimer: DisclaimerLabel;
  /** Visible source attribution, e.g. "Atlas Sandbox (placeholder)". */
  sourceLabel: string;
  sourceEnvironment: SandboxMarker | string;
  correlationId: string | null;
  searchStatus: SearchStatus;
  statusMessage: string;
  showAlternatives: boolean;
  /** True when the UI must render an honest empty/timeout/error state. */
  honestEmptyState: boolean;
  original: ComparisonOriginal;
  alternatives: ComparisonAlternative[];
  comparisonNote: string;
}
