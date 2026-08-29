import { MINIMAX_PROVENANCE_TAG } from '../data/minimax-visibility-copy';
import { Icon } from './Icon';

/** Compact provenance pill — only when MiniMax M3 genuinely returned this visit's extraction. */
export function MiniMaxProvenanceTag() {
  return (
    <span className="sc-minimax-provenance-tag" role="status">
      <span className="sc-minimax-provenance-tag__icon" aria-hidden="true">
        <Icon name="sparkle" size={14} />
      </span>
      {MINIMAX_PROVENANCE_TAG}
    </span>
  );
}
