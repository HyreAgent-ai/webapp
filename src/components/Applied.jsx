import { useState, useEffect, useRef } from 'react';
import { Briefcase, Users, Download, ExternalLink, Linkedin, Search } from 'lucide-react';
import { insertManualApplication } from '../lib/storage.js';

const TODAY_STR = new Date().toISOString().split("T")[0];

const STATUS_OPTIONS = ["Applied", "Interviewing", "Final Stage", "Offer Received", "Rejected"];
const STATUS_COLORS = {
  "Applied":       { bg: "#dcfce7", bd: "#86efac", tx: "#16a34a" },
  "Interviewing":  { bg: "#e0f2fe", bd: "#bae6fd", tx: "#0284c7" },
  "Final Stage":   { bg: "#fef3c7", bd: "#fcd34d", tx: "#d97706" },
  "Offer Received":{ bg: "#ede9fe", bd: "#c4b5fd", tx: "#7c3aed" },
  "Rejected":      { bg: "#fee2e2", bd: "#fca5a5", tx: "#dc2626" },
};

function Card({children, t, style}) {
  return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:20,boxShadow:t.shadow,...style}}>{children}</div>;
}
function Btn({children, onClick, disabled, variant="primary", size="md", t, style:xs}) {
  const V={primary:{bg:t.pri,c:"#fff",b:"none"},secondary:{bg:"transparent",c:t.sub,b:`1px solid ${t.border}`},green:{bg:t.greenL,c:t.green,b:`1px solid ${t.greenBd}`}};
  const s=V[variant]||V.primary; const p=size==="sm"?"5px 14px":"10px 20px"; const fs=size==="sm"?12.5:13.5;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.b,padding:p,borderRadius:8,fontSize:fs,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,fontFamily:"inherit",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,...xs}}>{children}</button>;
}
const matchColor=(v,t)=>v>=90?t.green:v>=75?t.yellow:t.red;

