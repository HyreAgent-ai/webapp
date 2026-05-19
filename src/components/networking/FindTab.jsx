import { useState, useEffect } from 'react';
import { Users, Linkedin, Mail, Send } from 'lucide-react';
import { supabase } from '../../supabase.js';
import Avatar from './shared/Avatar.jsx';
import ContactDraftSection from './shared/ContactDraftSection.jsx';

const PERSONAS = ['Recruiter','Hiring Manager','Peer Engineer','Executive','UIUC Alumni','Senior Engineer'];

// Local style helpers (follow project conventions)
function Card({ children, t, style }) {
  return <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 18, ...style }}>{children}</div>;
}
function SectionLabel({ children, t }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>{children}</div>;
}
function Btn({ children, onClick, disabled, t, size, variant, style }) {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: size === 'sm' ? '6px 14px' : '10px 20px', borderRadius: 8, fontSize: size === 'sm' ? 12.5 : 13.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', border: 'none', ...style };
  const colors = variant === 'green' ? { background: t.greenL, color: t.green, border: `1px solid ${t.greenBd}` } : { background: t.pri, color: '#fff' };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...colors }}>{children}</button>;
}
function Input({ label, value, onChange, t }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: t.sub, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
      <input value={value} onChange={onChange} style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 13px', color: t.tx, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );
}

export default function FindTab({ currentJob, contacts, addContact, groqKey, serperKey, t }) {
  const [co, setCo]       = useState(currentJob?.company || '');
  const [role, setRole]   = useState(currentJob?.role || '');
  const [loc, setLoc]     = useState(currentJob?.location || '');
  const [selectedPersonas, setSelectedPersonas] = useState(['Recruiter', 'Hiring Manager', 'Peer Engineer', 'UIUC Alumni']);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    if (currentJob) {
      setCo(currentJob.company || '');
      setRole(currentJob.role || '');
      setLoc(currentJob.location || '');
    }
  }, [currentJob?.id]);

  const addedIds = new Set(contacts.map(c => c.id));

  const findContacts = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/find-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ company: co, role, location: loc, personas: selectedPersonas }),
      });
      if (!res.ok) {
        const txt = await res.text();
        let msg = `HTTP ${res.status}`;
        try { msg = JSON.parse(txt).error || msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('No contacts found. Try different company name.');
      setResults(data);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const handleAddToNetwork = (c) => {
    addContact({
      id: c.id,
      name: c.name || c.type,
      company: c.company || co,
      position: c.title || c.type || '',
      linkedin_url: c.linkedin_url || c.linkedinUrl || '',
      email: c.email && c.email !== 'NA' ? c.email : null,
      persona: c.type || null,
      source: 'find_contacts',
      outreach_sent: true,
      outreach_date: new Date().toISOString().split('T')[0],
      outreach_status: 'Sent',
      outreach_status_changed_at: new Date().toISOString(),
    });
  };

  return (
    <div>
      <Card t={t} style={{ marginBottom: 20 }}>
        <SectionLabel t={t}>Find Contacts</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Input label="Company" value={co} onChange={e => setCo(e.target.value)} t={t} />
          <Input label="Role" value={role} onChange={e => setRole(e.target.value)} t={t} />
          <Input label="Location" value={loc} onChange={e => setLoc(e.target.value)} t={t} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: t.sub, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Target Personas</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setPersonasOpen(p => !p)}
                style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 13px', color: selectedPersonas.length ? t.tx : t.muted, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                  {selectedPersonas.length ? selectedPersonas.join(', ') : 'Select personas'}
                </span>
                <span style={{ fontSize: 10, flexShrink: 0 }}>▾</span>
              </button>
              {personasOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, zIndex: 100, padding: 8, boxShadow: t.shadow }}>
                  {PERSONAS.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 13, color: t.tx, borderRadius: 6, background: selectedPersonas.includes(p) ? t.hover : 'transparent' }}>
                      <input type="checkbox" checked={selectedPersonas.includes(p)}
                        onChange={e => setSelectedPersonas(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))}
                        style={{ accentColor: t.pri }} />
                      {p}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <Btn onClick={() => { setPersonasOpen(false); findContacts(); }} disabled={loading || !co || selectedPersonas.length === 0} t={t}>
          {loading ? 'Searching...' : `Find ${selectedPersonas.length} Contact${selectedPersonas.length !== 1 ? 's' : ''}`}
        </Btn>
        {loading && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '20px 0' }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: t.pri, animation: `lp-dot .8s ${i * .15}s ease-in-out infinite`, opacity: .3 }} />)}
          </div>
        )}
        {err && <div style={{ color: t.red, fontSize: 13, fontWeight: 600, marginTop: 12 }}>{err}</div>}
      </Card>

      {results.length > 0 && (
        <div>
          <SectionLabel t={t}>Contacts Found ({results.length})</SectionLabel>
          {results.map(c => {
            const isAdded = addedIds.has(c.id);
            const linkedinUrl = c.linkedin_url || c.linkedinUrl || '';
            return (
              <Card key={c.id} t={t} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <Avatar name={c.name || c.type} size={42} t={t} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: t.tx }}>{c.name || c.type}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.priL, color: t.pri }}>{c.personaSlot || c.type}</span>
                      {c.uiuc && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.greenL, color: t.green }}>UIUC Alumni</span>}
                      {isAdded && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.greenL, color: t.green }}>Added ✓</span>}
                    </div>
                    <div style={{ fontSize: 13, color: t.muted }}>{c.title || c.type} at {c.company}</div>
                    {c.email && c.email !== 'NA' && c.email !== '' && (
                      <div style={{ fontSize: 12, color: t.sub, marginTop: 2 }}>
                        <Mail size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />{c.email}
                      </div>
                    )}
                    {c.why && <div style={{ fontSize: 12, color: t.muted, marginTop: 4, fontStyle: 'italic' }}>{c.why}</div>}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                      {linkedinUrl && (
                        <a href={linkedinUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#0077B5', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                          <Linkedin size={14} /> LinkedIn Profile
                        </a>
                      )}
                      {!isAdded ? (
                        <Btn size="sm" variant="green" onClick={() => handleAddToNetwork(c)} t={t}>
                          <Send size={12} /> Add to Network
                        </Btn>
                      ) : (
                        <Btn size="sm" disabled t={t} style={{ opacity: 0.5 }}>
                          Already Added
                        </Btn>
                      )}
                    </div>
                    <ContactDraftSection contact={c} currentJob={currentJob} groqKey={groqKey} t={t} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {results.length === 0 && !loading && (
        <Card t={t} style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Users size={32} color={t.muted} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.sub }}>Search for contacts above.</div>
        </Card>
      )}
    </div>
  );
}
