import { useState } from 'react';
import { computeContactStats } from '../lib/storage.js';
import FindTab from './networking/FindTab.jsx';
import NetworkTab from './networking/NetworkTab.jsx';
import ActionsTab from './networking/ActionsTab.jsx';

function Chip({ children, active, onClick, t, color }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        background: active ? (color || t.pri) : t.card,
        border: `1px solid ${active ? (color || t.pri) : t.border}`,
        color: active ? '#fff' : t.sub }}>
      {children}
    </button>
  );
}

export default function Networking({ currentJob, contacts, addContact, updateContact,
  contactResults, setContactResults, setPage, groqKey, serperKey, t }) {
  const [tab, setTab] = useState('find');
  const stats = computeContactStats(contacts);
  const actionsBadge = stats.overdue + stats.promisesPending + stats.pocCandidates + stats.newConnections;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.tx }}>Networking</h2>
          <p style={{ margin: 0, fontSize: 14, color: t.sub }}>
            {contacts.filter(c => c.outreach_sent).length} contacts · {stats.overdue} overdue
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip active={tab === 'find'} onClick={() => setTab('find')} t={t}>Find Contacts</Chip>
          <Chip active={tab === 'network'} onClick={() => setTab('network')} t={t}>
            My Network <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 800 }}>
              {contacts.length}
            </span>
          </Chip>
          <Chip active={tab === 'actions'} onClick={() => setTab('actions')} t={t}
            color={actionsBadge > 0 ? '#dc2626' : undefined}>
            Actions
            {actionsBadge > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, padding: '1px 6px',
                borderRadius: 10, background: '#dc262622', color: '#dc2626' }}>
                {actionsBadge}
              </span>
            )}
          </Chip>
        </div>
      </div>

      {tab === 'find' && (
        <FindTab currentJob={currentJob} contacts={contacts}
          addContact={addContact} groqKey={groqKey} serperKey={serperKey} t={t} />
      )}
      {tab === 'network' && (
        <NetworkTab contacts={contacts} updateContact={updateContact}
          currentJob={currentJob} groqKey={groqKey} t={t} />
      )}
      {tab === 'actions' && (
        <ActionsTab contacts={contacts} updateContact={updateContact}
          currentJob={currentJob} groqKey={groqKey} t={t} />
      )}
    </div>
  );
}
