import { useState } from 'react';
import OverdueSection from './actions/OverdueSection.jsx';
import PromisesSection from './actions/PromisesSection.jsx';
import PocCandidatesSection from './actions/PocCandidatesSection.jsx';
import NewConnectionsSection from './actions/NewConnectionsSection.jsx';
import LinkedInSyncPanel from './actions/LinkedInSyncPanel.jsx';
import ContactDraftSection from './shared/ContactDraftSection.jsx';

export default function ActionsTab({ contacts, updateContact, currentJob, groqKey, t }) {
  const [draftContact, setDraftContact] = useState(null);

  const hasItems = contacts.some(c =>
    ['Accepted','Replied'].includes(c.outreach_status) ||
    (c.promise_made && c.promise_status !== 'kept') ||
    (c.poc_score >= 7 && !c.is_confirmed_poc)
  );

  return (
    <div>
      {!hasItems && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: t.muted, fontSize: 14 }}>
          ✓ Nothing needs attention right now. Check back tomorrow.
        </div>
      )}
      <OverdueSection contacts={contacts} updateContact={updateContact} onDraft={setDraftContact} t={t} />
      <PromisesSection contacts={contacts} updateContact={updateContact} t={t} />
      <PocCandidatesSection contacts={contacts} updateContact={updateContact} t={t} />
      <NewConnectionsSection contacts={contacts} updateContact={updateContact} onDraft={setDraftContact} t={t} />
      <LinkedInSyncPanel t={t} />

      {draftContact && (
        <div style={{ marginTop: 16, padding: 14, border: `1px solid ${t.border}`, borderRadius: 10, background: t.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.tx }}>
              Drafting message for {draftContact.name}
            </div>
            <button onClick={() => setDraftContact(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 18 }}>×</button>
          </div>
          <ContactDraftSection contact={draftContact} currentJob={currentJob} groqKey={groqKey} t={t} />
        </div>
      )}
    </div>
  );
}
