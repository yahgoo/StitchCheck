#!/usr/bin/env node
/* ── Traveller flow UI tests ──
 *
 * Validates the 18 UI requirements for the StitchCheck traveller flow:
 *  1.  Upload itinerary control exists
 *  2.  Two unbooked flight-ticket selectors exist
 *  3.  Placeholder option wording is replaced
 *  4.  AAA/BBB/CCC does not appear in user-facing itinerary text
 *  5.  Confirmed itinerary route propagates into risk cascade
 *  6.  Confirmed itinerary route propagates into alternatives/recommendation
 *  7.  Hotel check-in remains visible as downstream impact
 *  8.  Recovery animation appears near top of post-confirmation screen
 *  9.  Twenty alternatives are not all rendered as full cards initially
 *  10. Clicking Switch highlights the recommended plan
 *  11. Selected state has aria-pressed="true" or equivalent
 *  12. Clicking Keep and Switch are mutually exclusive
 *  13. Final safe wording remains unchanged
 *  14. No booking/payment/ticketing/order call occurs
 *  15. No provider names appear in default traveller-facing text
 *  16. No "synthetic," "fictional," or "Direct Gemini" in current UI
 *  17. No horizontal overflow
 *  18. Reduced-motion behavior remains intact
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/* ── Load source files ── */
const appTsx = readFileSync(join(root, "app/src/App.tsx"), "utf8");
const appCss = readFileSync(join(root, "app/src/App.css"), "utf8");
const fixtureJson = JSON.parse(
  readFileSync(join(root, "app-fixture-contracts/stitchcheck-ui-demo-data.json"), "utf8"),
);
const recoveryAdapterTs = readFileSync(join(root, "core/domain/recovery-plan-adapter.ts"), "utf8");
const riskComputationTs = readFileSync(join(root, "core/domain/risk-computation.ts"), "utf8");
const recoveryAnimTsx = readFileSync(join(root, "app/src/components/RecoveryPlanAnimation.tsx"), "utf8");
const recoveryAnimCss = readFileSync(join(root, "app/src/components/RecoveryPlanAnimation.css"), "utf8");
const fixturesTs = readFileSync(join(root, "app/src/data/fixtures.ts"), "utf8");
const indexHtml = readFileSync(join(root, "app/index.html"), "utf8");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ══════════════════════════════════════════════════════════
   1. Upload itinerary control exists
   ══════════════════════════════════════════════════════════ */
section("1. Upload itinerary control");

test("Upload itinerary button text exists", () => {
  assert.ok(
    appTsx.includes("Upload itinerary"),
    "App.tsx must contain 'Upload itinerary' button text",
  );
});

test("Upload help text exists", () => {
  assert.ok(
    appTsx.includes("Upload an itinerary image or flight-ticket document to review"),
    "App.tsx must contain upload help text",
  );
});

test("Upload safety restriction exists", () => {
  assert.ok(
    appTsx.includes("Sample documents only"),
    "App.tsx must contain 'Sample documents only' safety text",
  );
});

/* ══════════════════════════════════════════════════════════
   2. Two unbooked flight-ticket selectors exist
   ══════════════════════════════════════════════════════════ */
section("2. Two unbooked flight-ticket selectors");

test("First flight ticket selector exists", () => {
  assert.ok(
    appTsx.includes("First flight ticket") && appTsx.includes('id="ticket-1"'),
    "App.tsx must contain first flight ticket selector",
  );
});

test("Second flight ticket selector exists", () => {
  assert.ok(
    appTsx.includes("Second flight ticket") && appTsx.includes('id="ticket-2"'),
    "App.tsx must contain second flight ticket selector",
  );
});

/* ══════════════════════════════════════════════════════════
   3. Placeholder option wording is replaced
   ══════════════════════════════════════════════════════════ */
section("3. Placeholder option wording replaced");

test("No 'Select a fixture' wording", () => {
  assert.ok(
    !appTsx.includes("Select a fixture"),
    "App.tsx must not contain 'Select a fixture'",
  );
});

test("No 'demo fixture' wording", () => {
  assert.ok(
    !appTsx.includes("Select a demo fixture"),
    "App.tsx must not contain 'Select a demo fixture'",
  );
});

