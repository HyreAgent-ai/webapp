import { useState } from 'react';
import { MessageSquare, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { draftMessageWithGroq } from '../../../lib/groq.js';

const PERSONAS = ['Recruiter','Hiring Manager','Peer Engineer','Executive','UIUC Alumni','Senior Engineer'];
const INTENTS = [
  { value: 'job_application_ask', label: 'Job Application Ask' },
  { value: 'cold_outreach', label: 'Cold Outreach' },
];
const FORMATS = [
  { value: 'connection_note', label: 'Connection Note',   limitType: 'chars', max: 300 },
  { value: 'followup',        label: 'Follow-up Message', limitType: 'words', max: 100 },
  { value: 'cold_email',      label: 'Cold Email',        limitType: 'words', max: 150 },
];
const FORMAT_HINTS = {
  connection_note: 'Context only — WHY you are connecting. No metrics, no stats. 300 chars max.',
  followup:        'Thank for connecting, why reaching out, one stat, clear ask. 100 words max.',
  cold_email:      'Intro, composites stat, STEM OPT line, clear ask. 150 words max.',
};

function robustCopy(text) {
  if (!text) return Promise.reject('Nothing to copy');
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.resolve();
}

// Minimal Btn component used in this file only
function Btn({ children, onClick, disabled, t, size, variant, style }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: size === 'sm' ? '6px 12px' : '8px 16px',
    borderRadius: 7, fontSize: size === 'sm' ? 12 : 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit', border: 'none', ...style,
  };
  const colors = variant === 'green'
    ? { background: t.greenL, color: t.green, border: `1px solid ${t.greenBd}` }
    : variant === 'secondary'
    ? { background: t.hover, color: t.sub, border: `1px solid ${t.border}` }
    : { background: t.pri, color: '#fff' };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...colors }}>{children}</button>;
}

export default function ContactDraftSection({ contact, currentJob, groqKey, t }) {
  const autoPersona = contact.uiuc ? 'UIUC Alumni' : (contact.type || 'Peer Engineer');
  const [persona, setPersona]     = useState(PERSONAS.includes(autoPersona) ? autoPersona : 'Peer Engineer');
  const [intent, setIntent]       = useState('job_application_ask');
  const [format, setFormat]       = useState('connection_note');
  const [draft, setDraft]         = useState('');
  const [copied, setCopied]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError]     = useState('');
  const [regenNote, setRegenNote] = useState('');

  const selectedFormat = FORMATS.find(f => f.value === format) || FORMATS[0];
  const charCount = draft.length;
  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const limitVal  = selectedFormat.limitType === 'chars' ? charCount : wordCount;
  const overLimit = limitVal > selectedFormat.max;

  const generateDraft = async () => {
    if (!groqKey) { setAiError('Add your Groq API key in Settings to enable AI drafting.'); return; }
    setAiError('');
    setGenerating(true);
    try {
      const result = await draftMessageWithGroq(persona, intent, format, contact, currentJob, groqKey, regenNote);
      setDraft(result);
      setRegenNote('');
    } catch(e) {
      setAiError('AI draft failed: ' + e.message);
    }
    setGenerating(false);
  };

  const handleCopy = () => {
    robustCopy(draft).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const sel = {background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:'8px 11px',color:t.tx,fontSize:12.5,fontFamily:'inherit',outline:'none',width:'100%'};

  return (
    <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
      <div style={{fontSize:11,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <MessageSquare size={12}/> Draft Message
        {groqKey && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:t.yellowL,color:t.yellow}}>Groq AI</span>}
        {contact.uiuc && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:t.greenL,color:t.green}}>UIUC Alumni</span>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,marginBottom:10,alignItems:"end"}}>
        <div>
          <label style={{fontSize:10,fontWeight:700,color:t.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Persona</label>
          <select value={persona} onChange={e => setPersona(e.target.value)} style={sel}>
            {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:700,color:t.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Intent</label>
          <select value={intent} onChange={e => setIntent(e.target.value)} style={sel}>
            {INTENTS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:10,fontWeight:700,color:t.muted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Format</label>
          <select value={format} onChange={e => { setFormat(e.target.value); setDraft(''); }} style={sel}>
            {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <Btn size="sm" onClick={generateDraft} disabled={generating || !groqKey} t={t} style={{height:36,alignSelf:"end"}}>
          {generating ? <><RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/> Drafting...</> : <><Sparkles size={12}/> Draft</>}
        </Btn>
      </div>

      <div style={{fontSize:11.5,color:t.muted,marginBottom:10,padding:"5px 10px",background:t.hover,borderRadius:6}}>
        {FORMAT_HINTS[format]}
      </div>

      {!groqKey && (
        <div style={{fontSize:12,color:t.yellow,marginBottom:10,padding:"7px 11px",background:t.yellowL,borderRadius:6,border:`1px solid ${t.yellowBd}`}}>
          Add Groq API key in Settings to enable AI drafting.
        </div>
      )}
      {aiError && <div style={{fontSize:12,color:t.red,marginBottom:8,fontWeight:600}}>{aiError}</div>}

      {draft && (
        <div>
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            rows={format === 'cold_email' ? 9 : 5}
            style={{width:"100%",background:t.bg,border:`1px solid ${overLimit ? t.red : t.border}`,borderRadius:8,padding:"10px 14px",color:t.tx,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",lineHeight:1.6}}
          />
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
            <span style={{fontSize:11.5,fontWeight:700,color:overLimit ? t.red : t.green}}>
              {selectedFormat.limitType === 'chars'
                ? `${limitVal} / ${selectedFormat.max} chars${overLimit ? ' — OVER LIMIT' : ' — OK'}`
                : `${limitVal} / ${selectedFormat.max} words${overLimit ? ' — OVER LIMIT' : ' — OK'}`}
            </span>
            <Btn size="sm" variant="green" onClick={handleCopy} t={t}>
              {copied ? <><Check size={12}/> Copied!</> : <><Copy size={12}/> Copy</>}
            </Btn>
          </div>

          <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center"}}>
            <input
              value={regenNote}
              onChange={e => setRegenNote(e.target.value)}
              placeholder='Regeneration direction, e.g. "make shorter" or "focus on quality background"'
              onKeyDown={e => { if (e.key === 'Enter' && regenNote.trim()) generateDraft(); }}
              style={{flex:1,background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 12px",color:t.tx,fontSize:12.5,fontFamily:"inherit",outline:"none"}}
            />
            <Btn size="sm" variant="secondary" onClick={generateDraft} disabled={generating || !groqKey} t={t}>
              <RefreshCw size={11}/> Redo
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
