import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import './design-system/base.css';
import './design-system/components.css';
import './app/app.css';
import './pages/landing.css';

/**
 * Preview entry point.
 *
 * Identical to `main.tsx` except for two things required by a single-file,
 * sandboxed build: routing is held in memory (so the landing page's own `#`
 * anchors cannot fight the router) and no service worker is registered.
 */
const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato');

createRoot(container).render(
  <StrictMode>
    <MemoryRouter initialEntries={['/']}>
      <AppRoutes />
    </MemoryRouter>
  </StrictMode>,
);