test("No 'Upload Synthetic Screenshots' wording", () => {
  assert.ok(
    !appTsx.includes("Upload Synthetic Screenshots"),
    "App.tsx must not contain 'Upload Synthetic Screenshots'",
  );
});

test("Option text uses 'Select an unbooked flight-ticket'", () => {
  assert.ok(
    appTsx.includes("Select an unbooked flight-ticket"),
    "App.tsx must use 'Select an unbooked flight-ticket' option text",
  );
});

/* ══════════════════════════════════════════════════════════
   4. AAA/BBB/CCC does not appear in user-facing itinerary text
   ══════════════════════════════════════════════════════════ */
section("4. No AAA/BBB/CCC in user-facing text");

test("No AAA in App.tsx", () => {
  assert.ok(!appTsx.includes('"AAA"') && !appTsx.includes("'AAA'"), "App.tsx must not reference AAA");
});

test("No BBB in App.tsx", () => {
  assert.ok(!appTsx.includes('"BBB"') && !appTsx.includes("'BBB'"), "App.tsx must not reference BBB");
});

test("No CCC in App.tsx", () => {
  assert.ok(!appTsx.includes('"CCC"') && !appTsx.includes("'CCC'"), "App.tsx must not reference CCC");
});

test("No AAA in fixture extraction data", () => {
  const extraction = fixtureJson.uiStates.itineraryUnconfirmed.extractionResult;
  assert.ok(extraction.firstLeg.origin !== "AAA", "First leg origin must not be AAA");
  assert.ok(extraction.firstLeg.destination !== "BBB", "First leg destination must not be BBB");
  assert.ok(extraction.secondLeg.destination !== "CCC", "Second leg destination must not be CCC");
});

test("Fixture uses coherent CGK-DPS-CGK route", () => {
  const extraction = fixtureJson.uiStates.itineraryUnconfirmed.extractionResult;
  assert.equal(extraction.firstLeg.origin, "CGK");
  assert.equal(extraction.firstLeg.destination, "DPS");
  assert.equal(extraction.secondLeg.origin, "DPS");
  assert.equal(extraction.secondLeg.destination, "CGK");
});

/* ══════════════════════════════════════════════════════════
   5. Confirmed itinerary route propagates into risk cascade
   ══════════════════════════════════════════════════════════ */
section("5. Route propagates into risk cascade");

test("Recovery plan adapter uses itineraryContext for trigger route", () => {
  assert.ok(
    recoveryAdapterTs.includes("itineraryContext.firstLegOrigin") &&
    recoveryAdapterTs.includes("itineraryContext.firstLegDestination"),
    "Recovery plan adapter must use itineraryContext for trigger route",
  );
});

test("Risk computation uses itineraryContext for connection airport label", () => {
  assert.ok(
    riskComputationTs.includes("connectionAirport") &&
    riskComputationTs.includes("ctx.firstLegDestination"),
    "Risk computation must derive connection airport from itineraryContext",
  );
});

test("ItineraryContext flows from App extraction to recovery animation", () => {
  assert.ok(
    appTsx.includes("itineraryContext") &&
    appTsx.includes("extraction.firstLeg.origin") &&
    appTsx.includes("getDaytonaOfflineRecoveryAnimation"),
    "App must pass itineraryContext to recovery animation",
  );
});

/* ══════════════════════════════════════════════════════════
   6. Route propagates into alternatives/recommendation
   ══════════════════════════════════════════════════════════ */
section("6. Route propagates into alternatives");

test("Recommended plan uses itineraryContext for route summary", () => {
  assert.ok(
    recoveryAdapterTs.includes("itineraryContext.firstLegOrigin") &&
    recoveryAdapterTs.includes("routeSummary"),
    "Recovery adapter must use itineraryContext for recommended plan route",
  );
});

test("Onward option uses itineraryContext for second leg route", () => {
  assert.ok(
    recoveryAdapterTs.includes("itineraryContext.secondLegOrigin") &&
    recoveryAdapterTs.includes("itineraryContext.secondLegDestination"),
    "Recovery adapter must use itineraryContext for onward option route",
  );
});

