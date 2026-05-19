import { Linkedin } from 'lucide-react';
import Avatar from '../shared/Avatar.jsx';

export default function PromisesSection({ contacts, updateContact, t }) {
  const pending = contacts.filter(c => c.promise_made && c.promise_status !== 'kept' && c.promise_status !== 'dismissed');
  if (pending.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: '#c2410c', marginBottom: 8 }}>
        🟠 Promises Pending ({pending.length})
      </div>
      {pending.map(c => (
        <div key={c.id} style={{ padding: 12, borderRadius: 8, background: '#fff7ed',
          border: '1px solid #fed7aa', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <Avatar name={c.name} size={32} t={t} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 2 }}>"{c.promise_text}"</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {c.linkedin_url && (
              <a href={c.linkedin_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  borderRadius: 6, background: '#0077B5', color: '#fff',
                  fontWeight: 600, fontSize: 11.5, textDecoration: 'none' }}>
                <Linkedin size={11} /> LinkedIn
              </a>
            )}
            <button onClick={() => updateContact(c.id, { promise_status: 'kept' })}
              style={{ padding: '5px 12px', borderRadius: 6, background: '#15803d', color: '#fff',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
              ✓ Promise Kept
            </button>
            <button onClick={() => updateContact(c.id, { promise_status: 'dismissed' })}
              style={{ padding: '5px 10px', borderRadius: 6, background: '#fff',
                border: '1px solid #fed7aa', color: '#c2410c', fontSize: 11.5,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✕ Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
