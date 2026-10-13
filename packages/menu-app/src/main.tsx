import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SiteRoutes } from './Site';
import ErrorBoundary from './ErrorBoundary';
import { LangProvider } from './i18n';
import './index.css';

// Offline support for the menu shell (API responses are never cached by sw.js).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LangProvider>
        <ErrorBoundary>
          <SiteRoutes />
        </ErrorBoundary>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
