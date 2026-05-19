// ─────────────────────────────────────────────────────────────────────────────
// error-copy.js  —  UA-B1 / CB-5 deliverable
// ─────────────────────────────────────────────────────────────────────────────
// Maps the API's machine-readable error envelope (`{ code, message, request_id,
// hint }`) to the user-facing message rendered in <Toast />. The envelope is a
// developer artifact; this file is a user artifact. The split exists because
// a beta user who sees `AI_PROMPT_ISOLATION_VIOLATED` in a toast closes the tab
// and never comes back.
//
// Contract:
//   - Every `code` returned by the API MUST have an entry below.
//   - Codes without an entry render via the generic `fallback()` — never the
//     raw code. CI lint enforces this (see PHASE_A_DESIGN.md §1.8.4).
//   - Body copy MUST be plain English. No jargon. No "an error occurred."
//   - Body MAY reference `<request_id>` — the toast component substitutes the
//     real value via a one-tap "Copy debug info" affordance (UA-B1 #5).
//
// Reference: docs/architecture/reviews/03-user-advocate.md §UA-B1 + Section L.
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_CONTACT = 'email siddardth7@gmail.com';

/**
 * @typedef {{ title: string, body: string, action_label?: string, action_href?: string }} ErrorCopy
 */

/** @type {Record<string, ErrorCopy>} */
export const ERROR_COPY = {
  // ── 400 — client validation ────────────────────────────────────────────────
  VALIDATION_ERROR: {
    title: 'Something in this form needs a tweak.',
    body: 'Check the highlighted fields and try again.',
    action_label: 'OK',
  },
  MASS_ASSIGNMENT_REJECTED: {
    title: "We don't accept some of those fields.",
    body: 'The app sent a value we don\'t allow — refresh the page and try again. If it keeps happening, ' + OWNER_CONTACT + ' with this code.',
    action_label: 'Refresh',
  },
  MISSING_IDEMPOTENCY_KEY: {
    title: 'Request lost track of itself.',
    body: 'Refresh the page and try again. (Technical: the request was missing a header the API requires.)',
    action_label: 'Refresh',
  },
  PERSONA_LIMIT_EXCEEDED: {
    title: 'That\'s a lot of personas.',
    body: 'We cap contact searches at 6 personas to keep costs sane. Trim the list and try again.',
    action_label: 'OK',
  },

  // ── 401 — auth ─────────────────────────────────────────────────────────────
  UNAUTHORIZED: {
    title: 'Your session expired.',
    body: 'Sign back in to keep going.',
    action_label: 'Sign in',
    action_href: '/login',
  },

  // ── 403 — authorization / policy ───────────────────────────────────────────
  FORBIDDEN: {
    title: "You can't do that from here.",
    body: 'If you think this is wrong, ' + OWNER_CONTACT + ' with this code.',
    action_label: 'Got it',
  },
  CONSENT_REQUIRED: {
    title: 'One quick consent first.',
    body: 'We need you to read and accept the beta terms before using this feature.',
    action_label: 'Review consent',
    action_href: '/welcome/consent',
  },
  BETA_FULL: {
    title: 'The closed beta is at capacity.',
    body: 'We\'re running a tiny beta (5 users) while we shake bugs out. ' + OWNER_CONTACT + ' to get on the waitlist.',
    action_label: 'OK',
  },

  // ── 404 — missing ──────────────────────────────────────────────────────────
  NOT_FOUND: {
    title: "We couldn't find that.",
    body: 'It may have been deleted, or the link is stale. Head back to the dashboard.',
    action_label: 'Dashboard',
    action_href: '/',
  },

  // ── 409 — state conflicts ──────────────────────────────────────────────────
  IDEMPOTENCY_CONFLICT: {
    title: "This looks like a duplicate.",
    body: "Looks like you already submitted this — we kept the first version. If that's wrong, refresh and try again.",
    action_label: 'OK',
  },
  IDEMPOTENCY_IN_PROGRESS: {
    title: 'Still working on the previous one.',
    body: "Give us a second — your last request is still running. We'll pick this up automatically.",
    action_label: 'Wait',
  },
  CONSENT_VERSION_OUTDATED: {
    title: 'We updated our terms.',
    body: "Quick re-confirm and you're back in.",
    action_label: 'Re-confirm',
    action_href: '/welcome/consent',
  },

  // ── 429 — rate / quota ─────────────────────────────────────────────────────
  RATE_LIMITED: {
    title: 'Slow down a little.',
    body: 'You\'re going faster than our rate limit. Wait a few seconds and try again.',
    action_label: 'OK',
  },
  QUOTA_EXCEEDED: {
    title: 'You\'ve hit today\'s quota.',
    body: 'Daily AI usage is capped to keep costs predictable. It resets at midnight UTC.',
    action_label: 'OK',
  },

  // ── 5xx — upstream / server ────────────────────────────────────────────────
  UPSTREAM_UNAVAILABLE: {
    title: 'One of our providers is having a moment.',
    body: 'This isn\'t your computer — an upstream service (Groq, Serper, Supabase) is slow or down. Try again in a minute.',
    action_label: 'Retry',
  },
  AI_PROMPT_ISOLATION_VIOLATED: {
    title: "We didn't trust that AI response.",
    body: 'The AI returned something that didn\'t pass our safety check, so we threw it away rather than show it to you. Try again — usually it works the second time.',
    action_label: 'Try again',
  },
  INTERNAL_ERROR: {
    title: 'Something went wrong on our end.',
    body: 'Try again, or ' + OWNER_CONTACT + ' with this code.',
    action_label: 'Try again',
  },
};

/**
 * Generic fallback for any code not in ERROR_COPY. Used when a new code ships
 * before the copy lands — covered by CI lint, but a runtime safety net too.
 *
 * @param {string} [code]
 * @returns {ErrorCopy}
 */
export function fallback(code) {
  return {
    title: 'Something went wrong on our end.',
    body: code
      ? `Try again, or ${OWNER_CONTACT} with this code: ${code}.`
      : `Try again, or ${OWNER_CONTACT}.`,
    action_label: 'Try again',
  };
}

/**
 * Resolve an API error envelope to user-facing copy. Always returns a valid
 * ErrorCopy — falls back to `fallback()` for unknown codes.
 *
 * @param {{ code?: string, request_id?: string } | null | undefined} envelope
 * @returns {ErrorCopy}
 */
export function resolveCopy(envelope) {
  if (!envelope || !envelope.code) return fallback();
  return ERROR_COPY[envelope.code] || fallback(envelope.code);
}

/**
 * Returns the set of mapped error codes — used by the CI lint in
 * scripts/check-error-copy.sh (or an ESLint plugin) to compare against codes
 * thrown in api/v1/*.
 */
export function mappedCodes() {
  return Object.keys(ERROR_COPY);
}
