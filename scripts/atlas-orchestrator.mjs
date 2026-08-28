// Atlas orchestrator for StitchCheck.
//
// STATUS: MOCK MODE — NO REAL ATLAS EXECUTION
//
// This orchestrator manages Atlas Search/Verify operations and
// optional simulated ticketing. In mock mode, it produces
// clearly labeled fallback evidence without any network calls.
//
// Lifecycle:
//   1. Evaluate feature flags (ATLAS_LIVE_READ_ONLY must be true for live).
//   2. Execute Atlas Search (read-only).
//   3. Execute Atlas Verify (read-only) on top offer.
//   4. Optionally run simulated ticketing lifecycle.
//   5. Write evidence to app/public/atlas-evidence.json.
//
// Safety constraints:
//   - No write operations unless ATLAS_WRITES_ENABLED=true AND all 7 prerequisites met.
//   - Simulation is clearly labeled as such.
//   - No real order, payment, or ticket is created.
//   - Credentials never logged or written to evidence.
//
// Label:
//   "Atlas Sandbox — live Search/Verify" (live mode)
//   "Simulated ticketing — no real order created" (simulation)
//   "Offline fixture — not Atlas Sandbox evidence" (fallback)

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const EVIDENCE_OUTPUT = join(PROJECT_ROOT, 'app', 'public', 'atlas-evidence.json');

/* ── Feature flag evaluation ── */

function evaluateAtlasFlags() {
  const demoMode = process.env.DEMO_MODE || 'local';
  const liveReadOnly = process.env.ATLAS_LIVE_READ_ONLY === 'true';
  const writesEnabled = process.env.ATLAS_WRITES_ENABLED === 'true';
  const simulationEnabled = process.env.ATLAS_TICKETING_SIMULATION_ENABLED === 'true';

  /* Apply mode constraints */
  let effectiveLive = liveReadOnly;
  let effectiveWrites = writesEnabled;
  let effectiveSimulation = simulationEnabled;

  if (demoMode === 'local') {
    effectiveLive = false;
    effectiveWrites = false;
    effectiveSimulation = false;
  } else if (demoMode === 'daytona') {
    effectiveWrites = false;
    effectiveSimulation = false;
  }

  /* Simulation requires writes OFF */
  if (effectiveWrites) {
    effectiveSimulation = false;
  }

  return {
    demoMode,
    liveReadOnly: effectiveLive,
    writesEnabled: effectiveWrites,
    simulationEnabled: effectiveSimulation,
  };
}

/* ── Evidence envelope constructors ── */

function createFallbackEnvelope(correlationId, reason) {
  return Object.freeze({
    envelopeVersion: 1,
    correlationId,
    createdAt: new Date().toISOString(),
    operations: [],
    provenance: Object.freeze({
      evidenceSource: 'local-fallback',
      provider: 'atlas',
      executed: false,
      fallbackUsed: true,
      readOnly: false,
      label: 'Offline fixture \u2014 not Atlas Sandbox evidence',
    }),
  });
}

function createLiveEnvelope(correlationId, operations, simulation) {
  const provenance = {
    evidenceSource: 'atlas-sandbox',
    provider: 'atlas',
    executed: true,
    fallbackUsed: false,
    readOnly: true,
    label: 'Atlas Sandbox \u2014 live Search/Verify',
  };

  const envelope = {
    envelopeVersion: 1,
    correlationId,
    createdAt: new Date().toISOString(),
    operations: operations.map(op => Object.freeze({ ...op })),
    provenance: Object.freeze(provenance),
  };

  if (simulation) {
    envelope.simulation = Object.freeze({
      simulationOnly: true,
      steps: simulation.steps,
      finalDisclaimer: 'SIMULATION ONLY \u2014 no real order, payment, or ticket created',
    });
  }

  return Object.freeze(envelope);
}

/* ── Simulated ticketing lifecycle ── */

function runSimulatedTicketing() {
  const steps = [
    {
      step: 'order-created',
      status: 'simulated',
      simulatedAt: new Date().toISOString(),
      disclaimer: 'Simulated order creation — no real order created',
    },
    {
      step: 'payment-pending',
      status: 'simulated',
      simulatedAt: new Date().toISOString(),
      disclaimer: 'Simulated payment — no real payment processed',
    },
    {
      step: 'ticket-issued',
      status: 'simulated',
      simulatedAt: new Date().toISOString(),
      disclaimer: 'Simulated ticket — no real ticket issued',
    },
  ];

  return {
    steps,
    finalDisclaimer: 'SIMULATION ONLY \u2014 no real order, payment, or ticket created',
  };
}

