import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './app/routes';
import './design-system/base.css';
import './design-system/components.css';
import './app/app.css';
import './pages/landing.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root non trovato');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);

// The service worker is what makes the app installable and usable offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
