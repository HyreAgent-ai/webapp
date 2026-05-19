import { useState } from 'react';
import { signIn, signUp, sendPasswordReset } from '../lib/auth.js';

function friendlyError(err, mode) {
  const msg = err?.message || '';
  if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
    return { text: 'Too many attempts — please wait a few minutes before trying again.' };
  }
  if (msg.includes('User already registered') || msg.includes('already been registered')) {
    return { text: 'An account with this email already exists.', hint: 'signin' };
  }
  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return { text: 'Incorrect email or password.' };
  }
  if (msg.includes('Email not confirmed')) {
    return { text: 'Please confirm your email first — check your inbox.' };
  }
  if (msg.includes('Password should be at least')) {
    return { text: 'Password must be at least 8 characters.' };
  }
  if (msg.includes('Unable to validate email address')) {
    return { text: 'Please enter a valid email address.' };
  }
  return { text: msg || (mode === 'signin' ? 'Sign in failed.' : mode === 'signup' ? 'Sign up failed.' : 'Something went wrong.') };
}

export default function Login({ t }) {
  const [mode,     setMode]    = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email,    setEmail]   = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm] = useState('');
  const [error,    setError]   = useState(null); // { text, hint? }
  const [loading,  setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
    setResetSent(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      if (password !== confirm) { setError({ text: 'Passwords do not match.' }); return; }
      if (password.length < 8)  { setError({ text: 'Password must be at least 8 characters.' }); return; }
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await sendPasswordReset(email.trim());
        setResetSent(true);
      } catch (err) {
        setError(friendlyError(err, 'forgot'));
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (err) {
      setError(friendlyError(err, mode));
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
    display: 'block', color: t.sub, fontSize: 12,
    fontWeight: 600, marginBottom: 5,
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
        {/* Header */}
        <h2 style={{ color: t.tx, margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>JobAgent</h2>
        <p style={{ color: t.sub, margin: '0 0 24px', fontSize: 13 }}>
          {mode === 'signin' && 'Sign in to your account'}
          {mode === 'signup' && 'Create your account'}
          {mode === 'forgot' && 'Reset your password'}
        </p>

        {/* Mode toggle (only signin / signup) */}
        {mode !== 'forgot' && (
          <div style={{
            display: 'flex', gap: 0, marginBottom: 24,
            border: `1px solid ${t.border}`, borderRadius: 8, overflow: 'hidden',
          }}>
            {['signin', 'signup'].map((m) => (
              <button key={m} onClick={() => switchMode(m)} style={{
                flex: 1, padding: '8px 0', border: 'none',
                background: mode === m ? t.pri : 'transparent',
                color: mode === m ? '#fff' : t.sub,
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        {/* ── Forgot password: success state ── */}
        {mode === 'forgot' && resetSent ? (
          <div style={{
            background: t.greenL, border: `1px solid ${t.greenBd}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 20,
          }}>
            <div style={{ color: t.green, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
              Check your inbox
            </div>
            <div style={{ color: t.tx, fontSize: 13, lineHeight: 1.5 }}>
              A password reset link was sent to <strong>{email}</strong>. Click the link to set a new password.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={lbl}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoFocus placeholder="you@example.com" style={inp}
            />

            {mode !== 'forgot' && (
              <>
                <label style={lbl}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder={mode === 'signup' ? 'Min 8 characters' : ''}
                  style={inp}
                />
              </>
            )}

            {mode === 'signup' && (
              <>
                <label style={lbl}>Confirm Password</label>
                <input
                  type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required placeholder="Re-enter password"
                  style={{ ...inp, marginBottom: 18 }}
                />
              </>
            )}

            {/* Forgot password link (signin only) */}
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
                <button type="button" onClick={() => switchMode('forgot')} style={{
                  background: 'none', border: 'none', color: t.pri,
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  padding: 0,
                }}>
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: t.redL, border: `1px solid ${t.redBd}`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 14,
              }}>
                <span style={{ color: t.red, fontSize: 13 }}>{error.text}</span>
                {error.hint === 'signin' && (
                  <button type="button" onClick={() => switchMode('signin')} style={{
                    background: 'none', border: 'none', color: t.pri,
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    padding: '0 0 0 6px', fontWeight: 600,
                  }}>
                    Sign in instead →
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '11px', borderRadius: 8,
              background: t.pri, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
            }}>
              {loading
                ? (mode === 'forgot' ? 'Sending…' : mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'forgot' ? 'Send Reset Link' : mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        )}

        {/* Footer links */}
        <div style={{ marginTop: 18, textAlign: 'center' }}>
          {mode === 'forgot' ? (
            <button onClick={() => switchMode('signin')} style={{
              background: 'none', border: 'none', color: t.pri,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ← Back to Sign In
            </button>
          ) : (
            <p style={{ color: t.muted, fontSize: 11, margin: 0 }}>
              {mode === 'signup'
                ? "After sign-up you'll complete a quick profile setup."
                : 'First time? Switch to "Create Account" above.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
