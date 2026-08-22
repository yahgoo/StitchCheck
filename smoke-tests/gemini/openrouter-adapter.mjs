// OpenRouter request adapter for the temporary extraction path.
// Label: OpenRouter temporary path — not direct Gemini validation.
//
// This module is loaded only behind the harness's explicit execution flag and
// is never invoked during offline preparation tasks. Importing it performs no
// request. Safety rules:
//   - The key is read only from the ignored local env file and is never
//     printed, logged, or serialized.
//   - The model is pinned; generic router identifiers are rejected.
//   - No silent model or provider fallback: provider routing requires the
//     structured-output parameters and disables fallbacks. If routing cannot
//     be pinned, the case fails safely with a documented blocker.
//   - Rate-limit policy: one initial attempt per case, at most two retries,
//     Retry-After honored when supplied, otherwise bounded exponential
//     backoff with jitter; sequential execution only; no model/provider
//     switching after a failure.

import { readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadJson, readLocalEnvValue } from "./providers.mjs";
import { validateExtractionResult } from "./schema-validator.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(harnessDir, "fixtures");

const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const PINNED_MODEL = "google/gemini-3.7-flash";
const REQUEST_TIMEOUT_MS = 60000;
const MAX_RETRIES_AFTER_INITIAL = 2;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_CAP_MS = 30000;

const REJECTED_GENERIC_IDENTIFIERS = [
  "latest",
  "auto",
  "free",
  "openrouter/auto",
];

const MEDIA_TYPES = Object.freeze({
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
});

const EXTRACTION_INSTRUCTION = [
  "Extract the flight itinerary from this synthetic screenshot into JSON",
  "matching the provided schema. Fill every field you can read exactly.",
  "List every missing or unreadable field in missingFields. Never invent",
  "values. Set requiresUserConfirmation to true and syntheticDemo to true.",
].join(" ");

function legSchema() {
  return {
    type: "object",
    properties: {
      origin: { type: "string" },
      destination: { type: "string" },
      date: { type: "string" },
      departureTime: { type: "string" },
      arrivalTime: { type: "string" },
      airline: { type: ["string", "null"] },
      flightNumber: { type: ["string", "null"] },
    },
    required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
  };
}

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    extractionStatus: {
      type: "string",
      enum: ["success", "partial", "invalid", "error"],
    },
    firstLeg: legSchema(),
    secondLeg: legSchema(),
    connectionDurationMinutes: { type: ["number", "null"] },
    missingFields: { type: "array", items: { type: "string" } },
    fieldConfidence: { type: "object" },
    validationMessages: { type: "array", items: { type: "string" } },
    requiresUserConfirmation: { type: "boolean" },
    syntheticDemo: { type: "boolean" },
  },
  required: [
    "extractionStatus",
    "missingFields",
    "validationMessages",
    "requiresUserConfirmation",
    "syntheticDemo",
  ],
};

// Rejects blank, generic, and unapproved identifiers. Exported for offline
// validation; performs no request.
export function validateModelIdentifier(identifier, capabilities) {
  const value = (identifier ?? "").trim();
  if (!value) {
    return { ok: false, reason: "blank_model_identifier" };
  }
  const lowered = value.toLowerCase();
  if (
    REJECTED_GENERIC_IDENTIFIERS.some(
      (generic) => lowered === generic || lowered.endsWith(`:${generic}`),
    )
  ) {
    return { ok: false, reason: "generic_or_router_identifier_rejected" };
  }
  const entry = capabilities.providers.openrouter;
  if (entry.capabilityReviewStatus !== "approved") {
    return { ok: false, reason: "capability_not_approved" };
  }
  if (entry.approvedModelIdentifier !== value) {
    return { ok: false, reason: "model_identifier_not_approved" };
  }
  return { ok: true, reason: null };
}

// Loads a fixture only from the local fixtures directory.
function loadFixture(fixtureFile) {
  const fullPath = resolve(fixturesDir, fixtureFile);
  if (!fullPath.startsWith(fixturesDir)) {
    throw new Error("fixture_outside_allowed_directory");
  }
  const mediaType = MEDIA_TYPES[extname(fullPath).toLowerCase()];
  if (!mediaType) {
    throw new Error("unsupported_fixture_type");
  }
  const bytes = readFileSync(fullPath);
  return {
    mediaType,
    dataUrl: `data:${mediaType};base64,${bytes.toString("base64")}`,
  };
}

function buildRequestBody(fixture) {
  return {
    model: PINNED_MODEL,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_INSTRUCTION },
          { type: "image_url", image_url: { url: fixture.dataUrl } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stitchcheck_extraction",
        schema: EXTRACTION_JSON_SCHEMA,
      },
    },
    // Pin routing: no silent fallback; providers must support the required
    // structured-output parameters or the request must fail.
    provider: {
      require_parameters: true,
      allow_fallbacks: false,
    },
  };
}

function parseStructuredContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error("malformed_structured_output");
  }
  if (typeof content === "object") {
    return content;
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("malformed_structured_output");
  }
}

// Redacted summary only: status, missing fields, and field counts.
function summarizeRedacted(parsed) {
  const legFields = (leg) =>
    leg && typeof leg === "object" ? Object.keys(leg).length : 0;
  return {
    extractionStatus: parsed.extractionStatus,
    missingFields: parsed.missingFields,
    firstLegFieldCount: legFields(parsed.firstLeg),
    secondLegFieldCount: legFields(parsed.secondLeg),
    requiresUserConfirmation: parsed.requiresUserConfirmation,
    note: "raw response redacted",
  };
}

function sleep(ms) {
  return new Promise((resolveTimer) => setTimeout(resolveTimer, ms));
}

