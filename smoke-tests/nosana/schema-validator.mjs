// Strict schema validator for the StitchCheck Nosana risk-workload smoke-test
// contracts, matching docs/SPECS.md and docs/smoke-test-nosana.md.
// Local only: validates parsed objects and fixture files; never mutates
// input, never executes any workload, and never contacts Nosana or any
// network endpoint. Zero dependencies (Node.js built-ins only).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLACEHOLDER_LABEL = "Synthetic local placeholder — not Nosana evidence";
export const HEURISTIC_DISCLAIMER =
  "Heuristic risk estimate only — derived from a static/historical synthetic dataset; not a live delay, weather, legal, or guaranteed-outcome prediction.";

const WORKLOAD_STATUSES = ["queued", "running", "completed", "timeout", "error"];
const RISK_BANDS = ["low", "medium", "high", "unavailable"];
const AIRPORT_CODE = /^[A-Z]{3}$/;

// Keys that would indicate PII if present anywhere in a request.
const FORBIDDEN_PII_KEYS = [
  "name",
  "firstName",
  "lastName",
  "surname",
  "email",
  "emailAddress",
  "phone",
  "phoneNumber",
  "passenger",
  "passengers",
  "bookingReference",
  "pnr",
  "payment",
  "cardNumber",
  "passport",
  "dateOfBirth",
  "address",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkAirportCode(value, field, issues) {
  if (!isNonEmptyString(value)) {
    issues.push(`${field} must be a non-empty string`);
  } else if (!AIRPORT_CODE.test(value)) {
    issues.push(`${field} must be a 3-letter uppercase airport code`);
  }
}

// Recursively scans an object for keys that look like PII containers.
function scanPiiKeys(value, prefix, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPiiKeys(item, `${prefix}[${index}]`, issues));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const location = prefix ? `${prefix}.${key}` : key;
      if (FORBIDDEN_PII_KEYS.includes(key.toLowerCase())) {
        issues.push(`possible PII field present: ${location}`);
      }
      scanPiiKeys(child, location, issues);
    }
  }
}

// Validates a RiskRequest payload (the inner `riskRequest` object of a
// request fixture) against the illustrative input contract in
// docs/smoke-test-nosana.md.
export function validateRiskRequest(value) {
  const issues = [];
  if (!isPlainObject(value)) {
    return { valid: false, issues: ["riskRequest must be an object"] };
  }

  if (!isNonEmptyString(value.correlationId)) {
    issues.push("correlationId must be a non-empty string");
  }
  checkAirportCode(value.origin, "origin", issues);
  checkAirportCode(value.connectionAirport, "connectionAirport", issues);
  checkAirportCode(value.destination, "destination", issues);

  if (
    typeof value.connectionDurationMinutes !== "number" ||
    !Number.isFinite(value.connectionDurationMinutes) ||
    value.connectionDurationMinutes < 0
  ) {
    issues.push("connectionDurationMinutes must be a non-negative finite number");
  }

  if (!isNonEmptyString(value.staticHistoricalDatasetVersion)) {
    issues.push("staticHistoricalDatasetVersion must be a non-empty string");
  }

  if (value.syntheticDemo !== true) {
    issues.push("syntheticDemo must be true");
  }
  if (value.nonPiiDeclaration !== true) {
    issues.push("nonPiiDeclaration must be true");
  }

  scanPiiKeys(value, "", issues);

  return { valid: issues.length === 0, issues };
}

