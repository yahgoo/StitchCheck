// Local-only schema validator for the StitchCheck Atlas search-only smoke-test
// fixtures, matching the ATL-01..ATL-12 contracts in docs/smoke-test-atlas.md.
// Style reference: smoke-tests/gemini/schema-validator.mjs.
//
// Strictly local: validates parsed JSON fixture files and reports issues.
// Never mutates input, never reads credentials, never contacts any service.
// No network, authentication, SDK, or request code exists in this file.
//
// FORBIDDEN-ACTION ENFORCEMENT
// P0 is search-only. Fixture and label text must never reference any
// write-action verb. The seven forbidden tokens are declared exactly once,
// in FORBIDDEN_ACTION_TOKENS below (and in local-contract.json). Any fixture
// containing one of these tokens as a whole word fails validation.

import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DISCLAIMER_LABEL =
  "Synthetic local placeholder — not Atlas Sandbox evidence";

export const SANDBOX_MARKER = "sandbox-placeholder";

// The single source of truth for forbidden write-action verbs inside the
// validator. Matched case-insensitively on whole-word boundaries only.
export const FORBIDDEN_ACTION_TOKENS = [
  "verify",
  "book",
  "pay",
  "ticket",
  "reserve",
  "order",
  "write",
];

const SEARCH_STATUSES = ["loading", "completed", "empty", "timeout", "error"];

const CODE3 = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const TEST_CASE_RE = /^ATL-\d{2}$/;

// Keys that would indicate personally identifiable data. Fixtures must stay
// fully synthetic, so their presence is a hard failure.
const PII_SUSPECT_KEYS = [
  "passenger",
  "passengers",
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "phoneNumber",
  "passport",
  "dateOfBirth",
  "address",
  "creditCard",
  "cardNumber",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalStringOrNull(value, name, issues) {
  if (value !== null && !isNonEmptyString(value)) {
    issues.push(`${name} must be a non-empty string or null`);
  }
}

function checkPiiKeys(value, path, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkPiiKeys(item, `${path}[${index}]`, issues),
    );
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (PII_SUSPECT_KEYS.includes(key)) {
        issues.push(`${path}.${key} looks like PII; fixtures must be synthetic`);
      }
      checkPiiKeys(nested, `${path}.${key}`, issues);
    }
  }
}

// ---------------------------------------------------------------------------
// Forbidden-action enforcement
// ---------------------------------------------------------------------------

// Recursively walks any JSON-shaped value and reports every whole-word
// occurrence of a forbidden write-action token found in object keys or string
// values. Returns an array of { token, path } findings; empty means clean.
export function scanForForbiddenActions(value, path = "$") {
  const findings = [];
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    for (const token of FORBIDDEN_ACTION_TOKENS) {
      const pattern = new RegExp(`\\b${token}\\b`, "i");
      if (pattern.test(lower)) {
        findings.push({ token, path });
      }
    }
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      findings.push(...scanForForbiddenActions(item, `${path}[${index}]`));
    });
    return findings;
  }
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      for (const token of FORBIDDEN_ACTION_TOKENS) {
        const pattern = new RegExp(`\\b${token}\\b`, "i");
        if (pattern.test(lowerKey)) {
          findings.push({ token, path: `${path}.${key} (key)` });
        }
      }
      findings.push(...scanForForbiddenActions(nested, `${path}.${key}`));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Query fixture validation
// ---------------------------------------------------------------------------

