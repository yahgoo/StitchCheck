interface Props {
  type: 'loading' | 'status' | 'error' | 'success' | 'warning' | 'empty';
  message: string;
  onRetry?: () => void;
  onRestart?: () => void;
}

export function StatusBanner({ type, message, onRetry, onRestart }: Props) {
  const icons: Record<string, string> = {
    loading: '⏳',
    status: 'ℹ',
    error: '✕',
    success: '✓',
    warning: '⚠',
    empty: '∅',
  };

  const labels: Record<string, string> = {
    loading: 'Loading',
    status: 'Status',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    empty: 'No Results',
  };

  return (
    <div className={`sc-banner sc-banner--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="sc-banner__icon" aria-hidden="true">{icons[type]}</span>
      <strong>{labels[type]}:</strong> {message}
      {(onRetry || onRestart) && (
        <div className="sc-banner__actions">
          {onRetry && (
            <button className="sc-btn sc-btn--small" onClick={onRetry} type="button">
              Retry
            </button>
          )}
          {onRestart && (
            <button className="sc-btn sc-btn--small sc-btn--secondary" onClick={onRestart} type="button">
              Restart demo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
