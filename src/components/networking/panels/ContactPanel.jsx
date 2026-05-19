import { useState, useEffect } from 'react';
import { Linkedin } from 'lucide-react';
import Avatar from '../shared/Avatar.jsx';
import StatusBadge, { STATUS_COLORS } from '../shared/StatusBadge.jsx';
import ContactDraftSection from '../shared/ContactDraftSection.jsx';

const STATUS_OPTS = ['Sent','Accepted','Replied','Coffee Chat','Referral Secured','Cold'];

export default function ContactPanel({ contact, updateContact, currentJob, groqKey, t }) {
  const [noteVal, setNoteVal] = useState(contact?.notes || '');
  const [showDraft, setShowDraft] = useState(false);

  useEffect(() => {
    setNoteVal(contact?.notes || '');
  }, [contact?.id]);

  if (!contact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: t.muted, fontSize: 13 }}>
        Select a contact to view details
      </div>
    );
  }

  const last = contact.last_contact ? new Date(contact.last_contact) : null;
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  const sc = STATUS_COLORS[contact.outreach_status] || STATUS_COLORS['Sent'];

  const handleNoteBlur = () => {
    if (noteVal !== (contact.notes || '')) {
      updateContact(contact.id, { notes: noteVal });
    }
  };

  const handleStatusChange = (status) => {
    updateContact(contact.id, {
      outreach_status: status,
      outreach_status_changed_at: new Date().toISOString(),
    });
  };

  return (
    <div style={{ padding: 16, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Avatar name={contact.name} size={44} t={t} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.tx }}>{contact.name}</div>
            <div style={{ fontSize: 12, color: t.muted }}>
              {[contact.position, contact.company].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        {contact.linkedin_url && (
          <a href={contact.linkedin_url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
              borderRadius: 6, background: '#0077B5', color: '#fff', fontWeight: 600,
              fontSize: 11.5, textDecoration: 'none' }}>
            <Linkedin size={12} /> LinkedIn
          </a>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</span>
        <select value={contact.outreach_status || 'Sent'} onChange={e => handleStatusChange(e.target.value)}
          style={{ background: sc.bg, border: `1px solid ${sc.bd}`, borderRadius: 7,
            padding: '4px 8px', color: sc.tx, fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {days !== null && (
          <span style={{ fontSize: 11, color: days >= 7 ? t.red : t.muted, fontWeight: days >= 7 ? 700 : 400, marginLeft: 'auto' }}>
            {days}d ago
          </span>
        )}
      </div>

      {/* Badge row */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        {contact.conversation_stage && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
            background: t.priL, color: t.pri }}>{contact.conversation_stage}</span>
        )}
        {contact.relationship_strength && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
            background: t.greenL, color: t.green }}>{contact.relationship_strength}</span>
        )}
        {contact.is_confirmed_poc && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 8,
            background: '#fce7f3', color: '#db2777' }}>★ Confirmed POC</span>
        )}
        {!contact.is_confirmed_poc && contact.is_poc_candidate && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
            background: '#fff1f5', color: '#e11d63' }}>◆ POC Candidate</span>
        )}
      </div>

      {/* Intel stats */}
      {(contact.poc_score || contact.message_count) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {contact.poc_score > 0 && (
            <div style={{ flex: 1, padding: '8px', background: t.hover, borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 11 }}>
              <div style={{ color: t.muted, marginBottom: 2 }}>POC Score</div>
              <div style={{ fontWeight: 700, color: '#db2777', fontSize: 16 }}>{contact.poc_score}/10</div>
            </div>
          )}
          {contact.message_count > 0 && (
            <div style={{ flex: 1, padding: '8px', background: t.hover, borderRadius: 6, border: `1px solid ${t.border}`, fontSize: 11 }}>
              <div style={{ color: t.muted, marginBottom: 2 }}>Messages</div>
              <div style={{ fontWeight: 700, color: t.tx, fontSize: 16 }}>
                {contact.message_count}{contact.two_way_conversation ? ' ⇄' : ''}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Promise alert */}
      {contact.promise_made && contact.promise_text && contact.promise_status !== 'kept' && (
        <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 6,
          background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 11.5, color: '#92400e' }}>
          <span style={{ fontWeight: 700 }}>Promise: </span>{contact.promise_text}
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          color: t.muted, marginBottom: 4, letterSpacing: 1 }}>Notes</div>
        <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)} onBlur={handleNoteBlur}
          rows={3} placeholder="Add notes…"
          style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '8px 10px', color: t.tx, fontSize: 12.5, fontFamily: 'inherit',
            resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.6 }} />
      </div>

      {/* Draft toggle */}
      <button onClick={() => setShowDraft(v => !v)}
        style={{ width: '100%', padding: '9px 14px', borderRadius: 8, background: t.greenL,
          border: `1px solid ${t.greenBd}`, color: t.green, fontSize: 12.5,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: showDraft ? 0 : 8 }}>
        ✨ {showDraft ? 'Hide' : 'Draft Follow-up Message'}
      </button>
      {showDraft && (
        <ContactDraftSection contact={contact} currentJob={currentJob} groqKey={groqKey} t={t} />
      )}
    </div>
  );
}