test("Atlas success fixture uses CGK-DPS route", () => {
  const atlSuccess = JSON.parse(
    readFileSync(join(root, "smoke-tests/atlas/fixtures/result-atl-success.json"), "utf8"),
  );
  const routes = atlSuccess.searchResult.alternatives.map((a) => a.routeSummary);
  assert.ok(
    routes.some((r) => r.includes("CGK") && r.includes("DPS")),
    "Atlas success fixture alternatives must reference the CGK-DPS route",
  );
});

/* ══════════════════════════════════════════════════════════
   7. Hotel check-in remains visible as downstream impact
   ══════════════════════════════════════════════════════════ */
section("7. Hotel check-in in downstream cascade");

test("Risk computation includes hotel-checkin node", () => {
  assert.ok(
    riskComputationTs.includes("hotel-checkin") &&
    riskComputationTs.includes("hotel check-in"),
    "Risk computation must include hotel check-in node",
  );
});

test("Hotel check-in label in risk computation", () => {
  assert.ok(
    riskComputationTs.includes("Pre-booked hotel check-in"),
    "Risk computation must include 'Pre-booked hotel check-in' label",
  );
});

/* ══════════════════════════════════════════════════════════
   8. Recovery animation near top of post-confirmation screen
   ══════════════════════════════════════════════════════════ */
section("8. Recovery animation available on answer screen (collapsed by default)");

test("Answer/options screen nests animation under 'See why this is risky'", () => {
  const optionsSection = appTsx.indexOf("sc-screen--options");
  const riskDetailIdx = appTsx.indexOf("sc-risk-detail", optionsSection);
  const animIdx = appTsx.indexOf("RecoveryPlanAnimation", optionsSection);
  const summaryIdx = appTsx.indexOf("See why this is risky", optionsSection);
  assert.ok(
    riskDetailIdx > 0 && summaryIdx > riskDetailIdx && animIdx > summaryIdx,
    "RecoveryPlanAnimation must live inside collapsed 'See why this is risky' on options screen",
  );
});

test("Recommended plan appears before expandable risk detail on options screen", () => {
  const optionsSection = appTsx.indexOf("sc-screen--options");
  const optionsEnd = appTsx.indexOf("sc-screen--done", optionsSection);
  const optionsBody = appTsx.slice(optionsSection, optionsEnd > 0 ? optionsEnd : optionsSection + 5000);
  const recommendedIdx = optionsBody.indexOf("sc-recommended-option");
  const riskDetailIdx = optionsBody.indexOf("sc-risk-detail");
  assert.ok(
    recommendedIdx > 0 && riskDetailIdx > recommendedIdx,
    "Recommended option must appear above risk detail panel",
  );
});

/* ══════════════════════════════════════════════════════════
   9. Twenty alternatives not all rendered initially
   ══════════════════════════════════════════════════════════ */
section("9. Limited initial alternatives display");

test("showAllAlternatives state controls expansion", () => {
  assert.ok(
    appTsx.includes("showAllAlternatives") &&
    appTsx.includes("setShowAllAlternatives"),
    "App must have showAllAlternatives toggle state",
  );
});

test("Remaining alternatives hidden behind 'See more options' button", () => {
  assert.ok(
    appTsx.includes("See more options"),
    "App must have 'See more options' button for remaining alternatives",
  );
});

test("Only recommended plan shown initially, not all alternatives", () => {
  assert.ok(
    appTsx.includes("!showAllAlternatives && remainingAlternatives.length > 0"),
    "Remaining alternatives must be gated by showAllAlternatives flag",
  );
});

/* ══════════════════════════════════════════════════════════
   10. Clicking Switch highlights recommended plan
   ══════════════════════════════════════════════════════════ */
section("10. Switch highlights recommended plan");

test("Switch sets decision to 'switch'", () => {
  assert.ok(
    appTsx.includes("setDecision('switch')"),
    "App must set decision to 'switch' when Switch is clicked",
  );
});

test("Recommended option gets selected CSS class when switch selected", () => {
  assert.ok(
    appTsx.includes("sc-recommended-option--selected") ||
    appCss.includes("sc-recommended-option--selected"),
    "Selected recommended option must have a distinct CSS class",
  );
});

