// Provider-neutral extraction adapter contract for StitchCheck.

export const EXTRACTION_LABELS = Object.freeze({
  liveValidation:
    "Source: AI extraction (MiniMax M3 via OpenRouter) \u00b7 live",
  syntheticLocalFallback:
    "Synthetic local placeholder \u2014 not live extraction evidence",
  historicalOpenRouterGeminiPath:
    "Historical temporary OpenRouter Gemini path \u2014 archived evidence only",
});

export function createDisabledSourceStatus(provider, label, fallbackUsed) {
  return Object.freeze({
    provider,
    label,
    executed: false,
    enabled: false,
    authorizationKey: "OPENROUTER_API_KEY",
    fallbackUsed,
  });
}

export function createDisabledExtractionResult(reason) {
  return Object.freeze({
    extractionStatus: "disabled",
    firstLeg: null,
    secondLeg: null,
    connectionDurationMinutes: null,
    missingFields: ["all — adapter disabled"],
    fieldConfidence: { overall: "none", note: "adapter not enabled" },
    validationMessages: [],
    requiresUserConfirmation: true,
    syntheticDemo: true,
    sourceStatus: createDisabledSourceStatus(
      "openrouter",
      EXTRACTION_LABELS.syntheticLocalFallback,
      true,
    ),
    fallbackReason: reason ?? "adapter_disabled",
    label: EXTRACTION_LABELS.syntheticLocalFallback,
  });
}

export function validateAdapterShape(adapter) {
  const issues = [];
  if (adapter === null || adapter === undefined || typeof adapter !== "object") {
    return { ok: false, issues: ["adapter must be an object"] };
  }
  if (typeof adapter.isEnabled !== "function") {
    issues.push("isEnabled must be a function");
  }
  if (typeof adapter.extract !== "function") {
    issues.push("extract must be a function");
  }
  if (typeof adapter.getLabel !== "function") {
    issues.push("getLabel must be a function");
  }
  return { ok: issues.length === 0, issues };
}
