import { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Plus, Check, ExternalLink, Upload, PenTool, Database, CheckCircle, UserPlus } from 'lucide-react';
import { fetchJobs } from '../lib/storage.js';

function Card({children, t, style, onClick}) {
  return <div onClick={onClick} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:20,boxShadow:t.shadow,cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function Btn({children, onClick, disabled, variant="primary", size="md", t, style:xs}) {
  const V={primary:{bg:t.pri,c:"#fff",b:"none"},secondary:{bg:"transparent",c:t.sub,b:`1px solid ${t.border}`},ghost:{bg:"transparent",c:t.muted,b:`1px solid ${t.border}`},green:{bg:t.greenL,c:t.green,b:`1px solid ${t.greenBd}`},red:{bg:t.redL,c:t.red,b:`1px solid ${t.redBd}`}};
  const s=V[variant]||V.primary; const p=size==="sm"?"5px 14px":"10px 20px"; const fs=size==="sm"?12.5:13.5;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.b,padding:p,borderRadius:8,fontSize:fs,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,fontFamily:"inherit",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,...xs}}>{children}</button>;
}
function Chip({children, active, onClick, t}) {
  return <button onClick={onClick} style={{padding:"6px 16px",borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:active?t.pri:t.card,border:`1px solid ${active?t.pri:t.border}`,color:active?"#fff":t.sub,transition:"all .15s"}}>{children}</button>;
}
function Input({label, value, onChange, placeholder, multiline, rows=4, t, style:xs}) {
  const base={width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13.5,outline:"none",boxSizing:"border-box",fontFamily:"inherit",lineHeight:1.6,...xs};
  return <div style={{marginBottom:14}}>{label&&<label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}{multiline?<textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}}/>:<input value={value} onChange={onChange} placeholder={placeholder} style={base}/>}</div>;
}
function SectionLabel({children, t}) {
  return <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:14}}>{children}</div>;
}
function StatusBadge({status, t}) {
  const map={GREEN:{bg:t.greenL,c:t.green},YELLOW:{bg:t.yellowL,c:t.yellow},RED:{bg:t.redL,c:t.red}};
  const s=map[status]||{bg:t.hover,c:t.sub};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,fontSize:11.5,fontWeight:700,background:s.bg,color:s.c}}>{status}</span>;
}
function Spin({t}) {
  return <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"center",padding:"40px 0"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:t.pri,animation:`lp-dot .8s ${i*.15}s ease-in-out infinite`,opacity:.3}}/>)}</div>;
}
const matchColor=(v,t)=>v>=90?t.green:v>=75?t.yellow:t.red;

function universalParse(data) {
  if (Array.isArray(data)) return data;
  // Merge green + yellow before any generic key check (green_jobs alone would drop yellow)
  if (data.green_jobs || data.yellow_jobs) return [...(data.green_jobs||[]),...(data.yellow_jobs||[])];
  for (const k of ["jobs","results","data","items","listings","postings","records"]) {
    if (data[k] && Array.isArray(data[k])) return data[k];
  }
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v;
  }
  return [];
}


const FILTERS = ["All","Today","Visa Sponsor","Remote","90%+ Match","ITAR-Free","Contract"];
const SORT_OPTIONS = [
  { value: 'match_desc', label: 'Match: High → Low' },
  { value: 'match_asc',  label: 'Match: Low → High' },
  { value: 'date_desc',  label: 'Date: Newest' },
  { value: 'date_asc',   label: 'Date: Oldest' },
  { value: 'co_az',      label: 'Company A→Z' },
];

