import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createAtlasProxyMiddleware } from './server/atlas-proxy.mjs';
import { createExtractionPlugin } from './server/openrouter-extract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ── Load .env.local into process.env (server-side only) ──
 * We parse .env.local manually to avoid adding a dotenv dependency.
 * ALL variables go into process.env for the server-side proxy.
 * Only the DATA_MODE string and the ATLAS_SANDBOX_WRITES_ENABLED boolean
 * are injected into the browser bundle.
 * Credentials are NEVER injected into the client bundle. */
function loadEnvLocal(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const envPath = resolve(__dirname, '..', '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key) result[key] = val;
    }
  } catch {
    // .env.local may not exist
  }
  return result;
}

const envLocal = loadEnvLocal();
// Merge into process.env so the proxy middleware can read credentials
for (const [k, v] of Object.entries(envLocal)) {
  if (!(k in process.env)) process.env[k] = v;
}
const dataMode = envLocal.DATA_MODE === 'live' ? 'live' : 'offline';
// Compile-time second-layer switch for the Atlas Sandbox write scaffold.
// Boolean only — never carries credentials, URLs, or other secrets.
const atlasSandboxWrites = envLocal.ATLAS_SANDBOX_WRITES_ENABLED === 'true';

/* ── Atlas proxy Vite plugin ── */
function atlasProxyPlugin(): import('vite').Plugin {
  return {
    name: 'atlas-proxy',
    configureServer(server) {
      console.log('[atlas-proxy] registering middleware, DATA_MODE=%s', process.env.DATA_MODE);
      // Construct the middleware ONCE at plugin registration so the
      // sandbox write handler's stateful stores (confirmation tokens,
      // idempotency records, paid-order index) persist across requests.
      // Env stays live: gates read the shared process.env object per request.
      const middleware = createAtlasProxyMiddleware(process.env);
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/atlas')) {
          console.log('[atlas-proxy] intercepted %s %s', req.method, url);
        }
        return middleware(req, res, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), atlasProxyPlugin(), createExtractionPlugin(process.env)],
  define: {
    /* The ONLY values injected into the browser bundle:
     * DATA_MODE (plain string) and the Atlas Sandbox write scaffold switch
     * (plain boolean). Neither ever contains credentials or URLs. */
    __DATA_MODE__: JSON.stringify(dataMode),
    __ATLAS_SANDBOX_WRITES__: JSON.stringify(atlasSandboxWrites),
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../core'),
    },
  },
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
});
