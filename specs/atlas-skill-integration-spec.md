# Atlas Flight Booking Skill — Correct Integration Spec

> **Status**: DRAFT — 2026-08-21  
> **Owner**: StitchCheck dev lead  
> **Deadline**: Today, before 4 PM  
> **Scope**: Replace the failed direct-OAuth integration path with the official Atlas Flight Booking Skill installation path.

---

## 1. Purpose

This spec defines the **correct** integration path for Atlas Flight Booking into StitchCheck. It replaces the earlier direct-OAuth approach that failed with a 404 error. The spec covers:

- Why the previous OAuth approach failed (root cause and 404 detail).
- The 8-step correct integration path using the official Atlas Flight Booking Skill.
- The 6 non-negotiable safety rules that must hold at every step.
- The evidence-boundary update required after the path change.
- The before-4pm action for today.
- Related links for traceability.

This spec does **not** authorize any live Atlas call. It authorizes **installation and recognition testing only**. No search, booking, payment, sandbox switch, or passenger-data operation is in scope today.

---

## 2. Why the Previous OAuth Approach Failed

### 2.1 What was attempted

The earlier integration attempt tried to call Atlas OAuth token endpoints directly — constructing authorization URLs, exchanging authorization codes for access tokens, and attaching bearer tokens to Atlas REST API calls — without using the official Atlas Flight Booking Skill or the `atlas-flight` CLI.

### 2.2 The 404 detail

Every direct OAuth endpoint call returned **HTTP 404 (Not Found)**. The specific symptoms:

- The authorization URL constructed from the Atlas API quick-start documentation did not resolve to a valid OAuth consent screen.
- The token exchange endpoint returned 404 instead of a token response.
- The API base URL used for subsequent search calls also returned 404, confirming the endpoint structure was incorrect or undocumented for direct consumer use.

### 2.3 Root cause

Atlas does **not** expose a public, direct-consumer OAuth endpoint for ad-hoc integration. The Atlas Flight Booking API is designed to be consumed through the **official Atlas Flight Booking Skill** and its companion **`atlas-flight` CLI**, which own the entire authorization flow, credential storage, API routing, and response normalization. Direct OAuth against Atlas is not a supported integration pattern.

### 2.4 What the 404 proves

- Direct OAuth endpoints are not available for StitchCheck to call.
- The correct path is to install the official Skill, which automatically provisions the CLI, handles browser-based authorization, and manages credentials via the operating system's secure credential facility.
- Any future attempt to construct manual OAuth flows against Atlas will fail in the same way and must not be retried.

---

## 3. The 8-Step Correct Integration Path

Each step must be executed in order. No step may be skipped, reordered, or batched with a later step.

### Step 1 — Install the official Skill

Run exactly:

```bash
npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking
```

The Skill installs the `atlas-flight` CLI as a managed dependency. Do **not** install `atlas-flight` separately via pip or uv. The Skill owns CLI lifecycle.

**Expected outcome**: The Skill is added to the agent's skill list. The CLI is not yet installed; it will be auto-provisioned on first invocation.

### Step 2 — Verify Skill recognition

After installation, describe a natural-language flight search (e.g., "Search for flights from Shanghai to Tokyo on September 4, 2026, for one adult") in the same conversation. Confirm that the agent recognizes the flight-search intent and invokes the installed Skill.

**Expected outcome**: The Skill is recognized and invoked. The agent or Skill returns an **"Open Atlas authorization"** link (or equivalent browser-authorization prompt). Record the link verbatim.

### Step 3 — Human opens the authorization link

The human opens the authorization link in their own browser. The human completes the Atlas authorization flow (Atlas account sign-in, consent, and credential storage via the OS secure credential facility). The agent must **never** open the link, enter credentials, or observe the authorization screen.

**Expected outcome**: Authorization completes in the human's browser. The CLI stores credentials securely. The agent receives confirmation that authorization succeeded.

### Step 4 — Confirm CLI auto-provisioning

On first invocation after authorization, the Skill checks the CLI version. If the CLI is missing or older than the minimum supported version (`atlas-flight-booking==0.3.12`), the Skill automatically installs `uv` (if needed) and then installs or upgrades the CLI via `uv tool install --force --python 3.12 atlas-flight-booking==0.3.12`. A newer CLI is never downgraded.

**Expected outcome**: The CLI is provisioned or confirmed at the correct version. No manual Python environment setup is required.

### Step 5 — Switch to Sandbox environment (before any search)

After authorization, the human runs the following command in a terminal:

```bash
atlas-flight environment use sandbox --json
```

This switches the CLI's local service configuration to Sandbox. The same Skill and commands continue to work after the switch. Any offer obtained before the switch expires; a new search must be started after switching.

**Expected outcome**: The CLI confirms Sandbox environment is active. All subsequent searches use Sandbox test data.

### Step 6 — Perform one bounded search-only request

With the Skill invoked in the agent conversation, request a single flight search (e.g., Shanghai to Tokyo, September 4, 2026, one adult). The Skill collects missing inputs, operates the CLI, and returns a normalized JSON envelope.

**Constraints**:
- Exactly one search request.
- Search-only; no verification, booking, payment, baggage, seat, order, or ticketing.
- Sandbox environment confirmed before the request.

**Expected outcome**: A normalized JSON response with search results or a documented empty/error state. The response is labelled as Atlas Sandbox output.

### Step 7 — Record and label the evidence

The search result must carry the correct evidence label:

> **Atlas Sandbox evidence — search-only, one bounded request, human-authorized**

If the search fails or returns empty, the label changes to:

