#!/usr/bin/env node
// nosana-readonly-preflight.mjs — Gate 3.3 read-only Nosana checks.
//
// Executes exactly two read-only SDK calls:
//   1. client.api.credits.balance()
//   2. client.api.markets.list()
//
// No job submission. No IPFS pin. No credits spent.
// NEVER prints NOSANA_API_KEY, wallet keys, tokens, or auth headers.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TIMEOUT_SEC,
  estimateCostUsdFromMarketRate,
} from "./nosana_run_job.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MARKET = "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq";
const DEFAULT_COST_CEILING_USD = 10;
const ALLOWED_ENV_KEYS = new Set([
  "NOSANA_API_KEY",
  "NOSANA_COST_CEILING_USD",
  "NOSANA_MARKET",
]);

function loadAllowedEnvLocal() {
  const envLocalPath = path.join(here, "..", "..", ".env.local");
  try {
    const content = fs.readFileSync(envLocalPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!ALLOWED_ENV_KEYS.has(key) || process.env[key]) continue;
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    // .env.local optional if env already set
  }
}

function getCostCeilingUsd() {
  const envVal = process.env.NOSANA_COST_CEILING_USD;
  if (envVal !== undefined) {
    const parsed = parseFloat(envVal);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_COST_CEILING_USD;
}

function getTargetMarket() {
  return process.env.NOSANA_MARKET || DEFAULT_MARKET;
}

function marketAddress(market) {
  if (!market || typeof market !== "object") return null;
  return market.address || market.market || market.id || null;
}

function marketPricePerHourUsd(market) {
  if (!market || typeof market !== "object") return null;
  const candidates = [
    market.price_per_hour_usd,
    market.pricePerHourUsd,
    market.usdRewardPerHour,
    market.usd_reward_per_hour,
  ];
  for (const value of candidates) {
    const parsed = typeof value === "number" ? value : parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function sanitizeMarketSummary(market) {
  if (!market || typeof market !== "object") return null;
  return {
    address: marketAddress(market),
    slug: market.slug || market.name || null,
    type: market.type || market.marketType || null,
    pricePerHourUsd: marketPricePerHourUsd(market),
  };
}

async function main() {
  loadAllowedEnvLocal();

  const apiKey = process.env.NOSANA_API_KEY;
  if (!apiKey) {
    emitReport({
      ok: false,
      errorCode: "MISSING_CREDENTIAL",
      errorMessage: "NOSANA_API_KEY not set in environment or .env.local",
    });
    process.exit(1);
  }

  const targetMarket = getTargetMarket();
  const costCeilingUsd = getCostCeilingUsd();

  let nosanaKit;
  try {
    nosanaKit = await import("@nosana/kit");
  } catch (err) {
    emitReport({
      ok: false,
      errorCode: "SDK_IMPORT_FAILED",
      errorMessage: err.message,
    });
    process.exit(1);
  }

  const client = nosanaKit.createNosanaClient(nosanaKit.NosanaNetwork.MAINNET, {
    api: { apiKey },
  });

  let balance;
  try {
    balance = await client.api.credits.balance();
  } catch (err) {
    emitReport({
      ok: false,
      errorCode: "CREDITS_BALANCE_FAILED",
      errorMessage: err.message,
      targetMarket,
      costCeilingUsd,
    });
    process.exit(1);
  }

  let markets;
  try {
    markets = await client.api.markets.list();
  } catch (err) {
    emitReport({
      ok: false,
      errorCode: "MARKETS_LIST_FAILED",
      errorMessage: err.message,
      targetMarket,
      costCeilingUsd,
      credits: sanitizeBalance(balance),
    });
    process.exit(1);
  }

  const marketList = Array.isArray(markets) ? markets : [];
  const matchedMarket = marketList.find(
    (market) => marketAddress(market) === targetMarket,
  );

  const assignedCredits = extractAssignedCredits(balance);
  const pricePerHourUsd = matchedMarket
    ? marketPricePerHourUsd(matchedMarket)
    : null;
  const estimatedJobCostUsd = pricePerHourUsd !== null
    ? estimateCostUsdFromMarketRate(pricePerHourUsd, DEFAULT_TIMEOUT_SEC)
    : null;

  const marketVerdict = matchedMarket ? "CONFIRMED" : "UNVERIFIED";
  const creditsSufficient = marketVerdict === "CONFIRMED"
    && assignedCredits !== null
    && assignedCredits > 0
    && estimatedJobCostUsd !== null
    && estimatedJobCostUsd <= costCeilingUsd;

  emitReport({
    ok: true,
    provider: "nosana",
    gate: "3.3-read-only-preflight",
    sdkVersion: "2.7.5",
    executedCalls: ["client.api.credits.balance", "client.api.markets.list"],
    jobSubmitted: false,
    creditsSpent: false,
    targetMarket,
    marketVerdict,
    marketSummary: matchedMarket ? sanitizeMarketSummary(matchedMarket) : null,
    credits: sanitizeBalance(balance),
    assignedCredits,
    costCeilingUsd,
    estimatedJobCostUsd,
    estimatedJobTimeoutSec: DEFAULT_TIMEOUT_SEC,
    creditsSufficient,
    timestamp: new Date().toISOString(),
  });
}

function extractAssignedCredits(balance) {
  if (!balance || typeof balance !== "object") return null;
  const candidates = [
    balance.assignedCredits,
    balance.assigned_credits,
    balance.assigned,
  ];
  for (const value of candidates) {
    const parsed = typeof value === "number" ? value : parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function sanitizeBalance(balance) {
  if (!balance || typeof balance !== "object") return null;
  return {
    assignedCredits: extractAssignedCredits(balance),
    reservedCredits: numericField(balance, [
      "reservedCredits",
      "reserved_credits",
      "reserved",
    ]),
    settledCredits: numericField(balance, [
      "settledCredits",
      "settled_credits",
      "settled",
    ]),
  };
}

function numericField(obj, keys) {
  for (const key of keys) {
    const value = obj[key];
    const parsed = typeof value === "number" ? value : parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function emitReport(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  emitReport({
    ok: false,
    errorCode: "UNEXPECTED_ERROR",
    errorMessage: err.message,
  });
  process.exit(1);
});