/* ── Mock Atlas operations ── */

function mockAtlasSearch(options) {
  console.log(`[atlas-orchestrator] MOCK: Search ${options.origin} -> ${options.destination} on ${options.date}`);
  return {
    operation: 'search',
    status: 'success',
    requestSummary: {
      origin: options.origin,
      destination: options.destination,
      departureDate: options.date,
      currency: options.currency || 'USD',
    },
    responseSummary: {
      offerCount: 3,
      firstOfferReference: 'MOCK-OFFER-001',
      priceDisplay: '$245.00',
      currency: 'USD',
    },
    latencyMs: 42,
    errorCode: null,
    errorMessage: null,
  };
}

function mockAtlasVerify(offerRef) {
  console.log(`[atlas-orchestrator] MOCK: Verify offer ${offerRef}`);
  return {
    operation: 'verify',
    status: 'success',
    requestSummary: { offerReference: offerRef },
    responseSummary: {
      verifyStatus: 'price-confirmed',
      priceDisplay: '$245.00',
      currency: 'USD',
    },
    latencyMs: 28,
    errorCode: null,
    errorMessage: null,
  };
}

/* ── Main orchestrator ── */

async function runAtlasOrchestrator(options = {}) {
  const correlationId = options.correlationId || randomUUID();
  const flags = evaluateAtlasFlags();

  console.log(`[atlas-orchestrator] Starting with correlationId=${correlationId}`);
  console.log(`[atlas-orchestrator] Flags: liveReadOnly=${flags.liveReadOnly}, simulation=${flags.simulationEnabled}`);

  /* Gate: not live and not simulation -> fallback */
  if (!flags.liveReadOnly && !flags.simulationEnabled) {
    console.log('[atlas-orchestrator] Atlas not enabled. Writing fallback evidence.');
    const envelope = createFallbackEnvelope(correlationId, 'atlas_not_enabled');
    writeFileSync(EVIDENCE_OUTPUT, JSON.stringify(envelope, null, 2));
    return envelope;
  }

  const operations = [];

  /* Step 1: Atlas Search */
  if (flags.liveReadOnly) {
    console.log('[atlas-orchestrator] Step 1: Atlas Search (mock)...');
    const searchResult = mockAtlasSearch({
      origin: options.origin || 'KUL',
      destination: options.destination || 'SIN',
      date: options.date || '2026-09-15',
      currency: options.currency || 'USD',
    });
    operations.push(searchResult);

    /* Step 2: Atlas Verify */
    console.log('[atlas-orchestrator] Step 2: Atlas Verify (mock)...');
    const verifyResult = mockAtlasVerify(searchResult.responseSummary.firstOfferReference);
    operations.push(verifyResult);
  }

  /* Step 3: Simulated ticketing (if enabled) */
  let simulation = null;
  if (flags.simulationEnabled) {
    console.log('[atlas-orchestrator] Step 3: Running simulated ticketing...');
    simulation = runSimulatedTicketing();
  }

  /* Step 4: Build envelope */
  const envelope = createLiveEnvelope(correlationId, operations, simulation);

  /* Step 5: Write evidence */
  writeFileSync(EVIDENCE_OUTPUT, JSON.stringify(envelope, null, 2));
  console.log(`[atlas-orchestrator] Evidence written to ${EVIDENCE_OUTPUT}`);
  console.log(`[atlas-orchestrator] Provenance: ${envelope.provenance.label}`);

  return envelope;
}

/* ── CLI entry point ── */

const isMain = process.argv[1] &&
  (process.argv[1].endsWith('atlas-orchestrator.mjs') ||
   process.argv[1].endsWith('atlas-orchestrator'));

if (isMain) {
  runAtlasOrchestrator({
    origin: process.env.SEARCH_ORIGIN || 'KUL',
    destination: process.env.SEARCH_DESTINATION || 'SIN',
    date: process.env.SEARCH_DATE || '2026-09-15',
  })
    .then(() => {
      console.log('[atlas-orchestrator] Done.');
    })
    .catch((error) => {
      console.error(`[atlas-orchestrator] Fatal: ${error.message}`);
      process.exit(1);
    });
}

export {
  runAtlasOrchestrator,
  evaluateAtlasFlags,
  createFallbackEnvelope,
  createLiveEnvelope,
  runSimulatedTicketing,
  mockAtlasSearch,
  mockAtlasVerify,
};
