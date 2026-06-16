import { useState } from 'react';
import ContactList from './panels/ContactList.jsx';
import ContactPanel from './panels/ContactPanel.jsx';

export default function NetworkTab({ contacts, updateContact, currentJob, groqKey, t }) {
  const [selected, setSelected] = useState(null);

  // When a contact is updated, sync the selected view
  const handleUpdateContact = (id, fields) => {
    updateContact(id, fields);
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...fields }));
  };

  return (
    <div style={{ display: 'flex', border: `1px solid ${t.border}`, borderRadius: 12,
      overflow: 'hidden', background: t.card, minHeight: 500 }}>
      {/* Left panel — contact list */}
      <div style={{ width: '40%', minWidth: 260, borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.border}`,
          fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          My Network · {contacts.length}
        </div>
        <ContactList
          contacts={contacts}
          selectedId={selected?.id}
          onSelect={setSelected}
          t={t}
        />
      </div>
      {/* Right panel — contact detail */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ContactPanel
          contact={selected}
          updateContact={handleUpdateContact}
          currentJob={currentJob}
          groqKey={groqKey}
          t={t}
        />
      </div>
    </div>
  );
}
