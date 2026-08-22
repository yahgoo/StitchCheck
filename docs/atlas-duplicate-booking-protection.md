# Atlas Duplicate-Booking Protection

## Purpose

This document describes an offline safety boundary for preventing blind retries after Atlas duplicate-booking response 318. It implements a pure, dependency-injected state machine that enforces the core rule: query first, retry second. This boundary does not call any provider, does not authenticate, and does not execute any booking, payment, or order operation.

## Core Rule

`Query first, retry second.`

A 318 response from Atlas means "existing booking/order must be checked." It does not prove that no booking exists. It does not permit blind retry. The correct response is to query the existing order's authoritative status before taking any further action.

## State Machine

The guard implements the following states:

- **attempt-created**: A new candidate attempt has been created with explicit user confirmation.
- **awaiting-authoritative-status**: An order request was accepted; awaiting authoritative status from the provider.
- **query-existing-order**: A 318 response was received; the existing order must be queried.
- **recovered-existing-order**: The existing order was found to be ticketed; the booking reference is recovered.
- **existing-order-processing**: The existing order is still processing; polling is required; no duplicate creation permitted.
- **paid-awaiting-ticketing**: The existing order is paid but awaiting ticketing; authoritative follow-up required; no retry permitted.
- **retry-review-required**: The existing order failed or was cancelled; a separately confirmed retry decision is required.
- **safely-stopped**: The existing order status is unknown; the flow stopped safely; no retry permitted.

## Retry Conditions

Retry is permitted only when all of the following are satisfied:

- The authoritative status indicates `failed` or `cancelled`, or another explicitly permitted condition.
- Explicit human confirmation has been obtained for the retry.
- A genuinely different eligible candidate is provided, or a documented expiration/eligibility rule applies.
- A new local attempt record is created; the same candidate fingerprint cannot be reused.

Retry is never permitted from the following states:

- `recovered-existing-order` (ticketed)
- `existing-order-processing` (still processing)
- `paid-awaiting-ticketing` (paid, awaiting ticketing)
- `safely-stopped` (unknown status)

## Prohibited Behavior

The following behaviors are explicitly prohibited:

- Blindly repeating the same order without querying the existing order status.
- Treating a 318 response as proof that no booking exists.
- Creating fake identities or artificial passenger details to bypass duplicate detection.
- Artificially changing passenger details to create a nominally different candidate.
- Reusing the same order payload or candidate fingerprint.
- Retrying while the existing order is still processing or ticketed.
- Treating payment acceptance or order request acceptance as proof of ticket issuance.

## Evidence Boundary

- `Synthetic local placeholder — not Atlas Sandbox evidence`
- `executedAgainstProvider: false`
- Atlas remains unauthenticated and unexecuted.
- No booking, payment, reservation, ticket, polling, cancellation, or network execution occurred.

## Limitations

This boundary does not prove:

- Atlas behavior, authentication, or deployment.
- Ticketing, payment handling, or order processing.
- Provider availability, accuracy, latency, or cost.
- Production readiness.
- Successful final submission or booking.

All artifacts and results documented herein are from local, offline, deterministic execution with synthetic fixtures. No live provider has been invoked, authenticated, or deployed.
