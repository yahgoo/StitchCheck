#!/usr/bin/env node
// reconcile-live-nosana-evidence.mjs
//
// Offline reconciliation script: reprocesses the already-preserved Nosana
// live evidence through the fixed parser (opStates[].logs[].log path).
//
// SAFETY:
// - No job submission, no IPFS pin, no network request.
// - Uses only the locally cached sanitized fixture.
// - Writes a clearly named reconciled artifact.
// - Does NOT overwrite any original evidence.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const nosanaDir = path.resolve(here, ".");

// Import the parser and validator from the existing modules.
const { parseIpfsResultOutput } = await import(path.join(nosanaDir, "nosana_run_job.mjs"));
const { validateNosanaOutput } = await import(path.join(nosanaDir, "schema-validator.mjs"));

// ── Load the sanitized opStates fixture ─────────────────────────────────────
const fixturePath = path.join(nosanaDir, "fixtures", "opstates-live-result-sanitized.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

console.log("═══ Nosana Live Evidence Reconciliation ═══");
console.log("");
console.log(`Fixture: ${fixturePath}`);
console.log(`Fixture label: ${fixture._label}`);
console.log("");

// ── Parse the fixture through the fixed parser ──────────────────────────────
const parseResult = parseIpfsResultOutput(fixture);

if (!parseResult.ok) {
  console.error(`RECONCILIATION FAILED: ${parseResult.errorCode} — ${parseResult.error}`);
  process.exit(1);
}

console.log(`Parser source: ${parseResult.source}`);
console.log(`Parser output valid: true`);
console.log("");

// ── Validate the parsed output ──────────────────────────────────────────────
const output = parseResult.output;
const validation = validateNosanaOutput(output);

if (!validation.valid) {
  console.error(`VALIDATION FAILED: ${validation.issues.join("; ")}`);
  process.exit(1);
}

console.log("Risk output validation: PASS");
console.log("");

// ── Confirm expected values ─────────────────────────────────────────────────
const assertions = [
  ["riskScore === 0.2895", output.riskScore === 0.2895],
  ["riskBand === 'medium'", output.riskBand === "medium"],
  ["simulationCount === 800", output.simulationCount === 800],
  ["assumptions is array of length 4", Array.isArray(output.assumptions) && output.assumptions.length === 4],
  ["explanation is non-empty string", typeof output.explanation === "string" && output.explanation.length >= 10],
];

// Verify assumptions content
const expectedAssumptions = [
  "Historical average delay at BBB: 25 min",
  "On-time rate: 0.72",
  "Route miss rate: 0.28",
  "Monte Carlo simulations: 800",
];
for (let i = 0; i < expectedAssumptions.length; i++) {
  assertions.push([
    `assumptions[${i}] matches`,
    output.assumptions[i] === expectedAssumptions[i],
  ]);
}

let allPass = true;
for (const [label, ok] of assertions) {
  const status = ok ? "PASS" : "FAIL";
  if (!ok) allPass = false;
  console.log(`  [${status}] ${label}`);
}

if (!allPass) {
  console.error("\nRECONCILIATION: some assertions failed.");
  process.exit(1);
}

console.log("");

// ── Build the reconciled artifact ───────────────────────────────────────────
// Known live metadata from the preserved evidence artifacts.
const liveMetadata = {
  jobId: "BNZTHNoARu98EdaqPU5WiCaFWZAyU1e9NYCZJj2h1afY",
  market: "7AtiXMSH6R1jjBxrcYjehCkkSF7zvYWte63gwEDBcGHq",
  ipfsHash: "QmVtywQCBsMokSSnpjDDNAgGJR6dDa8rAHffpMwqmnq5Jg",
  resultIpfsHash: "QmbCmtmcbfwRKyU8vE6axGvTMZ6YA1AWkLzVVNpYPZrNHE",
  platformTimeoutSec: 3600,
  creditsUsed: 44,
  costUsd: 0.044,
  reservationId: "4a02696c-f4d5-429e-8b4a-e2f6cb3b1722",
  project: "7LB623XexGGLN4b9nbiGvQXrQAnBaYeaJzaPtVfrL5fG",
};

const reconciled = {
  _label: "RECONCILED live Nosana evidence — offline reprocessing of preserved artifact",
  _description:
    "This artifact was produced by offline reprocessing of the sanitized opStates fixture " +
    "derived from the live Nosana job result. No new job was submitted. No network request was made. " +
    "The fixed parser (opStates[].logs[].log path) successfully extracted the risk output.",
  _reconciledAt: new Date().toISOString(),
  _parserSource: parseResult.source,
  _fixturePath: "smoke-tests/nosana/fixtures/opstates-live-result-sanitized.json",

  // Evidence provenance
  evidenceSource: "nosana-evidence",
  fallbackUsed: false,

  // Validated risk output (actual live values)
  riskOutput: {
    riskScore: output.riskScore,
    riskBand: output.riskBand,
    assumptions: output.assumptions,
    simulationCount: output.simulationCount,
    explanation: output.explanation,
  },

  // Live job metadata
  liveMetadata,

  // Billing separation
  billing: {
    creditsUsed: liveMetadata.creditsUsed,
    costUsd: liveMetadata.costUsd,
    _note: "creditsUsed is internal Nosana credit metadata; costUsd is the USD equivalent. They are distinct fields.",
  },

  // Safety declarations
  safety: {
    noNewSubmission: true,
    noNetworkRequest: true,
    noCredentialExposed: true,
    inputWasFictional: true,
    dataWasSynthetic: true,
    noBookingPaymentOrWrite: true,
  },
};

// ── Write the reconciled artifact ───────────────────────────────────────────
const evidenceDir = path.join(nosanaDir, "results", "evidence");
fs.mkdirSync(evidenceDir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = path.join(evidenceDir, `${ts}-completed_success-reconciled.json`);
fs.writeFileSync(outPath, JSON.stringify(reconciled, null, 2) + "\n", "utf8");

console.log("═══ Reconciliation Complete ═══");
console.log("");
console.log(`Reconciled artifact: ${outPath}`);
console.log("");
console.log("Validated risk output:");
console.log(JSON.stringify(reconciled.riskOutput, null, 2));
console.log("");
console.log("Live metadata:");
console.log(`  Job ID:          ${liveMetadata.jobId}`);
console.log(`  Market:          ${liveMetadata.market}`);
console.log(`  IPFS definition: ${liveMetadata.ipfsHash}`);
console.log(`  IPFS result:     ${liveMetadata.resultIpfsHash}`);
console.log(`  Timeout:         ${liveMetadata.platformTimeoutSec}s`);
console.log(`  creditsUsed:     ${liveMetadata.creditsUsed} (internal credit metadata)`);
console.log(`  costUsd:         ${liveMetadata.costUsd} (USD equivalent)`);
console.log("");
console.log("Evidence provenance:");
console.log(`  evidenceSource:  ${reconciled.evidenceSource}`);
console.log(`  fallbackUsed:    ${reconciled.fallbackUsed}`);
console.log("");
console.log("All assertions passed. Reconciliation successful.");
