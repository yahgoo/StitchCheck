// Provider abstraction for the StitchCheck Gemini smoke-test harness.
//
// Two named providers exist:
//   - "gemini": default live extraction provider via Google Gemini API.
//     Enabled when GEMINI_API_KEY is present and config allows.
//   - "openrouter": rollback-only path, available only as an explicitly
//     selectable rollback path. Labelled
//     "OpenRouter temporary path — not direct Gemini validation".
//
// This module performs local configuration validation only. It contains no
// request capability, no endpoints, and no network code. Secret values are
// only length-checked; they are never printed, logged, or serialized.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROVIDERS = Object.freeze(["openrouter", "gemini"]);
export const OPENROUTER_LABEL =
  "OpenRouter temporary path — not direct Gemini validation";
export const GEMINI_LABEL = "Direct Gemini validation";

const harnessDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(harnessDir, "..", "..");

export function loadJson(relativePath) {
  return JSON.parse(readFileSync(join(harnessDir, relativePath), "utf8"));
}

// Reads a single named variable from the ignored local env file.
// An absent file is a valid state and yields an empty value.
export function readLocalEnvValue(name) {
  try {
    const text = readFileSync(join(workspaceRoot, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
      if (match) return match[1].trim();
    }
  } catch {
    // Missing env file: treated as an absent key.
  }
  return "";
}

// Validates provider selection, key presence, and approved-model presence.
// Returns a readiness record; never exposes secret values.
export function assessReadiness() {
  const config = loadJson("config.json");
  const capabilities = loadJson("provider-capabilities.json");
  const selection = config.providerSelection;

  const base = {
    provider: selection ?? null,
    providerMode: selection === "gemini" ? "direct" : "temporary",
    label: selection === "gemini" ? GEMINI_LABEL : OPENROUTER_LABEL,
    modelIdentifier: "not-approved",
    keyStatus: "missing",
    errorClass: null,
    ready: false,
  };

  if (!PROVIDERS.includes(selection)) {
    return { ...base, provider: null, errorClass: "unknown_provider" };
  }

  const keyName =
    selection === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY";
  const keyPresent = readLocalEnvValue(keyName).length > 0;
  base.keyStatus = keyPresent ? "present-not-used" : "missing";

  // Direct Gemini stays disabled unless explicitly selected with a key.
  if (selection === "gemini") {
    const directEnabled = config.directGeminiEnabled === true ||
      config.providerSelection === "gemini";
    if (!directEnabled || !keyPresent) {
      return { ...base, errorClass: "direct_gemini_disabled" };
    }
  }

  if (!keyPresent) {
    return { ...base, errorClass: "missing_api_key" };
  }

  const entry = capabilities.providers[selection];
  if (!entry) {
    return { ...base, errorClass: "unknown_provider" };
  }
  const model = (entry?.approvedModelIdentifier ?? "").trim();
  if (!model || entry.capabilityReviewStatus !== "approved") {
    return { ...base, errorClass: "missing_approved_model" };
  }

  return { ...base, modelIdentifier: model, errorClass: null, ready: true };
}
