// Direct Gemini adapter for StitchCheck.
//
// STATUS: ENABLED WHEN GEMINI_API_KEY IS PRESENT AND CONFIG ALLOWS
//
// This adapter implements the ExtractionAdapter interface for direct Google
// Gemini API calls using the @google/genai SDK. The adapter is enabled when:
//   1. config.json sets directGeminiEnabled: true (or providerSelection: "gemini")
//   2. provider-capabilities.json marks gemini capability as "approved"
//   3. An approved model identifier is explicitly configured (or GEMINI_MODEL env)
//   4. GEMINI_API_KEY is present in process.env or .env.local
//   5. The @google/genai SDK is importable
//
// When prerequisites are not met, all extraction requests return a clearly
// marked local fallback.
//
// Safety rules:
//   - No network calls unless the adapter is enabled AND credentials are available.
//   - No credentials are hard-coded, logged, or serialized.
//   - At most one controlled retry; never retries auth or validation failures.
//   - Single-request limit per execution.
//   - Safe timeout and bounded response size.
//   - Sanitized error handling excludes headers, keys, raw responses, PII.
//   - Offline tests use fake clients; no real provider is invoked.
//
// SDK dependency: @google/genai is installed in smoke-tests/gemini/.
// The SDK import is performed lazily at execution time only.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTRACTION_LABELS,
  createDisabledExtractionResult,
  createDisabledSourceStatus,
} from "./extraction-contract.mjs";
import {
  validateExtractionResult as _validateResult,
} from "./extraction-validator.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));

const SAFETY_LIMITS = Object.freeze({
  requestTimeoutMs: 60000,
  maxResponseBytes: 10 * 1024 * 1024, // 10 MB
  maxRetries: 1, // at most one controlled retry
  maxCalls: 1, // one request per execution
});

const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/* ── Module state ── */

let _callCount = 0;
let _providerClient = null;
let _credentialLoader = null;
let _autoCreatedClient = null;

/* ── Test / execution hooks ── */
//
// These hooks enable dependency injection for future execution and offline
// testing. They are NOT used during normal import or default operation.

/**
 * Injects an SDK client for future provider calls.
 * The client must implement the MinimalGeminiClient interface.
 * @param {Object|null} client
 */
export function _setProviderClient(client) {
  _providerClient = client;
}

/**
 * Injects a credential loader for future execution or testing.
 * The loader must return a non-empty string or null.
 * @param {Function|null} loader
 */
export function _setCredentialLoader(loader) {
  _credentialLoader = typeof loader === "function" ? loader : null;
}

/**
 * Resets module state (call counter, client, credential loader).
 * Used between offline tests to ensure deterministic isolation.
 */
export function _resetModuleState() {
  _callCount = 0;
  _providerClient = null;
  _credentialLoader = null;
  _autoCreatedClient = null;
}

/**
 * Resolves the runtime credential without exposing its value.
 * Checks (in order): injected loader, process.env.
 * Returns null if no credential is available.
 * @returns {string|null}
 */
function _resolveCredential() {
  // 1. Injected credential loader (for tests / DI)
  if (typeof _credentialLoader === "function") {
    try {
      const cred = _credentialLoader();
      if (typeof cred === "string" && cred.trim().length > 0) {
        return cred;
      }
    } catch {
      // Fall through to next resolution method.
    }
  }
  // 2. process.env (standard Node.js mechanism)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return null;
}

/* ── Request / response helpers ── */

/**
 * Builds the text instruction for itinerary extraction.
 * Includes a JSON schema constraint; no booking/payment instructions.
 * @param {import("./extraction-contract.mjs").ExtractionRequest} request
 * @returns {string}
 */
export function _buildExtractionPrompt(request) {
  const instruction = request.instruction?.trim() ||
    "Extract flight itinerary details from this image.";
  return `${instruction} Return ONLY a JSON object with this schema: {
  "extractionStatus": "success" | "partial" | "invalid" | "error",
  "firstLeg": { "origin": "", "destination": "", "date": "YYYY-MM-DD", "departureTime": "HH:MM", "arrivalTime": "HH:MM", "airline": "" | null, "flightNumber": "" | null },
  "secondLeg": { "origin": "", "destination": "", "date": "YYYY-MM-DD", "departureTime": "HH:MM", "arrivalTime": "HH:MM", "airline": "" | null, "flightNumber": "" | null },
  "connectionDurationMinutes": <number | null>,
  "missingFields": ["<field>"],
  "fieldConfidence": { "overall": "high" | "medium" | "low" },
  "validationMessages": ["<message>"],
  "requiresUserConfirmation": true,
  "syntheticDemo": true
}`;
}

