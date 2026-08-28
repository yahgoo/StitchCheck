## File to Create

**Path:** `specs/atlas-skill-integration-spec.md`

The `specs/` directory does not yet exist and must be created implicitly by writing the file.

## Cross-Check Result

All 7 verification items match between the official guide and the spec instructions. Zero discrepancies. The guide uses 12 fine-grained steps; the spec consolidates them into 8 numbered steps per the user's outline, while preserving all safety checkpoints and callout details.

## Spec Structure (7 sections)

### 1. Header and Purpose
- Title: `# Atlas Skill Integration Spec`
- One-paragraph summary: documents the switch from the custom OAuth approach (failed with 404) to the official Atlas Flight Booking Skill for Qoder.
- Reference the official guide: `Atlas_Flight_Booking_Skill_Qoder_User_Guide` (PDF and DOCX at project root; PDF also at `docs/`).

### 2. Why the Previous Approach Failed
- The custom client in `smoke-tests/atlas/read-only-atlas-adapter.mjs` used a guessed `/oauth/token` endpoint with `grant_type: client_credentials`, `ATLAS_CLIENT_ID`, and `ATLAS_CLIENT_SECRET` against `https://sandbox.atriptech.com`.
- The server returned HTTP 404 — the endpoint does not exist.
- The correct integration path is the official Atlas Flight Booking Skill, which handles authorization via browser-based ATRIP sign-in, not manual client ID/secret OAuth calls.
- Reference superseded docs: `docs/smoke-test-atlas.md`, `docs/stitchcheck-live-service-demo-preflight.md`.

### 3. Correct Integration Path (8 numbered steps, verified against the guide's 12 steps)
1. **Install**: `npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking` — installation is one-time; Tip callout: future searches just describe the flight request directly.
2. **Describe flight search**: natural language with origin, destination, date, passenger count (e.g., "Search for flights from Shanghai to Tokyo on September 4, 2026, for one adult").
3. **Browser authorization**: Qoder provides "Open Atlas authorization" link; human signs in to ATRIP in browser (existing account or create new). Privacy callout: password and Atlas login token are never shared with the Skill.
4. **Return to Qoder**: after "Authorization complete / You're all set", return to the same conversation and say "I've completed the Atlas authorization. Please continue with the flight search."
5. **Review results**: real-time search/comparison results with flight number, route, times, duration, stops, reference price. Important callout: reference-price offers cannot proceed to verification/ticketing.
6. **Sandbox rehearsal**:
   - Switch: `atlas-flight environment use sandbox --json`
   - Check status: "Please check my current Atlas authorization and ticketing status" — continue only when both active.
   - New search (do not reuse production offers).
   - Select offer, verify price (Price checkpoint: if price increases, explicitly accept new amount).
   - Fictional passenger details only: TEST/TRAVELER, Male, DOB 1990-01-01, Nationality Japan (JP), Passport TR0000001, Issuing country Japan, Expiry 2032-12-31.
   - Review full payment summary (Payment checkpoint: flight, passenger, services, price breakdown, total, currency, deadline).
   - Explicit approval: "Yes, I approve this exact payment."
7. **Sandbox result**: test order number, PNR, and ticket number returned. Sandbox result callout: does not create a real booking or charge a real payment method.
8. **Switch back**: `atlas-flight environment use production --json` — start a new search after switching.

### 4. Non-Negotiable Safety Rules (6 bullets)
- Never proceed to payment confirmation without human explicitly reviewing and approving the exact displayed summary first.
- Never reuse an offer across an environment switch.
- Never provide real passenger, passport, or payment information — fictional data only (TEST/TRAVELER example from the guide).
- Always confirm current environment (sandbox vs production) before any order or payment step; if unclear, stop and check status first.
- Treat any accidental production-environment booking attempt as a hard stop requiring immediate human intervention.
- Retain existing evidence-boundary language: this is Sandbox test evidence, not a live financial transaction.

### 5. Update to Evidence Boundaries
- Reclassify from "not authenticated, not executed" to "Sandbox search and test-booking rehearsal executed via official Skill."
- Still never claim a real booking or payment occurred.
- Current label `Synthetic local placeholder — not Atlas Sandbox evidence` would be replaced with a Sandbox-evidence label upon successful rehearsal.
- Cross-reference `docs/stitchcheck-submission-evidence-index.md` rows that would change (Atlas provider status row, ATL-LIVE-01 row).

### 6. Today's Immediate Action (before 4pm)
- Install the Skill.
- Authorize once via browser (ATRIP sign-in).
- Run one search.
- Confirm results.
- Stop there today.
- Save Sandbox payment rehearsal for tonight's session.

### 7. Footer
- Confirmation statement: no live call, network request, `.env.local` access, or package installation was made during spec creation.
- Related links from the guide: Skill repo (`github.com/atlas-doc/atlas-flight-booking-skill`), Atlas API docs (`https://resources.atriptech.com/api-document/readme-1`).
- Cross-reference superseded docs.

## Constraints
- Exactly one file created: `specs/atlas-skill-integration-spec.md`.
- No other file modified.
- No packages installed.
- No `.env.local` access.
- No network requests.
- No live provider calls.
