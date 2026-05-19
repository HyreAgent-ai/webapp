import { useState, useEffect, useRef } from 'react';
import { Plus, Star, Trash2, Edit3, BarChart2, ChevronLeft, Loader, CheckCircle, AlertCircle, X, Upload } from 'lucide-react';
import { fetchResumes, fetchResume, upsertResume, deleteResume, setPrimaryResume, saveResumeAnalysis } from '../lib/storage.js';
import { analyzeResumeWithGroq, parseResumeTextWithGroq } from '../lib/groq.js';
import { supabase } from '../supabase.js';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

const COMPILER_URL = import.meta.env.VITE_COMPILER_URL || 'https://resume-compiler-1077806152183.us-central1.run.app';

// ── Helpers ────────────────────────────────────────────────────────────────────
function emptyResume(profile) {
  return {
    summary: '',
    experience: (profile?.experience_bullets || []).map((eb, i) => ({
      id: `exp-${i}`,
      company: eb.company || '',
      role: eb.role || '',
      location: '',
      start_date: '',
      end_date: '',
      current: false,
      bullets: eb.metric ? [eb.metric] : [],
    })),
    education: [{ id: 'edu-0', school: '', degree: '', field: '', start_date: '', end_date: '', gpa: '' }],
    skills: [
      { id: 'sk-0', category: 'Engineering Tools', items: (profile?.tool_list || []) },
      { id: 'sk-1', category: 'Technical Skills', items: [] },
      { id: 'sk-2', category: 'Soft Skills', items: [] },
    ],
  };
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function Card({ children, t, style }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20, boxShadow: t.shadow, ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', t, style: xs }) {
  const V = {
    primary:   { bg: t.pri,    c: '#fff',  b: 'none' },
    secondary: { bg: 'transparent', c: t.sub,  b: `1px solid ${t.border}` },
    ghost:     { bg: 'transparent', c: t.muted, b: `1px solid ${t.border}` },
    yellow:    { bg: t.yellowL, c: t.yellow, b: `1px solid ${t.yellowBd}` },
    red:       { bg: t.redL,    c: t.red,   b: `1px solid ${t.redBd}` },
    danger:    { bg: t.red,     c: '#fff',  b: 'none' },
  };
  const s = V[variant] || V.primary;
  const p = size === 'sm' ? '5px 12px' : '9px 18px';
  const fs = size === 'sm' ? 12 : 13.5;
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: s.bg, color: s.c, border: s.b, padding: p, borderRadius: 8, fontSize: fs, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, ...xs }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, t, style: xs }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder} style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.tx, borderRadius: 7, padding: '7px 11px', fontSize: 13.5, width: '100%', fontFamily: 'inherit', outline: 'none', ...xs }} />
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, t, style: xs }) {
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.tx, borderRadius: 7, padding: '8px 11px', fontSize: 13.5, width: '100%', fontFamily: 'inherit', resize: 'vertical', outline: 'none', ...xs }} />
  );
}

// ── Normalize sections from any parse source into editor-compatible shape ─────
function normalizeParsedSections(raw) {
  return {
    summary: raw.summary || '',
    experience: (raw.experience || []).map((exp, i) => ({
      id: `exp-${i}`,
      company:    exp.company    || '',
      role:       exp.role       || '',
      location:   exp.location   || '',
      start_date: exp.start_date || exp.date_range || '',
      end_date:   exp.end_date   || '',
      current:    false,
      bullets:    exp.bullets    || [],
    })),
    education: (raw.education || []).map((edu, i) => ({
      id:         `edu-${i}`,
      school:     edu.school     || '',
      degree:     edu.degree     || '',
      field:      edu.field      || '',
      start_date: edu.start_date || edu.date_range || '',
      end_date:   edu.end_date   || '',
      gpa:        edu.gpa        || '',
    })),
    skills: (raw.skills || []).map((sk, i) => ({
      id:       `sk-${i}`,
      category: sk.category || '',
      items:    sk.items    || [],
    })),
  };
}