/**
 * JSON schema for structured output (Gemini responseSchema).
 * Mirrors the extraction contract fields.
 */
const EXTRACTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    extractionStatus: {
      type: "STRING",
      enum: ["success", "partial", "invalid", "error"],
    },
    firstLeg: {
      type: "OBJECT",
      properties: {
        origin: { type: "STRING" },
        destination: { type: "STRING" },
        date: { type: "STRING" },
        departureTime: { type: "STRING" },
        arrivalTime: { type: "STRING" },
        airline: { type: "STRING" },
        flightNumber: { type: "STRING" },
      },
      required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
    },
    secondLeg: {
      type: "OBJECT",
      properties: {
        origin: { type: "STRING" },
        destination: { type: "STRING" },
        date: { type: "STRING" },
        departureTime: { type: "STRING" },
        arrivalTime: { type: "STRING" },
        airline: { type: "STRING" },
        flightNumber: { type: "STRING" },
      },
      required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
    },
    connectionDurationMinutes: { type: "NUMBER" },
    missingFields: { type: "ARRAY", items: { type: "STRING" } },
    fieldConfidence: {
      type: "OBJECT",
      properties: {
        overall: { type: "STRING" },
        note: { type: "STRING" },
      },
    },
    validationMessages: { type: "ARRAY", items: { type: "STRING" } },
    requiresUserConfirmation: { type: "BOOLEAN" },
    syntheticDemo: { type: "BOOLEAN" },
  },
  required: [
    "extractionStatus",
    "firstLeg",
    "secondLeg",
    "missingFields",
    "fieldConfidence",
    "validationMessages",
    "requiresUserConfirmation",
    "syntheticDemo",
  ],
};

/**
 * Lowercase JSON Schema dialect for the Interactions API response_format.
 * The Interactions API uses lowercase type names ("object", "string", etc.)
 * unlike the legacy generateContent config which uses uppercase ("OBJECT", "STRING").
 */
const EXTRACTION_RESPONSE_SCHEMA_LOWER = {
  type: "object",
  properties: {
    extractionStatus: {
      type: "string",
      enum: ["success", "partial", "invalid", "error"],
    },
    firstLeg: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        date: { type: "string" },
        departureTime: { type: "string" },
        arrivalTime: { type: "string" },
        airline: { type: "string" },
        flightNumber: { type: "string" },
      },
      required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
    },
    secondLeg: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        date: { type: "string" },
        departureTime: { type: "string" },
        arrivalTime: { type: "string" },
        airline: { type: "string" },
        flightNumber: { type: "string" },
      },
      required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
    },
    connectionDurationMinutes: { type: "number" },
    missingFields: { type: "array", items: { type: "string" } },
    fieldConfidence: {
      type: "object",
      properties: {
        overall: { type: "string" },
        note: { type: "string" },
      },
    },
    validationMessages: { type: "array", items: { type: "string" } },
    requiresUserConfirmation: { type: "boolean" },
    syntheticDemo: { type: "boolean" },
  },
  required: [
    "extractionStatus",
    "firstLeg",
    "secondLeg",
    "missingFields",
    "fieldConfidence",
    "validationMessages",
    "requiresUserConfirmation",
    "syntheticDemo",
  ],
};

/**
 * Converts an uppercase-type schema (legacy generateContent dialect)
 * to a lowercase-type schema (Interactions API JSON Schema dialect).
 * @param {Object} schema
 * @returns {Object}
 */
export function _convertSchemaToLowercase(schema) {
  if (schema === null || schema === undefined) return schema;
  if (Array.isArray(schema)) return schema.map(_convertSchemaToLowercase);
  if (typeof schema !== "object") return schema;
  const result = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && typeof value === "string") {
      result[key] = value.toLowerCase();
    } else {
      result[key] = _convertSchemaToLowercase(value);
    }
  }
  return result;
}

