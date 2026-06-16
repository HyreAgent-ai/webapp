// Declined.jsx — Gate 2 exit page.
// Surfaced when a user declines either baseline consent on /welcome or
// /welcome/consent. Confirms no account was created. No dark patterns —
// the only path back is the explicit reconsider link.

export default function Declined({ t }) {
  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif", padding: 24,
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 460,
        boxShadow: t.shadow, textAlign: 'center',
      }}>
        <h1 style={{ color: t.tx, margin: '0 0 12px', fontSize: 22, fontWeight: 700 }}>
          No worries, no account created.
        </h1>
        <p style={{ color: t.sub, margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }}>
          Thanks for taking a look. We didn&apos;t store anything about you —
          no email, no IP, no record. If you change your mind, come back any time.
        </p>
        <a href="/welcome" style={{
          display: 'inline-block', color: t.pri, fontSize: 13, fontWeight: 600,
          textDecoration: 'none',
        }}>
          ← Reconsider
        </a>
      </div>
    </div>
  );
}
