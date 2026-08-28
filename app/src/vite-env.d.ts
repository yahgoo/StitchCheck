/// <reference types="vite/client" />

/** Injected by vite.config.ts define — the current data mode string.
 *  "live" = use Atlas Sandbox proxy; "offline" = use local fixtures. */
declare const __DATA_MODE__: 'live' | 'offline';

/** Injected by vite.config.ts define — Atlas Sandbox write scaffold switch.
 *  Compile-time second-layer gate only (boolean). The runtime source of
 *  truth is POST /api/atlas/sandbox/capabilities; write execution itself
 *  remains disabled server-side pending contract approval. */
declare const __ATLAS_SANDBOX_WRITES__: boolean;