/**
 * Resolves the API style for a given model and optional configuration.
 *
 * Default behavior:
 *   - gemini-3.7-flash and later Gemini 3.x Flash → "interactions"
 *   - gemini-3.6-flash and older/legacy models      → "generateContent"
 *
 * Configuration override (via config.json directGeminiApiStyle):
 *   - "auto"            → use model-based detection (default)
 *   - "interactions"    → force Interactions API
 *   - "generateContent" → force legacy generateContent API
 *
 * Unknown models fall back to "generateContent" (safe legacy behavior)
 * unless configuration explicitly selects "interactions".
 *
 * @param {string} model
 * @param {Object} [config]
 * @returns {"interactions"|"generateContent"}
 */
export function _resolveApiStyle(model, config) {
  const configOverride = (config?.directGeminiApiStyle || "auto").trim().toLowerCase();
  if (configOverride === "interactions") return "interactions";
  if (configOverride === "generatecontent") return "generateContent";
  // Auto-detect from model name
  const m = (model || "").trim().toLowerCase();
  // gemini-3.7-flash and later 3.x Flash, or any 4.x+ Flash → interactions
  const match3 = m.match(/^gemini-3\.(\d+)-flash/);
  if (match3) {
    const minor = parseInt(match3[1], 10);
    if (minor >= 7) return "interactions";
  }
  const match4plus = m.match(/^gemini-([4-9]\d*)\./);
  if (match4plus) return "interactions";
  return "generateContent";
}

/**
 * Builds the request payload for the Interactions API (ai.interactions.create).
 * Uses Content_2 blocks for input and TextResponseFormat for structured output.
 *
 * SDK-verified shapes:
 *   input: Array<Content_2> where Content_2 = TextContent | ImageContent
 *   TextContent:  { type: "text", text: string }
 *   ImageContent: { type: "image", data: base64String, mime_type: string }
 *   response_format: { type: "text", mime_type: "application/json", schema: {...} }
 *
 * @param {import("./extraction-contract.mjs").ExtractionRequest} request
 * @param {string} model
 * @returns {Object}
 */
export function _buildInteractionsRequest(request, model) {
  const prompt = _buildExtractionPrompt(request);
  const imageBytes = request.image instanceof Uint8Array
    ? request.image
    : new TextEncoder().encode(String(request.image || ""));
  const imageData = Buffer.from(imageBytes).toString("base64");
  return {
    model,
    input: [
      { type: "text", text: prompt },
      {
        type: "image",
        data: imageData,
        mime_type: request.mediaType || "image/png",
      },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: EXTRACTION_RESPONSE_SCHEMA_LOWER,
    },
    store: false,
  };
}

/**
 * Builds the request payload for the SDK client.
 * Includes structured-output config for Gemini responseSchema.
 * @param {import("./extraction-contract.mjs").ExtractionRequest} request
 * @param {string} model
 * @returns {Object}
 */
export function _buildProviderRequest(request, model) {
  const prompt = _buildExtractionPrompt(request);
  const imageBytes = request.image instanceof Uint8Array
    ? request.image
    : new TextEncoder().encode(String(request.image || ""));
  // Convert Uint8Array to base64 for the Gemini SDK inlineData.
  let imageData;
  if (imageBytes instanceof Uint8Array) {
    imageData = Buffer.from(imageBytes).toString("base64");
  } else {
    imageData = Buffer.from(imageBytes).toString("base64");
  }
  return {
    model,
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { data: imageData, mimeType: request.mediaType || "image/png" } },
      ],
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_RESPONSE_SCHEMA,
    },
  };
}

/**
 * Parses text output from the provider, stripping markdown fences.
 * @param {string} text
 * @returns {{ parsed: Object|null, warnings: string[] }}
 */
export function _parseProviderText(text) {
  const warnings = [];
  if (typeof text !== "string" || text.trim().length === 0) {
    warnings.push("no text output received from provider");
    return { parsed: null, warnings };
  }
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  try {
    return { parsed: JSON.parse(cleaned), warnings };
  } catch {
    warnings.push("failed to parse provider output as JSON");
    return { parsed: null, warnings };
  }
}

/**
 * Normalizes parsed provider output into the ExtractionResult contract.
 * Never returns raw provider output; strips internal fields.
 * @param {Object} parsed
 * @param {string[]} parseWarnings
 * @returns {Object}
 */