test("Selected indicator rendered when switch selected", () => {
  assert.ok(
    appTsx.includes("Selected") && appTsx.includes("decision === 'switch'"),
    "App must render 'Selected' indicator when switch is selected",
  );
});

/* ══════════════════════════════════════════════════════════
   11. Selected state has aria-pressed
   ══════════════════════════════════════════════════════════ */
section("11. aria-pressed on selection controls");

test("Recommended option has aria-pressed attribute", () => {
  assert.ok(
    appTsx.includes("aria-pressed={decision === 'switch'}"),
    "Recommended option must have aria-pressed bound to switch state",
  );
});

test("Keep button has aria-pressed attribute", () => {
  assert.ok(
    appTsx.includes("aria-pressed={decision === 'keep'}"),
    "Keep button must have aria-pressed bound to keep state",
  );
});

/* ══════════════════════════════════════════════════════════
   12. Keep and Switch are mutually exclusive
   ══════════════════════════════════════════════════════════ */
section("12. Keep/Switch mutual exclusivity");

test("Decision is a single state variable", () => {
  assert.ok(
    appTsx.includes("useState<Decision>(null)"),
    "Decision must be a single state variable (not two independent booleans)",
  );
});

test("Keep button toggles decision to 'keep'", () => {
  assert.ok(
    appTsx.includes("setDecision(") && appTsx.includes("'keep'"),
    "Keep button must set decision to 'keep'",
  );
});

test("Switch button toggles decision to 'switch'", () => {
  assert.ok(
    appTsx.includes("setDecision('switch')"),
    "Switch button must set decision to 'switch'",
  );
});

/* ══════════════════════════════════════════════════════════
   13. Final safe wording remains unchanged
   ══════════════════════════════════════════════════════════ */
section("13. Final safe wording");

test("'Request submitted — awaiting verified supplier outcome' present", () => {
  assert.ok(
    appTsx.includes("Request submitted — awaiting verified supplier outcome"),
    "App must contain the safe 'Request submitted' wording",
  );
});

test("No 'Booked' claim in done screen", () => {
  const doneSection = appTsx.slice(appTsx.indexOf("sc-screen--done"));
  assert.ok(
    !doneSection.includes(">Booked<") && !doneSection.includes(">Ticket issued<"),
    "Done screen must not claim 'Booked' or 'Ticket issued'",
  );
});

/* ══════════════════════════════════════════════════════════
   14. No booking/payment/ticketing/order call
   ══════════════════════════════════════════════════════════ */
section("14. No booking/payment write actions");