// ── Upload helper ─────────────────────────────────────────────────────────────
async function parseUploadedResume(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error('File too large. Max 5MB.');

  if (file.name.endsWith('.tex')) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not signed in.');
    const text = await file.text();
    const res = await fetch(`${COMPILER_URL}/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'Authorization': `Bearer ${session.access_token}` },
      body: text,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`LaTeX parse failed: ${res.status}`);
    const data = await res.json();
    return normalizeParsedSections(data);
  }

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    if (!fullText.trim()) throw new Error('Could not extract text from PDF. Try uploading as .tex.');
    const raw = await parseResumeTextWithGroq(fullText);
    return normalizeParsedSections(raw);
  }

  throw new Error('Please upload a .tex or .pdf file.');
}

// ── View 1: Resume List ───────────────────────────────────────────────────────
function ResumeList({ resumes, onNew, onUpload, onEdit, onDelete, onSetPrimary, onReport, uploading, loading, t }) {
  const fileInputRef = useRef(null);
  const count = resumes.length;

  if (!loading && count === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
        <Card t={t} style={{ textAlign: 'center', padding: '48px 40px', maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: t.tx, marginBottom: 8 }}>No resumes yet</div>
          <div style={{ color: t.muted, fontSize: 13.5, marginBottom: 24 }}>Upload your .tex or PDF, or build one from scratch.</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading} t={t}>
              {uploading ? <><Loader size={14} /> Parsing…</> : <><Upload size={14} /> Upload .tex / PDF</>}
            </Btn>
            <Btn onClick={onNew} t={t}><Plus size={15} /> New Resume</Btn>
          </div>
          <input ref={fileInputRef} type="file" accept=".tex,.pdf" style={{ display: 'none' }}
            onChange={e => { onUpload(e.target.files[0]); e.target.value = ''; }} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: t.tx, fontWeight: 700, fontSize: 20 }}>Resumes</h2>
          <div style={{ color: t.muted, fontSize: 13, marginTop: 3 }}>{count}/5 resumes · Primary is used in Job Analysis</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={count >= 5 || uploading} t={t}>
            {uploading ? <><Loader size={14} /> Parsing…</> : <><Upload size={14} /> Upload</>}
          </Btn>
          <Btn onClick={onNew} disabled={count >= 5} t={t}><Plus size={15} /> New</Btn>
          <input ref={fileInputRef} type="file" accept=".tex,.pdf" style={{ display: 'none' }}
            onChange={e => { onUpload(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      {loading && <div style={{ color: t.muted, textAlign: 'center', padding: 40 }}><Loader size={20} /></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {resumes.map(r => {
          const score = r.analysis_report?.score;
          const scoreColor = score === 'A' ? t.green : score === 'B' ? t.pri : score === 'C' ? t.yellow : score === 'D' ? t.red : t.muted;
          const scoreBg   = score === 'A' ? t.greenL : score === 'B' ? t.priL : score === 'C' ? t.yellowL : score === 'D' ? t.redL : 'transparent';
          const scoreBd   = score === 'A' ? t.greenBd : score === 'B' ? t.priBd : score === 'C' ? t.yellowBd : score === 'D' ? t.redBd : t.border;
          return (
            <Card key={r.id} t={t} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px' }}>
              {/* Left: info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: t.tx, fontSize: 15 }}>{r.name}</span>
                  {r.is_primary && (
                    <span style={{ background: t.priL, color: t.pri, border: `1px solid ${t.priBd}`, borderRadius: 5, padding: '2px 8px', fontSize: 11.5, fontWeight: 700 }}>
                      <Star size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />Primary
                    </span>
                  )}
                  {score && (
                    <span style={{ background: scoreBg, color: scoreColor, border: `1px solid ${scoreBd}`, borderRadius: 5, padding: '2px 8px', fontSize: 11.5, fontWeight: 700 }}>
                      Score: {score}
                    </span>
                  )}
                </div>
                {r.target_roles?.length > 0 && (
                  <div style={{ color: t.muted, fontSize: 12.5, marginBottom: 3 }}>{r.target_roles.join(' · ')}</div>
                )}
                <div style={{ color: t.muted, fontSize: 12, display: 'flex', gap: 14 }}>
                  <span>Analyzed: {r.last_analyzed_at ? fmtDate(r.last_analyzed_at) : 'Not analyzed'}</span>
                  <span>Updated: {fmtDate(r.updated_at)}</span>
                </div>
              </div>
              {/* Right: actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!r.is_primary && <Btn variant="ghost" size="sm" onClick={() => onSetPrimary(r.id)} t={t}><Star size={12} /> Set Primary</Btn>}
                {r.analysis_report && <Btn variant="secondary" size="sm" onClick={() => onReport(r)} t={t}><BarChart2 size={12} /> Report</Btn>}
                <Btn variant="secondary" size="sm" onClick={() => onEdit(r)} t={t}><Edit3 size={12} /> Edit</Btn>
                <Btn variant="red" size="sm" onClick={() => onDelete(r.id)} t={t}><Trash2 size={12} /></Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── View 2: Structured Editor ─────────────────────────────────────────────────
function ResumeEditor({ resume, onBack, onSave, onAnalyze, analyzing, t }) {
  const [draft, setDraft] = useState(() => ({
    ...resume,
    structured_sections: resume.structured_sections || emptyResume(null),
    target_roles: resume.target_roles || [],
  }));
  const [tab, setTab] = useState('experience');
  const [saving, setSaving] = useState(false);

  const sec = draft.structured_sections;
  const setSec = (patch) => setDraft(d => ({ ...d, structured_sections: { ...d.structured_sections, ...patch } }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  // ── Experience helpers ───────────────────────────────────────────────────────
  const addExp = () => setSec({ experience: [...(sec.experience || []), { id: `exp-${crypto.randomUUID()}`, company: '', role: '', location: '', start_date: '', end_date: '', current: false, bullets: [] }] });
  const removeExp = (id) => setSec({ experience: sec.experience.filter(e => e.id !== id) });
  const updateExp = (id, patch) => setSec({ experience: sec.experience.map(e => e.id === id ? { ...e, ...patch } : e) });
  const addBullet = (id) => updateExp(id, { bullets: [...(sec.experience.find(e => e.id === id)?.bullets || []), ''] });
  const updateBullet = (id, idx, val) => updateExp(id, { bullets: sec.experience.find(e => e.id === id).bullets.map((b, i) => i === idx ? val : b) });
  const removeBullet = (id, idx) => updateExp(id, { bullets: sec.experience.find(e => e.id === id).bullets.filter((_, i) => i !== idx) });

  // ── Education helpers ────────────────────────────────────────────────────────
  const addEdu = () => setSec({ education: [...(sec.education || []), { id: `edu-${crypto.randomUUID()}`, school: '', degree: '', field: '', start_date: '', end_date: '', gpa: '' }] });
  const removeEdu = (id) => setSec({ education: sec.education.filter(e => e.id !== id) });
  const updateEdu = (id, patch) => setSec({ education: sec.education.map(e => e.id === id ? { ...e, ...patch } : e) });

  // ── Skills helpers ───────────────────────────────────────────────────────────
  const addSkill = () => setSec({ skills: [...(sec.skills || []), { id: `sk-${crypto.randomUUID()}`, category: '', items: [] }] });
  const removeSkill = (id) => setSec({ skills: sec.skills.filter(s => s.id !== id) });
  const updateSkill = (id, patch) => setSec({ skills: sec.skills.map(s => s.id === id ? { ...s, ...patch } : s) });

  const TABS = ['experience', 'education', 'skills'];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Btn variant="ghost" onClick={onBack} t={t}><ChevronLeft size={15} /> All Resumes</Btn>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="yellow" onClick={() => onAnalyze(sec, draft.name, draft.target_roles)} disabled={analyzing} t={t}>
            {analyzing ? <><Loader size={14} /> Analyzing…</> : <><BarChart2 size={14} /> Analyze</>}
          </Btn>
          <Btn onClick={handleSave} disabled={saving} t={t}>
            {saving ? <><Loader size={14} /> Saving…</> : <><CheckCircle size={14} /> Save</>}
          </Btn>
        </div>
      </div>

      {/* Meta Card */}
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>RESUME NAME</div>
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Resume name" t={t} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 5 }}>TARGET ROLES (comma-separated)</div>
            <Input value={(draft.target_roles || []).join(', ')} onChange={e => setDraft(d => ({ ...d, target_roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="e.g. Software Engineer, Backend Developer" t={t} />
          </div>
        </div>
      </Card>

      {/* Summary Card */}
      <Card t={t} style={{ marginBottom: 12 }}>
        <div style={{ color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>PROFESSIONAL SUMMARY</div>
        <Textarea value={sec.summary || ''} onChange={e => setSec({ summary: e.target.value })} placeholder="Write a brief professional summary…" rows={4} t={t} />
      </Card>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        {TABS.map(tabId => (
          <button key={tabId} onClick={() => setTab(tabId)} style={{ background: 'none', border: 'none', borderBottom: tab === tabId ? `2px solid ${t.pri}` : '2px solid transparent', color: tab === tabId ? t.pri : t.muted, padding: '8px 18px', fontSize: 14, fontWeight: tab === tabId ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1, textTransform: 'capitalize' }}>
            {tabId}
          </button>
        ))}
      </div>

      {/* Experience */}
      {tab === 'experience' && (
        <div>
          {(sec.experience || []).map((exp) => (
            <Card key={exp.id} t={t} style={{ marginBottom: 12, position: 'relative' }}>
              <button onClick={() => removeExp(exp.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: t.muted, cursor: 'pointer', padding: 2 }}><X size={15} /></button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>COMPANY</div>
                  <Input value={exp.company} onChange={e => updateExp(exp.id, { company: e.target.value })} placeholder="Company name" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>ROLE</div>
                  <Input value={exp.role} onChange={e => updateExp(exp.id, { role: e.target.value })} placeholder="Job title" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>START DATE</div>
                  <Input value={exp.start_date} onChange={e => updateExp(exp.id, { start_date: e.target.value })} placeholder="e.g. Jan 2022" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>END DATE</div>
                  <Input value={exp.end_date} onChange={e => updateExp(exp.id, { end_date: e.target.value })} placeholder="e.g. Dec 2023" disabled={exp.current} t={t} style={{ opacity: exp.current ? 0.5 : 1 }} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.sub, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={exp.current} onChange={e => updateExp(exp.id, { current: e.target.checked })} />
                Current role
              </label>
              <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>BULLET POINTS</div>
              {(exp.bullets || []).map((b, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <Input value={b} onChange={e => updateBullet(exp.id, idx, e.target.value)} placeholder={`Bullet ${idx + 1}`} t={t} />
                  <button onClick={() => removeBullet(exp.id, idx)} style={{ background: 'none', border: 'none', color: t.muted, cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
                </div>
              ))}
              <Btn variant="ghost" size="sm" onClick={() => addBullet(exp.id)} t={t} style={{ marginTop: 4 }}><Plus size={12} /> Add Bullet</Btn>
            </Card>
          ))}
          <Btn variant="secondary" onClick={addExp} t={t}><Plus size={14} /> Add Experience</Btn>
        </div>
      )}

      {/* Education */}
      {tab === 'education' && (
        <div>
          {(sec.education || []).map((edu) => (
            <Card key={edu.id} t={t} style={{ marginBottom: 12, position: 'relative' }}>
              <button onClick={() => removeEdu(edu.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: t.muted, cursor: 'pointer', padding: 2 }}><X size={15} /></button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>SCHOOL</div>
                  <Input value={edu.school} onChange={e => updateEdu(edu.id, { school: e.target.value })} placeholder="University name" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>DEGREE</div>
                  <Input value={edu.degree} onChange={e => updateEdu(edu.id, { degree: e.target.value })} placeholder="e.g. Bachelor of Science" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>FIELD</div>
                  <Input value={edu.field} onChange={e => updateEdu(edu.id, { field: e.target.value })} placeholder="e.g. Computer Science" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>GPA (optional)</div>
                  <Input value={edu.gpa} onChange={e => updateEdu(edu.id, { gpa: e.target.value })} placeholder="e.g. 3.8" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>START DATE</div>
                  <Input value={edu.start_date} onChange={e => updateEdu(edu.id, { start_date: e.target.value })} placeholder="e.g. Aug 2019" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>END DATE</div>
                  <Input value={edu.end_date} onChange={e => updateEdu(edu.id, { end_date: e.target.value })} placeholder="e.g. May 2023" t={t} />
                </div>
              </div>
            </Card>
          ))}
          <Btn variant="secondary" onClick={addEdu} t={t}><Plus size={14} /> Add Education</Btn>
        </div>
      )}

      {/* Skills */}
      {tab === 'skills' && (
        <div>
          {(sec.skills || []).map((sk) => (
            <Card key={sk.id} t={t} style={{ marginBottom: 12, position: 'relative' }}>
              <button onClick={() => removeSkill(sk.id)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: t.muted, cursor: 'pointer', padding: 2 }}><X size={15} /></button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>CATEGORY</div>
                  <Input value={sk.category} onChange={e => updateSkill(sk.id, { category: e.target.value })} placeholder="e.g. Programming Languages" t={t} />
                </div>
                <div>
                  <div style={{ color: t.sub, fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>SKILLS (comma-separated)</div>
                  <Input value={(sk.items || []).join(', ')} onChange={e => updateSkill(sk.id, { items: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="e.g. Python, JavaScript, SQL" t={t} />
                </div>
              </div>
            </Card>
          ))}
          <Btn variant="secondary" onClick={addSkill} t={t}><Plus size={14} /> Add Skill Group</Btn>
        </div>
      )}
    </div>
  );
}

// ── View 3: Analysis Report ───────────────────────────────────────────────────
function AnalysisReport({ resume, onBack, t }) {
  const report = resume?.analysis_report;
  if (!report) return <div style={{ color: t.muted, padding: 40, textAlign: 'center' }}>No analysis report available.</div>;

  const score = report.score;
  const scoreColor = score === 'A' ? t.green : score === 'B' ? t.pri : score === 'C' ? t.yellow : t.red;
  const scoreBg    = score === 'A' ? t.greenL : score === 'B' ? t.priL : score === 'C' ? t.yellowL : t.redL;

  const severityOrder = ['urgent', 'critical', 'optional'];
  const issuesBySeverity = (report.issues || []).reduce((acc, issue) => {
    const sev = issue.severity || 'optional';
    if (!acc[sev]) acc[sev] = [];
    acc[sev].push(issue);
    return acc;
  }, {});

  return (
    <div>
      <Btn variant="ghost" onClick={onBack} t={t} style={{ marginBottom: 20 }}><ChevronLeft size={15} /> Back to Editor</Btn>

      {/* Score card */}
      <Card t={t} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ background: scoreBg, color: scoreColor, borderRadius: 12, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, flexShrink: 0 }}>
          {score}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: t.tx, marginBottom: 4 }}>{report.summary || 'Resume Analysis Complete'}</div>
          <div style={{ color: t.muted, fontSize: 13 }}>Overall grade for {resume.name}</div>
        </div>
      </Card>

      {/* What's working */}
      {report.highlights?.length > 0 && (
        <Card t={t} style={{ marginBottom: 12, background: t.greenL, border: `1px solid ${t.greenBd}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CheckCircle size={16} color={t.green} />
            <span style={{ fontWeight: 700, fontSize: 15, color: t.green }}>What's Working</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: t.green, fontWeight: 700, fontSize: 12, minWidth: 90, paddingTop: 1 }}>{h.section}</span>
                <span style={{ color: t.tx, fontSize: 13.5 }}>{h.note}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Issues to fix */}
      {(report.issues?.length > 0) && (
        <Card t={t} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertCircle size={16} color={t.red} />
            <span style={{ fontWeight: 700, fontSize: 15, color: t.tx }}>Issues to Fix</span>
          </div>
          {severityOrder.filter(sev => issuesBySeverity[sev]?.length > 0).map(sev => (
            <div key={sev} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: sev === 'urgent' ? t.red : sev === 'critical' ? t.yellow : t.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>{sev}</div>
              {issuesBySeverity[sev].map((issue, i) => (
                <div key={i} style={{ background: t.priL, border: `1px solid ${t.priBd}`, borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: t.tx, fontSize: 13.5, marginBottom: 4 }}>{issue.problem}</div>
                  {issue.why && <div style={{ color: t.sub, fontSize: 13, marginBottom: 3 }}><strong>Why:</strong> {issue.why}</div>}
                  {issue.suggestion && <div style={{ color: t.sub, fontSize: 13 }}><strong>Fix:</strong> {issue.suggestion}</div>}
                </div>
              ))}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Resume({ profile, groqKey, t }) {
  const [view, setView] = useState('list');
  const [resumes, setResumes] = useState([]);
  const [activeResume, setActiveResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const loadResumes = async () => {
    setLoading(true);
    try {
      const data = await fetchResumes();
      setResumes(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadResumes(); }, []);

  const createNew = async () => {
    try {
      const id = await upsertResume({
        name: 'New Resume',
        is_primary: resumes.length === 0,
        target_roles: [],
        structured_sections: emptyResume(profile),
      });
      const full = await fetchResume(id);
      setActiveResume(full);
      setView('editor');
      await loadResumes();
    } catch (e) {
      setError(e.message);
    }
  };

  const openEditor = async (resumeRow) => {
    try {
      const full = await fetchResume(resumeRow.id);
      setActiveResume(full);
      setView('editor');
    } catch (e) {
      setError(e.message);
    }
  };

  const openAnalysis = async (resumeRow) => {
    try {
      const full = await fetchResume(resumeRow.id);
      setActiveResume(full);
      setView('analysis');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSave = async (updated) => {
    try {
      await upsertResume(updated);
      const refreshed = await fetchResume(updated.id);
      setActiveResume(refreshed);
      await loadResumes();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const sections = await parseUploadedResume(file);
      if (sections.parse_error) throw new Error(sections.parse_error);
      const baseName = file.name.replace(/\.(tex|pdf)$/i, '');
      await upsertResume({
        name: baseName || 'Uploaded Resume',
        is_primary: resumes.length === 0,
        structured_sections: sections,
      });
      await loadResumes();
    } catch (e) {
      setError('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this resume? This cannot be undone.')) return;
    try {
      await deleteResume(id);
      await loadResumes();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSetPrimary = async (id) => {
    try {
      await setPrimaryResume(id);
      await loadResumes();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAnalyze = async (sections, name, targetRoles) => {
    if (!groqKey) {
      setError('Add your Groq API key in Settings to run analysis.');
      return;
    }
    setAnalyzing(true);
    setError('');
    try {
      const report = await analyzeResumeWithGroq(sections, targetRoles, groqKey);
      await saveResumeAnalysis(activeResume.id, report);
      const refreshed = await fetchResume(activeResume.id);
      setActiveResume(refreshed);
      await loadResumes();
      setView('analysis');
    } catch (e) {
      setError('Analysis failed: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>
      {error && (
        <div style={{ background: t.redL, border: `1px solid ${t.redBd}`, borderRadius: 8, padding: '10px 14px', color: t.red, fontSize: 13.5, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {view === 'list' && (
        <ResumeList
          resumes={resumes}
          loading={loading}
          uploading={uploading}
          onNew={createNew}
          onUpload={handleUpload}
          onEdit={openEditor}
          onDelete={handleDelete}
          onSetPrimary={handleSetPrimary}
          onReport={openAnalysis}
          t={t}
        />
      )}

      {view === 'editor' && activeResume && (
        <ResumeEditor
          resume={activeResume}
          onBack={() => setView('list')}
          onSave={handleSave}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          t={t}
        />
      )}

      {view === 'analysis' && activeResume && (
        <AnalysisReport
          resume={activeResume}
          onBack={() => setView('editor')}
          t={t}
        />
      )}
    </div>
  );
}
