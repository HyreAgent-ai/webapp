import { useState } from 'react';
import { Activity, ArrowRight, Check, Trash2 } from 'lucide-react';

function Card({children, t, style, onClick}) {
  return <div onClick={onClick} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:20,boxShadow:t.shadow,cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function Btn({children, onClick, disabled, variant="primary", size="md", t, style:xs}) {
  const V={primary:{bg:t.pri,c:"#fff",b:"none"},secondary:{bg:"transparent",c:t.sub,b:`1px solid ${t.border}`},green:{bg:t.greenL,c:t.green,b:`1px solid ${t.greenBd}`},red:{bg:t.redL,c:t.red,b:`1px solid ${t.redBd}`}};
  const s=V[variant]||V.primary; const p=size==="sm"?"5px 14px":"10px 20px"; const fs=size==="sm"?12.5:13.5;
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.c,border:s.b,padding:p,borderRadius:8,fontSize:fs,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,fontFamily:"inherit",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:6,...xs}}>{children}</button>;
}
function SectionLabel({children, t}) {
  return <div style={{fontSize:10.5,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:14}}>{children}</div>;
}
function StatusBadge({status, t}) {
  const map={GREEN:{bg:t.greenL,c:t.green},YELLOW:{bg:t.yellowL,c:t.yellow},RED:{bg:t.redL,c:t.red}};
  const s=map[status]||{bg:t.hover,c:t.sub};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,fontSize:11.5,fontWeight:700,background:s.bg,color:s.c}}>{status}</span>;
}
const matchColor=(v,t)=>v>=90?t.green:v>=75?t.yellow:t.red;

export default function Pipeline({pipeline, removePipeline, completePipeline, onLogApp, setPage, setCurrentJob, apps, t}) {
  const [verdictFilter, setVerdictFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date");

  const active = pipeline.filter(j => j.status === "active");
  const appKeys = new Set(apps.map(a => `${a.role}||${a.company}`));

  const handleComplete = (job) => {
    const key = `${job.role}||${job.company}`;
    if (!appKeys.has(key)) {
      onLogApp({
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: job.role,
        company: job.company,
        location: job.location || "",
        link: job.link || "",
        companyLink: "",
        match: job.match != null ? job.match : "",
        verdict: job.verdict || "GREEN",
        status: "Applied",
        date: new Date().toISOString().split('T')[0],
        locationType: job.locationType || "Onsite",
        type: job.type || "Full-time",
        salary: job.salary || "",
        resumeVariant: job.resumeVariant || "",
        fitLevel: job.verdict === "GREEN" ? "Green" : job.verdict === "YELLOW" ? "Yellow" : "Red"
      });
    }
    completePipeline(job.id);
  };

  return (
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:24,fontWeight:700,color:t.tx}}>Pipeline</h2>
        <p style={{margin:0,fontSize:14,color:t.sub}}>Jobs you want to apply to this session. Process each one through Analysis and Networking.</p>
      </div>

      {/* Flow guide */}
      <Card t={t} style={{marginBottom:20,padding:"16px 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          {["Add Jobs","Analyze","Network","Complete"].map((step,i) => (
            <div key={step} style={{flex:1,display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:t.pri,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700}}>{i+1}</div>
                <span style={{fontSize:11,fontWeight:600,color:t.pri,whiteSpace:"nowrap"}}>{step}</span>
              </div>
              {i < 3 && <div style={{flex:1,height:2,background:t.border,margin:"0 4px",marginTop:-18}}/>}
            </div>
          ))}
        </div>
      </Card>

      {active.length === 0 && (
        <Card t={t} style={{textAlign:"center",padding:"60px 24px"}}>
          <Activity size={32} color={t.muted} style={{marginBottom:12}}/>
          <div style={{fontSize:14,fontWeight:600,color:t.sub,marginBottom:16}}>No jobs in pipeline. Add jobs from Find Jobs.</div>
          <Btn onClick={() => setPage("search")} t={t}>Find Jobs</Btn>
        </Card>
      )}

      {active.length > 0 && (() => {
        const selStyle = {background:t.card,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",color:t.tx,fontSize:12.5,fontFamily:"inherit",outline:"none",cursor:"pointer"};

        const displayed = active
          .filter(j => verdictFilter === "All" || (j.verdict||"YELLOW") === verdictFilter)
          .sort((a, b) => {
            if (sortBy === "match")   return (b.match||0) - (a.match||0);
            if (sortBy === "company") return (a.company||"").localeCompare(b.company||"");
            // date: newest first (addedAt is a ms timestamp set in addToPipeline)
            return (b.addedAt||0) - (a.addedAt||0);
          });

        return (
          <>
            {/* Sort + filter row */}
            <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{fontSize:11,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1}}>Sort</div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={selStyle}>
                <option value="date">Date Added</option>
                <option value="match">Match %</option>
                <option value="company">Company</option>
              </select>
              <div style={{fontSize:11,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1,marginLeft:8}}>Filter</div>
              <select value={verdictFilter} onChange={e => setVerdictFilter(e.target.value)} style={selStyle}>
                <option value="All">All Verdicts</option>
                <option value="GREEN">GREEN</option>
                <option value="YELLOW">YELLOW</option>
                <option value="RED">RED</option>
              </select>
              <span style={{fontSize:12,color:t.muted,marginLeft:"auto"}}>{displayed.length} of {active.length}</span>
            </div>

            <SectionLabel t={t}>Active ({active.length})</SectionLabel>
            {displayed.map(job => (
              <Card key={job.id} t={t} style={{marginBottom:8,padding:"14px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14.5,fontWeight:700,color:t.tx}}>{job.role}</div>
                    <div style={{fontSize:13,color:t.sub}}>{job.company}{job.location?` · ${job.location}`:""}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {job.match != null && <span style={{fontSize:13,fontWeight:700,color:matchColor(job.match,t)}}>{job.match}%</span>}
                    <StatusBadge status={job.verdict||"YELLOW"} t={t}/>
                    <Btn size="sm" onClick={() => setPage("analyze", job)} t={t}><ArrowRight size={12}/> Analyze</Btn>
                    <Btn size="sm" variant="green" onClick={() => handleComplete(job)} t={t}><Check size={12}/> Complete</Btn>
                    <Btn size="sm" variant="red" onClick={() => {
                      if (window.confirm(`Remove "${job.role}" at ${job.company} from your pipeline?`)) {
                        removePipeline(job.id);
                      }
                    }} t={t}><Trash2 size={12}/></Btn>
                  </div>
                </div>
              </Card>
            ))}
          </>
        );
      })()}
    </div>
  );
}
