import { Linkedin, Sparkles } from 'lucide-react';
import Avatar from '../shared/Avatar.jsx';

export default function NewConnectionsSection({ contacts, updateContact, onDraft, t }) {
  const recent = contacts.filter(c => {
    if (c.outreach_status !== 'Accepted') return false;
    if (!c.outreach_status_changed_at) return false;
    return Math.floor((Date.now() - new Date(c.outreach_status_changed_at)) / 86400000) <= 7;
  });
  if (recent.length === 0) return null;

  const handleMessageSent = (c) => {
    updateContact(c.id, {
      outreach_status: 'Replied',
      last_contact: new Date().toISOString().split('T')[0],
      follow_up_snoozed_until: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      outreach_status_changed_at: new Date().toISOString(),
    });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: '#16a34a', marginBottom: 8 }}>
        🟢 New Connections — Send First Message ({recent.length})
      </div>
      {recent.map(c => {
        const days = Math.floor((Date.now() - new Date(c.outreach_status_changed_at)) / 86400000);
        return (
          <div key={c.id} style={{ padding: 12, borderRadius: 8, background: '#f0fdf4',
            border: '1px solid #86efac', marginBottom: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Avatar name={c.name} size={32} t={t} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: '#166534' }}>
                  Accepted {days}d ago · {c.persona} · {c.company}
                </div>
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
              <button onClick={() => onDraft(c)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  borderRadius: 6, background: '#fff', border: '1px solid #86efac',
                  color: '#15803d', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Sparkles size={11} /> Draft
              </button>
              <button onClick={() => handleMessageSent(c)}
                style={{ padding: '5px 12px', borderRadius: 6, background: '#15803d', color: '#fff',
                  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                ✓ Message Sent
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
