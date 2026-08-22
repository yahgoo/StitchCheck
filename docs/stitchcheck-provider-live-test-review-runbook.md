# StitchCheck Provider Live-Test Review Runbook

## Purpose

This runbook prepares a human to review, authorize, and sequence one future bounded direct-Gemini extraction test and one future bounded Atlas read-only search/compare test. Each provider has independent gates and requires separate authorization. No live execution is currently authorized. No SDK has been installed. No credential has been configured. No network request has been made.

## Current State

| Provider | Implementation state | Live state | Current evidence boundary |
|----------|---------------------|------------|---------------------------|
| Direct Gemini | Adapter boundary and offline tests implemented | Disabled and unexecuted | `Synthetic local placeholder — not direct Gemini evidence` |
| OpenRouter | Temporary-path adapter executed for GEM-01 | Existing temporary-path evidence only | `OpenRouter temporary path — not direct Gemini validation` |
| Atlas | Read-only adapter boundary and offline tests implemented | Unauthenticated and unexecuted | `Synthetic local placeholder — not Atlas Sandbox evidence` |
| Nosana | Local workload skeleton implemented | Blocked before any network request | `Synthetic local placeholder — not Nosana evidence` |

## Phase 0 — Human Review

The following steps are human actions only. No step may be automated or delegated to a script.

1. **Read the provider authorization matrix.** Review `docs/stitchcheck-provider-authorization-matrix.md` in full. Confirm that every gate is understood and that each provider has independent authorization requirements.

2. **Review the official provider/client documentation.** For each provider under consideration, read the official documentation published by the provider. Do not rely on third-party summaries, community posts, or inferred behavior.

3. **Confirm capability and target-environment requirements.** Verify that the required capability (e.g., image input and structured output for Gemini; read-only search/compare for Atlas) is confirmed by official documentation. Confirm the target environment or model is explicitly identified.

4. **Review cost, quota, permission, privacy, and data-handling implications.** Understand the cost of a single request, the quota impact, the permission scope required, the privacy implications of any data sent, and the data-retention policy of the provider.

5. **Confirm synthetic fixture scope.** Verify that the input is a synthetic fixture only. No PII, no real itinerary data, no live service data. Confirm the fixture matches the adapter contract.

6. **Review the adapter safety limits and operation allowlists.** Confirm that the adapter enforces a one-request limit, bounded timeout, bounded response size, zero retries, and that only permitted operations are accessible.

7. **Confirm sanitized evidence format.** Review the normalized output shape and error sanitization logic. Confirm that no credential, URL, raw response, or PII can appear in the recorded result.

8. **Record GO or NO-GO for each provider.** Each provider requires a separate, explicit human decision. A GO for one provider does not imply a GO for any other provider.

## Phase 1 — Gemini Readiness

Every item below must be completed by a human before any future Gemini execution can be considered.

- [ ] Official SDK/version reviewed — **Pending human review**
- [ ] Model capability reviewed — **Pending human review**
- [ ] Image input reviewed — **Pending human review**
- [ ] Structured output reviewed — **Pending human review**
- [ ] Capability approval recorded — **Pending human review**
- [ ] Secure runtime credential configured — **Pending human review**
- [ ] Exact synthetic fixture selected — **Pending human review**
- [ ] One-request limit confirmed — **Pending human review**
- [ ] Timeout/response limits confirmed — **Pending human review**
- [ ] No-retry behavior confirmed — **Pending human review**
- [ ] Human authorization recorded — **Pending human review**
- [ ] Separate execution mechanism reviewed — **Pending human review**

## Phase 2 — Atlas Readiness

Every item below must be completed by a human before any future Atlas execution can be considered.

- [ ] Official client/skill documentation reviewed — **Pending human review**
- [ ] Target Sandbox environment identified — **Pending human review**
- [ ] Client/SDK mechanism reviewed — **Pending human review**
- [ ] Read-only capability approved — **Pending human review**
- [ ] Search/compare operation scope confirmed — **Pending human review**
- [ ] Mutation allowlist rejection reviewed — **Pending human review**
- [ ] Secure runtime credential configured — **Pending human review**
- [ ] Exact synthetic search fixture selected — **Pending human review**
- [ ] One-request limit confirmed — **Pending human review**
- [ ] Timeout/response limits confirmed — **Pending human review**
- [ ] No-retry behavior confirmed — **Pending human review**
- [ ] Human authorization recorded — **Pending human review**
- [ ] Separate execution mechanism reviewed — **Pending human review**