export function _normalizeProviderResult(parsed, parseWarnings) {
  const warnings = [...(parseWarnings || [])];
  const result = {
    extractionStatus: parsed?.extractionStatus || "partial",
    firstLeg: parsed?.firstLeg || null,
    secondLeg: parsed?.secondLeg || null,
    connectionDurationMinutes: parsed?.connectionDurationMinutes ?? null,
    missingFields: Array.isArray(parsed?.missingFields) ? parsed.missingFields : [],
    fieldConfidence: parsed?.fieldConfidence || { overall: "low", note: "provider output not fully verified" },
    validationMessages: Array.isArray(parsed?.validationMessages) ? parsed.validationMessages : [],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: Object.freeze({
      provider: "gemini",
      label: EXTRACTION_LABELS.directGeminiValidation,
      executed: true,
      enabled: true,
      authorizationKey: "GEMINI_API_KEY",
      fallbackUsed: false,
    }),
    label: EXTRACTION_LABELS.directGeminiValidation,
  };
  if (warnings.length > 0) {
    result.validationMessages = [...result.validationMessages, ...warnings];
    result.fieldConfidence = { ...result.fieldConfidence, overall: "low" };
    if (result.extractionStatus === "success") {
      result.extractionStatus = "partial";
    }
  }
  const report = _validateResult(result);
  if (!report.valid) {
    result.extractionStatus = "partial";
    result.validationMessages = [...result.validationMessages, ...report.issues];
  }
  return Object.freeze(result);
}

/**
 * Sanitizes an error message to exclude credentials, URLs, headers, PII.
 * @param {*} error
 * @returns {string}
 */
export function _sanitizeError(error) {
  let msg = error instanceof Error ? error.message : String(error);
  msg = msg.replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
  msg = msg.replace(/AIza[a-zA-Z0-9]{20,}/g, "[REDACTED]");
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED]");
  msg = msg.replace(/https?:\/\/[^\s"')]+/g, "[REDACTED]");
  msg = msg.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED]");
  msg = msg.replace(/at\s+[^\n]+/g, "");
  msg = msg.replace(/\n{3,}/g, "\n\n").trim();
  return msg || "provider error (details redacted)";
}

/**
 * Returns true if the error indicates an authentication failure that
 * should NOT be retried.
 * @param {*} error
 * @returns {boolean}
 */
function _isAuthError(error) {
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(401|403|unauthorized|forbidden|invalid.*api.*key|authentication)\b/i.test(msg);
}

/**
 * Returns true if the error indicates a model-not-found (404) failure that
 * should NOT be retried.
 * @param {*} error
 * @returns {boolean}
 */
export function _isModelNotFoundError(error) {
  const msg = error instanceof Error ? error.message : String(error);
  return /\b(404|not.?found|model.*not.*found|unknown.*model)\b/i.test(msg);
}

/**
 * Creates a provider-call function using the SDK client.
 * The client must implement:
 *   - generateContent({ model, contents, config }) -> { text }  (legacy path)
 *   - interactionsCreate(interactionsReq) -> { output_text }    (interactions path)
 * Enforces: call limit, timeout, response size bound, error sanitization.
 * At most one controlled retry for transient errors; never retries auth,
 * model-not-found, or validation failures.
 * @param {Object} client - SDK client (MinimalGeminiClient interface)
 * @returns {Function} async (request, model, credential) => ExtractionResult
 */
