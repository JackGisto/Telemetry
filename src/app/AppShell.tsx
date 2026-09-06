import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSettingsStore } from './store';

const TABS = [
  { to: '/app', glyph: '◈', label: 'Home', end: true },
  { to: '/app/run', glyph: '▶', label: 'Run', end: false },
  { to: '/app/storico', glyph: '≡', label: 'Storico', end: false },
  { to: '/app/bici', glyph: '⚙', label: 'Bici', end: false },
  { to: '/app/impostazioni', glyph: '⋯', label: 'Altro', end: false },
];

/**
 * The app frame: a title bar, one scrolling column, and five tabs.
 * Five destinations is the whole navigation; nothing nests deeper than one
 * level below a tab.
 */
export function AppShell() {
  const mode = useSettingsStore((s) => s.mode);
  const { pathname } = useLocation();
  // Expert mode uses the extra width on desktop for charts (spec section 36).
  const wide = mode === 'expert' && pathname.includes('/analisi');

  return (
    <div className="app-shell">
      <main className={`app-main${wide ? ' app-main--wide' : ''}`}>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navigazione principale">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tabbar__item">
            <span className="tabbar__glyph" aria-hidden="true">
              {tab.glyph}
            </span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** Standard screen header. `question` states the one question the screen answers. */
export function ScreenHeader({
  title,
  question,
  action,
}: {
  title: string;
  question?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="stack stack--1" style={{ marginBottom: 'var(--s-5)' }}>
      <div className="row row--between">
        <h1 style={{ fontSize: 'var(--fs-h2)' }}>{title}</h1>
        {action}
      </div>
      {question && <p className="screen-question">{question}</p>}
    </header>
  );
}
