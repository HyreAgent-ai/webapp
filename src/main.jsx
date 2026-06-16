import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initPostHog } from './lib/telemetry/posthog.js';
import { scrubObject } from './lib/telemetry/scrub.js';

// Sentry — LIA / Article 6(1)(f), no consent banner needed
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.level === 'log') return null;
      try {
        if (event.exception?.values) {
          event.exception.values = event.exception.values.map(v => ({
            ...v, value: String(v.value ?? '').replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]'),
          }));
        }
        if (event.breadcrumbs?.values) event.breadcrumbs.values = event.breadcrumbs.values.map(b => scrubObject(b));
        if (event.request) event.request = scrubObject(event.request);
      } catch (_) {}
      return event;
    },
  });
}

// PostHog — consent-gated, opt_out by default until consent_ledger grants fire
initPostHog();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
