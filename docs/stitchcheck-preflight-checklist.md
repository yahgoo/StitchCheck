# StitchCheck Preflight Checklist

## Purpose

The preflight checker is a read-only validation tool that verifies submission packaging and evidence boundaries before recording or submission. It ensures all required documentation exists, required scripts are present, evidence labels are correct, provider boundaries are maintained, and no forbidden content (credentials or URLs) is present in the scanned files.

The checker runs deterministically using only Node.js built-ins and makes no modifications to any files.

## Checks

### Required Files
The checker verifies the existence of:
- `README.md`
- `docs/stitchcheck-demo-readiness-report.md`
- `docs/stitchcheck-local-demo-operator-guide.md`
- `docs/stitchcheck-slide-deck-outline.md`
- `docs/stitchcheck-demo-narrative-video-plan.md`
- `docs/stitchcheck-judge-qa.md`
- `docs/stitchcheck-submission-evidence-index.md`
- `docs/stitchcheck-final-submission-readiness-checklist.md`
- `docs/gemini-contract-alignment-record.md`
- `docs/nosana-integration-boundary.md`
- `docs/cross-provider-invariant-test-record.md`

### Package Scripts
The checker verifies that `app/package.json` contains:
- `verify:offline` script
- `typecheck` script
- `build` script

### Evidence Labels
The checker verifies the presence of exact evidence labels:
- `OpenRouter temporary path — not direct Gemini validation`
- `Synthetic local placeholder — not Nosana evidence`
- `Synthetic local placeholder — not Atlas Sandbox evidence`

### Provider Boundaries
The checker verifies that provider boundary statements remain present:
- Direct Gemini remains unexecuted
- Nosana remains unexecuted and undeployed
- Atlas remains unauthenticated and unexecuted
- OpenRouter is temporary-path evidence only, not direct Gemini validation

### Confirmation Gate
The checker verifies the confirmation-gate wording:
- `Confirm itinerary first`

### Forbidden Content
The checker scans the required documentation and package files for:
- Credential assignment patterns (API keys, bearer tokens, private keys, passwords)
- HTTP/HTTPS URLs

The checker does not flag:
- Required negative provider-status phrases
- Exact evidence labels

### Offline Test Results
- Atlas duplicate-booking guard: 48 passed, 0 failed.

The guard is offline-only and enforces query-before-retry without performing booking, payment, polling, or network execution.

## Safety Boundary

- No environment files are read.
- No credentials are used.
- No network requests occur.
- No provider is executed.
- No files are modified by the checker.

## Limitations

The checker cannot prove:
- Browser behavior
- Provider availability
- Provider accuracy
- Deployment success
- Authentication success
- Production readiness

The checker only validates that required files exist, required scripts are present, evidence labels are correct, provider boundaries are maintained, and no forbidden content is present in the scanned files.

## Usage

Run the preflight checker from the `app/` directory:

```bash
npm run preflight
```

The checker will output pass/fail lines for each check and a final total. It exits with a nonzero status if any check fails.