function downloadCSV(rows, headers, filename) {
  const escape = v => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Applied({apps, contacts, setPage, updateApplicationStatus, t}) {
  const networkingLog = (contacts || []).filter(c => c.outreach_sent);
  const [activeTab, setActiveTab] = useState("apps");
  const [dateRange, setDateRange] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date_desc");
  const [showManualLog, setShowManualLog] = useState(false);
  const roleInputRef = useRef(null);
  const [manualForm, setManualForm] = useState({
    role: '', company: '', link: '', date: TODAY_STR, location: '', status: 'Applied',
  });

  useEffect(() => {
    if (showManualLog) roleInputRef.current?.focus();
  }, [showManualLog]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillRole = params.get('prefill_role');
    const prefillCompany = params.get('prefill_company');
    if (prefillRole || prefillCompany) {
      setManualForm(f => ({
        ...f,
        role: prefillRole || f.role,
        company: prefillCompany || f.company,
      }));
      setShowManualLog(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const filterByDate = (items, dateField="date") => {
    if (dateRange === "all") return items;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cutoff;
    if (dateRange === "today") cutoff = startOfDay;
    else if (dateRange === "week") cutoff = new Date(startOfDay.getTime() - 7*86400000);
    else if (dateRange === "month") cutoff = new Date(startOfDay.getTime() - 30*86400000);
    else return items;
    return items.filter(item => { try { return new Date(item[dateField]) >= cutoff; } catch { return true; } });
  };

  const DateRangeBar = () => (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <span style={{fontSize:11,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1}}>Range:</span>
      {[{id:"all",label:"All"},{id:"today",label:"Today"},{id:"week",label:"This Week"},{id:"month",label:"This Month"}].map(({id,label}) => (
        <button key={id} onClick={() => setDateRange(id)} style={{padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:dateRange===id?700:500,cursor:"pointer",fontFamily:"inherit",background:dateRange===id?t.pri+"18":"transparent",border:`1px solid ${dateRange===id?t.pri:t.border}`,color:dateRange===id?t.pri:t.sub}}>{label}</button>
      ))}
    </div>
  );

  // Build filtered + sorted apps
  let filteredApps = filterByDate(apps);
  if (search.trim()) {
    const q = search.toLowerCase();
    filteredApps = filteredApps.filter(a => a.role?.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q));
  }
  if (statusFilter !== "All") {
    filteredApps = filteredApps.filter(a => (a.status || "Applied") === statusFilter);
  }
  if (sortBy === "date_asc") {
    filteredApps = [...filteredApps].sort((a,b) => new Date(a.date||0) - new Date(b.date||0));
  } else if (sortBy === "date_desc") {
    filteredApps = [...filteredApps].sort((a,b) => new Date(b.date||0) - new Date(a.date||0));
  } else if (sortBy === "match") {
    filteredApps = [...filteredApps].sort((a,b) => (Number(b.match)||0) - (Number(a.match)||0));
  }

  const filteredNet = filterByDate(networkingLog);

  const downloadAppCSV = () => {
    const headers = ["Date","Role","Status","Company","Company Link","Location","Apply Link","Match Score","Fit Level","Location Type","Employment Type","Salary","Resume Used"];
    const rows = filteredApps.map(a => [a.date||"",a.role||"",a.status||"Applied",a.company||"",a.companyLink||"",a.location||"",a.link||"",a.match||"",a.fitLevel||"",a.locationType||"Onsite",a.type||"Full-time",a.salary||"",a.resumeVariant?`Resume ${a.resumeVariant}`:""]);
    const suffix = dateRange !== "all" ? `_${dateRange}` : "";
    downloadCSV(rows, headers, `applications${suffix}_${TODAY_STR}.csv`);
  };

  const downloadNetCSV = () => {
    const headers = ["Networked Date","Name","Type","Company","Role","Email","LinkedIn URL"];
    const rows = filteredNet.map(c => [c.date||"",c.name||"",c.type||"",c.company||"",c.role||"",c.email||"NA",c.linkedinUrl||""]);
    const suffix = dateRange !== "all" ? `_${dateRange}` : "";
    downloadCSV(rows, headers, `networking${suffix}_${TODAY_STR}.csv`);
  };

  // Status counts for badges
  const statusCounts = apps.reduce((acc, a) => {
    const s = a.status || "Applied";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:700,color:t.tx}}>Applied</h2>
          <p style={{margin:0,fontSize:14,color:t.sub}}>All logged applications and networking</p>
        </div>
        <Btn t={t} onClick={() => setShowManualLog(true)} variant="secondary" size="sm">+ Log application</Btn>
      </div>

      <div style={{display:"flex",gap:0,marginBottom:20,borderBottom:`2px solid ${t.border}`}}>
        <button onClick={() => setActiveTab("apps")} style={{padding:"10px 20px",fontSize:13.5,fontWeight:activeTab==="apps"?700:500,color:activeTab==="apps"?t.pri:t.sub,background:"transparent",border:"none",borderBottom:activeTab==="apps"?`2px solid ${t.pri}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,marginBottom:-2}}>
          <Briefcase size={15}/>Applications ({apps.length})
        </button>
        <button onClick={() => setActiveTab("networking")} style={{padding:"10px 20px",fontSize:13.5,fontWeight:activeTab==="networking"?700:500,color:activeTab==="networking"?t.pri:t.sub,background:"transparent",border:"none",borderBottom:activeTab==="networking"?`2px solid ${t.pri}`:"2px solid transparent",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,marginBottom:-2}}>
          <Users size={15}/>Networking ({networkingLog.length})
        </button>
      </div>

      {activeTab === "apps" && (
        <div>
          {apps.length === 0 && (
            <Card t={t} style={{textAlign:"center",padding:"60px 24px"}}>
              <Briefcase size={32} color={t.muted} style={{marginBottom:12}}/>
              <div style={{fontSize:14,fontWeight:600,color:t.sub,marginBottom:16}}>No applications logged yet.</div>
              <Btn onClick={() => setPage("search")} t={t}>Find Jobs</Btn>
            </Card>
          )}
          {apps.length > 0 && (
            <div>
              {/* Status filter chips */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {["All", ...STATUS_OPTIONS].map(s => {
                  const col = STATUS_COLORS[s];
                  const isActive = statusFilter === s;
                  const count = s === "All" ? apps.length : (statusCounts[s] || 0);
                  return (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{
                      padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:isActive?700:500,
                      cursor:"pointer",fontFamily:"inherit",
                      background: isActive ? (col ? col.bg : t.priL) : t.card,
                      border: `1px solid ${isActive ? (col ? col.bd : t.pri) : t.border}`,
                      color: isActive ? (col ? col.tx : t.pri) : t.sub
                    }}>
                      {s} {count > 0 && <span style={{fontSize:10,fontWeight:800,marginLeft:3}}>({count})</span>}
                    </button>
                  );
                })}
              </div>

              {/* Search + sort + date controls */}
              <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:160,position:"relative",display:"flex",alignItems:"center"}}>
                  <Search size={13} style={{position:"absolute",left:10,color:t.muted,pointerEvents:"none"}}/>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search role or company…"
                    style={{width:"100%",paddingLeft:30,padding:"7px 10px 7px 30px",background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,color:t.tx,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
                  />
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:"7px 10px",color:t.tx,fontSize:12.5,fontFamily:"inherit",outline:"none"}}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="match">Match Score</option>
                </select>
                <DateRangeBar/>
                <Btn size="sm" variant="green" onClick={downloadAppCSV} disabled={filteredApps.length===0} t={t}>
                  <Download size={13}/> CSV {filteredApps.length !== apps.length ? `(${filteredApps.length})` : ""}
                </Btn>
              </div>

              {filteredApps.length === 0 && (
                <div style={{textAlign:"center",padding:"40px 0",color:t.muted,fontSize:13}}>No applications match your filters.</div>
              )}

              {filteredApps.length > 0 && (
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,borderSpacing:0}}>
                    <thead>
                      <tr style={{borderBottom:`2px solid ${t.border}`}}>
                        {["Date","Role","Status","Company","Location","Match","Fit","Loc Type","Emp Type","Salary","Resume","Link"].map(h => (
                          <th key={h} style={{textAlign:"left",padding:"8px 10px",fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApps.map((a,i) => {
                        const status = a.status || "Applied";
                        const sc = STATUS_COLORS[status] || STATUS_COLORS["Applied"];
                        return (
                          <tr key={a.id||i} style={{borderBottom:`1px solid ${t.border}`}}>
                            <td style={{padding:"8px 10px",color:t.tx,whiteSpace:"nowrap"}}>{a.date}</td>
                            <td style={{padding:"8px 10px",color:t.tx,fontWeight:600,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.role}</td>
                            <td style={{padding:"8px 10px"}}>
                              <select
                                value={status}
                                onChange={e => updateApplicationStatus && updateApplicationStatus(a.id, e.target.value)}
                                style={{background:sc.bg,border:`1px solid ${sc.bd}`,color:sc.tx,borderRadius:20,padding:"3px 8px",fontSize:11.5,fontWeight:700,fontFamily:"inherit",cursor:"pointer",outline:"none"}}
                              >
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{padding:"8px 10px",color:t.sub}}>
                              {a.company}
                              {a.companyLink && <a href={a.companyLink} target="_blank" rel="noreferrer" style={{marginLeft:4,color:t.muted}}><ExternalLink size={10}/></a>}
                            </td>
                            <td style={{padding:"8px 10px",color:t.sub,fontSize:12}}>{a.location}</td>
                            <td style={{padding:"8px 10px",fontWeight:700,color:a.match?matchColor(Number(a.match),t):t.muted}}>{a.match?`${a.match}%`:""}</td>
                            <td style={{padding:"8px 10px"}}>
                              {a.fitLevel && <span style={{fontSize:10.5,fontWeight:700,padding:"2px 7px",borderRadius:10,background:a.fitLevel==="Green"?t.greenL:a.fitLevel==="Yellow"?t.yellowL:t.redL,color:a.fitLevel==="Green"?t.green:a.fitLevel==="Yellow"?t.yellow:t.red}}>{a.fitLevel}</span>}
                            </td>
                            <td style={{padding:"8px 10px",color:t.muted,fontSize:11.5}}>{a.locationType||""}</td>
                            <td style={{padding:"8px 10px",color:t.muted,fontSize:11.5}}>{a.type||""}</td>
                            <td style={{padding:"8px 10px",color:t.muted,fontSize:11.5}}>{a.salary||""}</td>
                            <td style={{padding:"8px 10px"}}>
                              {a.resumeVariant && <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:t.priL,color:t.pri}}>{a.resumeVariant}</span>}
                            </td>
                            <td style={{padding:"8px 10px"}}>
                              {a.link && <a href={a.link} target="_blank" rel="noreferrer" style={{color:t.pri}}><ExternalLink size={13}/></a>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "networking" && (
        <div>
          {networkingLog.length > 0 && (
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12,alignItems:"center",flexWrap:"wrap",gap:8}}>
              <DateRangeBar/>
              <Btn size="sm" variant="green" onClick={downloadNetCSV} disabled={filteredNet.length===0} t={t}>
                <Download size={13}/> Download Networking CSV{dateRange!=="all"?` (${filteredNet.length})`:""}
              </Btn>
            </div>
          )}
          {networkingLog.length === 0 && (
            <Card t={t} style={{textAlign:"center",padding:"60px 24px"}}>
              <Users size={32} color={t.muted} style={{marginBottom:12}}/>
              <div style={{fontSize:14,fontWeight:600,color:t.sub}}>No networking contacts logged yet.</div>
            </Card>
          )}
          {networkingLog.length > 0 && (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5,borderSpacing:0}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${t.border}`}}>
                    {["Networked Date","Name","Type","Company","Role","Email","LinkedIn"].map(h => (
                      <th key={h} style={{textAlign:"left",padding:"8px 10px",fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredNet.map((c,i) => (
                    <tr key={c.id||i} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:"8px 10px",color:t.tx,whiteSpace:"nowrap"}}>{c.date}</td>
                      <td style={{padding:"8px 10px",color:t.tx,fontWeight:600}}>{c.name}</td>
                      <td style={{padding:"8px 10px"}}><span style={{fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:10,background:t.priL,color:t.pri}}>{c.type}</span></td>
                      <td style={{padding:"8px 10px",color:t.sub}}>{c.company}</td>
                      <td style={{padding:"8px 10px",color:t.sub}}>{c.role}</td>
                      <td style={{padding:"8px 10px",color:t.sub,fontSize:12}}>{c.email||"NA"}</td>
                      <td style={{padding:"8px 10px"}}>
                        {c.linkedinUrl && (
                          <a href={c.linkedinUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:6,background:"#0077B5",color:"#fff",fontWeight:600,fontSize:12,textDecoration:"none"}}>
                            <Linkedin size={13}/> Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showManualLog && (
        <div
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Log application manually"
          onKeyDown={e => { if (e.key === 'Escape') setShowManualLog(false); }}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}
        >
          <Card t={t} style={{maxWidth:500,width:'90%',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{marginBottom:8,fontSize:18,fontWeight:700,color:t.tx}}>Log application manually</h2>
            <p style={{fontSize:12,color:t.sub,marginBottom:16}}>The extension's auto-track is being rebuilt. Until then, log applications here.</p>
            <input
              ref={roleInputRef}
              placeholder="Role *"
              value={manualForm.role}
              onChange={e => setManualForm(f => ({...f, role: e.target.value}))}
              style={{width:'100%',padding:'8px 10px',marginBottom:8,border:`1px solid ${t.border}`,borderRadius:6,background:t.bg,color:t.tx,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}
            />
            <input
              placeholder="Company *"
              value={manualForm.company}
              onChange={e => setManualForm(f => ({...f, company: e.target.value}))}
              style={{width:'100%',padding:'8px 10px',marginBottom:8,border:`1px solid ${t.border}`,borderRadius:6,background:t.bg,color:t.tx,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}
            />
            <input
              placeholder="Apply URL (optional)"
              value={manualForm.link}
              onChange={e => setManualForm(f => ({...f, link: e.target.value}))}
              style={{width:'100%',padding:'8px 10px',marginBottom:8,border:`1px solid ${t.border}`,borderRadius:6,background:t.bg,color:t.tx,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}
            />
            <input
              type="date"
              value={manualForm.date}
              onChange={e => setManualForm(f => ({...f, date: e.target.value}))}
              style={{width:'100%',padding:'8px 10px',marginBottom:16,border:`1px solid ${t.border}`,borderRadius:6,background:t.bg,color:t.tx,fontFamily:'inherit',fontSize:13,boxSizing:'border-box'}}
            />
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <Btn t={t} variant="secondary" onClick={() => setShowManualLog(false)}>Cancel</Btn>
              <Btn t={t} onClick={async () => {
                if (!manualForm.role.trim() || !manualForm.company.trim()) {
                  alert('Role and Company are required.');
                  return;
                }
                try {
                  await insertManualApplication(manualForm);
                  setShowManualLog(false);
                  window.location.reload();
                } catch (e) {
                  alert(`Save failed: ${e.message}`);
                }
              }}>Save application</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
