// Signup.jsx — Gate 2 final step.
// Reads consent payload from sessionStorage (set by Consent.jsx) and calls
// signUpWithConsent(). If consent is missing — deep-link bypass attempt or
// expired session — redirects to /welcome/consent. The DB trigger is the
// authoritative enforcement; this UI redirect is just for a clean UX.

import { useState, useEffect } from 'react';
import { signUpWithConsent } from '../lib/auth.js';

export default function Signup({ t }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [consent, setConsent]   = useState(null);

  useEffect(() => {
    let payload = null;
    try {
      const raw = sessionStorage.getItem('pendingConsent');
      payload = raw ? JSON.parse(raw) : null;
    } catch { /* malformed sessionStorage — treat as missing */ }
    if (!payload || payload.data_storage !== 'granted' || payload.beta_terms !== 'granted') {
      // Deep-link bypass guard — kick back to consent screen.
      window.location.assign('/welcome/consent');
      return;
    }
    setConsent(payload);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!consent) return;
    setError('');
    setLoading(true);
    try {
      await signUpWithConsent(email.trim(), password, consent);
      // Trigger wrote consent_ledger rows; sessionStorage no longer needed.
      sessionStorage.removeItem('pendingConsent');
      // Session is created (email verification OFF for friends-beta per EC2).
      // App.jsx's useAuth() will pick up the new user and render the dashboard.
      window.location.assign('/');
    } catch (err) {
      setError(err.message || 'Sign up failed.');
      setLoading(false);
    }
  };

  if (!consent) {
    // Brief flash while the useEffect redirects.
    return (
      <div style={{
        minHeight: '100vh', background: t.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: t.sub, fontSize: 14 }}>Redirecting…</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif", padding: 24,
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 388,
        boxShadow: t.shadow,
      }}>
        <h2 style={{ color: t.tx, margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
          Create your account
        </h2>
        <p style={{ color: t.sub, margin: '0 0 20px', fontSize: 13 }}>
          One more step. Your consent grants are queued and will be written when you submit.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus autoComplete="email"
              style={{
                width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: '9px 13px', color: t.tx, fontSize: 13.5,
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password" placeholder="Min 8 characters"
              style={{
                width: '100%', background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 8, padding: '9px 13px', color: t.tx, fontSize: 13.5,
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: t.redL, border: `1px solid ${t.redBd}`, borderRadius: 8,
              padding: '9px 12px', color: t.red, fontSize: 12.5, marginBottom: 14,
              fontWeight: 600, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 11, borderRadius: 8,
            background: t.pri, color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
          }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/welcome/consent" style={{ color: t.muted, fontSize: 11.5, textDecoration: 'none' }}>
            ← Review consent
          </a>
        </div>
      </div>
    </div>
  );
}
