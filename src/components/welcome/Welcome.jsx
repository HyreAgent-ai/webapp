// Welcome.jsx — Gate 2 Screen 1.
// Landing page that any prospective user lands on before they ever see a
// signup form. Surfaces the two things we ask for consent on, sets
// expectations, and routes to /welcome/consent.
//
// Refs: docs/ux/beta-consent/README.md (Screen 1 wireframe), Decision #33
// Path D (no CSV import row in the matrix).

export default function Welcome({ t }) {
  const goConsent = () => { window.location.assign('/welcome/consent'); };
  const goDeclined = () => { window.location.assign('/welcome/declined'); };

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif", padding: 24,
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 520,
        boxShadow: t.shadow,
      }}>
        <h1 style={{ color: t.tx, margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>
          Welcome to HyreAgent.
        </h1>
        <p style={{ color: t.sub, margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }}>
          We&apos;re a tiny friends-only beta. Before you sign up, we want you to know
          two things — what we&apos;ll do with your data, and what we expect from each other.
        </p>

        <div style={{
          background: t.bg, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: 20, marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: t.priL,
              color: t.pri, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>1</div>
            <div>
              <div style={{ color: t.tx, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                We store your resume and job activity so the app can work for you.
              </div>
              <div style={{ color: t.sub, fontSize: 12.5, lineHeight: 1.5 }}>
                That&apos;s our contract with you. No marketing emails, no selling data.
                You can export everything and delete your account at any time.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: t.priL,
              color: t.pri, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>2</div>
            <div>
              <div style={{ color: t.tx, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                This is a beta — things will break, and we&apos;ll need your patience.
              </div>
              <div style={{ color: t.sub, fontSize: 12.5, lineHeight: 1.5 }}>
                You&apos;re here because we know you. Tell us when something breaks; we&apos;ll fix it fast.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={goDeclined} style={{
            background: 'transparent', color: t.sub, border: `1px solid ${t.border}`,
            padding: '10px 18px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            No thanks
          </button>
          <button onClick={goConsent} style={{
            background: t.pri, color: '#fff', border: 'none',
            padding: '10px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Show me the two things →
          </button>
        </div>
      </div>
    </div>
  );
}
