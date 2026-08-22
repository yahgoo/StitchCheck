// Strict structured-output schema validator for the StitchCheck extraction
// contract, matching docs/SPECS.md and docs/smoke-test-gemini.md.
// Local only: validates a parsed object and reports issues; never mutates
// input and never contacts any service.

const EXTRACTION_STATUSES = ["success", "partial", "invalid", "error", "disabled"];
const LEG_REQUIRED_FIELDS = [
  "origin",
  "destination",
  "date",
  "departureTime",
  "arrivalTime",
];
const LEG_OPTIONAL_FIELDS = ["airline", "flightNumber"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkLeg(leg, name, issues) {
  if (leg === null || typeof leg !== "object" || Array.isArray(leg)) {
    issues.push(`${name} must be an object`);
    return;
  }
  for (const field of LEG_REQUIRED_FIELDS) {
    if (!isNonEmptyString(leg[field])) {
      issues.push(`${name}.${field} must be a non-empty string`);
    }
  }
  for (const field of LEG_OPTIONAL_FIELDS) {
    if (
      leg[field] !== undefined &&
      leg[field] !== null &&
      !isNonEmptyString(leg[field])
    ) {
      issues.push(`${name}.${field} must be a non-empty string when present`);
    }
  }
}

export function validateExtractionResult(value) {
  const issues = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, issues: ["root must be an object"] };
  }

  if (!EXTRACTION_STATUSES.includes(value.extractionStatus)) {
    issues.push(
      `extractionStatus must be one of: ${EXTRACTION_STATUSES.join(", ")}`,
    );
  }

  const legsExpected =
    value.extractionStatus === "success" || value.extractionStatus === "partial";
  for (const legName of ["firstLeg", "secondLeg"]) {
    if (legsExpected) {
      checkLeg(value[legName], legName, issues);
    }
  }

  if (value.extractionStatus === "success") {
    if (
      typeof value.connectionDurationMinutes !== "number" ||
      !Number.isFinite(value.connectionDurationMinutes) ||
      value.connectionDurationMinutes < 0
    ) {
      issues.push(
        "connectionDurationMinutes must be a non-negative number when status is success",
      );
    }
  }

  if (
    !Array.isArray(value.missingFields) ||
    !value.missingFields.every(isNonEmptyString)
  ) {
    issues.push("missingFields must be an array of non-empty strings");
  }

  if (value.fieldConfidence !== undefined && value.fieldConfidence !== null) {
    if (
      typeof value.fieldConfidence !== "object" ||
      Array.isArray(value.fieldConfidence)
    ) {
      issues.push("fieldConfidence must be an object");
    } else {
      // The contract specifies string confidence labels (e.g. "high",
      // "medium", "low", "none"). Values may be non-empty strings or
      // finite numbers for forward compatibility.
      for (const [key, confidence] of Object.entries(value.fieldConfidence)) {
        if (typeof confidence === "string") {
          if (confidence.trim().length === 0) {
            issues.push(`fieldConfidence.${key} must be a non-empty string`);
          }
        } else if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
          issues.push(
            `fieldConfidence.${key} must be a non-empty string or finite number`,
          );
        }
      }
    }
  }

  if (
    !Array.isArray(value.validationMessages) ||
    !value.validationMessages.every(isNonEmptyString)
  ) {
    issues.push("validationMessages must be an array of non-empty strings");
  }

  if (value.requiresUserConfirmation !== true) {
    issues.push("requiresUserConfirmation must be true");
  }

  if (value.syntheticDemo !== true) {
    issues.push("syntheticDemo must be true");
  }

  return { valid: issues.length === 0, issues };
}