export default function FindJobs({searchResults, setSearchResults, pipeline, addToPipeline, setPage, findCompany, normalizeJob, isBlacklisted, checkITAR, customCompanies, setCustomCompanies, t}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState("match_desc");
  const [tab, setTab] = useState("feed");
  const [expandedBreakdown, setExpandedBreakdown] = useState(null);
  const [feedDates, setFeedDates]       = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [localJson, setLocalJson] = useState("");
  const [ext, setExt] = useState({role:"",company:"",location:"",link:"",type:"Full-time",description:""});
  const [addToIntel, setAddToIntel] = useState(false);
  const [extIntel, setExtIntel] = useState({industry:"",h1b:"LIKELY",itar:"NO"});
  const fileRef = useRef(null);
  const allFeedJobsRef = useRef([]); // full fetch cache — avoids re-querying on date switch
  const HIDDEN_STATUSES = new Set(['completed', 'removed']);
  const pipeIds = new Set(pipeline.map(j => j.id));

  const handleRefresh = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch ALL feed rows in one shot — avoids date-boundary bugs from the
      // two-call fetchFeedDates→fetchJobsByDate chain.
      const allJobs = await fetchJobs();
      allFeedJobsRef.current = allJobs;

      // Extract unique UTC dates (same slice fetchJobs uses for feed_date)
      const seen = new Set();
      const dates = [];
      for (const j of allJobs) {
        if (j.feed_date && !seen.has(j.feed_date)) {
          seen.add(j.feed_date);
          dates.push(j.feed_date);
        }
      }
      dates.sort((a, b) => b.localeCompare(a)); // descending
      setFeedDates(dates);

      const firstDate = dates[0] || '';
      setSelectedDate(firstDate);
      const visible = firstDate
        ? allJobs.filter(j => j.feed_date === firstDate && !j.in_pipeline && !HIDDEN_STATUSES.has(j.status))
        : allJobs.filter(j => !j.in_pipeline && !HIDDEN_STATUSES.has(j.status));
      setSearchResults(visible);
      setLastUpdated(new Date().toISOString());
    } catch(e) {
      setError("Failed to load feed: " + e.message);
    }
    setLoading(false);
  };

  // Auto-load today's feed on first mount so dropdown and data are always in sync.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleRefresh(); }, []);

  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
    // Filter client-side from the already-loaded allFeedJobsRef — instant, no re-fetch
    const jobs = allFeedJobsRef.current.filter(j => j.feed_date === dateStr && !j.in_pipeline && !HIDDEN_STATUSES.has(j.status));
    setSearchResults(jobs);
  };

  const formatDateLabel = (d) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (d === today)     return `Today (${d})`;
    if (d === yesterday) return `Yesterday (${d})`;
    return d;
  };

  const loadJobs = (arr, append=false) => {
    const norm = arr.map((j,i) => normalizeJob(j,i));
    if (append) {
      setSearchResults(prev => { const ids=new Set(prev.map(j=>j.id)); return [...prev,...norm.filter(j=>!ids.has(j.id))]; });
    } else {
      setSearchResults(norm);
    }
    setError("");
  };

  const handleFileUpload = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const arr = universalParse(data);
        if (!arr.length) throw new Error("No job objects found in this JSON file.");
        loadJobs(arr, true);
        setTab("feed");
      } catch(err) {
        setError(`Upload failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteLoad = () => {
    try {
      const data = JSON.parse(localJson.trim());
      const arr = universalParse(data);
      if (!arr.length) throw new Error("No job objects found.");
      loadJobs(arr, true);
      setLocalJson("");
      setTab("feed");
    } catch(err) {
      setError(`Parse failed: ${err.message}`);
    }
  };

  const handleAddExternal = () => {
    if (!ext.role || !ext.company) return;
    const job = normalizeJob({...ext, source:"external", id:`ext-${Date.now()}`}, 0);
    setSearchResults(prev => [job, ...prev]);
    if (addToIntel && !findCompany(ext.company)) {
      setCustomCompanies(prev => [...prev, {name:ext.company, tier:1, h1b:extIntel.h1b, itar:extIntel.itar, industry:extIntel.industry||"Unknown", roles:"", atsPlatform:"Unknown", domain:"", atsBoardUrl:""}]);
    }
    setExt({role:"",company:"",location:"",link:"",type:"Full-time",description:""});
    setAddToIntel(false);
    setTab("feed");
  };

  const filtered = searchResults.filter(j => {
    if (query.trim() && !j.role.toLowerCase().includes(query.toLowerCase()) && !j.company.toLowerCase().includes(query.toLowerCase()) && !(j.industry||"").toLowerCase().includes(query.toLowerCase())) return false;
    // "Today" = most recent pipeline run date (feedDates[0]), not UTC clock date.
    // Using UTC clock here breaks the filter whenever it's past midnight UTC but
    // still "today" in the user's local timezone.
    if (activeFilter === "Today" && feedDates.length > 0 && j.feed_date !== feedDates[0]) return false;
    if (activeFilter === "Visa Sponsor" && j.h1b !== "YES") return false;
    if (activeFilter === "Remote" && !(j.location||"").toLowerCase().includes("remote")) return false;
    if (activeFilter === "90%+ Match" && (j.match||0) < 90) return false;
    if (activeFilter === "ITAR-Free" && j.itar_flag) return false;
    if (activeFilter === "Contract" && j.employment_type !== "Contract") return false;
    return true;
  });

  const companyInfo = findCompany(ext.company);

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:700,color:t.tx}}>Find Jobs</h2>
        <p style={{margin:0,fontSize:14,color:t.sub}}>Jobs scored and distributed to your feed by the daily pipeline</p>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`2px solid ${t.border}`}}>
        {[{id:"feed",label:"Your Feed",Icon:Database},{id:"upload",label:"Upload JSON",Icon:Upload},{id:"external",label:"Add External Job",Icon:PenTool}].map(({id,label,Icon}) => (
          <button key={id} onClick={() => setTab(id)} style={{padding:"10px 20px",fontSize:13.5,fontWeight:tab===id?700:500,color:tab===id?t.pri:t.sub,background:"transparent",border:"none",borderBottom:tab===id?`2px solid ${t.pri}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,marginBottom:-2}}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {/* TAB: Your Feed (Supabase user_job_feed) */}
      {tab === "feed" && (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <div style={{flex:1,position:"relative"}}>
              <Search size={16} color={t.muted} style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}/>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search roles, companies..." style={{width:"100%",background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"11px 14px 11px 42px",color:t.tx,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            {feedDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",color:t.tx,fontSize:13,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
              >
                {feedDates.map(d => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>
            )}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",color:t.tx,fontSize:13,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={handleRefresh} disabled={loading} style={{padding:"0 16px",background:t.card,border:`1px solid ${t.border}`,borderRadius:10,cursor:loading?"not-allowed":"pointer",color:t.sub,display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,fontFamily:"inherit",opacity:loading?.5:1}}>
              <RefreshCw size={14} style={{animation:loading?"lp-spin 1s linear infinite":"none"}}/>{loading?"Loading":"Refresh"}
            </button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {FILTERS.map(f => (
              <Chip key={f} active={activeFilter===f} onClick={() => {
                setActiveFilter(f);
                // "Today" snaps the date selector to the most recent pipeline run date
                if (f === "Today" && feedDates.length > 0) handleDateChange(feedDates[0]);
              }} t={t}>{f}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Upload JSON */}
      {tab === "upload" && (
        <Card t={t} style={{marginBottom:20}}>
          <SectionLabel t={t}>Upload or Paste JSON</SectionLabel>
          <p style={{fontSize:13,color:t.sub,marginBottom:16,lineHeight:1.6}}>Upload any JSON file containing job listings. The parser automatically detects the structure.</p>
          <div style={{display:"flex",gap:12,marginBottom:20}}>
            <input type="file" ref={fileRef} accept=".json" onChange={handleFileUpload} style={{display:"none"}}/>
            <Btn onClick={() => fileRef.current?.click()} t={t}><Upload size={14}/> Choose JSON File</Btn>
          </div>
          <div style={{borderTop:`1px solid ${t.border}`,paddingTop:16}}>
            <div style={{fontSize:12,fontWeight:600,color:t.sub,marginBottom:8}}>Or paste JSON directly:</div>
            <textarea value={localJson} onChange={e => setLocalJson(e.target.value)} placeholder='Paste any JSON here...' rows={5} style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 14px",color:t.tx,fontSize:12,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box",outline:"none"}}/>
            <Btn size="sm" onClick={handlePasteLoad} disabled={!localJson.trim()} t={t} style={{marginTop:8}}>Load Pasted JSON</Btn>
          </div>
        </Card>
      )}

      {/* TAB: External Job */}
      {tab === "external" && (
        <Card t={t} style={{marginBottom:20}}>
          <SectionLabel t={t}>Add a Job You Found Elsewhere</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
            <Input label="Job Title *" value={ext.role} onChange={e => setExt(p=>({...p,role:e.target.value}))} placeholder="Manufacturing Engineer" t={t}/>
            <Input label="Company *" value={ext.company} onChange={e => setExt(p=>({...p,company:e.target.value}))} placeholder="Hanwha Aerospace" t={t}/>
            <Input label="Location" value={ext.location} onChange={e => setExt(p=>({...p,location:e.target.value}))} placeholder="Newington, CT" t={t}/>
            <Input label="Apply Link" value={ext.link} onChange={e => setExt(p=>({...p,link:e.target.value}))} placeholder="https://..." t={t}/>
          </div>
          <Input label="Job Description (optional)" value={ext.description} onChange={e => setExt(p=>({...p,description:e.target.value}))} placeholder="Paste JD for ITAR checks..." multiline rows={3} t={t}/>
          {ext.company && !companyInfo && (
            <div style={{background:t.yellowL,border:`1px solid ${t.yellowBd}`,borderRadius:8,padding:14,marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <input type="checkbox" checked={addToIntel} onChange={e => setAddToIntel(e.target.checked)} id="addIntel"/>
                <label htmlFor="addIntel" style={{fontSize:13,fontWeight:600,color:t.yellow,cursor:"pointer"}}>
                  <UserPlus size={13} style={{display:"inline",verticalAlign:-2,marginRight:4}}/>Add "{ext.company}" to Company Intel Database
                </label>
              </div>
              {addToIntel && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:8}}>
                  <Input label="Industry" value={extIntel.industry} onChange={e => setExtIntel(p=>({...p,industry:e.target.value}))} placeholder="Aerospace" t={t}/>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>H-1B</label>
                    <select value={extIntel.h1b} onChange={e => setExtIntel(p=>({...p,h1b:e.target.value}))} style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13.5,fontFamily:"inherit",outline:"none"}}>
                      <option value="YES">YES</option><option value="LIKELY">LIKELY</option><option value="NO">NO</option>
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,color:t.sub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>ITAR</label>
                    <select value={extIntel.itar} onChange={e => setExtIntel(p=>({...p,itar:e.target.value}))} style={{width:"100%",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 13px",color:t.tx,fontSize:13.5,fontFamily:"inherit",outline:"none"}}>
                      <option value="NO">NO</option><option value="Partial">Partial</option><option value="YES">YES</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
          {ext.company && companyInfo && (
            <div style={{fontSize:12.5,color:t.green,fontWeight:600,marginBottom:14}}>
              <CheckCircle size={13} style={{display:"inline",verticalAlign:-2,marginRight:4}}/> Found in database: {companyInfo.name} (Tier {companyInfo.tier}, H-1B: {companyInfo.h1b})
            </div>
          )}
          <Btn onClick={handleAddExternal} disabled={!ext.role||!ext.company} t={t}><Plus size={14}/> Add to Job Feed</Btn>
        </Card>
      )}

      {error && (
        <Card t={t} style={{marginBottom:16,borderColor:t.redBd,background:t.redL}}>
          <div style={{color:t.red,fontWeight:700,fontSize:13.5,marginBottom:4}}>Error</div>
          <div style={{color:t.red,fontSize:13}}>{error}</div>
        </Card>
      )}
      {loading && !searchResults.length && <Spin t={t}/>}

      {searchResults.length > 0 && (
        <div style={{display:"flex",gap:10,marginBottom:16,fontSize:12.5,color:t.muted}}>
          <span style={{fontWeight:700,color:t.tx}}>{filtered.length}</span> results
          {lastUpdated && <span>· Updated {new Date(lastUpdated).toLocaleString()}</span>}
        </div>
      )}

      {/* Job list */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {[...filtered].sort((a,b) => {
          if (a.itar_flag !== b.itar_flag) return a.itar_flag - b.itar_flag;
          if (sortBy === 'match_desc') return (b.match||0) - (a.match||0);
          if (sortBy === 'match_asc')  return (a.match||0) - (b.match||0);
          if (sortBy === 'date_desc')  return (b.posted||'').localeCompare(a.posted||'');
          if (sortBy === 'date_asc')   return (a.posted||'').localeCompare(b.posted||'');
          if (sortBy === 'co_az')      return (a.company||'').localeCompare(b.company||'');
          return 0;
        }).map((job,i) => {
          const inP = pipeIds.has(job.id);
          return (
            <Card key={job.id||i} t={t} style={{opacity:job.itar_flag?.5:1,borderColor:job.itar_flag?t.redBd:t.border,padding:"14px 18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:14.5,fontWeight:700,color:t.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.role}</span>
                    <StatusBadge status={job.verdict} t={t}/>
                    {job.employment_type==="Contract" && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"rgba(217,119,6,0.13)",color:"#d97706"}}>CONTRACT</span>}
                    {job.legitimacy_tier==="suspicious" && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"rgba(220,38,38,0.1)",color:"#dc2626"}}>⚠ SUSPICIOUS</span>}
                    {job.legitimacy_tier==="caution" && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"rgba(217,119,6,0.1)",color:"#d97706"}}>⚠ CAUTION</span>}
                    {job.source==="external" && <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:t.priL,color:t.pri}}>EXTERNAL</span>}
                  </div>
                  <div style={{fontSize:13,color:t.sub}}>{job.company}{job.location?` · ${job.location}`:""}{job.posted?` · ${job.posted}`:""}</div>
                  {expandedBreakdown===job.id && job.score_breakdown && (
                    <div style={{marginTop:8,padding:"8px 10px",background:t.bg2||t.bg,border:`1px solid ${t.border}`,borderRadius:8,fontSize:11.5,color:t.sub,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px 12px"}}>
                      {[
                        ["Title Match", job.score_breakdown.title_match, 40],
                        ["H1B Score",   job.score_breakdown.h1b_score,   20],
                        ["ITAR Clean",  job.score_breakdown.itar_clean,  10],
                        ["Entry Level", job.score_breakdown.entry_level, 15],
                        ["Co. Intel",  job.score_breakdown.company_intel,10],
                        ["Legitimacy",  job.score_breakdown.legitimacy,   5],
                      ].map(([label, val, max]) => (
                        <div key={label} style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{color:t.muted,minWidth:72}}>{label}</span>
                          <span style={{fontWeight:700,color:val===max?t.green||"#16a34a":t.tx}}>{val}/{max}</span>
                        </div>
                      ))}
                      {(job.red_flags||[]).length > 0 && (
                        <div style={{gridColumn:"1/-1",marginTop:4,color:"#d97706",fontWeight:600}}>
                          Flags: {job.red_flags.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  {job.match != null && (
                    <span
                      onClick={() => setExpandedBreakdown(prev => prev===job.id ? null : job.id)}
                      style={{fontSize:14,fontWeight:800,color:matchColor(job.match,t),cursor:job.score_breakdown?"pointer":"default",userSelect:"none"}}
                      title={job.score_breakdown?"Click to see score breakdown":undefined}
                    >{job.match}%</span>
                  )}
                  {job.link && <a href={job.link} target="_blank" rel="noreferrer" style={{color:t.sub}}><ExternalLink size={14}/></a>}
                  <Btn size="sm" variant={inP?"green":"secondary"} onClick={() => { if(!inP) addToPipeline(job); }} disabled={inP||job.itar_flag} t={t}>
                    {inP ? <><Check size={12}/> Added</> : <><Plus size={12}/> Pipeline</>}
                  </Btn>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && searchResults.length > 0 && !loading && (
        <div style={{textAlign:"center",padding:"48px 24px",color:t.muted}}>
          <Search size={28} color={t.muted} style={{marginBottom:10}}/>
          <div style={{fontSize:14,fontWeight:600,color:t.sub,marginBottom:6}}>No jobs match your current filters.</div>
          <div style={{fontSize:13,color:t.muted}}>
            Try removing a filter or clearing the search query.
          </div>
          <button
            onClick={() => { setActiveFilter("All"); setQuery(""); }}
            style={{marginTop:14,padding:"8px 18px",background:t.priL,border:`1px solid ${t.priBd}`,borderRadius:8,color:t.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
          >
            Clear filters
          </button>
        </div>
      )}
      {searchResults.length === 0 && !loading && (
        <Card t={t} style={{textAlign:"center",padding:"60px 24px"}}>
          <Search size={32} color={t.muted} style={{marginBottom:12}}/>
          <div style={{fontSize:14,fontWeight:600,color:t.sub,marginBottom:8}}>Your feed is empty.</div>
          <div style={{fontSize:13,color:t.muted,marginBottom:16}}>The daily pipeline populates this automatically. You can also upload a JSON file or add jobs manually.</div>
          <button onClick={handleRefresh} disabled={loading} style={{padding:"9px 20px",background:t.priL,border:`1px solid ${t.priBd}`,borderRadius:8,color:t.pri,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6}}>
            <RefreshCw size={14}/> Check for new jobs
          </button>
        </Card>
      )}
    </div>
  );
}
