import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { scrubObject, scrubValue, PII_DENY_LIST } from '../../src/lib/telemetry/scrub.js';

// ── Sentry (LIA / Article 6(1)(f)) ──────────────────────────────────────────
let _sentryReady = false;
export function initSentry() {
  if (_sentryReady || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || 'development',
    beforeSend(event) {
      if (event.level === 'log') return null;
      return scrubSentryEvent(event);
    },
  });
  _sentryReady = true;
}

function scrubSentryEvent(event) {
  try {
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(v => ({
        ...v,
        value: scrubValue('message', v.value ?? ''),
      }));
    }
    if (event.breadcrumbs?.values) {
      event.breadcrumbs.values = event.breadcrumbs.values.map(b =>
        scrubObject(b)
      );
    }
    if (event.request) event.request = scrubObject(event.request);
    if (event.extra) event.extra = scrubObject(event.extra);
  } catch (_) { /* never crash in telemetry */ }
  return event;
}

export function setSentryUser(userId) {
  if (!_sentryReady) return;
  Sentry.setUser({ id: userId });
}

export function clearSentryUser() {
  if (!_sentryReady) return;
  Sentry.setUser(null);
}

export { Sentry };

// ── PostHog (consent / Article 6(1)(a)) ─────────────────────────────────────
let _posthog = null;
export function getPostHog() {
  if (_posthog) return _posthog;
  if (!process.env.POSTHOG_KEY) return null;
  _posthog = new PostHog(process.env.POSTHOG_KEY, {
    host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  return _posthog;
}

export function captureServerEvent(userId, event, properties = {}) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties: scrubObject(properties) });
}

// Call from DELETE /api/v1/me after Postgres commit
export async function deleteUserTelemetry(userId) {
  // Sentry — clear user immediately
  clearSentryUser();

  // PostHog person delete (best-effort, outside Postgres tx)
  const ph = getPostHog();
  if (ph && process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    try {
      const url = `${process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'}/api/projects/${process.env.POSTHOG_PROJECT_ID}/persons/?distinct_id=${encodeURIComponent(userId)}`;
      const listRes = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}` },
      });
      if (listRes.ok) {
        const { results } = await listRes.json();
        if (results?.length) {
          await fetch(
            `${process.env.POSTHOG_HOST || 'https://eu.i.posthog.com'}/api/projects/${process.env.POSTHOG_PROJECT_ID}/persons/${results[0].id}/?delete_events=true`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}` },
            }
          );
        }
      }
    } catch (_) { /* best-effort — don't break deletion flow */ }
  }

  // Sentry user delete (best-effort)
  if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    try {
      await fetch(
        `https://sentry.io/api/0/projects/${process.env.SENTRY_ORG}/${process.env.SENTRY_PROJECT}/users/${encodeURIComponent(userId)}/`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` },
        }
      );
    } catch (_) { /* best-effort */ }
  }
}
