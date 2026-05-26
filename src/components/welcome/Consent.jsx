// Consent.jsx — Gate 2 Screen 2.
// Two-checkbox consent screen. Both must be granted before signup proceeds.
// Stashes the consent payload in sessionStorage so /signup can read it; tab
// close clears it. The DB trigger (on_auth_user_created) is the authoritative
// enforcement — this UI is a usability layer, not the lock.
//
// Refs: docs/ux/beta-consent/README.md (Screen 2 wireframe + lawful-basis
// matrix), Decision #33 Path D (NO contacts_csv_import row in friends-beta).

import { useState } from 'react';

const CONSENT_VERSION = '2026-05-25';

export default function Consent({ t }) {
  const [dataStorage, setDataStorage] = useState(false);
  const [betaTerms,   setBetaTerms]   = useState(false);

  const canContinue = dataStorage && betaTerms;

  const onContinue = () => {
    if (!canContinue) return;
    sessionStorage.setItem('pendingConsent', JSON.stringify({
      data_storage: 'granted',
      beta_terms:   'granted',
      version:      CONSENT_VERSION,
      grantedAt:    new Date().toISOString(),
    }));
    window.location.assign('/signup');
  };

  const onDecline = () => {
    sessionStorage.removeItem('pendingConsent');
    window.location.assign('/welcome/declined');
  };

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif", padding: 24,
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 560,
        boxShadow: t.shadow,
      }}>
        <h1 style={{ color: t.tx, margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>
          Two things, then you&apos;re in.
        </h1>
        <p style={{ color: t.sub, margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.6 }}>
          Tick both to continue. Decline either and we won&apos;t create an account for you.
        </p>

        {/* Lawful-basis matrix */}
        <div style={{
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
          padding: '14px 16px', marginBottom: 20, fontSize: 12.5, color: t.sub, lineHeight: 1.6,
        }}>
          <div style={{ color: t.tx, fontWeight: 600, marginBottom: 6 }}>What we do, why we do it</div>
          <div><strong style={{ color: t.tx }}>Resume parsing &amp; job-feed personalization</strong> — performance of our contract with you (GDPR Art. 6(1)(b)).</div>
          <div><strong style={{ color: t.tx }}>Error logs (Sentry, no email)</strong> — our legitimate interest in keeping the app running (Art. 6(1)(f)).</div>
          <div style={{ marginTop: 6, fontSize: 11.5, color: t.muted }}>
            See <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: t.pri }}>privacy.html</a> and{' '}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: t.pri }}>terms.html</a> for the full text.
          </div>
        </div>

        {/* Checkbox 1 — data_storage */}
        <label style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: 14, border: `1px solid ${dataStorage ? t.priBd : t.border}`,
          background: dataStorage ? t.priL : 'transparent',
          borderRadius: 10, cursor: 'pointer', marginBottom: 12,
          transition: 'background .12s, border-color .12s',
        }}>
          <input
            type="checkbox" checked={dataStorage}
            onChange={(e) => setDataStorage(e.target.checked)}
            style={{ marginTop: 3, accentColor: t.pri, width: 16, height: 16, cursor: 'pointer' }}
          />
          <div>
            <div style={{ color: t.tx, fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
              I&apos;m okay with HyreAgent storing my resume, job activity, and contacts so the app can work.
            </div>
            <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5 }}>
              Purpose: <code style={{ background: t.bg, padding: '0 4px', borderRadius: 3 }}>data_storage</code>.
              You can export this anytime under Settings → Data Rights, and delete everything under Settings → Danger Zone.
            </div>
          </div>
        </label>

        {/* Checkbox 2 — beta_terms */}
        <label style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: 14, border: `1px solid ${betaTerms ? t.priBd : t.border}`,
          background: betaTerms ? t.priL : 'transparent',
          borderRadius: 10, cursor: 'pointer', marginBottom: 20,
          transition: 'background .12s, border-color .12s',
        }}>
          <input
            type="checkbox" checked={betaTerms}
            onChange={(e) => setBetaTerms(e.target.checked)}
            style={{ marginTop: 3, accentColor: t.pri, width: 16, height: 16, cursor: 'pointer' }}
          />
          <div>
            <div style={{ color: t.tx, fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
              I understand this is a friends-only beta and things may break.
            </div>
            <div style={{ color: t.sub, fontSize: 12, lineHeight: 1.5 }}>
              Purpose: <code style={{ background: t.bg, padding: '0 4px', borderRadius: 3 }}>beta_terms</code>.
              We&apos;ll tell you when we ship breaking changes; you tell us when something&apos;s broken.
            </div>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onDecline} style={{
            background: 'transparent', color: t.sub, border: 'none',
            padding: '10px 4px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ← I&apos;ll pass
          </button>
          <button onClick={onContinue} disabled={!canContinue} style={{
            background: canContinue ? t.pri : t.border,
            color: canContinue ? '#fff' : t.muted, border: 'none',
            padding: '11px 22px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: canContinue ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            opacity: canContinue ? 1 : 0.7,
          }}>
            Continue to signup →
          </button>
        </div>
      </div>
    </div>
  );
}
