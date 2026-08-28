import type { ProviderStatusResult } from '../../../core/provenance';
import {
  PROVIDER_CHECK_COUNT,
  providerChecksSummary,
} from '../data/minimax-visibility-copy';
import { MiniMaxOfflineNotice } from './MiniMaxOfflineNotice';

const PROVIDER_ROWS: ReadonlyArray<{
  key: 'extraction' | 'nosana' | 'atlas';
  name: string;
  role: string;
}> = [
  { key: 'extraction', name: 'MiniMax M3', role: 'extraction' },
  { key: 'nosana', name: 'Nosana', role: 'risk analysis' },
  { key: 'atlas', name: 'Atlas Sandbox', role: 'flight search' },
];

function labelFor(s: ProviderStatusResult | null, name: string): string {
  if (!s) return `${name} · pending`;
  switch (s.status) {
    case 'live-success': return `${name} · live`;
    case 'live-failed': return `${name} · unavailable`;
    case 'offline-fallback': return `${name} · offline`;
    case 'not-configured': return `${name} · not configured`;
    case 'blocked-pending-approval': return `${name} · blocked pending approval`;
    default: return `${name} · unknown`;
  }
}

function variantFor(s: ProviderStatusResult | null): string {
  if (!s) return '';
  switch (s.status) {
    case 'live-success': return 'sc-provider-tag--live';
    case 'live-failed': return 'sc-provider-tag--error';
    case 'offline-fallback': return 'sc-provider-tag--fallback';
    case 'blocked-pending-approval': return 'sc-provider-tag--blocked';
    default: return '';
  }
}

function countCompletedChecks(
  extraction: ProviderStatusResult | null,
  nosana: ProviderStatusResult | null,
  atlas: ProviderStatusResult | null,
  extractionLoading: boolean,
): number {
  let count = 0;
  if (extraction !== null && !extractionLoading) count += 1;
  if (nosana !== null) count += 1;
  if (atlas !== null) count += 1;
  return count;
}

function providerChecksStarted(
  extraction: ProviderStatusResult | null,
  nosana: ProviderStatusResult | null,
  atlas: ProviderStatusResult | null,
  extractionLoading: boolean,
): boolean {
  return extractionLoading || extraction !== null || nosana !== null || atlas !== null;
}

export function ProviderStatusBar({
  extraction,
  nosana,
  atlas,
  extractionLoading,
  showMiniMaxOfflineExplanation,
}: {
  extraction: ProviderStatusResult | null;
  nosana: ProviderStatusResult | null;
  atlas: ProviderStatusResult | null;
  extractionLoading: boolean;
  showMiniMaxOfflineExplanation?: boolean;
}) {
  if (!providerChecksStarted(extraction, nosana, atlas, extractionLoading)) {
    return showMiniMaxOfflineExplanation ? <MiniMaxOfflineNotice /> : null;
  }

  const completedCount = countCompletedChecks(extraction, nosana, atlas, extractionLoading);
  const statusByKey = {
    extraction,
    nosana,
    atlas,
  } as const;

  return (
    <div className="sc-provider-status-bar sc-provider-status-bar--compact">
      {showMiniMaxOfflineExplanation && <MiniMaxOfflineNotice />}
      <div className="sc-provider-checks-row" role="status" aria-label="Provider checks status">
        <span className="sc-provider-live-checks-summary">
          {providerChecksSummary(completedCount)}
        </span>
        <details className="sc-provider-details">
          <summary>How this works</summary>
          <div className="sc-provider-details__body">
            {PROVIDER_ROWS.map(({ key, name, role }) => {
              const status = statusByKey[key];
              const label = key === 'extraction' && extractionLoading
                ? `${name} · extracting…`
                : labelFor(status, name);
              return (
                <span
                  key={key}
                  className={`sc-provider-tag ${variantFor(status)}`}
                >
                  {label} ({role})
                </span>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}

export {
  countCompletedChecks,
  providerChecksStarted,
  PROVIDER_CHECK_COUNT,
};

/** @deprecated Use countCompletedChecks — kept for importers expecting live-success counts. */
function countLiveSuccess(
  extraction: ProviderStatusResult | null,
  nosana: ProviderStatusResult | null,
  atlas: ProviderStatusResult | null,
): number {
  return [extraction, nosana, atlas].filter((s) => s?.status === 'live-success').length;
}

export { countLiveSuccess };
