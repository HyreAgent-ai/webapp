import { useState, useEffect, useCallback } from 'react';
import { BarChart2, CheckCircle, Users, Copy, Check, Briefcase, Zap, SlidersHorizontal, Edit3, Sparkles, FileText, Download, RefreshCw, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { analyzeJob, selectBestResume } from '../lib/scoring.js';
import { analyzeJobWithGroq, generateCoverLetterWithGroq, answerApplicationQuestion, generateSummary } from '../lib/groq.js';
import { buildCoverLetterPayload } from '../lib/coverLetter.js';
import * as Storage from '../lib/storage.js';
import { supabase } from '../supabase.js';

const COMPILER_URL = import.meta.env.VITE_COMPILER_URL ?? "http://localhost:8080";

function Card({children, t, style}) {
  return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:20,boxShadow:t.shadow,...style}}>{children}</div>;
}
function Btn({children, onClick, disabled, variant="primary", size="md", t, style:xs}) {
  const V={primary:{bg:t.pri,c:"#fff",b:"none"},secondary:{bg:"transparent",c:t.sub,b:`1px solid ${t.border}`},ghost:{bg:"transparent",c:t.muted,b:`1px solid ${t.border}`},green:{bg:t.greenL,c:t.green,b:`1px solid ${t.greenBd}`},red:{bg:t.redL,c:t.red,b:`1px solid ${t.redBd}`}};
  const s=V[variant]||V.primary; const p=size==="sm"?"5px 14px":"10px 20px"; const fs=size==="sm"?12.5:13.5;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.b,padding:p,borderRadius:8,fontSize:fs,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,fontFamily:"inherit",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,...xs}}>{children}</button>;
}
function Input({label, value, onChange, placeholder, multiline, rows=4, t, style:xs}) {
  const base={width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.6,...xs};
  return <div style={{marginBottom:14}}>{label&&<label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{multiline?<textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}}/>:<input value={value} onChange={onChange} placeholder={placeholder} style={base}/>}</div>;
}
function SectionLabel({children, t}) {
  return <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:14}}>{children}</div>;
}

function robustCopy(text) {
  if (!text) return Promise.reject("Nothing to copy");
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); resolve(); } catch { reject(); }
    finally { document.body.removeChild(ta); }
  });
}

// Parse \skillline{Label}{Skills} into rows
function SkilllinePreview({latex, t}) {
  const lines = (latex || "").split('\n').filter(Boolean);
  const parsed = lines.map(line => {
    const m = line.match(/\\skillline\{([^}]+)\}\{([^}]+)\}/);
    return m ? {label: m[1], skills: m[2]} : null;
  }).filter(Boolean);

  if (!parsed.length) {
    return <div style={{fontSize:12.5,color:t.sub,whiteSpace:"pre-wrap",lineHeight:1.7}}>{latex}</div>;
  }
  return (
    <div>
      {parsed.map((row, i) => (
        <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12,lineHeight:1.5,alignItems:"baseline"}}>
          <span style={{fontWeight:700,color:t.pri,minWidth:170,flexShrink:0,fontSize:11.5}}>{row.label.replace(/\\&/g, '&')}</span>
          <span style={{color:t.sub}}>{row.skills.replace(/\\&/g, '&')}</span>
        </div>
      ))}
    </div>
  );
}

const TONES = [
  { value: 'professional',   label: 'Professional' },
  { value: 'technical',      label: 'Technical' },
  { value: 'conversational', label: 'Conversational' },
];

// ─── Application Q&A ──────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  "Write a message to the hiring team",
  "Why do you want to work at [company]?",
  "Why are you interested in this role?",
  "Tell us about yourself in 2-3 sentences",
  "What is your greatest strength relevant to this role?",
  "Describe a challenge you solved using data or analysis",
];