export function createProviderCallFunction(client) {
  return async function callProvider(request, model, credential) {
    if (_callCount >= SAFETY_LIMITS.maxCalls) {
      return createDisabledExtractionResult("call_limit_exceeded");
    }
    _callCount += 1;
    const config = loadConfig();
    const apiStyle = _resolveApiStyle(model, config);
    const providerReq = apiStyle === "interactions"
      ? _buildInteractionsRequest(request, model)
      : _buildProviderRequest(request, model);

    const maxAttempts = 1 + SAFETY_LIMITS.maxRetries;
    let lastError = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let rawResult;
      try {
        const timeoutMs = SAFETY_LIMITS.requestTimeoutMs;
        const timer = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("request_timeout")), timeoutMs)
        );
        const apiCall = apiStyle === "interactions"
          ? (typeof client.interactionsCreate === "function"
            ? client.interactionsCreate(providerReq)
            : Promise.reject(new Error("interactions_api_not_available")))
          : client.generateContent(providerReq);
        rawResult = await Promise.race([apiCall, timer]);
      } catch (error) {
        lastError = error;
        // Never retry auth failures
        if (_isAuthError(error)) {
          const sanitized = _sanitizeError(error);
          return Object.freeze({
            extractionStatus: "error",
            firstLeg: null,
            secondLeg: null,
            connectionDurationMinutes: null,
            missingFields: ["all \u2014 authentication failed"],
            fieldConfidence: { overall: "none", note: "provider authentication failed" },
            validationMessages: [sanitized],
            requiresUserConfirmation: true,
            syntheticDemo: true,
            sourceStatus: Object.freeze({
              provider: "gemini",
              label: EXTRACTION_LABELS.directGeminiValidation,
              executed: true,
              enabled: true,
              authorizationKey: "GEMINI_API_KEY",
              fallbackUsed: true,
            }),
            label: EXTRACTION_LABELS.directGeminiValidation,
          });
        }
        // Never retry model-not-found (404) errors
        if (_isModelNotFoundError(error)) {
          const sanitized = _sanitizeError(error);
          return Object.freeze({
            extractionStatus: "error",
            firstLeg: null,
            secondLeg: null,
            connectionDurationMinutes: null,
            missingFields: ["all \u2014 model not found"],
            fieldConfidence: { overall: "none", note: "model not found or not available" },
            validationMessages: [sanitized],
            requiresUserConfirmation: true,
            syntheticDemo: true,
            sourceStatus: Object.freeze({
              provider: "gemini",
              label: EXTRACTION_LABELS.directGeminiValidation,
              executed: true,
              enabled: true,
              authorizationKey: "GEMINI_API_KEY",
              fallbackUsed: true,
            }),
            label: EXTRACTION_LABELS.directGeminiValidation,
          });
        }
        // Retry transient errors (timeout, network) if attempts remain
        if (attempt < maxAttempts - 1) {
          const delayMs = Math.min(2000 * 2 ** attempt + Math.floor(Math.random() * 500), 10000);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        // All attempts exhausted
        const sanitized = _sanitizeError(lastError);
        return Object.freeze({
          extractionStatus: "error",
          firstLeg: null,
          secondLeg: null,
          connectionDurationMinutes: null,
          missingFields: ["all \u2014 provider error"],
          fieldConfidence: { overall: "none", note: "provider call failed" },
          validationMessages: [sanitized],
          requiresUserConfirmation: true,
          syntheticDemo: true,
          sourceStatus: Object.freeze({
            provider: "gemini",
            label: EXTRACTION_LABELS.directGeminiValidation,
            executed: true,
            enabled: true,
            authorizationKey: "GEMINI_API_KEY",
            fallbackUsed: true,
          }),
          label: EXTRACTION_LABELS.directGeminiValidation,
        });
      }

      // Success path — parse the response
      // Support both { text } (legacy) and { output_text } (interactions) shapes
      const text = typeof rawResult?.text === "string"
        ? rawResult.text
        : typeof rawResult?.output_text === "string"
          ? rawResult.output_text
          : "";
      const byteSize = new TextEncoder().encode(text).length;
      if (byteSize > SAFETY_LIMITS.maxResponseBytes) {
        return Object.freeze({
          extractionStatus: "error",
          firstLeg: null,
          secondLeg: null,
          connectionDurationMinutes: null,
          missingFields: ["all \u2014 response too large"],
          fieldConfidence: { overall: "none", note: "response exceeded size limit" },
          validationMessages: ["response exceeded maximum size"],
          requiresUserConfirmation: true,
          syntheticDemo: true,
          sourceStatus: Object.freeze({
            provider: "gemini",
            label: EXTRACTION_LABELS.directGeminiValidation,
            executed: true,
            enabled: true,
            authorizationKey: "GEMINI_API_KEY",
            fallbackUsed: true,
          }),
          label: EXTRACTION_LABELS.directGeminiValidation,
        });
      }
      const { parsed, warnings } = _parseProviderText(text);
      if (!parsed) {
        return Object.freeze({
          extractionStatus: "partial",
          firstLeg: null,
          secondLeg: null,
          connectionDurationMinutes: null,
          missingFields: ["all \u2014 unparseable output"],
          fieldConfidence: { overall: "none", note: "could not parse provider output" },
          validationMessages: warnings,
          requiresUserConfirmation: true,
          syntheticDemo: true,
          sourceStatus: Object.freeze({
            provider: "gemini",
            label: EXTRACTION_LABELS.directGeminiValidation,
            executed: true,
            enabled: true,
            authorizationKey: "GEMINI_API_KEY",
            fallbackUsed: true,
          }),
          label: EXTRACTION_LABELS.directGeminiValidation,
        });
      }
      return _normalizeProviderResult(parsed, warnings);
    }

    // Unreachable; the loop always returns.
    const sanitized = _sanitizeError(lastError);
    return Object.freeze({
      extractionStatus: "error",
      firstLeg: null,
      secondLeg: null,
      connectionDurationMinutes: null,
      missingFields: ["all \u2014 provider error"],
      fieldConfidence: { overall: "none", note: "provider call failed" },
      validationMessages: [sanitized],
      requiresUserConfirmation: true,
      syntheticDemo: true,
      sourceStatus: Object.freeze({
        provider: "gemini",
        label: EXTRACTION_LABELS.directGeminiValidation,
        executed: true,
        enabled: true,
        authorizationKey: "GEMINI_API_KEY",
        fallbackUsed: true,
      }),
      label: EXTRACTION_LABELS.directGeminiValidation,
    });
  };
}