test("No book/pay/ticket/reserve/order function calls in App.tsx", () => {
  const writePatterns = [
    /callBook\(/, /callPay\(/, /callTicket\(/,
    /callReserve\(/, /callOrder\(/, /createBooking\(/,
    /createOrder\(/, /submitPayment\(/,
  ];
  for (const pat of writePatterns) {
    assert.ok(!pat.test(appTsx), `App.tsx must not contain write call matching ${pat}`);
  }
});

test("Footer states no booking/payment/order created", () => {
  assert.ok(
    appTsx.includes("No booking, payment, reservation, or order created"),
    "Footer must state no booking/payment/order created",
  );
});

/* ══════════════════════════════════════════════════════════
   15. No provider names in default traveller-facing text
   ══════════════════════════════════════════════════════════ */
section("15. No provider names in main UI");

test("No 'Nosana' in traveller-facing rendered text", () => {
  /* Internal function names like loadNosanaRiskResult are not traveller-facing.
   * Check that 'Nosana' does not appear in JSX string literals rendered in UI. */
  const jsxContent = appTsx
    .replace(/loadNosanaRiskResult/g, '')
    .replace(/nosanaResult/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.ok(
    !jsxContent.includes(">Nosana<") && !jsxContent.includes("'Nosana"),
    "App.tsx must not render 'Nosana' in traveller-facing text",
  );
});

test("No 'Gemini' in App.tsx", () => {
  assert.ok(!appTsx.includes("Gemini"), "App.tsx must not mention 'Gemini'");
});

test("No 'Daytona' in App.tsx main screens", () => {
  /* Daytona only appears in the execution mode prop for the animation component,
   * which is an internal data-model value, not traveller-facing text. */
  const mainScreenContent = appTsx.slice(
    appTsx.indexOf("<main"),
    appTsx.indexOf("</main>"),
  );
  assert.ok(
    !mainScreenContent.includes(">Daytona<") &&
    !mainScreenContent.includes("'Daytona"),
    "Main screens must not show 'Daytona' as traveller-facing text",
  );
});

/* ══════════════════════════════════════════════════════════
   16. No "synthetic," "fictional," or "Direct Gemini" in UI
   ══════════════════════════════════════════════════════════ */
section("16. No banned words in UI");

test("No 'synthetic' in App.tsx (case-insensitive)", () => {
  assert.ok(
    !/synthetic/i.test(appTsx),
    "App.tsx must not contain 'synthetic'",
  );
});

test("No 'fictional' in App.tsx (case-insensitive)", () => {
  assert.ok(
    !/fictional/i.test(appTsx),
    "App.tsx must not contain 'fictional'",
  );
});

test("No 'Direct Gemini' in App.tsx", () => {
  assert.ok(
    !/Direct Gemini/i.test(appTsx),
    "App.tsx must not contain 'Direct Gemini'",
  );
});

test("No 'fictional' in fixtures.ts getDefaultExtraction", () => {
  const getDefaultFn = fixturesTs.slice(fixturesTs.indexOf("getDefaultExtraction"));
  assert.ok(
    !/fictional/i.test(getDefaultFn),
    "getDefaultExtraction must not set provenanceMode to 'fictional-local'",
  );
});

/* ══════════════════════════════════════════════════════════
   17. No horizontal overflow
   ══════════════════════════════════════════════════════════ */
section("17. No horizontal overflow");

test("App container uses flex column with min-height 100vh", () => {
  assert.ok(
    appCss.includes("min-height: 100vh") &&
    appCss.includes("flex-direction: column"),
    "App container must use min-height: 100vh and flex-direction: column",
  );
});

test("Main content has max-width constraint", () => {
  assert.ok(
    appCss.includes("max-width") && appCss.includes("margin: 0 auto"),
    "Main content must have max-width with auto margins",
  );
});

test("Boarding pass cards use grid with wrap on mobile", () => {
  assert.ok(
    appCss.includes(".sc-boarding-passes") &&
    appCss.includes("grid-template-columns: 1fr"),
    "Boarding pass cards must collapse to single column on mobile",
  );
});

/* ══════════════════════════════════════════════════════════
   18. Reduced-motion behavior remains intact
   ══════════════════════════════════════════════════════════ */
section("18. Reduced-motion behavior");

test("RecoveryPlanAnimation CSS has prefers-reduced-motion", () => {
  assert.ok(
    recoveryAnimCss.includes("prefers-reduced-motion"),
    "RecoveryPlanAnimation CSS must honor prefers-reduced-motion",
  );
});

test("Reduced-motion behavior is handled", () => {
  assert.ok(
    recoveryAnimCss.includes("prefers-reduced-motion") ||
    recoveryAnimTsx.includes("reduced-motion") ||
    recoveryAnimTsx.includes("prefers-reduced-motion"),
    "Reduced motion must be handled in CSS or component",
  );
});

/* ══════════════════════════════════════════════════════════
   Bonus: Tab title check
   ══════════════════════════════════════════════════════════ */
section("Bonus: Tab title");

test("Browser title is 'StitchCheck — Itinerary Risk Checker'", () => {
  assert.ok(
    indexHtml.includes("StitchCheck — Itinerary Risk Checker"),
    "index.html title must be 'StitchCheck — Itinerary Risk Checker'",
  );
});

/* ══════════════════════════════════════════════════════════
   Summary
   ══════════════════════════════════════════════════════════ */
console.log("\n════════════════════════════════════════════════");
console.log(`Traveller flow UI tests: ${passed} passed, ${failed} failed`);
console.log("════════════════════════════════════════════════");

if (failed > 0) process.exit(1);