export function validateSearchQueryFixture(value) {
  const issues = [];
  if (!isPlainObject(value)) {
    return { valid: false, issues: ["root must be an object"] };
  }

  if (!isNonEmptyString(value.fixtureId)) {
    issues.push("fixtureId must be a non-empty string");
  }
  if (value.disclaimer !== DISCLAIMER_LABEL) {
    issues.push(`disclaimer must be exactly: ${DISCLAIMER_LABEL}`);
  }
  if (
    !Array.isArray(value.testCases) ||
    value.testCases.length === 0 ||
    !value.testCases.every(
      (id) => isNonEmptyString(id) && TEST_CASE_RE.test(id),
    )
  ) {
    issues.push("testCases must be a non-empty array of ATL-NN identifiers");
  }
  if (!isNonEmptyString(value.scenarioNote)) {
    issues.push("scenarioNote must be a non-empty string");
  }

  const query = value.searchQuery;
  if (!isPlainObject(query)) {
    issues.push("searchQuery must be an object");
  } else {
    if (
      !isNonEmptyString(query.correlationId) ||
      !query.correlationId.startsWith("synthetic-")
    ) {
      issues.push(
        "searchQuery.correlationId must be a non-empty string starting with 'synthetic-'",
      );
    }
    for (const field of ["origin", "destination"]) {
      if (!isNonEmptyString(query[field]) || !CODE3.test(query[field])) {
        issues.push(`searchQuery.${field} must be a 3-letter synthetic code`);
      }
    }
    if (!isNonEmptyString(query.departureDate) || !DATE_RE.test(query.departureDate)) {
      issues.push("searchQuery.departureDate must match YYYY-MM-DD");
    }
    for (const field of ["earliestDepartureTime", "latestArrivalTime"]) {
      if (!isNonEmptyString(query[field]) || !TIME_RE.test(query[field])) {
        issues.push(`searchQuery.${field} must match HH:MM`);
      }
    }
    if (query.searchIntent !== "safer-alternative") {
      issues.push("searchQuery.searchIntent must be 'safer-alternative'");
    }
    if (query.sandboxOnly !== true) {
      issues.push("searchQuery.sandboxOnly must be true");
    }
    if (query.syntheticDemo !== true) {
      issues.push("searchQuery.syntheticDemo must be true");
    }
    // ATL-12: a search request may only exist for a confirmed itinerary.
    if (query.confirmedItinerary !== true) {
      issues.push(
        "searchQuery.confirmedItinerary must be true (search requires confirmation first)",
      );
    }
  }

  const context = value.syntheticContext;
  if (!isPlainObject(context)) {
    issues.push("syntheticContext must be an object");
  } else {
    if (
      !Array.isArray(context.legs) ||
      context.legs.length === 0
    ) {
      issues.push("syntheticContext.legs must be a non-empty array");
    } else {
      context.legs.forEach((leg, index) => {
        const legName = `syntheticContext.legs[${index}]`;
        if (!isPlainObject(leg)) {
          issues.push(`${legName} must be an object`);
          return;
        }
        for (const field of ["origin", "destination"]) {
          if (!isNonEmptyString(leg[field]) || !CODE3.test(leg[field])) {
            issues.push(`${legName}.${field} must be a 3-letter synthetic code`);
          }
        }
        if (!isNonEmptyString(leg.date) || !DATE_RE.test(leg.date)) {
          issues.push(`${legName}.date must match YYYY-MM-DD`);
        }
        for (const field of ["departureTime", "arrivalTime"]) {
          if (!isNonEmptyString(leg[field]) || !TIME_RE.test(leg[field])) {
            issues.push(`${legName}.${field} must match HH:MM`);
          }
        }
      });
    }
    if (
      typeof context.connectionDurationMinutes !== "number" ||
      !Number.isFinite(context.connectionDurationMinutes) ||
      context.connectionDurationMinutes < 0
    ) {
      issues.push(
        "syntheticContext.connectionDurationMinutes must be a non-negative number",
      );
    }
  }

  if (
    value.expectedOutcomeFixture !== undefined &&
    !isNonEmptyString(value.expectedOutcomeFixture)
  ) {
    issues.push("expectedOutcomeFixture must be a non-empty string when present");
  }

  checkPiiKeys(value, "$", issues);
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Result fixture validation
// ---------------------------------------------------------------------------

const ALTERNATIVE_REQUIRED_FIELDS = [
  "offerReference",
  "routeSummary",
  "departureTime",
  "arrivalTime",
  "duration",
  "connectionType",
  "priceDisplay",
  "currency",
  "availabilityLabel",
];

export function validateSearchResultFixture(value) {
  const issues = [];
  if (!isPlainObject(value)) {
    return { valid: false, issues: ["root must be an object"] };
  }

  if (!isNonEmptyString(value.fixtureId)) {
    issues.push("fixtureId must be a non-empty string");
  }
  if (value.disclaimer !== DISCLAIMER_LABEL) {
    issues.push(`disclaimer must be exactly: ${DISCLAIMER_LABEL}`);
  }
  if (
    !Array.isArray(value.testCases) ||
    value.testCases.length === 0 ||
    !value.testCases.every(
      (id) => isNonEmptyString(id) && TEST_CASE_RE.test(id),
    )
  ) {
    issues.push("testCases must be a non-empty array of ATL-NN identifiers");
  }

  const result = value.searchResult;
  if (!isPlainObject(result)) {
    issues.push("searchResult must be an object");
    checkPiiKeys(value, "$", issues);
    return { valid: issues.length === 0, issues };
  }

  if (
    !isNonEmptyString(result.correlationId) ||
    !result.correlationId.startsWith("synthetic-")
  ) {
    issues.push(
      "searchResult.correlationId must be a non-empty string starting with 'synthetic-'",
    );
  }
  if (!SEARCH_STATUSES.includes(result.searchStatus)) {
    issues.push(
      `searchResult.searchStatus must be one of: ${SEARCH_STATUSES.join(", ")}`,
    );
  }
  // ATL-08: every fixture result must carry the sandbox placeholder marker.
  if (result.sourceEnvironment !== SANDBOX_MARKER) {
    issues.push(`searchResult.sourceEnvironment must be '${SANDBOX_MARKER}'`);
  }
  if (!Array.isArray(result.alternatives)) {
    issues.push("searchResult.alternatives must be an array");
  } else {
    result.alternatives.forEach((alternative, index) => {
      const name = `searchResult.alternatives[${index}]`;
      if (!isPlainObject(alternative)) {
        issues.push(`${name} must be an object`);
        return;
      }
      for (const field of ALTERNATIVE_REQUIRED_FIELDS) {
        if (!isNonEmptyString(alternative[field])) {
          issues.push(`${name}.${field} must be a non-empty string`);
        }
      }
      if (alternative.connectionDurationMinutes !== undefined) {
        if (
          typeof alternative.connectionDurationMinutes !== "number" ||
          !Number.isFinite(alternative.connectionDurationMinutes) ||
          alternative.connectionDurationMinutes < 0
        ) {
          issues.push(
            `${name}.connectionDurationMinutes must be a non-negative number when present`,
          );
        }
      }
    });
  }

  optionalStringOrNull(result.errorCode, "searchResult.errorCode", issues);
  optionalStringOrNull(result.errorMessage, "searchResult.errorMessage", issues);
  if (typeof result.fallbackUsed !== "boolean") {
    issues.push("searchResult.fallbackUsed must be a boolean");
  }

  // Status-specific honesty rules: the UI must never fabricate alternatives.
  if (result.searchStatus === "completed") {
    if (!Array.isArray(result.alternatives) || result.alternatives.length === 0) {
      issues.push(
        "searchResult.alternatives must contain at least one entry when searchStatus is completed",
      );
    }
    if (result.errorCode !== null || result.errorMessage !== null) {
      issues.push(
        "searchResult.errorCode and errorMessage must be null when searchStatus is completed",
      );
    }
  }
  if (["empty", "timeout", "error"].includes(result.searchStatus)) {
    if (Array.isArray(result.alternatives) && result.alternatives.length !== 0) {
      issues.push(
        `searchResult.alternatives must be empty when searchStatus is ${result.searchStatus}`,
      );
    }
  }
  if (["timeout", "error"].includes(result.searchStatus)) {
    if (!isNonEmptyString(result.errorCode) || !isNonEmptyString(result.errorMessage)) {
      issues.push(
        `searchResult.errorCode and errorMessage must be non-empty strings when searchStatus is ${result.searchStatus}`,
      );
    }
  }

  if (
    value.expectedUiBehavior !== undefined &&
    !isNonEmptyString(value.expectedUiBehavior)
  ) {
    issues.push("expectedUiBehavior must be a non-empty string when present");
  }

  checkPiiKeys(value, "$", issues);
  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

function classifyFixture(fileName) {
  if (fileName.startsWith("query-atl-")) return "query";
  if (fileName.startsWith("result-atl-")) return "result";
  return null;
}

// Validates one fixture file; returns true when it passes both the schema
// checks and the forbidden-action scan. Prints PASS/FAIL lines itself.
function validateOneFile(name, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`FAIL: ${name} — invalid JSON: ${error.message}`);
    return false;
  }

  const kind = classifyFixture(name);
  const schema =
    kind === "query"
      ? validateSearchQueryFixture(parsed)
      : validateSearchResultFixture(parsed);
  const forbidden = scanForForbiddenActions(parsed);
  const fileIssues = [...schema.issues];
  for (const finding of forbidden) {
    fileIssues.push(
      `forbidden action token detected at ${finding.path}: "${finding.token}"`,
    );
  }

  if (schema.valid && forbidden.length === 0) {
    console.log(`PASS: ${name} (${kind} fixture)`);
    return true;
  }
  console.error(`FAIL: ${name} (${kind} fixture)`);
  for (const issue of fileIssues) {
    console.error(`  - ${issue}`);
  }
  return false;
}

