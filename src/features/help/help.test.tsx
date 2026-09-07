import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GLOSSARY, type GlossaryId } from './glossary';
import { TermInfo, TermLabel } from './TermInfo';

describe('contenuto del glossario', () => {
  const ids = Object.keys(GLOSSARY) as GlossaryId[];

  it.each(ids)('la voce "%s" è compilata e utile', (id) => {
    const entry = GLOSSARY[id];
    expect(entry.term.length).toBeGreaterThan(2);
    expect(entry.body.length).toBeGreaterThan(0);
    for (const paragraph of entry.body) {
      // A one-line stub would not actually explain anything.
      expect(paragraph.length).toBeGreaterThan(40);
    }
  });

  it('non lascia segnaposto o testo non tradotto', () => {
    for (const entry of Object.values(GLOSSARY)) {
      const text = [entry.term, ...entry.body, entry.tip ?? ''].join(' ');
      expect(text).not.toMatch(/TODO|TBD|lorem/i);
    }
  });
});

describe('pulsante di spiegazione', () => {
  it('espone un nome accessibile che nomina il termine', () => {
    render(<TermInfo id="ride-height" />);
    expect(
      screen.getByRole('button', { name: /cosa significa: altezza di marcia/i }),
    ).toBeInTheDocument();
  });

  it('apre la spiegazione in un dialogo e la richiude', async () => {
    const user = userEvent.setup();
    render(<TermInfo id="bottom-out" />);

    await user.click(screen.getByRole('button', { name: /cosa significa/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName(/fondo corsa/i);
    expect(screen.getByText(/non può più comprimersi/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mostra il consiglio pratico quando la voce ne ha uno', async () => {
    const user = userEvent.setup();
    render(<TermInfo id="riding-style" />);
    await user.click(screen.getByRole('button', { name: /cosa significa/i }));
    expect(screen.getByText('In pratica')).toBeInTheDocument();
  });

  it('affianca il pulsante al testo senza sostituirlo', () => {
    render(<TermLabel id="score">Valutazione</TermLabel>);
    expect(screen.getByText('Valutazione')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cosa significa: score/i })).toBeInTheDocument();
  });
});