function ApplicationQA({ company, role, jd, summary, top5Skills, groqKey, t }) {
  const [open, setOpen]       = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setLoading(true); setError(''); setAnswer('');
    try {
      const text = await answerApplicationQuestion(
        question,
        { company, role, jd, summary, top5Skills },
        groqKey
      );
      setAnswer(text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    robustCopy(answer).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });
  };

  const applyQuick = (prompt) => {
    setQuestion(prompt.replace('[company]', company || 'the company'));
    setAnswer('');
  };

  return (
    <Card t={t} style={{marginBottom:16}}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}
      >
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:t.priL,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <MessageSquare size={14} color={t.pri}/>
            </div>
            <div>
              <div style={{fontSize:13.5,fontWeight:700,color:t.tx}}>Application Q&amp;A</div>
              <div style={{fontSize:11,color:t.muted}}>Answer form questions — "message to hiring team", short essays, etc.</div>
            </div>
          </div>
          {open ? <ChevronUp size={16} color={t.muted}/> : <ChevronDown size={16} color={t.muted}/>}
        </div>
      </button>

      {open && (
        <div style={{marginTop:16}}>
          {/* Quick prompts */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Quick Prompts</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => applyQuick(p)}
                  style={{fontSize:11.5,padding:"4px 11px",borderRadius:20,border:`1px solid ${t.border}`,
                    background: question === p.replace('[company]', company||'the company') ? t.priL : t.hover,
                    color: question === p.replace('[company]', company||'the company') ? t.pri : t.sub,
                    cursor:"pointer",fontFamily:"inherit",fontWeight:600,transition:"all .1s"}}>
                  {p.replace('[company]', company || 'the company')}
                </button>
              ))}
            </div>
          </div>

          {/* Question input */}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Your Question / Prompt</div>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Paste the form question here, e.g. 'Tell us something unique about yourself'"
              rows={3}
              style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,
                padding:"9px 13px",color:t.tx,fontSize:13,outline:"none",
                boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.6,resize:"vertical"}}
            />
          </div>

          <Btn onClick={handleGenerate} disabled={loading || !question.trim()} t={t}>
            {loading ? <><RefreshCw size={13} style={{animation:"spin 1s linear infinite"}}/> Generating…</> : <><Sparkles size={13}/> Generate Answer</>}
          </Btn>

          {error && (
            <div style={{marginTop:10,padding:"8px 12px",background:t.redL,border:`1px solid ${t.redBd}`,borderRadius:8,fontSize:12.5,color:t.red}}>
              {error}
            </div>
          )}

          {answer && (
            <div style={{marginTop:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1}}>Answer</div>
                <div style={{display:"flex",gap:8}}>
                  <Btn size="sm" variant="green" onClick={handleCopy} t={t}>
                    {copied ? <><Check size={12}/> Copied!</> : <><Copy size={12}/> Copy</>}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={handleGenerate} t={t}>
                    <RefreshCw size={12}/> Regen
                  </Btn>
                </div>
              </div>
              <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,
                padding:"14px 16px",fontSize:13,lineHeight:1.8,color:t.sub,whiteSpace:"pre-wrap"}}>
                {answer}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── AI Cover Letter Section ───────────────────────────────────────────────────
function CoverLetterSection({ role, company, jd, analysis, groqKey, t }) {
  const [open, setOpen]         = useState(false);
  const [tone, setTone]         = useState('professional');
  const [letter, setLetter]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);
  const [regenNote, setRegenNote] = useState('');

  const wordCount = letter.trim() ? letter.trim().split(/\s+/).length : 0;
  const overWords = wordCount > 370;

  const generate = async () => {
    if (!groqKey) { setError('Add your Groq API key in Settings to generate cover letters.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await generateCoverLetterWithGroq(role, company, jd, analysis, tone, groqKey, regenNote);
      setLetter(result);
      setRegenNote('');
    } catch(e) {
      setError('Generation failed: ' + e.message);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    robustCopy(letter).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); }).catch(() => {});
  };

  const downloadPDF = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const paras = letter
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(p => `<p>${p}</p>`)
      .join('\n');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Cover Letter — ${role} at ${company}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Georgia','Times New Roman',serif;font-size:11.5pt;line-height:1.8;color:#111;max-width:680px;margin:0 auto;padding:72pt 0}
  .hdr{margin-bottom:32pt;font-size:10.5pt;line-height:1.7}
  .name{font-size:15pt;font-weight:bold;margin-bottom:4pt;letter-spacing:.3pt}
  .salute{margin-bottom:20pt;font-size:11pt}
  p{margin-bottom:14pt;text-align:justify;hyphens:auto}
  .sign{margin-top:20pt}
  @media print{@page{margin:72pt}body{padding:0}}
</style></head><body>
<div class="hdr">
  <div class="name">Siddardth Pathipaka</div>
  <div>siddardth.pathipaka@gmail.com</div>
  <div style="margin-top:12pt">${date}</div>
  <div style="margin-top:12pt">Hiring Team<br>${company}</div>
