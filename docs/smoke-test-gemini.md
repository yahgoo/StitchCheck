# Smoke Test: Gemini Screenshot Extraction

## Purpose
Validate the highest-risk first step in StitchCheck P0:
whether Gemini can extract a usable, structured itinerary from two synthetic,
unbooked flight-ticket or checkout screenshots.

This is a plan only. Gemini has not been tested, configured, or called, and
nothing in this document claims that it works.

## P0 Requirement Coverage
Relevant requirements and tests:
- US-03, US-04, US-05, US-09
- FR-03, FR-04, FR-05
- UAT-06, UAT-07, UAT-08, UAT-09

## Hypothesis
Given two synthetic screenshots representing a two-leg self-transfer, Gemini
can return structured itinerary data containing origin, destination, date,
airline, flight number when available, departure time, arrival time, and
connection duration, with enough reliability for a user to review and correct
the result before downstream processing.

## Preconditions
- Use synthetic screenshots only.
- Do not use real passenger names, booking references, payment details,
  passports, or other PII.
- Confirm official Gemini multimodal and structured-output documentation
  before implementation.
- Do not claim API capability until this smoke test succeeds.

## Minimal Test Inputs
Input requirements only; no images are created by this document:
1. A clear synthetic two-leg itinerary with all core fields visible.
2. A synthetic itinerary with one optional field missing, such as flight
   number.
3. A synthetic itinerary with difficult layout, low contrast, or fragmented
   fields.
4. An invalid synthetic image that does not contain a flight itinerary.
5. An image with an unreadable required field.

## Expected Structured Output Contract
Illustrative JSON-like shape only:

```
{
  "extractionStatus": "success | partial | invalid | error",
  "firstLeg": {
    "origin": "",
    "destination": "",
    "departureDate": "",
    "airline": "",
    "flightNumber": "",
    "departureTime": "",
    "arrivalTime": ""
  },
  "secondLeg": {
    "origin": "",
    "destination": "",
    "departureDate": "",
    "airline": "",
    "flightNumber": "",
    "departureTime": "",
    "arrivalTime": ""
  },
  "connectionDurationMinutes": null,
  "missingFields": [],
  "fieldConfidence": {},
  "validationMessages": [],
  "requiresUserConfirmation": true,
  "syntheticDemo": true
}
```

The application must not begin Nosana risk scoring or Atlas Sandbox search
until the user reviews, corrects if needed, and confirms this data.

## Test Cases

| Test ID | Synthetic Input | Expected Extraction Outcome | Required Safety or UI Behavior | Pass/Fail |
|---|---|---|---|---|
| GEM-01 | Clear valid two-leg input | extractionStatus success; all core fields populated for both legs | Fields shown beside source screenshots; confirmation required before downstream | |
| GEM-02 | Optional field missing (e.g. flight number) | extractionStatus success or partial; missing field listed in missingFields | Missing field clearly flagged, not invented | |
| GEM-03 | Difficult or fragmented layout | extractionStatus success or partial; low-confidence fields listed in fieldConfidence | Low-confidence fields highlighted for user review | |
| GEM-04 | Not a flight itinerary | extractionStatus invalid with validationMessages | Clear, understandable rejection feedback with re-upload path | |
| GEM-05 | Required field unreadable | extractionStatus partial; unreadable field in missingFields | Clear feedback identifying the unreadable field; no downstream processing | |
| GEM-06 | Structured output malformed or unavailable | extractionStatus error | Clear error with retry or labelled replay; nothing fabricated | |
| GEM-07 | Model timeout or service error | extractionStatus error | Timeout state with retry path; synthetic labels preserved | |
| GEM-08 | User corrects an extracted field before confirmation | Corrected value recorded; userConfirmed set only after explicit confirmation | No Nosana or Atlas work starts before confirmation | |

## Pass Criteria
The smoke test passes only if:
- Structured output is returned in a predictable shape.
- Required fields are extracted or clearly flagged as missing.
- Invalid and unreadable inputs receive clear validation feedback.
- The user can correct fields before confirmation.
- No downstream risk calculation or Atlas search begins before confirmation.
- All test inputs remain synthetic and contain no PII.

## Failure Decision
If the test fails:
- Do not proceed with Gemini integration.
- Record the failure mode.
- Consider a user-entered structured itinerary fallback only if it preserves
  Gemini's essential, visible role in the final demo.
- Update the PRD, UAT, and SPECS before implementation if the tested behavior
  changes the P0 contract.

## Evidence to Record After Execution
- Model and API version.
- Test date and environment.
- Synthetic input identifier.
- Raw structured response, with no sensitive data.
- Extracted fields, missing fields, and errors.
- Latency.
- Result for each test case.
- Screenshot or screen recording of visible extraction output.

## Stop Condition
Confirm only that `docs/smoke-test-gemini.md` was created and is the only
project file changed.
