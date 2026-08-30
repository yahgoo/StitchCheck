import type { ReactNode } from 'react';

interface HowWeCheckedThisProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  checkedAtLabel: string;
  provenanceLabel?: string | null;
  heuristicDisclaimer?: string | null;
  sourceNote?: string | null;
  extraTechnicalNotes?: string[];
  children?: ReactNode;
}

export function HowWeCheckedThis({
  open,
  onToggle,
  checkedAtLabel,
  provenanceLabel,
  heuristicDisclaimer,
  sourceNote,
  extraTechnicalNotes = [],
  children,
}: HowWeCheckedThisProps) {
  return (
    <details
      className="sc-how-calculated sc-how-we-checked"
      open={open}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
    >
      <summary>How we checked this</summary>
      <div className="sc-how-calculated__body">
        <p>
          We compared your connection time with available alternatives and{' '}
          {checkedAtLabel === 'just now'
            ? 'checked prices just now.'
            : `checked prices at ${checkedAtLabel}.`}{' '}
          Prices and seats can change.
        </p>
        <p>This is an estimate based on your itinerary.</p>
        {heuristicDisclaimer && (
          <p className="sc-disclaimer">{heuristicDisclaimer}</p>
        )}
        {provenanceLabel && (
          <p data-testid="rpa-how-provenance">{provenanceLabel}</p>
        )}
        {sourceNote && <p className="sc-source-note">{sourceNote}</p>}
        {extraTechnicalNotes.map((note) => (
          <p key={note} className="sc-meta-small">{note}</p>
        ))}
        {children}
      </div>
    </details>
  );
}
