/* ── NarrationBar — visible caption and narration control ──
 * Displays the current narration text as a visible caption.
 * Provides controls for voice/captions-only/off modes.
 *
 * Labels:
 *   - "Local browser narration" — when voice mode is active.
 *   - "Captions-only fallback" — when captions-only mode is active.
 *   - "Voice disabled for deterministic capture" — when off.
 *
 * This component does not reference or imply any external provider.
 */

import type { NarrationMode, NarrationStatus } from './useNarration';

interface Props {
  mode: NarrationMode;
  status: NarrationStatus;
  currentText: string;
  isSupported: boolean;
  onModeChange: (mode: NarrationMode) => void;
  onStop: () => void;
}

const MODE_LABELS: Record<NarrationMode, string> = {
  off: 'Voice disabled',
  'captions-only': 'Captions only',
  voice: 'Local browser narration',
};

const STATUS_ICONS: Record<NarrationStatus, string> = {
  idle: '💬',
  speaking: '🔊',
  unsupported: '⚠',
  error: '✕',
};

export function NarrationBar({
  mode,
  status,
  currentText,
  isSupported,
  onModeChange,
  onStop,
}: Props) {
  /* Don't render anything if mode is off and there's no text */
  if (mode === 'off' && !currentText) {
    return (
      <div className="sc-narration-bar sc-narration-bar--off" role="status" aria-label="Narration control">
        <span className="sc-narration-bar__label">
          Voice disabled for deterministic capture
        </span>
        <button
          className="sc-btn sc-btn--small sc-btn--secondary"
          onClick={() => onModeChange(isSupported ? 'voice' : 'captions-only')}
          type="button"
          aria-label="Enable narration"
        >
          {isSupported ? 'Enable narration' : 'Enable captions'}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`sc-narration-bar sc-narration-bar--${mode}`}
      role="status"
      aria-label="Narration control"
      aria-live="polite"
    >
      <div className="sc-narration-bar__header">
        <span className="sc-narration-bar__status-icon" aria-hidden="true">
          {STATUS_ICONS[status]}
        </span>
        <span className="sc-narration-bar__mode-label">
          {MODE_LABELS[mode]}
        </span>
        {status === 'unsupported' && (
          <span className="sc-narration-bar__fallback-note">
            Speech synthesis unavailable — captions-only fallback active
          </span>
        )}
      </div>

      {currentText && (
        <p className="sc-narration-bar__caption">{currentText}</p>
      )}

      <div className="sc-narration-bar__controls">
        {mode === 'voice' && (
          <button
            className="sc-btn sc-btn--small sc-btn--secondary"
            onClick={onStop}
            type="button"
            aria-label="Stop narration"
          >
            Stop
          </button>
        )}
        {mode !== 'off' && (
          <button
            className="sc-btn sc-btn--small sc-btn--secondary"
            onClick={() => onModeChange('off')}
            type="button"
            aria-label="Disable narration"
          >
            Disable
          </button>
        )}
        {mode === 'captions-only' && isSupported && (
          <button
            className="sc-btn sc-btn--small sc-btn--secondary"
            onClick={() => onModeChange('voice')}
            type="button"
            aria-label="Enable voice"
          >
            Enable voice
          </button>
        )}
        {mode === 'voice' && (
          <button
            className="sc-btn sc-btn--small sc-btn--secondary"
            onClick={() => onModeChange('captions-only')}
            type="button"
            aria-label="Switch to captions only"
          >
            Captions only
          </button>
        )}
      </div>
    </div>
  );
}
