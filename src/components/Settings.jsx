import { useState, useEffect } from 'react';
import { Database, Zap, RefreshCw, Plus, Trash2, Edit3, Check, X, ChevronDown, Sparkles, Info } from 'lucide-react';
import { DEFAULT_TEMPLATES } from '../lib/templates.js';
import * as Storage from '../lib/storage.js';
import { supabase } from '../supabase.js';

function Card({children, t, style}) {
  return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:20,boxShadow:t.shadow,...style}}>{children}</div>;
}
function Btn({children, onClick, disabled, variant="primary", size="md", t, style:xs}) {
  const V={primary:{bg:t.pri,c:"#fff",b:"none"},secondary:{bg:"transparent",c:t.sub,b:`1px solid ${t.border}`},ghost:{bg:"transparent",c:t.muted,b:`1px solid ${t.border}`},green:{bg:t.greenL,c:t.green,b:`1px solid ${t.greenBd}`},red:{bg:t.redL,c:t.red,b:`1px solid ${t.redBd}`},danger:{bg:t.red,c:"#fff",b:"none"}};
  const s=V[variant]||V.primary; const p=size==="sm"?"5px 14px":"10px 20px"; const fs=size==="sm"?12.5:13.5;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.b,padding:p,borderRadius:8,fontSize:fs,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,fontFamily:"inherit",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,...xs}}>{children}</button>;
}