## Phase 3 — Execution Review, Not Execution

This section describes the review sequence that must be completed immediately before any future bounded request. This section does not authorize a request. A separate human-approved task is required for each provider.

- **Confirm every applicable gate is complete.** Review the authorization matrix and the Phase 1 or Phase 2 checklist. Every applicable item must be marked complete. Any pending item is a hard stop.

- **Confirm the intended provider and operation.** Identify exactly which provider will be called and which operation is permitted. For Gemini: extraction only. For Atlas: search or compare only. No other operation is permitted.

- **Confirm one synthetic input only.** The input must be a single synthetic fixture. No real data, no PII, no live service data.

- **Confirm one request maximum.** The adapter enforces a one-request limit per execution. No second request, no retry, no follow-up.

- **Confirm no external write action is possible.** The adapter cannot create, confirm, pay for, reserve, ticket, order, verify, cancel, change, or refund anything. For Atlas, all mutation operations are explicitly forbidden.

- **Confirm output will be normalized and sanitized.** The result will pass through the adapter's normalization and error sanitization logic. No raw provider output, credential, URL, or PII will appear in the recorded result.

- **Confirm the operator can stop immediately on uncertainty.** If any unexpected behavior, error, or ambiguity occurs, the operator must stop immediately and not proceed.

- **Obtain explicit human GO immediately before any separate execution task.** The human must record GO for the specific provider and specific bounded request immediately before the execution task begins. A prior GO does not carry forward to a different request or a different provider.

## Phase 4 — Evidence Review

After any future bounded run, a human must review the following before any documentation change:

- **Timestamp and test identifier.** Record when the request was made and which test identifier was used.

- **Provider and approved operation.** Record which provider was called and which operation was performed.

- **Normalized result only.** Review only the normalized contract output. No raw provider response should be recorded or reviewed.

- **Sanitized status.** Confirm that the result contains no credentials, URLs, raw response content, or PII.

- **Request count.** Confirm that exactly one request was made and that the one-request limit was enforced.

- **Timeout/failure state.** If the request timed out or failed, record the sanitized error and confirm no sensitive data was exposed.

- **What the result proves.** State precisely what the normalized result demonstrates about the adapter and the provider's response to the synthetic input.

- **What the result does not prove.** State what the result does not demonstrate — e.g., it does not prove production readiness, it does not prove behavior with real data, it does not prove end-to-end integration.

- **Whether the result may be cited.** Determine whether the result may be cited in documentation as evidence, and under which evidence label.

- **Human sign-off before status documentation changes.** No documentation status may be changed without explicit human sign-off reviewing the normalized result.

## Stop Conditions

Execution must not proceed if any of the following conditions apply:

1. Any pending matrix gate.
2. Missing official documentation.
3. Unclear model, client, or target environment.
4. Unclear cost, quota, permission, privacy, or retention.
5. Missing secure credential setup.
6. More than one request.
7. Any retry or polling behavior.
8. Any raw response or secret exposure.
9. Any booking, payment, reservation, ticket, order, verification, or mutation.
10. Any browser-side provider call.
11. Any mismatch between adapter and contract.
12. Any need to guess.

## Evidence Labels

The following evidence labels are preserved exactly:

- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not direct Gemini evidence`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

Offline tests and local placeholders are not live provider evidence. They validate adapter logic using fake clients and synthetic data only. No offline test result may be cited as provider evidence. No status may be upgraded based on offline test results alone.

## Final Authorization Rule

"This runbook does not authorize provider execution. A separate human-approved task is required for each provider and each bounded request."

## Human Sign-Off

### Gemini

- Reviewer:
- Date/time:
- Matrix reviewed:
- All applicable gates complete: Yes / No
- Final decision: GO / NO-GO
- Notes:

### Atlas

- Reviewer:
- Date/time:
- Matrix reviewed:
- All applicable gates complete: Yes / No
- Final decision: GO / NO-GO
- Notes:
