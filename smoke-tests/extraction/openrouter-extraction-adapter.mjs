// OpenRouter itinerary extraction adapter for StitchCheck.
//
// Routes multimodal extraction through OpenRouter using minimax/minimax-m3:free.
// Enabled when OPENROUTER_API_KEY is present and config/capabilities allow.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTRACTION_LABELS,
  createDisabledExtractionResult,
} from "./extraction-contract.mjs";
import {
  validateExtractionResult as _validateResult,
} from "./extraction-validator.mjs";

const harnessDir = dirname(fileURLToPath(import.meta.url));

const SAFETY_LIMITS = Object.freeze({
  requestTimeoutMs: 90000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetries: 0,
  maxCalls: 1,
});

const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const PINNED_MODEL = "minimax/minimax-m3:free";
const CREDENTIAL_ENV_KEY = "OPENROUTER_API_KEY";

let _callCount = 0;
let _providerClient = null;
let _credentialLoader = null;
let _autoCreatedClient = null;

/** Per-request budget: the Vite proxy resets this at the start of each HTTP extract. */
export function _resetCallCount() {
  const previous = _callCount;
  _callCount = 0;
  return previous;
}

export function _getCallCount() {
  return _callCount;
}

export function _setProviderClient(client) {
  _providerClient = client;
}

export function _setCredentialLoader(loader) {
  _credentialLoader = typeof loader === "function" ? loader : null;
}

export function _resetModuleState() {
  _callCount = 0;
  _providerClient = null;
  _credentialLoader = null;
  _autoCreatedClient = null;
}

function _resolveCredential() {
  if (typeof _credentialLoader === "function") {
    try {
      const cred = _credentialLoader();
      if (typeof cred === "string" && cred.trim().length > 0) {
        return cred.trim();
      }
    } catch {
      // fall through
    }
  }
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return process.env.OPENROUTER_API_KEY.trim();
  }
  return null;
}

function loadConfig() {
  try {
    return JSON.parse(readFileSync(join(harnessDir, "config.json"), "utf8"));
  } catch {
    return null;
  }
}

function loadCapabilities() {
  try {
    return JSON.parse(readFileSync(join(harnessDir, "provider-capabilities.json"), "utf8"));
  } catch {
    return null;
  }
}

function _resolveModel() {
  const envModel = process.env.EXTRACTION_MODEL?.trim();
  if (envModel) return envModel;
  const config = loadConfig();
  const pinned = config?.pinnedModelIdentifier?.trim();
  if (pinned) return pinned;
  const caps = loadCapabilities();
  const approved = caps?.providers?.openrouter?.approvedModelIdentifiers;
  if (Array.isArray(approved) && approved.length > 0) {
    return approved[0];
  }
  const legacy = caps?.providers?.openrouter?.approvedModelIdentifier?.trim();
  if (legacy) return legacy;
  return PINNED_MODEL;
}

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

const EXTRACTION_JSON_SCHEMA = {
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
        airline: { type: ["string", "null"] },
        flightNumber: { type: ["string", "null"] },
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
        airline: { type: ["string", "null"] },
        flightNumber: { type: ["string", "null"] },
      },
      required: ["origin", "destination", "date", "departureTime", "arrivalTime"],
    },
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

export function _buildOpenRouterRequest(request, model) {
  const prompt = _buildExtractionPrompt(request);
  const imageBytes = request.image instanceof Uint8Array
    ? request.image
    : new TextEncoder().encode(String(request.image || ""));
  const dataUrl = `data:${request.mediaType || "image/png"};base64,${Buffer.from(imageBytes).toString("base64")}`;
  return {
    model,
    temperature: 0,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
    response_format: {
      type: "json_object",
    },
  };
}

export function _extractOpenRouterText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (content === undefined || content === null) return "";
  if (typeof content === "object") return JSON.stringify(content);
  return String(content);
}

export function _parseProviderText(text) {
  const warnings = [];
  if (typeof text !== "string" || text.trim().length === 0) {
    warnings.push("no text output received from provider");
    return { parsed: null, warnings, failurePoint: "json-parse" };
  }

  const candidates = [];
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  candidates.push(cleaned);

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace > 0) {
    candidates.push(cleaned.slice(firstBrace));
  }

  for (const candidate of candidates) {
    const extracted = _extractBalancedJsonObject(candidate);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted);
        if (extracted !== cleaned) {
          warnings.push("extracted JSON object from surrounding text");
        }
        return { parsed, warnings, failurePoint: null };
      } catch {
        // try next candidate
      }
    }
  }

  warnings.push("failed to parse provider output as JSON");
  return { parsed: null, warnings, failurePoint: "json-parse" };
}

function _extractBalancedJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function _asTrimmedString(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Align provider `date` with UI `departureDate`; map `carrier` → `airline`. */
export function _normalizeLegFields(leg) {
  if (!leg || typeof leg !== "object" || Array.isArray(leg)) return leg;
  const date = _asTrimmedString(leg.date) || _asTrimmedString(leg.departureDate);
  const airline = _asTrimmedString(leg.airline) || _asTrimmedString(leg.carrier);
  return {
    ...leg,
    date,
    departureDate: _asTrimmedString(leg.departureDate) || date,
    airline,
    flightNumber: leg.flightNumber == null ? "" : _asTrimmedString(leg.flightNumber),
  };
}

export function _normalizeParsedExtraction(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  return {
    ...parsed,
    firstLeg: _normalizeLegFields(parsed.firstLeg),
    secondLeg: parsed.secondLeg == null ? parsed.secondLeg : _normalizeLegFields(parsed.secondLeg),
  };
}

export function _assessItinerarySchema(parsed) {
  const issues = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { schemaValidated: false, issues: ["parsed payload is not an object"] };
  }
  const leg = parsed.firstLeg;
  if (!leg || typeof leg !== "object") {
    issues.push("firstLeg is missing or not an object");
  } else {
    for (const field of ["origin", "destination", "flightNumber", "departureTime", "arrivalTime"]) {
      const value = leg[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push(`firstLeg.${field} is missing or empty`);
      }
    }
  }
  return { schemaValidated: issues.length === 0, issues };
}

function _schemaFailureResult(parsed, issues, warnings, model) {
  return Object.freeze({
    extractionStatus: "error",
    firstLeg: parsed?.firstLeg ?? null,
    secondLeg: parsed?.secondLeg ?? null,
    connectionDurationMinutes: parsed?.connectionDurationMinutes ?? null,
    missingFields: issues.length > 0 ? issues : ["schema validation failed"],
    fieldConfidence: { overall: "none", note: "itinerary schema validation failed" },
    validationMessages: [...(warnings || []), ...issues],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: Object.freeze({
      provider: "openrouter",
      label: EXTRACTION_LABELS.liveValidation,
      executed: true,
      enabled: true,
      authorizationKey: CREDENTIAL_ENV_KEY,
      fallbackUsed: true,
      transport: "openrouter",
      model,
    }),
    label: EXTRACTION_LABELS.liveValidation,
    _failurePoint: "schema-validation",
  });
}

export function _sanitizeError(error) {
  let msg = error instanceof Error ? error.message : String(error);
  msg = msg.replace(/sk-or-v1-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
  msg = msg.replace(/sk-[a-zA-Z0-9]{10,}/g, "[REDACTED]");
  msg = msg.replace(/AIza[a-zA-Z0-9]{20,}/g, "[REDACTED]");
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "[REDACTED]");
  msg = msg.replace(/https?:\/\/[^\s"')]+/g, "[REDACTED]");
  msg = msg.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED]");
  return msg.trim() || "provider error (details redacted)";
}

export function extractHttpStatus(error) {
  return error?.error?.code ?? error?.status ?? error?.response?.status ?? null;
}

export function _classifyError(error) {
  const status = extractHttpStatus(error);
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status === 500 || status === 503) return "server_error";
  const msg = error instanceof Error ? error.message : String(error);
  if (/\b(401|403|unauthorized|forbidden|invalid.*api.*key)\b/i.test(msg)) return "authentication";
  if (/\b(404|not.?found|model.*not.*found)\b/i.test(msg)) return "model_not_found";
  if (/\b429\b|rate.?limit/i.test(msg)) return "rate_limited";
  if (/timeout/i.test(msg)) return "timeout";
  return "provider_error";
}

export function _buildDiagnostic(error, retryCount) {
  return Object.freeze({
    errorClass: error instanceof Error ? error.constructor.name : "Unknown",
    errorCategory: _classifyError(error),
    errorHttpStatus: extractHttpStatus(error),
    retryCount,
    firstAttemptFailed: true,
  });
}

function _isAuthError(error) {
  return _classifyError(error) === "authentication";
}

export function _isModelNotFoundError(error) {
  return _classifyError(error) === "model_not_found";
}

export function _normalizeProviderResult(parsed, parseWarnings) {
  const warnings = [...(parseWarnings || [])];
  parsed = _normalizeParsedExtraction(parsed);
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
      provider: "openrouter",
      label: EXTRACTION_LABELS.liveValidation,
      executed: true,
      enabled: true,
      authorizationKey: CREDENTIAL_ENV_KEY,
      fallbackUsed: false,
      transport: "openrouter",
      model: _resolveModel(),
    }),
    label: EXTRACTION_LABELS.liveValidation,
  };
  if (warnings.length > 0) {
    result.validationMessages = [...result.validationMessages, ...warnings];
    result.fieldConfidence = { ...result.fieldConfidence, overall: "low" };
    if (result.extractionStatus === "success") {
      result.extractionStatus = "partial";
    }
  }
  const report = _validateResult(result);
  const itinerary = _assessItinerarySchema(parsed);
  if (!report.valid || !itinerary.schemaValidated) {
    result.extractionStatus = "error";
    result.validationMessages = [
      ...result.validationMessages,
      ...report.issues,
      ...itinerary.issues,
    ];
    result.sourceStatus = Object.freeze({
      ...result.sourceStatus,
      fallbackUsed: true,
    });
    result._failurePoint = "schema-validation";
  } else if (result.extractionStatus !== "success" && result.extractionStatus !== "partial") {
    result.extractionStatus = "partial";
  }
  return Object.freeze(result);
}

function _errorResult(error, missingFieldsNote, note) {
  return Object.freeze({
    extractionStatus: "error",
    firstLeg: null,
    secondLeg: null,
    connectionDurationMinutes: null,
    missingFields: [missingFieldsNote],
    fieldConfidence: { overall: "none", note },
    validationMessages: [_sanitizeError(error)],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: Object.freeze({
      provider: "openrouter",
      label: EXTRACTION_LABELS.liveValidation,
      executed: true,
      enabled: true,
      authorizationKey: CREDENTIAL_ENV_KEY,
      fallbackUsed: true,
      transport: "openrouter",
      model: _resolveModel(),
    }),
    label: EXTRACTION_LABELS.liveValidation,
    _diagnostic: _buildDiagnostic(error, 0),
    _failurePoint: "transport",
  });
}

export function createProviderCallFunction(client) {
  return async function callProvider(request, model) {
    if (_callCount >= SAFETY_LIMITS.maxCalls) {
      return createDisabledExtractionResult("call_limit_exceeded");
    }
    _callCount += 1;

    const providerReq = _buildOpenRouterRequest(request, model);
    let rawResult;
    try {
      const timer = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("request_timeout")), SAFETY_LIMITS.requestTimeoutMs)
      );
      rawResult = await Promise.race([client.chatCompletions(providerReq), timer]);
    } catch (error) {
      if (_isAuthError(error)) {
        return _errorResult(error, "all \u2014 authentication failed", "provider authentication failed");
      }
      if (_isModelNotFoundError(error)) {
        return _errorResult(error, "all \u2014 model not found", "model not found or not available");
      }
      if (_classifyError(error) === "rate_limited") {
        return _errorResult(error, "all \u2014 rate limited", "OpenRouter rate limit reached (no retry)");
      }
      return _errorResult(error, "all \u2014 provider error", "provider call failed");
    }

    const text = _extractOpenRouterText(rawResult);
    if (new TextEncoder().encode(text).length > SAFETY_LIMITS.maxResponseBytes) {
      return _errorResult(new Error("response too large"), "all \u2014 response too large", "response exceeded size limit");
    }
    const { parsed, warnings, failurePoint } = _parseProviderText(text);
    const normalized = parsed ? _normalizeParsedExtraction(parsed) : null;
    if (!normalized) {
      return Object.freeze({
        extractionStatus: "error",
        firstLeg: null,
        secondLeg: null,
        connectionDurationMinutes: null,
        missingFields: ["all \u2014 unparseable output"],
        fieldConfidence: { overall: "none", note: "could not parse provider output" },
        validationMessages: warnings,
        requiresUserConfirmation: true,
        syntheticDemo: true,
        sourceStatus: Object.freeze({
          provider: "openrouter",
          label: EXTRACTION_LABELS.liveValidation,
          executed: true,
          enabled: true,
          authorizationKey: CREDENTIAL_ENV_KEY,
          fallbackUsed: true,
          transport: "openrouter",
          model,
        }),
        label: EXTRACTION_LABELS.liveValidation,
        _failurePoint: failurePoint || "json-parse",
      });
    }
    const itinerary = _assessItinerarySchema(normalized);
    if (!itinerary.schemaValidated) {
      return _schemaFailureResult(normalized, itinerary.issues, warnings, model);
    }
    return _normalizeProviderResult(normalized, warnings);
  };
}

async function _tryAutoCreateClient() {
  if (_autoCreatedClient) return _autoCreatedClient;
  const credential = _resolveCredential();
  if (!credential) return null;
  _autoCreatedClient = {
    async chatCompletions(body) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error("request_timeout")),
        SAFETY_LIMITS.requestTimeoutMs,
      );
      try {
        const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${credential}`,
            "content-type": "application/json",
            "HTTP-Referer": "https://stitchcheck.local",
            "X-Title": "StitchCheck",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await response.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        if (!response.ok) {
          const err = new Error(json?.error?.message || `HTTP ${response.status}`);
          err.status = response.status;
          err.error = json?.error;
          throw err;
        }
        return json;
      } finally {
        clearTimeout(timer);
      }
    },
    _isOpenRouterClient: true,
  };
  return _autoCreatedClient;
}

function checkAuthorization() {
  const config = loadConfig();
  const capabilities = loadCapabilities();
  if (!config || !capabilities) {
    return { enabled: false, reason: "missing_config_or_capabilities" };
  }
  const extractionEnabled = config.extractionEnabled === true ||
    config.providerSelection === "openrouter" ||
    config.directGeminiEnabled === true ||
    config.providerSelection === "gemini";
  if (!extractionEnabled) {
    return { enabled: false, reason: "extraction_not_enabled_in_config" };
  }
  const openrouterCap = capabilities.providers?.openrouter;
  if (!openrouterCap || openrouterCap.capabilityReviewStatus !== "approved") {
    return { enabled: false, reason: "openrouter_capability_not_approved" };
  }
  const model = _resolveModel();
  if (model !== PINNED_MODEL) {
    return { enabled: false, reason: "model_not_approved" };
  }
  if (!_resolveCredential()) {
    return { enabled: false, reason: "credential_not_available" };
  }
  return {
    enabled: true,
    reason: null,
    model,
    label: EXTRACTION_LABELS.liveValidation,
  };
}

export const openrouterExtractionAdapter = {
  isEnabled() {
    return checkAuthorization().enabled === true;
  },
  async extract(request) {
    const auth = checkAuthorization();
    if (!auth.enabled) {
      return createDisabledExtractionResult(auth.reason);
    }
    let client = _providerClient;
    if (!client) {
      client = await _tryAutoCreateClient();
    }
    if (!client) {
      return createDisabledExtractionResult("openrouter_client_not_available");
    }
    const callProvider = createProviderCallFunction(client);
    return callProvider(request, auth.model);
  },
  getLabel() {
    const auth = checkAuthorization();
    return auth.enabled
      ? EXTRACTION_LABELS.liveValidation
      : EXTRACTION_LABELS.syntheticLocalFallback;
  },
};

export function getOpenRouterExtractionReadiness() {
  const auth = checkAuthorization();
  const config = loadConfig();
  const capabilities = loadCapabilities();
  return {
    adapter: "openrouter-extraction",
    enabled: auth.enabled,
    reason: auth.reason,
    label: auth.enabled
      ? EXTRACTION_LABELS.liveValidation
      : EXTRACTION_LABELS.syntheticLocalFallback,
    configPresent: config !== null,
    capabilitiesPresent: capabilities !== null,
    resolvedModel: auth.model ?? "",
    transport: "openrouter",
    safetyLimits: SAFETY_LIMITS,
    prerequisites: [
      "config.json: extractionEnabled = true OR providerSelection = \"openrouter\"",
      "provider-capabilities.json: openrouter.capabilityReviewStatus = approved",
      "approved model pinned to minimax/minimax-m3:free",
      "OPENROUTER_API_KEY available via process.env or .env.local",
    ],
    note: "Itinerary extraction uses MiniMax M3 (free) via OpenRouter only.",
  };
}

export default openrouterExtractionAdapter;

export const _testHooks = {
  buildExtractionPrompt: _buildExtractionPrompt,
  buildOpenRouterRequest: _buildOpenRouterRequest,
  parseProviderText: _parseProviderText,
  assessItinerarySchema: _assessItinerarySchema,
  normalizeLegFields: _normalizeLegFields,
  normalizeParsedExtraction: _normalizeParsedExtraction,
  normalizeProviderResult: _normalizeProviderResult,
  resetCallCountOnly: _resetCallCount,
  getCallCount: _getCallCount,
  sanitizeError: _sanitizeError,
  createProviderCallFunction,
  resetCallCount: _resetModuleState,
  setProviderClient: _setProviderClient,
  setCredentialLoader: _setCredentialLoader,
  resolveCredential: _resolveCredential,
  resolveModel: _resolveModel,
  extractOpenRouterText: _extractOpenRouterText,
  isAuthError: _isAuthError,
  isModelNotFoundError: _isModelNotFoundError,
  extractHttpStatus,
  classifyError: _classifyError,
  buildDiagnostic: _buildDiagnostic,
};
