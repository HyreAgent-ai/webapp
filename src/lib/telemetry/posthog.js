// Client-side PostHog helpers — consent-gated per EC1 Option A.
// PostHog only inits after consent_ledger grants are confirmed.
import posthog from 'posthog-js';
import { scrubObject } from './scrub.js';

let _ready = false;

export function initPostHog() {
  if (_ready || !import.meta.env.VITE_POSTHOG_KEY) return;
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    session_recording: {
      maskAllInputs: true,
      captureNetworkRequests: false,
      recordConsoleLog: false,
    },
    loaded(ph) {
      ph.opt_out_capturing(); // default off until consent granted
    },
    sanitize_properties(props) {
      return scrubObject(props);
    },
  });
  _ready = true;
}

export function consentGranted(userId) {
  if (!_ready) return;
  posthog.opt_in_capturing();
  posthog.identify(userId); // uuid only, never email
  posthog.startSessionRecording();
}

export function consentRevoked() {
  if (!_ready) return;
  posthog.opt_out_capturing();
  posthog.stopSessionRecording();
  posthog.reset();
}

export function identifyUser(userId) {
  if (!_ready) return;
  posthog.identify(userId);
}

export function resetUser() {
  if (!_ready) return;
  posthog.reset();
}

export function capture(event, props = {}) {
  if (!_ready) return;
  posthog.capture(event, scrubObject(props));
}

// Named event helpers — keeps firing-site code minimal
export const track = {
  signupCompleted: () => capture('auth_signup_completed'),
  consentGranted:  (purpose, version) => capture('consent_granted', { purpose, version }),
  consentRevoked:  (purpose) => capture('consent_revoked', { purpose }),
  resumeUploaded:  (byte_size) => capture('resume_uploaded', { byte_size }),
  jdAnalysisRun:   (duration_ms, score_bucket) => capture('jd_analysis_run', { duration_ms, score_bucket }),
  applicationCreated: () => capture('application_created'),
  applicationMarkedApplied: () => capture('application_marked_applied'),
  deletionInitiated: () => capture('account_deletion_initiated'),
};
