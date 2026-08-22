# StitchCheck Final Submission QA Checklist

## Use This Checklist

This checklist is for human pre-submission review only. It does not upgrade provider evidence, authorize live-service execution, or change any provider boundary. All items must be verified against the actual submission materials before recording or submission.

## Product Demo

- [ ] Fresh local page load completes without errors.
- [ ] Synthetic fixture selection works (GEM-01 through GEM-05).
- [ ] Extracted fields are editable after fixture selection.
- [ ] At least one user correction is visible in the extraction fields.
- [ ] Exact gate text `Confirm itinerary first` is visible before confirmation.
- [ ] Explicit user confirmation is required to proceed.
- [ ] Downstream risk and alternatives panels unlock only after explicit confirmation.
- [ ] Visible source and placeholder labels appear in the correct panels.
- [ ] Keep or Switch is local only and ends without external action.

## Evidence Honesty

- [ ] Exact Gemini label appears: `OpenRouter temporary path — not direct Gemini validation`
- [ ] Direct Gemini is not claimed as executed.
- [ ] Nosana is not claimed as deployed or executed.
- [ ] Atlas is not claimed as authenticated or executed.
- [ ] Atlas duplicate-booking protection is described as offline-only.
- [ ] `executedAgainstProvider: false` is preserved for offline Atlas results.
- [ ] No local fixture is presented as a provider response.
- [ ] No claim suggests booking, payment, reservation, ticketing, order, verification, cancellation, or another external write action.

## Submission Assets

- [ ] README matches actual local behavior and provider status.
- [ ] Slide deck contains exactly eight slides or follows the approved outline.
- [ ] Video follows the 90–120 second plan.
- [ ] Recording contains no terminal, credentials, `.env.local`, unrelated tabs, notifications, or PII.
- [ ] Screenshots or visuals, if used, show local-demo context and labels.
- [ ] Evidence index and contract-alignment record remain consistent with claims.

## Quality Gates

- [ ] Gemini offline tests: 92 passed, 0 failed.
- [ ] Atlas offline tests: 89 passed, 0 failed.
- [ ] Atlas duplicate-booking guard: 48 passed, 0 failed.
- [ ] Nosana schema-validator fixtures passed.
- [ ] Type-check passed.
- [ ] Production build passed.
- [ ] No unintended files are changed.

## Final Human Decision

- [ ] I have reviewed all provider and evidence wording for accuracy.
- [ ] I authorize submission with local-demo and evidence boundaries disclosed.
- [ ] I have saved or captured the final submission materials.

## Stop Conditions

Stop immediately and do not submit if any of the following occur:

- Any key, token, credential, or PII appears.
- Any wording presents offline or local results as live provider evidence.
- The confirmation gate fails or panels unlock early.
- A provider action, booking-like action, or unexpected network request occurs.
