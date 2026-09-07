import { InfoButton } from '@/design-system';
import { GLOSSARY, type GlossaryId } from './glossary';

/**
 * The "i" next to a term, wired to the glossary.
 *
 * Components ask for a term by id and never carry the explanation themselves,
 * so the help copy stays reviewable as a single set.
 */
export function TermInfo({ id }: { id: GlossaryId }) {
  const entry = GLOSSARY[id];
  return (
    <InfoButton title={entry.term}>
      <div className="info-body">
        {entry.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {entry.tip && (
          <div className="info-tip">
            <span className="info-tip__label">In pratica</span>
            {entry.tip}
          </div>
        )}
      </div>
    </InfoButton>
  );
}

/**
 * A label followed by its explanation button. Use wherever a term appears as
 * plain text that a rider new to suspension setup would not recognise.
 */
export function TermLabel({
  id,
  children,
  className = '',
}: {
  id: GlossaryId;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`info-label ${className}`}>
      <span>{children}</span>
      <TermInfo id={id} />
    </span>
  );
}
