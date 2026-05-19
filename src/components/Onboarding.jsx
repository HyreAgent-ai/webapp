import { useState } from 'react';
import * as Storage from '../lib/storage.js';
import { supabase } from '../supabase.js';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
).toString();

const COMPILER_URL = import.meta.env.VITE_COMPILER_URL || 'https://resume-compiler-1077806152183.us-central1.run.app';

const DOMAIN_OPTIONS = [
  { value: 'aerospace_manufacturing', label: 'Aerospace & Manufacturing' },
  { value: 'industrial_engineering',  label: 'Industrial & Operations Engineering' },
  { value: 'mechanical_thermal',      label: 'Mechanical & Thermal Engineering' },
];

const VISA_OPTIONS = ['US Citizen', 'Green Card', 'H-1B', 'OPT/STEM OPT', 'Other'];
const DEGREE_OPTIONS = ['B.S.', 'M.S.', 'Ph.D.', 'B.E.', 'M.E.'];

// Pre-filled role target suggestions per domain family
const DOMAIN_ROLE_SUGGESTIONS = {
  aerospace_manufacturing: [
    { title: 'Manufacturing Engineer', cluster: 'core_manufacturing', priority: 1 },
    { title: 'Aerospace Systems Engineer', cluster: 'core_manufacturing', priority: 1 },
    { title: 'Propulsion Engineer', cluster: 'startup_manufacturing', priority: 2 },
    { title: 'Production Engineer', cluster: 'core_manufacturing', priority: 2 },
  ],
  industrial_engineering: [
    { title: 'Industrial Engineer', cluster: 'industrial_operations', priority: 1 },
    { title: 'Operations Engineer', cluster: 'industrial_operations', priority: 1 },
    { title: 'Supply Chain Engineer', cluster: 'industrial_operations', priority: 2 },
    { title: 'Process Engineer', cluster: 'industrial_operations', priority: 2 },
  ],
  mechanical_thermal: [
    { title: 'Mechanical Engineer', cluster: 'mechanical_thermal', priority: 1 },
    { title: 'Thermal Systems Engineer', cluster: 'mechanical_thermal', priority: 1 },
    { title: 'Systems Engineer', cluster: 'mechanical_thermal', priority: 2 },
    { title: 'R&D Engineer', cluster: 'mechanical_thermal', priority: 2 },
  ],
};

const STEPS = ['Profile', 'Target Roles', 'API Keys', 'Resume'];

