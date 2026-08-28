/* ── DataSourceTag — per-panel data-source indicator ──
 *
 * Renders a compact, accessible tag indicating the provenance of the
 * data displayed in the immediately following panel.
 *
 * Never infers source from the global app mode alone. */

export type DataSource =
  | 'local-fixture'
  | 'atlas-live'
  | 'offline-fallback'
  | 'daytona-live';

const SOURCE_LABELS: Record<DataSource, string> = {
  'local-fixture': 'Source: Local fixture',
  'atlas-live': 'Source: Atlas Sandbox \u00b7 live',
  'offline-fallback': 'Source: Offline fallback',
  'daytona-live': 'Source: Daytona sandbox \u00b7 live',
};

const SOURCE_VARIANT: Record<DataSource, string> = {
  'local-fixture': '',
  'atlas-live': 'sc-source-tag--live',
  'offline-fallback': 'sc-source-tag--fallback',
  'daytona-live': 'sc-source-tag--live',
};

interface Props {
  source: DataSource;
}

export function DataSourceTag({ source }: Props) {
  const variant = SOURCE_VARIANT[source];
  const className = `sc-source-tag${variant ? ` ${variant}` : ''}`;
  return (
    <p className={className} data-testid="data-source-tag">
      {SOURCE_LABELS[source]}
    </p>
  );
}
