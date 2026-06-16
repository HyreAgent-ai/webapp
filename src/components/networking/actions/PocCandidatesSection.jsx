import Avatar from '../shared/Avatar.jsx';

export default function PocCandidatesSection({ contacts, updateContact, t }) {
  const today = new Date().toISOString().split('T')[0];
  const candidates = contacts.filter(c =>
    c.poc_score >= 7 && !c.is_confirmed_poc &&
    (!c.follow_up_snoozed_until || c.follow_up_snoozed_until < today)
  );
  if (candidates.length === 0) return null;

  const handleConfirm = (c) => {
    updateContact(c.id, {
      is_confirmed_poc: true,
      outreach_status: 'Referral Secured',
      outreach_status_changed_at: new Date().toISOString(),
    });
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 1, color: '#db2777', marginBottom: 8 }}>
        ★ POC Candidates Ready to Convert ({candidates.length})
      </div>
      {candidates.map(c => (
        <div key={c.id} style={{ padding: 12, borderRadius: 8, background: '#fce7f3',
          border: '1px solid #f9a8d4', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Avatar name={c.name} size={32} t={t} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: '#9d174d' }}>
                Score {c.poc_score}/10 · {c.relationship_strength} · {c.position} at {c.company}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => handleConfirm(c)}
              style={{ padding: '5px 12px', borderRadius: 6, background: '#db2777', color: '#fff',
                fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
              ★ Confirm as POC
            </button>
            <button onClick={() => updateContact(c.id, {
                follow_up_snoozed_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
              })}
              style={{ padding: '5px 10px', borderRadius: 6, background: '#f1f5f9',
                border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11.5,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Not Yet
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
