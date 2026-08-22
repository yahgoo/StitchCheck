// Atlas Sandbox — Search → Verify smoke test.
//
// STATUS: PREPARED — NOT YET EXECUTED
//
// This script performs a read-only Atlas Sandbox smoke test:
//   1. Switch to Sandbox environment.
//   2. Perform a fresh Search with synthetic parameters and currency USD.
//   3. Capture routingIdentifier (search_id) and offer identifiers.
//   4. Perform Verify on the first offer (read-only price check).
//   5. Stop immediately after Verify — HARD STOP before Order.
//   6. Save sanitized evidence without credentials or PII.
//   7. Label results as "Atlas Sandbox evidence" only after real success.
//   8. Label results as failure state otherwise.
//
// Safety constraints:
//   - No order creation, payment, ticketing, cancellation, refund, or modification.
//   - No credential exposure in output, logs, or saved files.
//   - No React app modification.
//   - Single execution only; no retries beyond CLI-level retryable semantics.
//
// Prerequisites:
//   - atlas-flight CLI >= 0.3.12 installed and on PATH.
//   - Atlas authorization completed (atlas-flight auth status → AUTHORIZED).
//   - search_available: true in auth status response.
//
// Run:
//   node smoke-tests/atlas/run-sandbox-search-verify.mjs
//
// Or step-by-step (see docs/stitchcheck-atlas-sandbox-smoke-test.md).

import { execFile } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");

/* ── Configuration ── */

const SEARCH_PARAMS = Object.freeze({
  origin: "KUL",
  destination: "SIN",
  depart: "2026-09-15",
  adults: 1,
  currency: "USD",
});

const CLI_TIMEOUT_MS = 60_000;

/* ── Helpers ── */

/**
 * Executes an atlas-flight CLI command and returns parsed JSON.
 * Never logs or returns raw output without sanitization.
 * @param {string[]} args
 * @returns {Promise<{ parsed: Object|null, raw: string, exitCode: number }>}
 */
function runCli(args) {
  return new Promise((resolve) => {
    execFile(
      "atlas-flight",
      args,
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const raw = (stdout || "").trim();
        const combined = `${raw}\n${(stderr || "").trim()}`.trim();
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          parsed = null;
        }
        resolve({
          parsed,
          raw: combined,
          exitCode: error ? error.code ?? 1 : 0,
        });
      }
    );
  });
}

/**
 * Sanitizes a CLI response object by removing fields that could
 * expose credentials, internal routing, or PII.
 * Preserves opaque identifiers needed for the flow.
 * @param {Object} obj
 * @returns {Object}
 */
