import { useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

const EXTENSION_ID = 'ogcopjeibojihnjgodbdkfehofiblmde';

export default function ConnectExtension({ t }) {
  const [status, setStatus] = useState('idle'); // 'idle'|'connecting'|'connected'|'error'
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleConnect = async () => {
    setStatus('connecting');
    setError(null);
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      if (!session) throw new Error('Not signed in — please sign in first.');

      if (!window.chrome?.runtime?.sendMessage) {
        throw new Error('Chrome extension not detected. Install the JobAgent extension first.');
      }

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          {
            type: 'AUTH_SET',
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user_id: session.user.id,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Extension not installed or not running'));
            } else {
              resolve(res);
            }
          }
        );
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Extension rejected the connection');
      }
      setStatus('connected');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  const pri = t?.pri || '#7c3aed';

  if (!user) {
    return (
      <div style={{maxWidth:480,margin:'48px auto',padding:'24px',textAlign:'center',fontFamily:'inherit'}}>
        <h1 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Sign in to connect</h1>
        <p style={{color:t?.sub||'#6b7280',marginBottom:16}}>You need to be signed in to connect the extension to your account.</p>
        <a href="/" style={{color:pri}}>← Go to sign in</a>
      </div>
    );
  }

  return (
    <div style={{maxWidth:520,margin:'48px auto',padding:'24px',fontFamily:'inherit'}}>
      <h1 style={{fontSize:22,fontWeight:700,marginBottom:8,color:t?.tx||'#111'}}>Connect the JobAgent extension</h1>
      <p style={{color:t?.sub||'#6b7280',marginBottom:24,fontSize:14}}>
        Signed in as <strong>{user.email}</strong>. Click below to authorize the Chrome extension to write to your account.
      </p>

      {status === 'idle' && (
        <button
          onClick={handleConnect}
          style={{padding:'12px 24px',background:pri,color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}
        >
          Connect extension
        </button>
      )}

      {status === 'connecting' && <p style={{color:t?.sub||'#6b7280'}}>Connecting…</p>}

      {status === 'connected' && (
        <div style={{background:'#dcfce7',border:'1px solid #86efac',borderRadius:8,padding:16,color:'#16a34a',fontSize:14}}>
          ✓ Connected. You can close this tab — Mark Applied will now work in the extension.
        </div>
      )}

      {status === 'error' && (
        <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:16,color:'#991b1b',fontSize:14}}>
          <strong>Couldn't connect.</strong> {error}
          <p style={{marginTop:8,marginBottom:0}}>
            <button
              onClick={() => { setStatus('idle'); setError(null); }}
              style={{color:pri,background:'none',border:'none',cursor:'pointer',textDecoration:'underline',fontFamily:'inherit',padding:0,fontSize:14}}
            >
              Try again
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
