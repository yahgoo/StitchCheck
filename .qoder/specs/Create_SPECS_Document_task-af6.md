## Create `docs/SPECS.md`

### Step 1 -- Create the file

**File:** `/Users/kmsum/Downloads/Gemini Hackathon - Daytona HackSprint - Alibaba x Atlas Travel/docs/SPECS.md`

Sources (already read, read-only): `docs/hackathon-brief.md`, `docs/research-synthesis.md`, `docs/idea-context.md`, `docs/user-stories.md`, `docs/PRD.md`, `docs/UAT.md`.

Write `# StitchCheck: Technical Specification` with these sections per the user's specification:

1. **P0 Boundary** -- Full P0 flow statement plus the four explicit declarations (ends at Keep/Switch; Atlas search-only; no real PII/credentials/booking/payment/verification/ticketing/order; no implementation claim is evidence an integration works).
2. **Requirement Traceability** -- Table `| User Story | Functional Requirement | UAT Coverage | Technical Component |` mapping US-01..US-13 to FR-01..FR-13 and the corresponding UAT IDs from `docs/UAT.md`, using only the seven allowed component labels.
3. **System Components** -- The seven components, each with Inputs, Outputs, States, Errors, Safety boundary, and supported Requirement IDs.
4. **State Model** -- The 20 named states listed, plus the four transition rules (no risk/Atlas before confirmation; decision only after comparison data; DecisionRecorded creates no order/write; retry/replay preserves synthetic labels).
5. **Data Contracts** -- Illustrative JSON-like schemas (no code) for SyntheticUpload, ExtractedItinerary, RiskRequest, RiskResult, AtlasSearchRequest, AtlasAlternative (with the explicit `offerReference` display-only statement), and DecisionRecord — each with the specified fields.
6. **Interface Contracts** -- The eight conceptual interfaces (Gemini request/response/error; Nosana submit/status/result; Atlas search request/result/empty-error-timeout), each specifying required inputs, expected outputs, timeout/error/fallback-replay behavior, and read-only marking; Atlas explicitly read-only/search-only; all P0 interfaces read-only except internal non-PII session state. No endpoint URLs, SDK names, code, or credentials.
7. **UI Views** -- The eight views, each with displayed information, permitted actions, loading/empty/timeout/error behavior, replay behavior, and required safety labels.
8. **Risk Heuristic Rules** -- The four product-behavior rules specified.
9. **Atlas Rules** -- The five rules specified (sandbox only; search-only; no offer reuse after environment switch; no write controls; on failure preserve Keep plus retry/replay, never fabricate results).
10. **Observability and Demo Evidence** -- The five visible proofs specified.
11. **Error and Replay Matrix** -- Table `| Failure Area | User-Facing State | Allowed Action | Fallback Rule | Must Not Happen |` covering upload validation, Gemini extraction, Nosana timeout/error, Atlas empty/timeout/error, and final decision handling.
12. **Open Questions for Smoke Tests** -- Only the six items specified; unanswered, no success claims.
13. **Implementation Constraints** -- The six constraints specified.
14. **Stop Condition** -- Confirm only that `docs/SPECS.md` was created and is the only project file changed.

### Constraints honored

- Exactly one file created; all other docs untouched.
- No application code, packages, skills, or dependencies.
- No URL browsing, authentication, credentials, API calls, or integration testing.

### Verification

- Read back `docs/SPECS.md`; confirm every FR-01..FR-13 maps to at least one US and UAT item.
- Confirm no interface permits an Atlas write action in P0.
- Check filesystem timestamps to confirm it is the only project file created or modified.
