import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SiteRoutes } from './Site';
import ErrorBoundary from './ErrorBoundary';
import { LangProvider } from './i18n';
import './index.css';
import NativeBridge from './NativeBridge';
import { isNative, routeApiToServer } from './lib/native';

routeApiToServer();

// Offline support for the menu shell (API responses are never cached by sw.js).
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NativeBridge />
      <LangProvider>
        <ErrorBoundary>
          <SiteRoutes />
        </ErrorBoundary>
      </LangProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
