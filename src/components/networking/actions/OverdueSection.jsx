import { Linkedin, Sparkles } from 'lucide-react';
import Avatar from '../shared/Avatar.jsx';

export default function OverdueSection({ contacts, updateContact, onDraft, t }) {
  const today = new Date();
  const overdue = contacts.filter(c => {
    if (!['Accepted','Replied'].includes(c.outreach_status)) return false;
    const snoozed = c.follow_up_snoozed_until && new Date(c.follow_up_snoozed_until) >= today;
    if (snoozed) return false;
    const last = c.last_contact ? new Date(c.last_contact) : null;
    return last && Math.floor((Date.now() - last) / 86400000) >= 7;
  });

  if (overdue.length === 0) return null;

  const handleFollowedUp = (c) => {
    const snoozedUntil = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    updateContact(c.id, { follow_up_snoozed_until: snoozedUntil });
  };

  const handleDismiss = (c) => {
    const snoozedUntil = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    updateContact(c.id, { follow_up_snoozed_until: snoozedUntil });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: '#dc2626', marginBottom: 8 }}>
        🔴 Overdue Follow-ups ({overdue.length})
      </div>
      {overdue.map(c => {
        const days = Math.floor((Date.now() - new Date(c.last_contact)) / 86400000);
        return (
          <div key={c.id} style={{ padding: 12, borderRadius: 8, background: '#fef2f2',
            border: '1px solid #fecaca', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Avatar name={c.name} size={32} t={t} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    {c.outreach_status} · {c.company} · {days}d ago
                  </div>
                </div>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: 10, background: '#fee2e2',
                color: '#dc2626', fontSize: 10, fontWeight: 800, alignSelf: 'flex-start' }}>
                🔴 Overdue
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                    borderRadius: 6, background: '#0077B5', color: '#fff', fontWeight: 600,
                    fontSize: 11.5, textDecoration: 'none' }}>
                  <Linkedin size={11} /> LinkedIn
                </a>
              )}
              <button onClick={() => onDraft(c)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                  borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac',
                  color: '#15803d', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Sparkles size={11} /> Draft Message
              </button>
              <button onClick={() => handleFollowedUp(c)}
                style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
                  background: '#15803d', color: '#fff', fontSize: 11.5,
                  fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
                ✓ I Followed Up
              </button>
              <button onClick={() => handleDismiss(c)}
                style={{ padding: '5px 10px', borderRadius: 6, background: '#f1f5f9',
                  border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11.5,
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ Not Yet
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