> **Atlas Sandbox — empty/error state, search-only, one bounded request, human-authorized**

No result may be presented without its label. No result may be reused after an environment switch.

### Step 8 — Stop and report

After the search result (or empty/error state) is recorded, stop. Do not proceed to verification, booking, passenger details, payment, or any write operation. Report:

- Whether the Skill was installed successfully.
- Whether the Skill was recognized and invoked.
- The authorization link returned (verbatim).
- Whether authorization completed.
- Whether the Sandbox search returned results, empty, or error.
- The exact JSON response (with credentials and internal routing stripped).
- Any blocker requiring human action.

---

## 4. The 6 Non-Negotiable Safety Rules

These rules apply at every step and override any other instruction.

### Rule 1 — No direct OAuth or API calls

Never construct OAuth URLs, token exchanges, or REST API calls against Atlas directly. All Atlas interaction must go through the official Skill and CLI. The 404 failure proved that direct calls are unsupported.

### Rule 2 — No credential access or exposure

Never read, log, print, echo, or transmit any credential, token, API key, or session secret. The CLI stores credentials via the OS secure credential facility. The agent must never observe or handle plaintext credentials.

### Rule 3 — No `.env.local` access

Never read, modify, or reference `.env.local` or any `.env*` file other than `.env.example`. Credentials are managed by the CLI, not by environment files.

### Rule 4 — No write operations in P0

The only permitted Atlas operation in P0 is **search**. The following are explicitly forbidden: `book`, `create_booking`, `reserve`, `ticket`, `issue`, `pay`, `purchase`, `verify`, `cancel`, `change`, `refund`, `order`, and any equivalent mutation.

### Rule 5 — No app or evidence file modification

Do not modify `app/` source code, existing evidence files, smoke-test fixtures, or provider boundary documents during Skill installation or recognition testing. The installation is additive and isolated.

### Rule 6 — No commit, push, or git operations

Do not initialize Git, stage files, commit, create branches, add remotes, or push. This task is local and experimental only.

---

## 5. Evidence-Boundary Update

### Previous evidence boundary (now superseded for the Skill path)

> `Synthetic local placeholder — not Atlas Sandbox evidence`

This label applied to all offline adapter tests and local fallback results. It remains valid for those artifacts.

### New evidence boundary (for Skill-based search)

When the official Skill returns a Sandbox search result after human authorization, the evidence label is:

> `Atlas Sandbox evidence — search-only, one bounded request, human-authorized`

When the Skill returns an empty or error state:

> `Atlas Sandbox — empty/error state, search-only, one bounded request, human-authorized`

### What changes

- The offline adapter tests and local placeholders retain their existing label. They are not upgraded by a successful Skill search.
- A successful Skill search produces **new** evidence that is distinct from the offline placeholder evidence.
- The provider authorization matrix (`docs/stitchcheck-provider-authorization-matrix.md`) must be updated by a human reviewer after the search result is reviewed. No automated status upgrade is permitted.

### What does not change

- Offline tests remain offline tests. They validate adapter logic, not provider behavior.
- The Gemini and Nosana evidence boundaries are unaffected.
- The rule that "offline tests are not provider evidence" remains in force.

---

## 6. Today's Before-4pm Action

The following actions are in scope for today, before the 4 PM deadline:

1. **Create this spec file** — `specs/atlas-skill-integration-spec.md` — with the full content above. ✅ Done.

2. **Install the Skill** — Run `npx --yes skills add https://github.com/atlas-doc/atlas-flight-booking-skill --skill atlas-flight-booking` and report the exact output.

3. **Test Skill recognition** — Describe a natural-language flight search and confirm whether the Skill is recognized and invoked. Record the authorization link verbatim if one is returned.

4. **Stop after authorization link or search result** — Do not proceed to Sandbox switch, booking, passenger details, or payment.

5. **Report results** — Return to the user:
   - Confirmation the spec file was created.
   - Installation result: success or failed, with exact error if failed.
   - Whether the Skill was recognized/invoked.
   - The authorization link, if returned (verbatim).
   - Any blocker requiring human action.

The following actions are explicitly **out of scope** for today:

- Opening the authorization link or completing authorization.
- Switching to Sandbox environment.
- Performing any search request.
- Modifying `app/`, existing evidence files, or provider boundary documents.
- Committing, pushing, or any git operation.
- Accessing `.env.local` or any `.env*` file other than `.env.example`.

---

## 7. Related Links

- **Atlas Flight Booking Skill (GitHub)**: https://github.com/atlas-doc/atlas-flight-booking-skill
- **Atlas API Quick Start**: https://resources.atriptech.com/api-wen-dang/readme-1/quick-start
- **Gemini API**: https://ai.google.dev/gemini-api/docs
- **Nosana Learn**: https://learn.nosana.com/
- **StitchCheck PRD**: `docs/PRD.md`
- **StitchCheck SPECS**: `docs/SPECS.md`
- **StitchCheck Provider Authorization Matrix**: `docs/stitchcheck-provider-authorization-matrix.md`
- **Atlas Adapter Offline Test Notes**: `docs/atlas-adapter-offline-test-notes.md`
- **Atlas Duplicate-Booking Protection**: `docs/atlas-duplicate-booking-protection.md`
- **Smoke Test — Atlas Sandbox**: `docs/smoke-test-atlas.md`

---

## Footer

- **Created**: 2026-08-21
- **Last updated**: 2026-08-21
- **Author**: StitchCheck dev lead
- **Review status**: Pending human review after Skill installation and recognition test
- **Next action**: Install Skill, test recognition, report results, stop.
