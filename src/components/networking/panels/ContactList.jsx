import { useState } from 'react';
import { Search, X } from 'lucide-react';
import Avatar from '../shared/Avatar.jsx';

const STATUS_OPTS = ['All','Sent','Accepted','Replied','Coffee Chat','Referral Secured','Cold'];

function urgencyScore(c) {
  const today = new Date();
  const last = c.last_contact ? new Date(c.last_contact) : null;
  const days = last ? Math.floor((today - last) / 86400000) : 999;
  const snoozed = c.follow_up_snoozed_until && new Date(c.follow_up_snoozed_until) >= today;
  const overdue = !snoozed && ['Accepted','Replied'].includes(c.outreach_status) && days >= 7;
  if (overdue && c.follow_up_priority === 'urgent') return 100;
  if (overdue) return 80;
  if (c.is_confirmed_poc) return 60;
  if (c.is_poc_candidate) return 50;
  if (c.conversation_stage === 'Strong Rapport') return 40;
  return days > 0 ? Math.max(0, 30 - days) : 0;
}

function borderColor(c, t) {
  const today = new Date();
  const last = c.last_contact ? new Date(c.last_contact) : null;
  const days = last ? Math.floor((today - last) / 86400000) : 999;
  const snoozed = c.follow_up_snoozed_until && new Date(c.follow_up_snoozed_until) >= today;
  const overdue = !snoozed && ['Accepted','Replied'].includes(c.outreach_status) && days >= 7;
  if (overdue && c.follow_up_priority === 'urgent') return '#dc2626';
  if (c.is_confirmed_poc) return '#db2777';
  if (c.is_poc_candidate) return '#e11d63';
  if (c.conversation_stage === 'Strong Rapport') return t.green;
  if (overdue) return t.yellow;
  return undefined;
}

export default function ContactList({ contacts, selectedId, onSelect, t }) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPoc, setFilterPoc] = useState('All'); // All | poc | follow-up

  const today = new Date();

  const filtered = [...contacts]
    .filter(c => {
      if (filterStatus !== 'All' && c.outreach_status !== filterStatus) return false;
      if (filterPoc === 'poc' && !c.is_confirmed_poc && !c.is_poc_candidate) return false;
      if (filterPoc === 'follow-up') {
        const snoozed = c.follow_up_snoozed_until && new Date(c.follow_up_snoozed_until) >= today;
        if (snoozed || !c.follow_up) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [c.name, c.company, c.position, c.persona].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => urgencyScore(b) - urgencyScore(a));

  const outreached = contacts.filter(c => c.outreach_sent);
  const followUpCount = outreached.filter(c => {
    const snoozed = c.follow_up_snoozed_until && new Date(c.follow_up_snoozed_until) >= today;
    return !snoozed && c.follow_up;
  }).length;
  const pocCount = contacts.filter(c => c.is_confirmed_poc || c.is_poc_candidate).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter chips */}
      <div style={{ padding: '10px 10px 6px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {[
          { label: 'All', key: 'All' },
          { label: `Follow-up${followUpCount > 0 ? ` ${followUpCount}` : ''}`, key: 'follow-up' },
          { label: `POC${pocCount > 0 ? ` ${pocCount}` : ''}`, key: 'poc' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterPoc(f.key)}
            style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10.5, fontWeight: 700,
              background: filterPoc === f.key ? t.pri : t.card,
              border: `1px solid ${filterPoc === f.key ? t.pri : t.border}`,
              color: filterPoc === f.key ? '#fff' : t.sub, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f.label}
          </button>
        ))}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '3px 6px', borderRadius: 8, fontSize: 10.5, background: t.bg,
            border: `1px solid ${t.border}`, color: t.sub, fontFamily: 'inherit', outline: 'none' }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {/* Search */}
      <div style={{ padding: '7px 10px', borderBottom: `1px solid ${t.border}`, position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: t.muted }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…"
          style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6,
            padding: '6px 10px 6px 28px', color: t.tx, fontSize: 12, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box' }} />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: t.muted, padding: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>
      {/* Contact rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.muted }}>No contacts found.</div>
        )}
        {filtered.map(c => {
          const last = c.last_contact ? new Date(c.last_contact) : null;
          const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
          const bd = borderColor(c, t);
          return (
            <div key={c.id} onClick={() => onSelect(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                borderBottom: `1px solid ${t.border}`, cursor: 'pointer',
                background: selectedId === c.id ? t.priL : 'transparent',
                borderLeft: bd ? `3px solid ${bd}` : '3px solid transparent' }}>
              <Avatar name={c.name} size={32} t={t} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: selectedId === c.id ? 700 : 600, fontSize: 12.5,
                  color: t.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[c.company, c.position].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {days !== null && (
                  <div style={{ fontSize: 10, color: days >= 7 ? t.red : t.muted, fontWeight: days >= 7 ? 700 : 400 }}>
                    {days}d
                  </div>
                )}
                {c.is_confirmed_poc && <div style={{ fontSize: 10, color: '#db2777' }}>★ POC</div>}
                {!c.is_confirmed_poc && c.outreach_status && (
                  <div style={{ fontSize: 10, color: t.muted }}>{c.outreach_status}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
