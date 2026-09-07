import { useState } from 'react';
import { Modal } from './Modal';

/**
 * The "i" affordance.
 *
 * Deliberately content-free: it takes the wording as props so the design system
 * never holds product copy. It is a real button with an accessible name, not an
 * icon glyph, so it is reachable by keyboard and announced by a screen reader.
 */
export function InfoButton({
  title,
  children,
  label,
}: {
  title: string;
  children: React.ReactNode;
  /** Overrides the accessible name; defaults to naming the term. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="info-btn"
        aria-label={label ?? `Cosa significa: ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          // Info sits inside cards and rows that are themselves clickable.
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <span aria-hidden="true">i</span>
      </button>

      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        {children}
      </Modal>
    </>
  );
}
