// Extraction result validator for StitchCheck.
//
// Validates that an extraction result meets the minimum requirements:
//   - Required fields are present and non-empty
//   - Dates and times are well-formed
//   - Connection duration is plausible
//   - Confidence values are valid
//   - Uncertainty is preserved as warnings or low confidence
//
// This validator does not invent data. It rejects malformed input and
// preserves uncertainty as warnings or confidence values.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

const VALID_EXTRACTION_STATUSES = [
  "success",
  "partial",
  "invalid",
  "error",
  "disabled",
];

const REQUIRED_LEG_FIELDS = ["origin", "destination", "date", "departureTime", "arrivalTime"];
const OPTIONAL_LEG_FIELDS = ["airline", "flightNumber"];

/* ── Helper functions ── */

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(dateStr) {
  if (!isNonEmptyString(dateStr)) return false;
  if (!DATE_REGEX.test(dateStr)) return false;

  // Check if date is actually valid
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidTime(timeStr) {
  if (!isNonEmptyString(timeStr)) return false;
  if (!TIME_REGEX.test(timeStr)) return false;

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function isPlausibleConnectionDuration(minutes) {
  if (minutes === null || minutes === undefined) return true; // optional
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return false;
  if (minutes < 0) return false;
  if (minutes > 24 * 60) return false; // max 24 hours
  return true;
}

/* ── Leg validation ── */

function validateLeg(leg, legName, issues, warnings) {
  if (leg === null || leg === undefined) {
    issues.push(`${legName} is missing`);
    return;
  }

  if (typeof leg !== "object" || Array.isArray(leg)) {
    issues.push(`${legName} must be an object`);
    return;
  }

  // Check required fields
  for (const field of REQUIRED_LEG_FIELDS) {
    const value = leg[field];
    if (!isNonEmptyString(value)) {
      issues.push(`${legName}.${field} must be a non-empty string`);
    }
  }

  // Validate date format
  if (leg.date && !isValidDate(leg.date)) {
    issues.push(`${legName}.date must be ISO-8601 format (YYYY-MM-DD)`);
  }

  // Validate time formats
  if (leg.departureTime && !isValidTime(leg.departureTime)) {
    issues.push(`${legName}.departureTime must be 24-hour format (HH:MM)`);
  }
  if (leg.arrivalTime && !isValidTime(leg.arrivalTime)) {
    issues.push(`${legName}.arrivalTime must be 24-hour format (HH:MM)`);
  }

  // Check optional fields (if present, must be non-empty strings)
  for (const field of OPTIONAL_LEG_FIELDS) {
    const value = leg[field];
    if (value !== undefined && value !== null && !isNonEmptyString(value)) {
      warnings.push(`${legName}.${field} must be a non-empty string when present`);
    }
  }
}

/* ── Main validation function ── */

/**
 * Validates an extraction result against the contract requirements.
 * Returns a validation report with issues and warnings.
 *
 * @param {import("./extraction-contract.mjs").ExtractionResult} result
 * @returns {{ valid: boolean, issues: string[], warnings: string[] }}
 */
export function validateExtractionResult(result) {
  const issues = [];
  const warnings = [];

  // Check root object
  if (result === null || result === undefined || typeof result !== "object") {
    return { valid: false, issues: ["result must be an object"], warnings: [] };
  }

  if (Array.isArray(result)) {
    return { valid: false, issues: ["result must not be an array"], warnings: [] };
  }

  // Check extractionStatus
  if (!VALID_EXTRACTION_STATUSES.includes(result.extractionStatus)) {
    issues.push(
      `extractionStatus must be one of: ${VALID_EXTRACTION_STATUSES.join(", ")}`,
    );
  }

  // For disabled status, minimal validation
  if (result.extractionStatus === "disabled") {
    if (result.syntheticDemo !== true) {
      issues.push("syntheticDemo must be true for disabled results");
    }
    return { valid: issues.length === 0, issues, warnings };
  }

  // Check legs (required for success/partial)
  const expectsLegs =
    result.extractionStatus === "success" ||
    result.extractionStatus === "partial";

  if (expectsLegs) {
    validateLeg(result.firstLeg, "firstLeg", issues, warnings);
    validateLeg(result.secondLeg, "secondLeg", issues, warnings);
  }

  // Check connection duration
  if (expectsLegs && result.connectionDurationMinutes !== undefined) {
    if (!isPlausibleConnectionDuration(result.connectionDurationMinutes)) {
      issues.push(
        "connectionDurationMinutes must be a non-negative number ≤ 1440 (24 hours)",
      );
    }
  }

  // Check missingFields
  if (!Array.isArray(result.missingFields)) {
    issues.push("missingFields must be an array");
  } else {
    for (const field of result.missingFields) {
      if (!isNonEmptyString(field)) {
        issues.push("missingFields must contain only non-empty strings");
        break;
      }
    }
  }

  // Check fieldConfidence
  if (result.fieldConfidence !== undefined && result.fieldConfidence !== null) {
    if (typeof result.fieldConfidence !== "object" || Array.isArray(result.fieldConfidence)) {
      issues.push("fieldConfidence must be an object");
    } else {
      // Check overall confidence
      if (result.fieldConfidence.overall !== undefined) {
        const overall = result.fieldConfidence.overall;
        if (!isNonEmptyString(overall)) {
          warnings.push("fieldConfidence.overall should be a non-empty string");
        }
      }
    }
  }

  // Check validationMessages
  if (!Array.isArray(result.validationMessages)) {
    issues.push("validationMessages must be an array");
  } else {
    for (const msg of result.validationMessages) {
      if (!isNonEmptyString(msg)) {
        issues.push("validationMessages must contain only non-empty strings");
        break;
      }
    }
  }

  // Check requiresUserConfirmation
  if (result.requiresUserConfirmation !== true) {
    issues.push("requiresUserConfirmation must be true");
  }

  // Check syntheticDemo
  if (result.syntheticDemo !== true) {
    issues.push("syntheticDemo must be true");
  }

  return { valid: issues.length === 0, issues, warnings };
}

/* ── Export helpers for testing ── */

export const _test = {
  isValidDate,
  isValidTime,
  isPlausibleConnectionDuration,
};