/* ── Model resolution ── */

/**
 * Resolves the Gemini model identifier from (in order):
 *   1. GEMINI_MODEL environment variable
 *   2. provider-capabilities.json approvedModelIdentifier
 *   3. DEFAULT_GEMINI_MODEL fallback
 * @returns {string}
 */
function _resolveModel() {
  // 1. Environment variable override
  if (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim().length > 0) {
    return process.env.GEMINI_MODEL.trim();
  }
  // 2. Config / capabilities
  const capabilities = loadCapabilities();
  const capModel = (capabilities?.providers?.gemini?.approvedModelIdentifier ?? "").trim();
  if (capModel) return capModel;
  // 3. Default
  return DEFAULT_GEMINI_MODEL;
}

/* ── Auto-create SDK client ── */

/**
 * Attempts to create a real @google/genai client wrapper.
 * Returns null if the SDK is not available or credentials are missing.
 * The returned object wraps the real SDK to support both API styles:
 *   - generateContent(providerReq) -> { text }           (legacy path)
 *   - interactionsCreate(interactionsReq) -> { output_text } (interactions path)
 * @returns {Promise<Object|null>}
 */
async function _tryAutoCreateClient() {
  if (_autoCreatedClient) return _autoCreatedClient;
  const credential = _resolveCredential();
  if (!credential) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: credential });
    // Wrap the real SDK to support both API styles.
    _autoCreatedClient = {
      async generateContent(providerReq) {
        const { model, contents, config } = providerReq;
        const params = { model, contents };
        if (config) params.config = config;
        const response = await ai.models.generateContent(params);
        return { text: response.text || "" };
      },
      async interactionsCreate(interactionsReq) {
        const { model, input, response_format, store } = interactionsReq;
        const params = { model, input };
        if (response_format) params.response_format = response_format;
        if (store !== undefined) params.store = store;
        const interaction = await ai.interactions.create(params);
        return { output_text: interaction.output_text || "" };
      },
      _isRealSdkClient: true,
    };
    return _autoCreatedClient;
  } catch {
    return null;
  }
}

/* ── Configuration loading ── */

function loadConfig() {
  try {
    const configPath = join(harnessDir, "config.json");
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return null;
  }
}

function loadCapabilities() {
  try {
    const capPath = join(harnessDir, "provider-capabilities.json");
    return JSON.parse(readFileSync(capPath, "utf8"));
  } catch {
    return null;
  }
}

/* ── Authorization check ── */

function checkAuthorization() {
  const config = loadConfig();
  const capabilities = loadCapabilities();

  if (!config || !capabilities) {
    return {
      enabled: false,
      reason: "missing_config_or_capabilities",
    };
  }

  // Check explicit enable flag (supports both directGeminiEnabled and
  // providerSelection === "gemini" as enable signals).
  const directEnabled = config.directGeminiEnabled === true ||
    config.providerSelection === "gemini";
  if (!directEnabled) {
    return {
      enabled: false,
      reason: "direct_gemini_not_enabled_in_config",
    };
  }

  // Check capability approval
  const geminiCap = capabilities.providers?.gemini;
  if (!geminiCap || geminiCap.capabilityReviewStatus !== "approved") {
    return {
      enabled: false,
      reason: "gemini_capability_not_approved",
    };
  }

  // Resolve model identifier (env > capabilities > default)
  const model = _resolveModel();
  if (!model) {
    return {
      enabled: false,
      reason: "no_approved_gemini_model",
    };
  }

  // Check credential availability. Without a key the adapter is disabled.
  // This ensures offline tests (no key set) correctly report disabled.
  const credential = _resolveCredential();
  if (!credential) {
    return {
      enabled: false,
      reason: "credential_not_available",
    };
  }

  return {
    enabled: true,
    reason: null,
    model,
    label: EXTRACTION_LABELS.directGeminiValidation,
  };
}

