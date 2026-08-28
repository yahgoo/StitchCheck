import {
  MINIMAX_OFFLINE_EXPLANATION,
  MINIMAX_OFFLINE_STATUS,
} from '../data/minimax-visibility-copy';

/** Inline status for the ready-made shortcut — not an error treatment. */
export function MiniMaxOfflineNotice() {
  return (
    <p className="sc-minimax-offline-notice" role="status">
      <span className="sc-minimax-offline-notice__status">{MINIMAX_OFFLINE_STATUS}</span>
      <span className="sc-minimax-offline-notice__explanation">{MINIMAX_OFFLINE_EXPLANATION}</span>
    </p>
  );
}
