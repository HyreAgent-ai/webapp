import { useState } from 'react';
import { updatePassword } from '../lib/auth.js';

export default function ResetPassword({ t, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to update password. Try requesting a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.bg,
    color: t.tx, fontSize: 14, boxSizing: 'border-box',
    marginBottom: 14, fontFamily: 'inherit', outline: 'none',
  };
  const lbl = {
    display: 'block', color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 5,
  };

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '40px 36px', width: 388,
        boxShadow: t.shadow,
      }}>
        <h2 style={{ color: t.tx, margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Set New Password</h2>
        <p style={{ color: t.sub, margin: '0 0 24px', fontSize: 13 }}>Choose a new password for your account.</p>

        {done ? (
          <div>
            <div style={{
              background: t.greenL, border: `1px solid ${t.greenBd}`,
              borderRadius: 10, padding: '16px 18px', marginBottom: 20,
            }}>
              <div style={{ color: t.green, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Password updated!</div>
              <div style={{ color: t.tx, fontSize: 13 }}>You can now sign in with your new password.</div>
            </div>
            <button onClick={onDone} style={{
              width: '100%', padding: '11px', borderRadius: 8,
              background: t.pri, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Go to App →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={lbl}>New Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoFocus placeholder="Min 8 characters" style={inp}
            />
            <label style={lbl}>Confirm Password</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required placeholder="Re-enter password" style={{ ...inp, marginBottom: 18 }}
            />

            {error && (
              <div style={{
                background: t.redL, border: `1px solid ${t.redBd}`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 14,
              }}>
                <span style={{ color: t.red, fontSize: 13 }}>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', borderRadius: 8,
              background: t.pri, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
            }}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