export default function Onboarding({ t, onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 0 — Profile
  const [name, setName] = useState('');
  const [degree, setDegree] = useState('M.S.');
  const [visa, setVisa] = useState('OPT/STEM OPT');
  const [domain, setDomain] = useState('aerospace_manufacturing');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  // Step 1 — Role Targets (loaded from suggestions, user can add/remove)
  const [roleTargets, setRoleTargets] = useState(
    DOMAIN_ROLE_SUGGESTIONS['aerospace_manufacturing']
  );
  const [newRoleTitle, setNewRoleTitle] = useState('');

  // Step 2 — API Keys
  const [groqKey, setGroqKey] = useState('');
  const [serperKey, setSerperKey] = useState('');

  // Step 3 — Resume Upload
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeType, setResumeType] = useState('');  // 'tex' | 'pdf'
  const [parseError, setParseError] = useState('');
  const [parsePending, setParsePending] = useState(false);

  const labelStyle = { display: 'block', color: t.sub, fontSize: 12, fontWeight: 600, marginBottom: 6 };
  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${t.border}`, background: t.bg,
    color: t.tx, fontSize: 14, boxSizing: 'border-box',
    marginBottom: 16, fontFamily: 'inherit', outline: 'none',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  function handleDomainChange(val) {
    setDomain(val);
    setRoleTargets(DOMAIN_ROLE_SUGGESTIONS[val] || []);
  }

  function removeRoleTarget(idx) {
    setRoleTargets(r => r.filter((_, i) => i !== idx));
  }

  function addRoleTarget() {
    if (!newRoleTitle.trim()) return;
    setRoleTargets(r => [...r, { title: newRoleTitle.trim(), cluster: domain, priority: 3 }]);
    setNewRoleTitle('');
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setParseError('');

    if (file.size > 5 * 1024 * 1024) {
      setParseError('File too large. Max 5MB.');
      return;
    }

    if (file.name.endsWith('.tex')) {
      const text = await file.text();
      setResumeFile(file);
      setResumeText(text);
      setResumeType('tex');
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setResumeFile(file);
      setResumeType('pdf');
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + '\n';
      }
      setResumeText(fullText.slice(0, 8000));
    } else {
      setParseError('Please upload a .tex or .pdf file.');
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError('');
    try {
      await Storage.upsertUserProfile({
        full_name: name.trim(),
        degree: degree,
        visa_status: visa,
        domain_family: domain,
        linkedin_url: linkedinUrl.trim() || null,
      });

      if (roleTargets.length > 0) {
        for (const rt of roleTargets) {
          await Storage.upsertRoleTarget({
            title: rt.title,
            cluster: rt.cluster,
            priority: rt.priority,
            keywords: [],
            boost_tags: [],
            require_h1b: visa === 'H-1B' || visa === 'OPT/STEM OPT',
          });
        }
      }

      if (groqKey.trim())   await Storage.saveUserIntegration('groq', groqKey.trim());
      if (serperKey.trim()) await Storage.saveUserIntegration('serper', serperKey.trim());

      // Parse and save resume if provided (non-blocking — onboarding completes regardless)
      if (resumeFile && resumeText) {
        setParsePending(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let structuredSections = null;

          if (resumeType === 'tex') {
            const res = await fetch(`${COMPILER_URL}/parse`, {
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: resumeText,
              signal: AbortSignal.timeout(15000),
            });
            if (res.ok) structuredSections = await res.json();
          } else {
            const res = await fetch('/api/parse-resume', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ text: resumeText }),
              signal: AbortSignal.timeout(20000),
            });
            if (res.ok) structuredSections = await res.json();
          }

          if (structuredSections && !structuredSections.parse_error) {
            await Storage.upsertResume({
              name: 'Primary Resume',
              is_primary: true,
              structured_sections: structuredSections,
            });
          }
        } catch (err) {
          console.warn('Resume parse failed (non-blocking):', err.message);
        } finally {
          setParsePending(false);
        }
      }

      onComplete();
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
      setSaving(false);
    }
  }

  function nextStep() {
    if (step === 0 && !name.trim()) { setError('Please enter your name.'); return; }
    if (step === 1 && roleTargets.length === 0) { setError('Add at least one role target.'); return; }
    setError('');
    setStep(s => s + 1);
  }

  return (
    <div style={{
      minHeight: '100vh', background: t.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, padding: '40px 36px', width: 460,
        boxShadow: t.shadow,
      }}>
        {/* Header */}
        <h2 style={{ color: t.tx, margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
          Welcome to JobAgent
        </h2>
        <p style={{ color: t.sub, margin: '0 0 24px', fontSize: 13 }}>
          Let's set up your profile so we can surface the right jobs for you.
        </p>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 6,
                background: i <= step ? t.pri : t.border,
                transition: 'background .2s',
              }} />
              <span style={{ fontSize: 11, color: i === step ? t.pri : t.muted, fontWeight: i === step ? 700 : 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 0: Profile */}
        {step === 0 && (
          <>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              style={inputStyle} placeholder="Jane Smith" autoFocus
            />

            <label style={labelStyle}>Highest Degree</label>
            <select value={degree} onChange={e => setDegree(e.target.value)} style={selectStyle}>
              {DEGREE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <label style={labelStyle}>Visa / Work Authorization</label>
            <select value={visa} onChange={e => setVisa(e.target.value)} style={selectStyle}>
              {VISA_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            <label style={labelStyle}>Engineering Domain</label>
            <select value={domain} onChange={e => handleDomainChange(e.target.value)} style={selectStyle}>
              {DOMAIN_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>

            <label style={labelStyle}>LinkedIn URL (optional)</label>
            <input
              type="text" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)}
              style={inputStyle} placeholder="https://linkedin.com/in/yourprofile"
            />
          </>
        )}

        {/* Step 1: Role Targets */}
        {step === 1 && (
          <>
            <p style={{ color: t.sub, fontSize: 13, margin: '0 0 16px' }}>
              These are pre-filled based on your domain. Add or remove as you like.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {roleTargets.map((rt, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px',
                }}>
                  <span style={{ color: t.tx, fontSize: 13 }}>{rt.title}</span>
                  <button
                    onClick={() => removeRoleTarget(i)}
                    style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addRoleTarget()}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                placeholder="Add a custom role title…"
              />
              <button
                onClick={addRoleTarget}
                style={{
                  padding: '10px 16px', borderRadius: 8, border: 'none',
                  background: t.pri, color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                }}
              >Add</button>
            </div>
          </>
        )}

        {/* Step 2: API Keys */}
        {step === 2 && (
          <>
            <p style={{ color: t.sub, fontSize: 13, margin: '0 0 16px' }}>
              Optional — you can skip these and add them later in Settings.
            </p>

            <label style={labelStyle}>Groq API Key (for AI analysis)</label>
            <input
              type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)}
              style={inputStyle} placeholder="gsk_…" autoFocus
            />

            <label style={labelStyle}>Serper API Key (for company research)</label>
            <input
              type="password" value={serperKey} onChange={e => setSerperKey(e.target.value)}
              style={inputStyle} placeholder="Your Serper key"
            />

            <p style={{ color: t.muted, fontSize: 11, margin: '4px 0 16px' }}>
              Keys are stored per-user in your Supabase account and never shared.
            </p>
          </>
        )}

        {/* Step 3: Resume Upload */}
        {step === 3 && (
          <>
            <p style={{color: t.sub, fontSize: 13, margin: '0 0 16px'}}>
              Upload your Overleaf .tex file or resume PDF so AI analysis uses your real experience. Optional — you can skip and upload later from the Resume tab.
            </p>

            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', border: `2px dashed ${t.border}`,
              borderRadius: 10, padding: '24px 16px', cursor: 'pointer',
              background: t.bg, marginBottom: 14,
            }}>
              <span style={{fontSize: 13, color: t.sub, marginBottom: 8}}>
                {resumeFile ? resumeFile.name : 'Click to upload .tex or .pdf'}
              </span>
              <span style={{fontSize: 11, color: t.muted}}>Max 5MB</span>
              <input type="file" accept=".tex,.pdf" onChange={handleFileSelect}
                style={{display: 'none'}} />
            </label>

            {parseError && <p style={{color: t.red, fontSize: 13, margin: '0 0 12px'}}>{parseError}</p>}
            {resumeFile && !parseError && (
              <p style={{color: '#16a34a', fontSize: 12, margin: '0 0 12px'}}>
                ✓ {resumeType === 'tex' ? 'LaTeX file ready' : 'PDF text extracted'} — will be parsed on finish
              </p>
            )}

            <button onClick={() => onComplete()} style={{
              width: '100%', padding: 8, background: 'none',
              border: 'none', color: t.muted, fontSize: 12, cursor: 'pointer',
            }}>
              Skip for now
            </button>
          </>
        )}

        {/* Error */}
        {error && (
          <p style={{ color: t.red, fontSize: 13, margin: '0 0 14px' }}>{error}</p>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={() => { setError(''); setStep(s => s - 1); }}
              style={{
                flex: 1, padding: '11px', borderRadius: 8,
                background: 'transparent', color: t.sub,
                border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={nextStep}
              style={{
                flex: 2, padding: '11px', borderRadius: 8,
                background: t.pri, color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Continue</button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{
                flex: 2, padding: '11px', borderRadius: 8,
                background: t.pri, color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1, fontFamily: 'inherit',
              }}
            >{saving ? 'Saving…' : 'Finish Setup'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