// Validates a RiskResult payload (the inner `riskResult` object of a
// result fixture or a skeleton-recorded result) against the illustrative
// expected result contract in docs/smoke-test-nosana.md.
export function validateRiskResult(value) {
  const issues = [];
  if (!isPlainObject(value)) {
    return { valid: false, issues: ["riskResult must be an object"] };
  }

  if (!isNonEmptyString(value.correlationId)) {
    issues.push("correlationId must be a non-empty string");
  }

  if (!WORKLOAD_STATUSES.includes(value.workloadStatus)) {
    issues.push(`workloadStatus must be one of: ${WORKLOAD_STATUSES.join(", ")}`);
  }

  if (value.jobOrServiceReference !== null && !isNonEmptyString(value.jobOrServiceReference)) {
    issues.push("jobOrServiceReference must be a non-empty string or null");
  }

  if (!RISK_BANDS.includes(value.riskBand)) {
    issues.push(`riskBand must be one of: ${RISK_BANDS.join(", ")}`);
  }

  if (value.riskScore !== null) {
    if (
      typeof value.riskScore !== "number" ||
      !Number.isFinite(value.riskScore) ||
      value.riskScore < 0 ||
      value.riskScore > 1
    ) {
      issues.push("riskScore must be null or a finite number between 0 and 1");
    }
  }

  // A score must never be invented if the job failed or timed out.
  if (value.workloadStatus === "timeout" || value.workloadStatus === "error") {
    if (value.riskScore !== null) {
      issues.push("riskScore must be null when workloadStatus is timeout or error");
    }
    if (value.riskBand !== "unavailable") {
      issues.push("riskBand must be unavailable when workloadStatus is timeout or error");
    }
  }

  if (value.riskBand === "unavailable" && value.riskScore !== null) {
    issues.push("riskScore must be null when riskBand is unavailable");
  }

  if (!isNonEmptyString(value.heuristicDisclaimer)) {
    issues.push("heuristicDisclaimer must be a non-empty string");
  } else if (!/heuristic/i.test(value.heuristicDisclaimer)) {
    issues.push("heuristicDisclaimer must visibly state that the estimate is heuristic");
  }

  if (!isNonEmptyString(value.failureCascadeExplanation)) {
    issues.push("failureCascadeExplanation must be a non-empty string");
  }

  if (!isNonEmptyString(value.datasetVersion)) {
    issues.push("datasetVersion must be a non-empty string");
  }

  if (typeof value.fallbackUsed !== "boolean") {
    issues.push("fallbackUsed must be a boolean");
  }

  const codePresent = value.errorCode !== null && value.errorCode !== undefined;
  const messagePresent = value.errorMessage !== null && value.errorMessage !== undefined;
  if (codePresent !== messagePresent) {
    issues.push("errorCode and errorMessage must be both present or both null");
  }
  if (codePresent && !isNonEmptyString(value.errorCode)) {
    issues.push("errorCode must be a non-empty string when present");
  }
  if (messagePresent && !isNonEmptyString(value.errorMessage)) {
    issues.push("errorMessage must be a non-empty string when present");
  }

  // Successful scored output must not carry an error code.
  if (
    value.workloadStatus === "completed" &&
    value.riskBand !== "unavailable" &&
    codePresent
  ) {
    issues.push("errorCode must be null for a completed workload with an available risk band");
  }

  return { valid: issues.length === 0, issues };
}

// Validates that a fixture wrapper visibly carries the exact placeholder
// label required for all local artifacts.
export function validatePlaceholderLabel(fixture) {
  const issues = [];
  if (!isPlainObject(fixture)) {
    return { valid: false, issues: ["fixture must be an object"] };
  }
  if (fixture.placeholderLabel !== PLACEHOLDER_LABEL) {
    issues.push(`placeholderLabel must be exactly: ${PLACEHOLDER_LABEL}`);
  }
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// CLI: validate every fixture listed in fixtures/manifest.json and self-check
// that clearly broken inputs are rejected. Runs fully offline.
// ---------------------------------------------------------------------------
function runCli() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.join(here, "fixtures", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  let failures = 0;

  function report(name, expectedValid, result) {
    const matchesExpectation = result.valid === expectedValid;
    if (!matchesExpectation) failures += 1;
    const verdict = matchesExpectation ? "PASS" : "FAIL";
    const detail = expectedValid
      ? result.valid
        ? "valid as expected"
        : `expected valid but got issues: ${result.issues.join("; ")}`
      : result.valid
        ? "expected invalid but fixture validated"
        : `rejected as expected (${result.issues.length} issue(s))`;
    console.log(`[${verdict}] ${name}: ${detail}`);
  }

  for (const entry of manifest.requestFixtures) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(here, "fixtures", entry.file), "utf8"),
    );
    const labelResult = validatePlaceholderLabel(fixture);
    if (!labelResult.valid) failures += 1;
    console.log(
      `[${labelResult.valid ? "PASS" : "FAIL"}] ${entry.fixtureId} placeholder label: ${
        labelResult.valid ? "exact label present" : labelResult.issues.join("; ")
      }`,
    );
    report(entry.fixtureId, entry.expectedValid, validateRiskRequest(fixture.riskRequest));
  }

  for (const entry of manifest.resultFixtures) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(here, "fixtures", entry.file), "utf8"),
    );
    const labelResult = validatePlaceholderLabel(fixture);
    if (!labelResult.valid) failures += 1;
    console.log(
      `[${labelResult.valid ? "PASS" : "FAIL"}] ${entry.fixtureId} placeholder label: ${
        labelResult.valid ? "exact label present" : labelResult.issues.join("; ")
      }`,
    );
    report(entry.fixtureId, entry.expectedValid, validateRiskResult(fixture.riskResult));
  }

  // Self-check: clearly broken inputs must be rejected.
  const brokenRequest = validateRiskRequest({ connectionDurationMinutes: -1 });
  const brokenResult = validateRiskResult({
    workloadStatus: "error",
    riskScore: 0.9,
    riskBand: "high",
  });
  const selfCheckOk = !brokenRequest.valid && !brokenResult.valid;
  if (!selfCheckOk) failures += 1;
  console.log(
    `[${selfCheckOk ? "PASS" : "FAIL"}] self-check: broken request and invented-score result both rejected`,
  );

  console.log("");
  if (failures === 0) {
    console.log("All fixture validations passed (offline, synthetic, no Nosana contact).");
  } else {
    console.log(`${failures} validation check(s) failed.`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli();
}