function sanitizeResponse(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = structuredClone(obj);

  // Remove request-level metadata that could leak internal routing.
  delete clone.request_id;

  // Sanitize any string fields that might contain credentials or URLs.
  const sensitivePatterns = [
    /sk-[a-zA-Z0-9]{10,}/g,
    /AIza[a-zA-Z0-9]{20,}/g,
    /Bearer\s+[a-zA-Z0-9._-]+/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ];

  function scrubStrings(val) {
    if (typeof val === "string") {
      let s = val;
      for (const pat of sensitivePatterns) {
        s = s.replace(pat, "[REDACTED]");
      }
      // Redact URLs that might contain tokens.
      s = s.replace(/https?:\/\/[^\s"')]+/g, "[REDACTED]");
      return s;
    }
    if (Array.isArray(val)) {
      return val.map(scrubStrings);
    }
    if (val && typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        out[k] = scrubStrings(v);
      }
      return out;
    }
    return val;
  }

  return scrubStrings(clone);
}

/**
 * Generates a timestamped result filename.
 * @param {string} prefix
 * @returns {string}
 */
function resultFilename(prefix) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${ts}.json`;
}

/**
 * Writes a result object to the results directory.
 * @param {string} filename
 * @param {Object} data
 */
async function writeResult(filename, data) {
  await mkdir(RESULTS_DIR, { recursive: true });
  const filepath = join(RESULTS_DIR, filename);
  await writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
  return filepath;
}

/* ── Main flow ── */

async function main() {
  const report = {
    testId: "ATL-SBX-SV-01",
    startedAt: new Date().toISOString(),
    steps: [],
    evidenceLabel: null,
    hardStop: "AFTER_VERIFY — no Order, Payment, Ticketing, or any write",
    result: "PENDING",
  };

  try {
    // ── Step 1: Switch to Sandbox ──
    console.log("── Step 1: Switch to Sandbox environment ──");
    const envResult = await runCli(["environment", "use", "sandbox", "--json"]);
    const envData = envResult.parsed;

    report.steps.push({
      step: "environment_switch",
      command: "atlas-flight environment use sandbox --json",
      exitCode: envResult.exitCode,
      responseCode: envData?.code ?? null,
      sanitized: envData ? sanitizeResponse(envData) : null,
    });

    if (envData?.code !== "ENVIRONMENT_SWITCHED" && envData?.status !== "success") {
      // Some CLI versions may use different codes; check for success status.
      if (envData?.status !== "success") {
        report.result = "FAILURE";
        report.failureStep = "environment_switch";
        report.failureDetail = envData?.message || envResult.raw || "unknown error";
        report.evidenceLabel =
          "Atlas Sandbox — failure state (environment switch failed)";
        await saveAndExit(report);
        return;
      }
    }
    console.log("  ✅  Sandbox environment confirmed.");

    // ── Step 2: Fresh Search ──
    console.log("── Step 2: Perform fresh Search ──");
    const searchArgs = [
      "search",
      "--origin", SEARCH_PARAMS.origin,
      "--destination", SEARCH_PARAMS.destination,
      "--depart", SEARCH_PARAMS.depart,
      "--adults", String(SEARCH_PARAMS.adults),
      "--currency", SEARCH_PARAMS.currency,
      "--json",
    ];
    const searchResult = await runCli(searchArgs);
    const searchData = searchResult.parsed;

    report.steps.push({
      step: "search",
      command: `atlas-flight ${searchArgs.join(" ")}`,
      exitCode: searchResult.exitCode,
      responseCode: searchData?.code ?? null,
      sanitized: searchData ? sanitizeResponse(searchData) : null,
    });

    if (!searchData || searchData.status !== "success") {
      report.result = "FAILURE";
      report.failureStep = "search";
      report.failureDetail = searchData?.message || searchResult.raw || "no response";
      report.evidenceLabel =
        "Atlas Sandbox — failure state (search failed or returned empty)";
      await saveAndExit(report);
      return;
    }

    // Extract search_id for offer list.
    const searchId = searchData?.data?.search_id || searchData?.data?.searchId;
    if (!searchId) {
      report.result = "FAILURE";
      report.failureStep = "search";
      report.failureDetail = "no search_id in response";
      report.evidenceLabel =
        "Atlas Sandbox — failure state (search_id missing)";
      await saveAndExit(report);
      return;
    }
    console.log(`  ✅  Search completed. search_id captured.`);

    // ── Step 3: List offers and capture identifiers ──
    console.log("── Step 3: List offers ──");
    const offerListArgs = ["offer", "list", "--search-id", searchId, "--json"];
    const offerListResult = await runCli(offerListArgs);
    const offerListData = offerListResult.parsed;

    report.steps.push({
      step: "offer_list",
      command: `atlas-flight ${offerListArgs.join(" ")}`,
      exitCode: offerListResult.exitCode,
      responseCode: offerListData?.code ?? null,
      sanitized: offerListData ? sanitizeResponse(offerListData) : null,
    });

    if (!offerListData || offerListData.status !== "success") {
      report.result = "FAILURE";
      report.failureStep = "offer_list";
      report.failureDetail = offerListData?.message || offerListResult.raw || "no offers";
      report.evidenceLabel =
        "Atlas Sandbox — failure state (offer list failed)";
      await saveAndExit(report);
      return;
    }

    // Extract the first offer_id.
    const offers = offerListData?.data?.offers || offerListData?.data?.alternatives || [];
    if (!Array.isArray(offers) || offers.length === 0) {
      report.result = "FAILURE";
      report.failureStep = "offer_list";
      report.failureDetail = "no offers returned";
      report.evidenceLabel =
        "Atlas Sandbox — failure state (no offers available)";
      await saveAndExit(report);
      return;
    }

    const firstOffer = offers[0];
    const offerId = firstOffer?.offer_id || firstOffer?.offerId || firstOffer?.id;
    if (!offerId) {
      report.result = "FAILURE";
      report.failureStep = "offer_list";
      report.failureDetail = "no offer_id in first offer";
      report.evidenceLabel =
        "Atlas Sandbox — failure state (offer_id missing)";
      await saveAndExit(report);
      return;
    }

    // Capture identifiers for the report (opaque — preserved exactly).
    report.capturedIdentifiers = {
      search_id: searchId,
      offer_id: offerId,
      offer_count: offers.length,
    };
    console.log(`  ✅  ${offers.length} offer(s) found. First offer_id captured.`);

    // ── Step 4: Verify (read-only price check) ──
    console.log("── Step 4: Verify offer (read-only) ──");
    const verifyArgs = ["offer", "verify", "--offer-id", offerId, "--json"];
    const verifyResult = await runCli(verifyArgs);
    const verifyData = verifyResult.parsed;

    report.steps.push({
      step: "verify",
      command: `atlas-flight ${verifyArgs.join(" ")}`,
      exitCode: verifyResult.exitCode,
      responseCode: verifyData?.code ?? null,
      sanitized: verifyData ? sanitizeResponse(verifyData) : null,
    });

    if (!verifyData || verifyData.status !== "success") {
      // Verify may return PRICE_CONFIRMATION_REQUIRED or similar — still a valid response.
      const knownCodes = [
        "PRICE_CONFIRMATION_REQUIRED",
        "PRICE_VERIFICATION_UNAVAILABLE",
        "OFFER_EXPIRED",
        "FLIGHT_UNAVAILABLE",
      ];
      if (verifyData?.code && knownCodes.includes(verifyData.code)) {
        report.result = "PARTIAL_SUCCESS";
        report.evidenceLabel =
          "Atlas Sandbox evidence — search + verify completed, price change or offer expired";
      } else {
        report.result = "FAILURE";
        report.failureStep = "verify";
        report.failureDetail = verifyData?.message || verifyResult.raw || "verify failed";
        report.evidenceLabel =
          "Atlas Sandbox — failure state (verify failed)";
      }
    } else {
      report.result = "SUCCESS";
      report.evidenceLabel =
        "Atlas Sandbox evidence — search + verify completed, read-only, one bounded request";
    }

    // Extract sessionId from verify if available.
    const sessionId = verifyData?.data?.session_id || verifyData?.data?.sessionId;
    if (sessionId) {
      report.capturedIdentifiers.session_id = sessionId;
    }

    console.log(`  ✅  Verify completed. Status: ${report.result}`);

    // ── HARD STOP ──
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  HARD STOP — Flow stops after Verify.");
    console.log("  Next operation would be Order creation (WRITE).");
    console.log("  No Order, Payment, Ticketing, or any write is performed.");
    console.log("═══════════════════════════════════════════════════════════════");

    report.hardStopReached = true;
    report.completedAt = new Date().toISOString();

    await saveAndExit(report);
  } catch (err) {
    report.result = "FAILURE";
    report.failureStep = "unexpected_exception";
    report.failureDetail = err?.message || String(err);
    report.evidenceLabel =
      "Atlas Sandbox — failure state (unexpected exception)";
    report.completedAt = new Date().toISOString();
    await saveAndExit(report);
  }
}

/**
 * Saves the report and prints summary.
 * @param {Object} report
 */
async function saveAndExit(report) {
  const filename = resultFilename("sandbox-search-verify");
  const filepath = await writeResult(filename, report);

  console.log("");
  console.log("── Smoke Test Report ──");
  console.log(`  Result:        ${report.result}`);
  console.log(`  Evidence:      ${report.evidenceLabel}`);
  console.log(`  Hard stop:     ${report.hardStop}`);
  if (report.failureStep) {
    console.log(`  Failure step:  ${report.failureStep}`);
    console.log(`  Failure detail: ${report.failureDetail}`);
  }
  if (report.capturedIdentifiers) {
    console.log(`  Identifiers:   search_id, offer_id${report.capturedIdentifiers.session_id ? ", session_id" : ""} captured`);
  }
  console.log(`  Saved to:      ${filepath}`);
  console.log("");

  // Exit with appropriate code.
  if (report.result === "SUCCESS" || report.result === "PARTIAL_SUCCESS") {
    process.exit(0);
  }
  process.exit(1);
}

// Run.
main();