</div>
<div class="salute">Dear Hiring Manager,</div>
${paras}
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { setError('Pop-up blocked — allow pop-ups and try again.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const sel = { background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.tx, fontSize: 13, fontFamily: 'inherit', outline: 'none' };

  return (
    <Card t={t} style={{ marginBottom: 16, borderColor: open ? t.yellowBd : t.border }}>
      {/* Header row — click to expand */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: t.yellowL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={15} color={t.yellow} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: t.tx }}>Cover Letter Generator</div>
            <div style={{ fontSize: 11, color: t.muted }}>AI-generated, JD-targeted — edit before sending</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {letter && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.greenL, color: t.green }}>Ready</span>}
          {groqKey && <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.yellowL, color: t.yellow }}>Groq AI</span>}
          {open ? <ChevronUp size={16} color={t.muted} /> : <ChevronDown size={16} color={t.muted} />}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>

          {/* Tone + Generate row */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: t.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)} style={sel}>
                {TONES.map(t_ => <option key={t_.value} value={t_.value}>{t_.label}</option>)}
              </select>
            </div>
            <Btn onClick={generate} disabled={loading || !groqKey} t={t}>
              {loading
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                : <><Sparkles size={13} /> Generate Cover Letter</>}
            </Btn>
          </div>

          {!groqKey && (
            <div style={{ fontSize: 12, color: t.yellow, padding: '8px 12px', background: t.yellowL, borderRadius: 8, border: `1px solid ${t.yellowBd}`, marginBottom: 12 }}>
              Add Groq API key in Settings to use AI cover letter generation.
            </div>
          )}
          {error && <div style={{ fontSize: 12.5, color: t.red, fontWeight: 600, marginBottom: 10 }}>{error}</div>}

          {letter && (
            <div>
              <textarea
                value={letter}
                onChange={e => setLetter(e.target.value)}
                rows={18}
                style={{ width: '100%', background: t.bg, border: `1px solid ${overWords ? t.red : t.border}`, borderRadius: 8, padding: '14px 18px', color: t.tx, fontSize: 12.5, fontFamily: "'Georgia','Times New Roman',serif", resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.85 }}
              />

              {/* Word count + action buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: overWords ? t.red : wordCount > 340 ? t.yellow : t.green }}>
                  {wordCount} words{overWords ? ' — OVER 370 limit' : wordCount > 340 ? ' — approaching limit' : ' — OK'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn size="sm" variant="secondary" onClick={generate} disabled={loading || !groqKey} t={t}>
                    <RefreshCw size={11} /> Redo
                  </Btn>
                  <Btn size="sm" variant="green" onClick={handleCopy} t={t}>
                    {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Text</>}
                  </Btn>
                  <Btn size="sm" t={t} onClick={downloadPDF}>
                    <Download size={12} /> Download PDF
                  </Btn>
                </div>
              </div>

              {/* Regeneration direction */}
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <input
                  value={regenNote}
                  onChange={e => setRegenNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && regenNote.trim()) generate(); }}
                  placeholder='Direction for Redo, e.g. "more technical" or "emphasise SAMPE work" or "shorten Para 2"'
                  style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 12px', color: t.tx, fontSize: 12.5, fontFamily: 'inherit', outline: 'none' }}
                />
                <Btn size="sm" variant="secondary" onClick={generate} disabled={loading || !groqKey || !regenNote.trim()} t={t}>
                  <RefreshCw size={11} /> Apply
                </Btn>
              </div>

              {/* PDF tip */}
              <div style={{ marginTop: 10, fontSize: 11.5, color: t.muted, padding: '6px 10px', background: t.hover, borderRadius: 6 }}>
                <strong>PDF download</strong> opens a print dialog — choose "Save as PDF" in your browser. The PDF includes the header, date, and salutation automatically.
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function JobAnalysis({currentJob, updatePipelineJob, completePipeline, onLogApp, setPage, setCurrentJob, apps, findCompany, isBlacklisted, checkITAR, groqKey, t}) {
  const [co, setCo] = useState(currentJob?.company || "");
  const [role, setRole] = useState(currentJob?.role || "");
  const [loc, setLoc] = useState(currentJob?.location || "");
  const [link, setLink] = useState(currentJob?.link || "");
  const [jobId, setJobId] = useState(currentJob?.jobId || "");
  const [jd, setJd] = useState(currentJob?.jd || "");
  const [res, setRes] = useState(null);
  const [result, setResult] = useState(currentJob?.analysisResult || null);
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState(null);
  const [copied, setCopied] = useState("");
  const [showRaw2, setShowRaw2] = useState(false);
  const [genLoading, setGenLoading] = useState(null);
  const [genError, setGenError] = useState(null);
  const [allResumes, setAllResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(false);

  // Fetch all resumes with structured_sections on mount
  useEffect(() => {
    Storage.fetchAllResumesWithSections()
      .then(resumes => { setAllResumes(resumes); })
      .catch(() => {})
      .finally(() => setResumeLoading(false));
  }, []);

  // Sync from currentJob whenever the active job changes
  useEffect(() => {
    if (currentJob) {
      setCo(currentJob.company || "");
      setRole(currentJob.role || "");
      setLoc(currentJob.location || "");
      setJobId(currentJob.jobId || "");
      setLink(currentJob.link || "");
      setJd(currentJob.jd || "");
      setResult(currentJob.analysisResult || null);
    }
  }, [currentJob?.id, currentJob?.location, currentJob?.company, currentJob?.role, currentJob?.jd, currentJob?.jobId]);

  // Persist JD and form fields back to currentJob so they survive page switches
  const syncToParent = useCallback((updates) => {
    setCurrentJob(prev => prev ? {...prev, ...updates} : updates);
  }, [setCurrentJob]);

  const handleJdChange = (e) => {
    setJd(e.target.value);
    syncToParent({ jd: e.target.value });
  };
  const handleCoChange = (e) => { setCo(e.target.value); syncToParent({ company: e.target.value }); };
  const handleRoleChange = (e) => { setRole(e.target.value); syncToParent({ role: e.target.value }); };
  const handleLocChange = (e) => { setLoc(e.target.value); syncToParent({ location: e.target.value }); };
  const handleLinkChange = (e) => { setLink(e.target.value); syncToParent({ link: e.target.value }); };

  // ITAR/blacklist checks
  useEffect(() => {
    if (!co && !jd) return;
    const c = {};
    if (co) { c.bl = isBlacklisted(co); c.m628 = findCompany(co); }
    if (jd) c.itar = checkITAR(jd);
    c.ok = !c.bl && (!c.itar || c.itar.length === 0);
    setChecks(c);
  }, [co, jd]);

  const analyze = async () => {
    if (!jd.trim()) return;
    setLoading(true);

    const jdText = currentJob?.description || currentJob?.jd || jd;
    const bestResume = selectBestResume(allResumes, jdText);
    if (bestResume) setSelectedResume(bestResume);

    try {
      let analysisResult;

      if (groqKey && bestResume?.structured_sections) {
        const groqResult = await analyzeJobWithGroq(jdText, bestResume.structured_sections, groqKey);
        analysisResult = {
          ...groqResult,
          recommendedResume: bestResume.name,
          recommendedResumeId: bestResume.id,
          aiPowered: true,
        };
      } else {
        analysisResult = analyzeJob(jdText, bestResume);
      }

      setResult(analysisResult);
      syncToParent({ analysisResult, jd, company: co, role, location: loc, link });
      if (currentJob?.id) {
        updatePipelineJob(currentJob.id, { analysisResult, jd, company: co, role, location: loc, link });
      }
    } catch (e) {
      const analysisResult = analyzeJob(jdText, bestResume);
      setResult({ ...analysisResult, aiError: e.message });
      syncToParent({ analysisResult, jd });
    }

    setLoading(false);
  };

  const copyText = (k, v) => {
    robustCopy(v).then(() => { setCopied(k); setTimeout(() => setCopied(""), 2500); }).catch(() => {});
  };

  const downloadFile = useCallback(async (endpoint, payload, fallbackFilename, loadingKey) => {
    setGenLoading(loadingKey);
    setGenError(null);
    try {
      const response = await fetch(`${COMPILER_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = response.headers.get("Content-Disposition") ?? "";
      const nameMatch = cd.match(/filename="?([^";\n]+)"?/);
      a.download = fallbackFilename || (nameMatch ? nameMatch[1] : 'resume.pdf');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenLoading(null);
    }
  }, []);

  const toFileSlug = (s) =>
    (s || '').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  // Recruiter-friendly slug: title-case words, strip filler, cap at maxWords
  const toRoleSlug = (s, maxWords = 4) => {
    const filler = new Set(['the','of','and','or','for','a','an','in','at','to','with','by']);
    return (s || '')
      .trim()
      .split(/\s+/)
      .filter(w => !filler.has(w.toLowerCase()))
      .slice(0, maxWords)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('_')
      .replace(/[^a-zA-Z0-9_]/g, '') || 'Engineer';
  };

  const downloadResume = useCallback(async () => {
    const activeResume = selectedResume || allResumes.find(r => r.is_primary) || allResumes[0];
    if (!result || !activeResume?.structured_sections) return;
    const companySlug = toFileSlug(co) || 'Company';
    const roleSlug = toRoleSlug(role);

    setGenLoading("resume");
    setGenError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const profile = await Storage.fetchUserProfile();

      // If summary toggled on, generate it first
      let mod1Summary = '';
      if (includeSummary && activeResume?.structured_sections?.summary !== null) {
        mod1Summary = await generateSummary(
          currentJob?.description || currentJob?.jd || jd,
          result.primary_category,
          result.top5_jd_skills || [],
          role,
          activeResume.structured_sections,
          groqKey
        );
      }

      const compilePayload = {
        structured_sections: activeResume.structured_sections,
        groq_output: {
          mod2_skilllines: result.mod2_skilllines,
          primary_category: result.primary_category,
          mod1_summary: mod1Summary,
        },
        include_summary: includeSummary && !!mod1Summary,
        candidate_name: profile?.full_name || 'Candidate',
        contact: {
          email: profile?.email || '',
          phone: profile?.phone || '',
          linkedin: profile?.linkedin_url || '',
          location: profile?.location || '',
        },
        company: co,
        role: role,
      };

      const response = await fetch(`${COMPILER_URL}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(compilePayload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = response.headers.get('Content-Disposition') ?? '';
      const nameMatch = cd.match(/filename="?([^";\n]+)"?/);
      a.download = nameMatch ? nameMatch[1] : `Siddardth_Pathipaka_${roleSlug}_${companySlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenLoading(null);
    }
  }, [result, co, role, selectedResume, allResumes, includeSummary, currentJob, jd, groqKey]);

  const downloadCoverLetter = useCallback(() => {
    if (!result) return;
    const companySlug = toFileSlug(co) || 'Company';
    const roleSlug = toRoleSlug(role);
    const payload = buildCoverLetterPayload({ result, company: co, role });
    downloadFile(
      "/generate-cover-letter",
      payload,
      `Siddardth_Pathipaka_CoverLetter_${roleSlug}_${companySlug}.pdf`,
      "coverletter"
    );
  }, [result, co, role, downloadFile]);

  const handleCompleteAndLog = () => {
    if (currentJob?.id) completePipeline(currentJob.id);
    const appKey = `${currentJob?.role||role}||${currentJob?.company||co}`;
    const appKeys = new Set(apps.map(a => `${a.role}||${a.company}`));
    if (!appKeys.has(appKey)) {
      onLogApp({
        id: `app-${Date.now()}`,
        role: currentJob?.role || role,
        company: currentJob?.company || co,
        location: currentJob?.location || loc,
        link: currentJob?.link || link,
        companyLink: "",
        match: currentJob?.match || "",
        verdict: currentJob?.verdict || "GREEN",
        status: "Applied",
        date: new Date().toISOString().split('T')[0],
        locationType: currentJob?.locationType || "Onsite",
        type: currentJob?.type || "Full-time",
        salary: currentJob?.salary || "",
        resumeVariant: result?.recommendedResume || res || "",
        fitLevel: (currentJob?.verdict) === "GREEN" ? "Green" : (currentJob?.verdict) === "YELLOW" ? "Yellow" : "Red"
      });
    }
    setPage("pipeline");
  };

  // Render bold markers as <strong> spans.
  // Defensive: normalises stale stored results that may contain \textbf{} instead of **.
  function renderBoldMarkers(text) {
    if (!text) return null;
    const normalised = text
      .replace(/\\textbf\{([^}]*)\}/g, '**$1**')   // \textbf{x}  → **x**
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');    // other \cmd{x} → x
    const parts = normalised.split(/\*\*([^*]+)\*\*/g);
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} style={{color: t.tx, fontWeight: 800}}>{p}</strong>
        : <span key={i}>{p}</span>
    );
  }

  // "Copy Text" gives clean plain text; "Copy LaTeX" gives the \textbf{} version for Overleaf
  const mod1PlainText = (result?.mod1_summary || '')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\*\*/g, '');


  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:700,color:t.tx}}>Job Analysis</h2>
      </div>

      {!currentJob?.role && !co && (
        <Card t={t} style={{textAlign:"center",padding:"60px 24px"}}>
          <BarChart2 size={32} color={t.muted} style={{marginBottom:12}}/>
          <div style={{fontSize:14,fontWeight:600,color:t.sub,marginBottom:16}}>Select a job from Pipeline to analyze.</div>
          <Btn onClick={() => setPage("pipeline")} t={t}>Go to Pipeline</Btn>
        </Card>
      )}

      {!resumeLoading && allResumes.length === 0 && (
        <div style={{background:'#fffbe6', border:'1px solid #ffe58f', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#7c5c00'}}>
          No resume found. Go to the <strong>Resume</strong> tab and upload your .tex or PDF to enable AI analysis.
        </div>
      )}

      {(currentJob?.role || co) && (
        <Card t={t} style={{marginBottom:16}}>
          <SectionLabel t={t}>Job Details</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <Input label="Company" value={co} onChange={handleCoChange} t={t}/>
            <Input label="Role" value={role} onChange={handleRoleChange} t={t}/>
            <Input label="Location" value={loc} onChange={handleLocChange} t={t}/>
            <Input label="Job ID" value={jobId} onChange={e => { setJobId(e.target.value); syncToParent({ jobId: e.target.value }); }} placeholder="Job ID (optional)" t={t}/>
            <Input label="Link" value={link} onChange={handleLinkChange} t={t}/>
          </div>
          <Input
            label="Full Job Description"
            value={jd}
            onChange={handleJdChange}
            placeholder="Paste the complete job description here..."
            multiline rows={8} t={t}
          />
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
            <Btn onClick={analyze} disabled={loading || resumeLoading || allResumes.length === 0 || !jd.trim()} title={allResumes.length === 0 ? 'Upload your resume in the Resume tab first' : undefined} t={t}>
              {groqKey && <Sparkles size={13}/>}
              {loading ? "Analyzing..." : groqKey ? "Run AI Analysis" : "Run Resume Analysis"}
            </Btn>
            {groqKey && <span style={{fontSize:11,color:t.green,fontWeight:700}}>✦ Groq AI active</span>}
            {!groqKey && <span style={{fontSize:11,color:t.muted}}>Add Groq key in Settings for AI-tailored output</span>}
            {allResumes.length > 1 && (
              <>
                <span style={{fontSize:12,color:t.muted}}>Resume:</span>
                {[{id: null, name: 'Auto'}, ...allResumes].map(r => {
                  const active = r.id === null ? res === null : res === r.id;
                  return (
                    <button key={r.id ?? 'auto'}
                      onClick={() => setRes(r.id === null ? null : (res === r.id ? null : r.id))}
                      style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",
                        background:active?t.pri+"18":"transparent",
                        border:`1px solid ${active?t.pri:t.border}`,
                        color:active?t.pri:t.sub,whiteSpace:"nowrap",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis"}}>
                      {r.name}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </Card>
      )}

      {checks && (
        <Card t={t} style={{marginBottom:16,borderColor:checks.ok?t.greenBd:t.redBd}}>
          {checks.bl && <div style={{color:t.red,fontSize:13,fontWeight:700,marginBottom:4}}>⛔ Blacklisted: {checks.bl}</div>}
          {checks.itar?.length > 0 && <div style={{color:t.red,fontSize:13,fontWeight:700,marginBottom:4}}>🔒 ITAR keywords: {checks.itar.join(", ")}</div>}
          {checks.m628 && <div style={{color:t.green,fontSize:13,fontWeight:600,marginBottom:4}}>✓ M628: {checks.m628.name} · Tier {checks.m628.tier} · H-1B: {checks.m628.h1b} · ITAR: {checks.m628.itar}</div>}
          {checks.ok && <div style={{color:t.green,fontSize:13,fontWeight:600}}>✓ No ITAR or blacklist flags</div>}
        </Card>
      )}

      {loading && (
        <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"center",padding:"40px 0"}}>
          {[0,1,2].map(i => <div key={i} style={{width:7,height:7,borderRadius:"50%",background:t.pri,animation:`lp-dot .8s ${i*.15}s ease-in-out infinite`,opacity:.3}}/>)}
        </div>
      )}

      {result?.aiError && (
        <div style={{background:t.yellowL,border:`1px solid ${t.yellowBd}`,borderRadius:8,padding:"10px 16px",marginBottom:12,fontSize:12.5,color:t.yellow,fontWeight:600}}>
          ⚠ AI error: {result.aiError} — showing local keyword results instead.
        </div>
      )}

      {result && !loading && (
        <div>
          {result.aiPowered && (
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,fontSize:12.5,color:t.green,fontWeight:700}}>
              <Sparkles size={13}/> AI-powered analysis by Groq (llama-3.3-70b-versatile)
            </div>
          )}
          {result?.primary_category && (
            <div style={{display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, background:'#f0f5ff', border:'1px solid #adc6ff', fontSize:12, fontWeight:700, color:'#1d4ed8', marginBottom:10}}>
              Resume angle: {result.primary_category}
            </div>
          )}
          {result && primaryResume?.structured_sections?.summary !== null && primaryResume?.structured_sections?.summary !== undefined && (
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
              <input type="checkbox" id="summary-toggle" checked={includeSummary}
                onChange={e => setIncludeSummary(e.target.checked)} />
              <label htmlFor="summary-toggle" style={{fontSize:13, color:'#666', cursor:'pointer'}}>
                Include tailored summary paragraph
              </label>
            </div>
          )}
          {/* Recommended Resume */}
          <Card t={t} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Briefcase size={16} color={t.pri}/>
              <span style={{fontSize:14,fontWeight:700,color:t.tx}}>Recommended Resume</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:t.priL,border:`1px solid ${t.priBd}`,borderRadius:10}}>
              <div style={{width:40,height:40,borderRadius:8,background:t.pri,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff"}}>{result.recommendedResume}</div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:t.tx}}>{RESUMES[result.recommendedResume]?.name || "Unknown"}</div>
                <div style={{fontSize:12.5,color:t.sub}}>{result.resumeReason}</div>
              </div>
            </div>
          </Card>

          <div style={{background:t.redL,border:`1px solid ${t.redBd}`,borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:12.5,fontWeight:700,color:t.red}}>
            CRITICAL: Only TWO modifications permitted — Summary and Skills only. Experience and project bullets are LOCKED.
          </div>

          {genError && (
            <div style={{
              background: t.redL,
              border: `1px solid ${t.redBd}`,
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 12,
              fontSize: 12.5,
              color: t.red,
              fontWeight: 600
            }}>
              Generation failed: {genError}. Check that the compilation service is running.
            </div>
          )}
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <Btn
              onClick={downloadResume}
              disabled={genLoading !== null}
              t={t}
            >
              {genLoading === "resume" ? "Compiling PDF\u2026" : "\u2b07 Download Resume PDF"}
            </Btn>
            <Btn
              onClick={downloadCoverLetter}
              disabled={genLoading !== null}
              variant="secondary"
              t={t}
            >
              {genLoading === "coverletter" ? "Generating\u2026" : "\u2b07 Download Cover Letter"}
            </Btn>
            {genLoading && (
              <span style={{fontSize:12,color:t.muted,fontStyle:"italic"}}>
                First generation may take a few seconds if the service just started\u2026
              </span>
            )}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr",gap:16,marginBottom:16}}>

            {/* MOD 1: Summary — hidden (summary section removed from resume) */}
            <div style={{display:"none"}}>
            <Card t={t} style={{borderColor:t.greenBd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:7,background:t.greenL,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Edit3 size={14} color={t.green}/>
                  </div>
                  <div>
                    <div style={{fontSize:13.5,fontWeight:700,color:t.tx}}>Mod 1 — Summary</div>
                    <div style={{fontSize:11,color:t.muted}}>Auto-injected into your resume PDF download</div>
                  </div>
                </div>
                <Btn size="sm" variant="green" onClick={() => copyText("mod1", mod1PlainText)} t={t}>
                  {copied === "mod1" ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy Text</>}
                </Btn>
              </div>

              {/* Top 5 JD Skills chips */}
              {result.top5_jd_skills?.length > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Top 5 JD Requirements Targeted</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {result.top5_jd_skills.map((k, i) => (
                      <span key={i} style={{fontSize:11.5,padding:"3px 10px",borderRadius:20,background:t.priL,color:t.pri,fontWeight:700,border:`1px solid ${t.priBd}`}}>{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview with bold markers rendered */}
              <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"14px 16px",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Preview</div>
                <div style={{fontSize:13,lineHeight:1.8,color:t.sub,fontStyle:"italic"}}>
                  {renderBoldMarkers(result.mod1_summary) || "—"}
                </div>
              </div>

            </Card>
            </div>

            {/* MOD 2: Skills */}
            <Card t={t} style={{borderColor:t.greenBd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:7,background:t.greenL,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <SlidersHorizontal size={14} color={t.green}/>
                  </div>
                  <div>
                    <div style={{fontSize:13.5,fontWeight:700,color:t.tx}}>Mod 2 — Skills</div>
                    <div style={{fontSize:11,color:t.muted}}>Replace all \skillline rows in Overleaf</div>
                  </div>
                </div>
                <Btn size="sm" variant="green" onClick={() => copyText("mod2", result.mod2_skills)} t={t}>
                  {copied === "mod2" ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy LaTeX</>}
                </Btn>
              </div>

              {/* Formatted preview */}
              <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Preview</div>
                <SkilllinePreview latex={result.mod2_skills} t={t}/>
              </div>

              {/* Raw LaTeX toggle */}
              <button onClick={() => setShowRaw2(!showRaw2)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:t.muted,fontWeight:600,padding:0,marginBottom:showRaw2?8:0}}>
                {showRaw2 ? "▼" : "▶"} Raw LaTeX
              </button>
              {showRaw2 && (
                <div style={{background:t.hover,border:`1px solid ${t.border}`,borderRadius:6,padding:"10px 12px",fontSize:11,lineHeight:1.7,color:t.sub,fontFamily:"monospace",whiteSpace:"pre-wrap",maxHeight:180,overflowY:"auto"}}>
                  {result.mod2_skills}
                </div>
              )}
            </Card>
          </div>

          {/* Additional Analysis */}
          <Card t={t} style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
              <Zap size={16} color={t.pri}/>
              <span style={{fontSize:14,fontWeight:700,color:t.tx}}>Additional Analysis</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Top 5 Missing Keywords</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                  {(result.missing_keywords || []).map(k => (
                    <span key={k} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:t.redL,color:t.red,fontWeight:600}}>{k}</span>
                  ))}
                </div>
                {result.top_matches?.length > 0 && (
                  <>
                    <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Keyword Matches Found</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {result.top_matches.map(k => (
                        <span key={k} style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:t.greenL,color:t.green,fontWeight:600}}>{k}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><span style={{fontSize:12,color:t.sub}}>ATS Keyword Coverage: </span><span style={{fontSize:14,fontWeight:800,color:t.tx}}>{result.ats_coverage}</span></div>
                <div><span style={{fontSize:12,color:t.sub}}>Composites Visible: </span><span style={{fontSize:13,fontWeight:700,color:result.composites_visible?t.green:t.red}}>{result.composites_visible?"Yes — composites keywords present":"No — add composites terms"}</span></div>
                <div><span style={{fontSize:12,color:t.sub}}>Quantification: </span><span style={{fontSize:13,fontWeight:700,color:t.tx}}>{result.quantification_check}</span></div>
              </div>
            </div>
          </Card>

          {/* AI Insights block */}
          {result.ai_insights && (
            <Card t={t} style={{marginBottom:16,borderColor:t.yellowBd}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <div style={{width:28,height:28,borderRadius:7,background:t.yellowL,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Sparkles size={14} color={t.yellow}/>
                </div>
                <div>
                  <div style={{fontSize:13.5,fontWeight:700,color:t.tx}}>AI Insights</div>
                  <div style={{fontSize:11,color:t.muted}}>Recommendations and strategic notes for this application</div>
                </div>
              </div>
              <div style={{fontSize:13,lineHeight:1.8,color:t.sub,background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"14px 16px",whiteSpace:"pre-wrap"}}>
                {result.ai_insights}
              </div>
            </Card>
          )}

          {/* AI Cover Letter Generator */}
          <CoverLetterSection
            role={role || currentJob?.role || ''}
            company={co || currentJob?.company || ''}
            jd={jd}
            analysis={result}
            groqKey={groqKey}
            t={t}
          />

          {/* Application Q&A */}
          <ApplicationQA
            company={co} role={role} jd={jd}
            summary={result.mod1_summary}
            top5Skills={result.top5_jd_skills}
            groqKey={groqKey} t={t}
          />

          {/* Action buttons */}
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={() => { syncToParent({company:co,role,location:loc,link,jd,jobId}); setPage("networking"); }} t={t}>
              <Users size={14}/> Find Contacts
            </Btn>
            <Btn variant="green" onClick={handleCompleteAndLog} t={t}>
              <CheckCircle size={14}/> Complete & Log to Tracker
            </Btn>
            <Btn variant="ghost" onClick={() => setResult(null)} t={t}>Re-Analyze</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