async function computeDelayMs(response, attempt) {
  const retryAfter = response?.headers?.get?.("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, BACKOFF_CAP_MS);
    }
  }
  const exponential = BACKOFF_BASE_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(exponential + jitter, BACKOFF_CAP_MS);
}

function baseRecord({ testId, fixtureId }, runAt) {
  return {
    provider: "openrouter",
    providerMode: "temporary",
    modelIdentifier: PINNED_MODEL,
    testId,
    fixtureId,
    timestamp: runAt,
    latencyMs: 0,
    outcome: null,
    missingFields: [],
    validationOutcome: null,
    errorClass: null,
    retryCount: 0,
    retryDelayMs: 0,
    confirmationGateStatus: "not_reached",
    redactedResponseSummary: null,
    attempts: 0,
    endedAt: null,
    validationMessages: [],
    fixtureSyntheticNonPii: null,
    networkDestinationCategory: "OpenRouter chat completions (temporary path)",
  };
}

function finish(record, startedAt, attempts) {
  record.attempts = attempts;
  record.endedAt = new Date().toISOString();
  record.latencyMs = Date.now() - startedAt;
  return record;
}

// Runs one GEM case end to end. Sequential only; never switches model or
// provider after a failure. Never logs the key, headers, or raw response.
export async function runExtractionCase(planItem) {
  const startedAt = Date.now();
  const record = baseRecord(planItem, new Date().toISOString());

  const capabilities = loadJson("provider-capabilities.json");
  const config = loadJson("config.json");
  const manifest = loadJson(join("fixtures", "manifest.json"));
  record.fixtureSyntheticNonPii = manifest.syntheticOnly === true;

  const modelCheck = validateModelIdentifier(PINNED_MODEL, capabilities);
  if (!modelCheck.ok) {
    record.outcome = "not_executed";
    record.errorClass = modelCheck.reason;
    return finish(record, startedAt, 0);
  }
  if (config.pinnedModelIdentifier !== PINNED_MODEL) {
    record.outcome = "not_executed";
    record.errorClass = "model_pin_mismatch";
    return finish(record, startedAt, 0);
  }
  if (config.allowModelFallback || config.allowProviderFallback) {
    record.outcome = "not_executed";
    record.errorClass = "fallback_not_prohibited";
    return finish(record, startedAt, 0);
  }

  const key = readLocalEnvValue("OPENROUTER_API_KEY");
  if (!key) {
    record.outcome = "not_executed";
    record.errorClass = "missing_api_key";
    return finish(record, startedAt, 0);
  }

  let fixture;
  try {
    fixture = loadFixture(planItem.fixtureFile);
  } catch (error) {
    record.outcome = "error";
    record.errorClass = error.message || "fixture_load_failed";
    return finish(record, startedAt, 0);
  }

  let attempt = 0;
  let totalDelayMs = 0;
  while (attempt <= MAX_RETRIES_AFTER_INITIAL) {
    record.attempts = attempt + 1;
    let response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(fixture)),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch (error) {
      const errorClass =
        error?.name === "AbortError" ? "timeout" : "network_error";
      if (attempt < MAX_RETRIES_AFTER_INITIAL) {
        const delayMs = Math.min(
          BACKOFF_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 500),
          BACKOFF_CAP_MS,
        );
        totalDelayMs += delayMs;
        record.retryCount += 1;
        record.retryDelayMs = totalDelayMs;
        await sleep(delayMs);
        attempt += 1;
        continue;
      }
      record.outcome = "error";
      record.errorClass = errorClass;
      return finish(record, startedAt, attempt + 1);
    }

    if (response.status === 429 || response.status >= 500) {
      const errorClass = response.status === 429 ? "rate_limited" : "service_error";
      if (attempt < MAX_RETRIES_AFTER_INITIAL) {
        const delayMs = await computeDelayMs(response, attempt);
        totalDelayMs += delayMs;
        record.retryCount += 1;
        record.retryDelayMs = totalDelayMs;
        await sleep(delayMs);
        attempt += 1;
        continue;
      }
      record.outcome = "error";
      record.errorClass = errorClass;
      record.redactedResponseSummary = `HTTP ${response.status} after ${attempt + 1} attempt(s); body redacted`;
      return finish(record, startedAt, attempt + 1);
    }

    if (!response.ok) {
      record.outcome = "error";
      record.errorClass = "api_error";
      record.redactedResponseSummary = `HTTP ${response.status}; body redacted`;
      return finish(record, startedAt, attempt + 1);
    }

    let parsed;
    try {
      const payload = await response.json();
      parsed = parseStructuredContent(payload);
    } catch {
      record.outcome = "error";
      record.errorClass = "malformed_structured_output";
      record.validationOutcome = "invalid";
      return finish(record, startedAt, attempt + 1);
    }

    const validation = validateExtractionResult(parsed);
    record.validationOutcome = validation.valid ? "valid" : "invalid";
    if (!validation.valid) {
      record.outcome = "error";
      record.errorClass = "malformed_structured_output";
      record.redactedResponseSummary = `schema validation failed with ${validation.issues.length} issue(s)`;
      return finish(record, startedAt, attempt + 1);
    }

    record.outcome = parsed.extractionStatus;
    record.missingFields = parsed.missingFields;
    record.validationMessages = parsed.validationMessages ?? [];
    record.confirmationGateStatus = "pending_user_review";
    record.redactedResponseSummary = summarizeRedacted(parsed);
    return finish(record, startedAt, attempt + 1);
  }

  // Unreachable; the loop always returns.
  record.outcome = "error";
  record.errorClass = "unexpected_control_flow";
  return finish(record, startedAt, record.attempts);
}