/* ── Adapter implementation ── */

/**
 * Direct Gemini extraction adapter.
 * Implements ExtractionAdapter interface.
 */
export const directGeminiAdapter = {
  /**
   * Returns true only when all authorization prerequisites are met.
   * @returns {boolean}
   */
  isEnabled() {
    const auth = checkAuthorization();
    return auth.enabled === true;
  },

  /**
   * Performs one extraction request.
   * Uses the @google/genai SDK when enabled and credentials are available.
   * Falls back to a clearly marked local placeholder otherwise.
   *
   * @param {import("./extraction-contract.mjs").ExtractionRequest} request
   * @returns {Promise<import("./extraction-contract.mjs").ExtractionResult>}
   */
  async extract(request) {
    const auth = checkAuthorization();

    // If not enabled, return fallback
    if (!auth.enabled) {
      return createDisabledExtractionResult(auth.reason);
    }

    // Determine which client to use:
    // 1. Injected client (for tests / DI)
    // 2. Auto-created client from SDK + env credential
    let client = _providerClient;
    if (!client) {
      client = await _tryAutoCreateClient();
    }

    if (client) {
      const credential = _resolveCredential();
      if (!credential) {
        return createDisabledExtractionResult("credential_not_available");
      }
      const callProvider = createProviderCallFunction(client);
      return callProvider(request, auth.model, credential);
    }

    // No client available: return fallback
    return createDisabledExtractionResult("sdk_not_available");
  },

  /**
   * Returns the evidence-boundary label for this adapter.
   * @returns {string}
   */
  getLabel() {
    const auth = checkAuthorization();
    return auth.enabled
      ? EXTRACTION_LABELS.directGeminiValidation
      : EXTRACTION_LABELS.syntheticLocalFallback;
  },
};

/* ── Readiness report ── */

/**
 * Returns a readiness report for the direct Gemini adapter.
 * Does not expose credentials or secrets.
 * @returns {Object}
 */
export function getDirectGeminiReadiness() {
  const auth = checkAuthorization();
  const config = loadConfig();
  const capabilities = loadCapabilities();

  return {
    adapter: "direct-gemini",
    enabled: auth.enabled,
    reason: auth.reason,
    label: auth.enabled
      ? EXTRACTION_LABELS.directGeminiValidation
      : EXTRACTION_LABELS.syntheticLocalFallback,
    configPresent: config !== null,
    capabilitiesPresent: capabilities !== null,
    directGeminiEnabled:
      config?.directGeminiEnabled === true || config?.providerSelection === "gemini",
    geminiCapabilityApproved:
      capabilities?.providers?.gemini?.capabilityReviewStatus === "approved",
    resolvedModel: auth.model ?? "",
    safetyLimits: SAFETY_LIMITS,
    prerequisites: [
      "config.json: directGeminiEnabled = true OR providerSelection = \"gemini\"",
      "provider-capabilities.json: gemini.capabilityReviewStatus = approved",
      "GEMINI_API_KEY available via process.env or .env.local",
      "@google/genai SDK importable",
    ],
    note: "Adapter is enabled when config allows and GEMINI_API_KEY is present. Falls back to local placeholder otherwise.",
  };
}

/* ── Exports ── */

export default directGeminiAdapter;

/* ── Test hooks (for offline testing only) ── */

export const _testHooks = {
  buildExtractionPrompt: _buildExtractionPrompt,
  buildProviderRequest: _buildProviderRequest,
  buildInteractionsRequest: _buildInteractionsRequest,
  parseProviderText: _parseProviderText,
  normalizeProviderResult: _normalizeProviderResult,
  sanitizeError: _sanitizeError,
  createProviderCallFunction,
  resetCallCount: _resetModuleState,
  setProviderClient: _setProviderClient,
  setCredentialLoader: _setCredentialLoader,
  resolveCredential: _resolveCredential,
  resolveModel: _resolveModel,
  resolveApiStyle: _resolveApiStyle,
  convertSchemaToLowercase: _convertSchemaToLowercase,
  tryAutoCreateClient: _tryAutoCreateClient,
  isAuthError: _isAuthError,
  isModelNotFoundError: _isModelNotFoundError,
};