export default function AppSettings({templates, setTemplates, groqKey, setGroqKey, serperKey, setSerperKey, user, onSignOut, t}) {
  const [serperStatus, setSerperStatus] = useState("");
  const [testingSerper, setTestingSerper] = useState(false);
  const [serperInput, setSerperInput] = useState(serperKey || "");
  const [serperDirty, setSerperDirty] = useState(false);
  const [serperSaveStatus, setSerperSaveStatus] = useState("");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editDraft, setEditDraft] = useState({name:"", body:""});
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [groqInput, setGroqInput] = useState(groqKey || "");
  const [groqDirty, setGroqDirty] = useState(false);
  const [groqSaveStatus, setGroqSaveStatus] = useState("");
  const [gistMigrateId, setGistMigrateId] = useState("");
  const [gistMigrateToken, setGistMigrateToken] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState("");

  const [prefs, setPrefs]           = useState({});
  const [prefSaving, setPrefSaving] = useState('');

  // Sync inputs when API keys load asynchronously from Supabase
  useEffect(() => { if (!groqDirty)   setGroqInput(groqKey   || ""); }, [groqKey,   groqDirty]);
  useEffect(() => { if (!serperDirty) setSerperInput(serperKey || ""); }, [serperKey, serperDirty]);

  useEffect(() => {
    Storage.fetchPreferences().then(p => setPrefs(p || {})).catch(() => {});
  }, []);

  const savePreferences = async () => {
    setPrefSaving('Saving...');
    try {
      await Storage.savePreferences(prefs);
      setPrefSaving('Saved!');
      setTimeout(() => setPrefSaving(''), 3000);
    } catch(e) {
      setPrefSaving('Error: ' + e.message);
    }
  };

  const saveSerperKey = async () => {
    setSerperDirty(false);
    try {
      setSerperSaveStatus("Saving...");
      await Storage.saveUserIntegration('serper', serperInput.trim());
      setSerperKey(serperInput.trim());
      setSerperSaveStatus(serperInput.trim() ? "Saved!" : "Key cleared.");
      setTimeout(() => setSerperSaveStatus(""), 3000);
    } catch(e) {
      setSerperSaveStatus("Save failed: " + e.message);
    }
  };

  const testSerper = async () => {
    if (serperInput.trim() !== serperKey) {
      setSerperStatus("Save the key first, then test.");
      return;
    }
    setTestingSerper(true);
    setSerperStatus("Testing...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/find-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ company: "Boeing", role: "Engineer", count: 3 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSerperStatus(`Connected! Found ${data.length} results.`);
      } else {
        const err = await res.json();
        setSerperStatus(`Error: ${err.error}`);
      }
    } catch(e) {
      setSerperStatus(`Failed: ${e.message}`);
    }
    setTestingSerper(false);
  };

  const startEdit = (tpl) => {
    setEditingTemplate(tpl.id);
    setEditDraft({name: tpl.name, body: tpl.body});
  };

  const saveEdit = async () => {
    const updated = templates.map(t => t.id === editingTemplate ? {...t, ...editDraft} : t);
    setTemplates(updated);
    try {
      await Storage.upsertTemplate({id: editingTemplate, ...editDraft});
    } catch(e) {
      console.error("Failed to save template:", e);
    }
    setEditingTemplate(null);
  };

  const deleteTemplate = async (id) => {
    if (DEFAULT_TEMPLATES.find(t => t.id === id)) return; // can't delete defaults
    setTemplates(prev => prev.filter(t => t.id !== id));
    try { await Storage.deleteTemplate(id); } catch(e) { console.error(e); }
  };

  const resetTemplates = () => {
    setTemplates(DEFAULT_TEMPLATES);
    DEFAULT_TEMPLATES.forEach(tpl => Storage.upsertTemplate(tpl).catch(console.error));
  };

  const saveGroqKey = async () => {
    setGroqDirty(false);
    try {
      setGroqSaveStatus("Saving...");
      await Storage.saveUserIntegration('groq', groqInput.trim());
      setGroqKey(groqInput.trim());
      setGroqSaveStatus(groqInput.trim() ? "Saved! Groq AI is now active." : "Key cleared.");
      setTimeout(() => setGroqSaveStatus(""), 3000);
    } catch(e) {
      setGroqSaveStatus("Save failed: " + e.message);
    }
  };

  const addTemplate = () => {
    const newTpl = {
      id: `custom-${Date.now()}`,
      name: "New Template",
      body: "Hi {{firstName}}, ..."
    };
    setTemplates(prev => [...prev, newTpl]);
    startEdit(newTpl);
  };

  const migrateFromGist = async () => {
    if (!gistMigrateId || !gistMigrateToken) return;
    setMigrating(true);
    setMigrateStatus("Fetching from Gist...");
    try {
      const authHeaders = [
        {'Authorization': `token ${gistMigrateToken}`},
        {'Authorization': `Bearer ${gistMigrateToken}`}
      ];
      let gistData = null;
      for (const headers of authHeaders) {
        const res = await fetch(`https://api.github.com/gists/${gistMigrateId.trim()}`, {headers});
        if (res.ok) {
          const data = await res.json();
          const raw = data?.files?.["jobagent_data.json"]?.content;
          if (raw) gistData = JSON.parse(raw);
          break;
        }
      }
      if (!gistData) throw new Error("Could not load data from Gist. Check ID and token.");

      const migrateItems = async (key, upsertFn) => {
        const items = gistData[key] || [];
        if (items.length > 0) {
          for (const item of items) {
            try { await upsertFn(item); } catch(e) { /* skip dups */ }
          }
        }
        return items.length;
      };

      const appCount = await migrateItems("ja_v5-apps", Storage.upsertApplication);
      const netCount = await migrateItems("ja_v5-netlog", Storage.upsertNetlog);

      setMigrateStatus(`Migration complete! ${appCount} applications, ${netCount} networking contacts imported to Supabase. Refresh the page to see your data.`);
    } catch(e) {
      setMigrateStatus(`Migration failed: ${e.message}`);
    }
    setMigrating(false);
  };

  const allTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES;

  return (
    <div>
      <div style={{marginBottom:28}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:800,color:t.tx}}>Settings</h2>
            <p style={{margin:0,fontSize:13.5,color:t.sub}}>Manage templates, test integrations, and migrate data.</p>
          </div>
          {user && (
            <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
              <span style={{color:t.sub,fontSize:12.5}}>{user.email}</span>
              <button onClick={onSignOut} style={{
                background:t.redL, color:t.red, border:`1px solid ${t.redBd}`,
                padding:'5px 14px', borderRadius:8, fontSize:12.5, fontWeight:600,
                cursor:'pointer', fontFamily:'inherit',
              }}>Sign Out</button>
            </div>
          )}
        </div>
      </div>

      {/* Getting Started */}
      <Card t={t} style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{width:34,height:34,borderRadius:9,background:t.priL,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Info size={16} color={t.pri}/>
          </div>
          <div>
            <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Getting Started</div>
            <div style={{fontSize:12,color:t.muted}}>How JobAgent works</div>
          </div>
        </div>
        {[
          ['Job Feed',    'Scrapers run daily via GitHub Actions. Jobs are matched against your target roles set in Profile. New jobs appear in Find Jobs.'],
          ['Pipeline',   'Add jobs to Pipeline from Find Jobs. Use Job Analysis to analyze a JD against your resume variant. Log applications from the Pipeline view.'],
          ['Resume',     'Create structured resumes in the Resume section. Run AI analysis (requires Groq key) for scoring and improvement suggestions. Primary resume is used in Job Analysis.'],
          ['Networking', 'Add contacts from Find Contacts. Compose messages using templates. Track conversation status and follow-ups in the Networking log.'],
          ['API Keys',   'Groq (free at console.groq.com) enables AI analysis and message drafting. Serper (free at serper.dev) enables LinkedIn contact search.'],
        ].map(([title, desc]) => (
          <div key={title} style={{display:'flex',gap:12,marginBottom:12}}>
            <div style={{width:90,fontSize:12,fontWeight:700,color:t.sub,flexShrink:0,paddingTop:1}}>{title}</div>
            <div style={{fontSize:12.5,color:t.tx,lineHeight:1.6}}>{desc}</div>
          </div>
        ))}
      </Card>

      {/* Message Templates */}
      <Card t={t} style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:t.priL,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Edit3 size={16} color={t.pri}/>
            </div>
            <div>
              <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Message Templates</div>
              <div style={{fontSize:12,color:t.muted}}>{allTemplates.length} templates for networking outreach</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn size="sm" variant="secondary" onClick={resetTemplates} t={t}><RefreshCw size={12}/> Reset to Defaults</Btn>
            <Btn size="sm" onClick={addTemplate} t={t}><Plus size={12}/> Add Template</Btn>
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {allTemplates.map(tpl => (
            <div key={tpl.id} style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
              {editingTemplate === tpl.id ? (
                <div style={{padding:16}}>
                  <div style={{marginBottom:10}}>
                    <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Template Name</label>
                    <input value={editDraft.name} onChange={e => setEditDraft(p=>({...p,name:e.target.value}))} style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Body (use {"{{firstName}}, {{company}}, {{role}}, {{variantFocus}}, {{variantSkills}}"})</label>
                    <textarea value={editDraft.body} onChange={e => setEditDraft(p=>({...p,body:e.target.value}))} rows={6} style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 14px",color:t.tx,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",lineHeight:1.6}}/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn size="sm" variant="green" onClick={saveEdit} t={t}><Check size={12}/> Save</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditingTemplate(null)} t={t}><X size={12}/> Cancel</Btn>
                  </div>
                </div>
              ) : (
                <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:t.tx,marginBottom:4}}>{tpl.name}</div>
                    <div style={{fontSize:12,color:t.muted,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{tpl.body}</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12}}>
                    <Btn size="sm" variant="secondary" onClick={() => startEdit(tpl)} t={t}><Edit3 size={11}/> Edit</Btn>
                    {!DEFAULT_TEMPLATES.find(d => d.id === tpl.id) && (
                      <Btn size="sm" variant="red" onClick={() => deleteTemplate(tpl.id)} t={t}><Trash2 size={11}/></Btn>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Serper API Key */}
      <Card t={t} style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:34,height:34,borderRadius:9,background:t.greenL,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Database size={16} color={t.green}/>
          </div>
          <div>
            <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Serper API Key</div>
            <div style={{fontSize:12,color:serperKey?t.green:t.muted}}>{serperKey ? "Active — Find Contacts enabled" : "Add key to enable Find Contacts in Networking"}</div>
          </div>
        </div>
        <div style={{background:t.hover,borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:12.5,color:t.sub,lineHeight:1.6}}>
          Get a free key at <strong>serper.dev</strong>. Powers the LinkedIn contact search in Networking.
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Serper API Key</label>
          <input
            type="password"
            value={serperInput}
            onChange={e => { setSerperInput(e.target.value); setSerperDirty(true); }}
            placeholder="paste your Serper key..."
            style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}
          />
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <Btn onClick={saveSerperKey} disabled={serperInput === (serperKey||"")} t={t}>Save Key</Btn>
          <Btn variant="secondary" onClick={testSerper} disabled={testingSerper||(!serperInput&&!serperKey)} t={t}>{testingSerper ? "Testing..." : "Test Connection"}</Btn>
          {serperSaveStatus && <span style={{fontSize:12.5,fontWeight:600,color:serperSaveStatus.includes("failed")?t.red:t.green}}>{serperSaveStatus}</span>}
          {serperStatus && <span style={{fontSize:12.5,fontWeight:600,color:serperStatus.includes("Connected")?t.green:t.red}}>{serperStatus}</span>}
        </div>
      </Card>

      {/* Groq AI */}
      <Card t={t} style={{marginBottom:20}}>
        <button onClick={() => setPremiumOpen(!premiumOpen)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",padding:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:t.yellowL,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Sparkles size={16} color={t.yellow}/>
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Groq AI (Free)</div>
              <div style={{fontSize:12,color:groqKey?t.green:t.muted}}>{groqKey ? "Active — AI-powered analysis enabled" : "Add key to enable AI analysis and drafting"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {groqKey && <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,background:t.greenL,color:t.green}}>ACTIVE</span>}
            <ChevronDown size={16} color={t.muted} style={{transform:premiumOpen?"rotate(180deg)":"rotate(0deg)",transition:"transform .2s"}}/>
          </div>
        </button>
        {premiumOpen && (
          <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${t.border}`}}>
            <div style={{background:t.hover,borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:12.5,color:t.sub,lineHeight:1.6}}>
              Groq provides a free API for <strong>llama-3.3-70b</strong>. Get a key at <strong>console.groq.com</strong> (free tier). Enables AI-powered Job Analysis and smart message drafting.
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Groq API Key</label>
              <input
                type="password"
                value={groqInput}
                onChange={e => { setGroqInput(e.target.value); setGroqDirty(true); }}
                placeholder="gsk_..."
                style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}
              />
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <Btn onClick={saveGroqKey} disabled={groqInput === (groqKey||"")} t={t}><Sparkles size={13}/> Save Key</Btn>
              {groqKey && <Btn variant="secondary" onClick={() => { setGroqInput(""); }} t={t}>Clear</Btn>}
              {groqSaveStatus && (
                <span style={{fontSize:12.5,fontWeight:600,color:groqSaveStatus.includes("failed")?t.red:t.green}}>{groqSaveStatus}</span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Job Preferences */}
      <Card t={t} style={{marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:t.yellowL,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Zap size={16} color={t.yellow}/>
            </div>
            <div>
              <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Job Preferences</div>
              <div style={{fontSize:12,color:t.muted}}>Controls feed filtering.</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {prefSaving && <span style={{fontSize:12,fontWeight:600,color:prefSaving.includes('Error')?t.red:t.green}}>{prefSaving}</span>}
            <Btn size="sm" onClick={savePreferences} t={t}>Save Preferences</Btn>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:'uppercase',letterSpacing:1}}>Location Preferences (comma-separated)</label>
            <input
              value={(prefs.location_preference||[]).join(', ')}
              onChange={e => setPrefs(p => ({...p, location_preference: e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}
              placeholder="Los Angeles, Seattle, Remote"
              style={{width:'100%',background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:'9px 13px',color:t.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:'uppercase',letterSpacing:1}}>Exclude These Role Types</label>
            <input
              value={(prefs.exclude_roles||[]).join(', ')}
              onChange={e => setPrefs(p => ({...p, exclude_roles: e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}
              placeholder="software engineer, data scientist"
              style={{width:'100%',background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:'9px 13px',color:t.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:'uppercase',letterSpacing:1}}>Min Feed Score (0–100)</label>
            <input
              type="number" min="0" max="100"
              value={prefs.feed_min_score ?? 30}
              onChange={e => setPrefs(p => ({...p, feed_min_score: parseInt(e.target.value)||0}))}
              style={{width:'100%',background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:'9px 13px',color:t.tx,fontSize:13,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            />
          </div>
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:'uppercase',letterSpacing:1}}>H1B / Visa Filter</label>
            <label style={{display:'flex',alignItems:'center',gap:8,marginTop:10,fontSize:13,color:t.tx,cursor:'pointer'}}>
              <input type="checkbox" checked={!!prefs.h1b_filter} onChange={e => setPrefs(p => ({...p, h1b_filter: e.target.checked}))} />
              Only show H1B-sponsoring companies
            </label>
          </div>
        </div>
      </Card>

      {/* Import from GitHub Gist */}
      <Card t={t}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:34,height:34,borderRadius:9,background:t.priL,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <RefreshCw size={16} color={t.pri}/>
          </div>
          <div>
            <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>Import from GitHub Gist</div>
            <div style={{fontSize:12,color:t.muted}}>One-time migration from old localStorage/Gist storage to Supabase</div>
          </div>
        </div>

        <div style={{background:t.hover,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:12.5,color:t.sub,lineHeight:1.6}}>
          If you used the previous version of JobAgent (v5.x with GitHub Gist sync), paste your Gist ID and token below to import your applications and networking log into Supabase.
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>Gist ID</label>
            <input value={gistMigrateId} onChange={e => setGistMigrateId(e.target.value)} placeholder="abc123def456..." style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>GitHub Token (ghp_...)</label>
            <input type="password" value={gistMigrateToken} onChange={e => setGistMigrateToken(e.target.value)} placeholder="ghp_..." style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13,fontFamily:"monospace",outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <Btn onClick={migrateFromGist} disabled={migrating||!gistMigrateId||!gistMigrateToken} t={t}>
            {migrating ? "Migrating..." : "Import from Gist"}
          </Btn>
          {migrateStatus && (
            <span style={{fontSize:12.5,fontWeight:600,color:migrateStatus.includes("complete")?t.green:migrateStatus.includes("fail")?t.red:t.sub,maxWidth:500,lineHeight:1.4}}>{migrateStatus}</span>
          )}
        </div>
      </Card>

    </div>
  );
}