function runCli() {
  // Single-file mode: `node schema-validator.mjs <path-to-fixture.json>`.
  // Used to demonstrate that the forbidden-action scan fails any fixture
  // whose text contains a forbidden token.
  const singleTarget = process.argv[2];
  if (singleTarget) {
    const name = basename(singleTarget);
    if (classifyFixture(name) === null) {
      console.error(
        `FAIL: ${name} does not follow the query-atl-* / result-atl-* naming scheme`,
      );
      process.exit(1);
    }
    const ok = validateOneFile(name, singleTarget);
    process.exit(ok ? 0 : 1);
  }

  const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
  let entries;
  try {
    entries = readdirSync(fixturesDir).filter((name) => name.endsWith(".json"));
  } catch (error) {
    console.error(`FAIL: cannot read fixtures directory: ${error.message}`);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error("FAIL: no fixture files found");
    process.exit(1);
  }

  const unclassified = entries.filter((name) => classifyFixture(name) === null);
  for (const name of unclassified) {
    console.error(
      `FAIL: ${name} does not follow the query-atl-* / result-atl-* naming scheme`,
    );
  }

  let failures = unclassified.length;
  const classified = entries
    .filter((name) => classifyFixture(name) !== null)
    .sort();

  for (const name of classified) {
    if (!validateOneFile(name, join(fixturesDir, name))) {
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(
      `\n${failures} fixture(s) failed validation (forbidden-action and schema checks included).`,
    );
    process.exit(1);
  }
  console.log(
    `\nAll ${classified.length} fixtures passed schema and forbidden-action validation.`,
  );
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runCli();
}
