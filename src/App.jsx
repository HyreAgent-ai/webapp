import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  LayoutDashboard, Search, BarChart2, Briefcase, Users, Building2, Settings,
  Sun, Moon, Zap, Activity, FileText, UserCircle
} from "lucide-react";

import { M628, ITAR_KEYWORDS, BLACKLIST } from "./data/m628.js";
import * as Storage from "./lib/storage.js";
import { DEFAULT_TEMPLATES } from "./lib/templates.js";
import { useAuth, signOut } from "./lib/auth.js";
import { supabase } from "./supabase.js";
import Login from "./components/Login.jsx";
import ResetPassword from "./components/ResetPassword.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Welcome from "./components/welcome/Welcome.jsx";
import Consent from "./components/welcome/Consent.jsx";
import Declined from "./components/welcome/Declined.jsx";
import Signup from "./components/Signup.jsx";

import Dashboard from "./components/Dashboard.jsx";
import FindJobs from "./components/FindJobs.jsx";
import Pipeline from "./components/Pipeline.jsx";
import JobAnalysis from "./components/JobAnalysis.jsx";
import Networking from "./components/Networking.jsx";
import Applied from "./components/Applied.jsx";
import CompanyIntel from "./components/CompanyIntel.jsx";
import AppSettings from "./components/Settings.jsx";
import Resume from "./components/Resume.jsx";
import Profile from "./components/Profile.jsx";
import ConnectExtension from "./components/ConnectExtension.jsx";

// ─── THEME ────────────────────────────────────────────────────────────────────
const LIGHT = {
  bg:"#f6f8fa", sb:"#ffffff", card:"#ffffff", border:"#d0d7de",
  tx:"#1f2328", sub:"#636c76", muted:"#9198a1",
  pri:"#0969da", priL:"#ddf4ff", priBd:"#54aeff",
  green:"#1a7f37", greenL:"#dafbe1", greenBd:"#82e295",
  yellow:"#9a6700", yellowL:"#fff8c5", yellowBd:"#d4a72c",
  red:"#cf222e", redL:"#ffebe9", redBd:"#ff8182",
  hover:"#f3f4f6", shadow:"0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)"
};
const DARK = {
  bg:"#0d1117", sb:"#161b22", card:"#1c2128", border:"#30363d",
  tx:"#e6edf3", sub:"#8b949e", muted:"#484f58",
  pri:"#58a6ff", priL:"#1f2d3d", priBd:"#2d4a7a",
  green:"#3fb950", greenL:"#1a2e1a", greenBd:"#2ea043",
  yellow:"#d29922", yellowL:"#2d2208", yellowBd:"#9e6a03",
  red:"#f85149", redL:"#3d1a1a", redBd:"#8d1c1c",
  hover:"#21262d", shadow:"0 1px 3px rgba(0,0,0,.4), 0 1px 2px rgba(0,0,0,.3)"
};

const NAV_GROUPS = [
  { label: "Overview", items: [
    {id:"dashboard", label:"Dashboard", Icon:LayoutDashboard},
  ]},
  { label: "Job Search", items: [
    {id:"search",   label:"Find Jobs",    Icon:Search},
    {id:"pipeline", label:"Pipeline",     Icon:Activity},
    {id:"analyze",  label:"Job Analysis", Icon:BarChart2},
  ]},
  { label: "Tracking", items: [
    {id:"applied",    label:"Applied",      Icon:Briefcase},
    {id:"networking", label:"Networking",   Icon:Users},
    {id:"intel",      label:"Company Intel",Icon:Building2},
  ]},
  { label: "Profile & Tools", items: [
    {id:"resume",   label:"Resume",        Icon:FileText},
    {id:"profile",  label:"Profile",       Icon:UserCircle},
    {id:"settings", label:"API & Settings",Icon:Settings},
  ]},
];
const NAV_ITEMS_FLAT = NAV_GROUPS.flatMap(g => g.items);

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
function findCompany(co) {
  if (!co) return null;
  const l = co.toLowerCase().trim();
  return M628.find(c => l.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(l));
}

function isBlacklisted(co) {
  const l = co.toLowerCase();
  return BLACKLIST.find(b => l.includes(b.toLowerCase()));
}

function checkITAR(text) {
  const l = text.toLowerCase();
  return ITAR_KEYWORDS.filter(k => l.includes(k));
}

function normalizeJob(j, idx) {
  const co = j.company || j.company_name || j.employer || j.organization || "Unknown";
  const role = j.role || j.job_title || j.title || j.position || j.name || "Unknown Role";
  const link = j.link || j.job_url || j.url || j.apply_url || j.apply_link || j.href || "";
  const loc = j.location || j.city || j.place || "";
  const posted = j.posted || j.posted_date || j.date || j.created || j.postedDate || "";
  const src = j.source || "imported";
  const dbCo = findCompany(co);
  return {
    id: j.id || `imp-${co}-${idx}`.replace(/\s+/g, "-"),
    role, company: co, location: loc, type: j.type || "Full-time",
    link, posted,
    itar_flag: j.itar_flag || false, itar_detail: j.itar_detail || "",
    tier: j.tier || j.ats_tier || (dbCo ? `Tier ${dbCo.tier}` : ""),
    h1b: j.h1b || (dbCo ? dbCo.h1b : "LIKELY"),
    industry: j.industry || (dbCo ? dbCo.industry : ""),
    reason: j.reason || `Imported (${src})`,
    match: j.match ?? j.relevance_score ?? (j.itar_flag ? 0 : null),
    verdict: j.verdict || (j.itar_flag ? "RED" : "GREEN"),
    source: src, domain_verified: j.domain_verified || false,
  };
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function JobAgent() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(undefined); // undefined=not loaded, null=no profile, object=loaded
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [dark, setDark] = useState(false);
  const t = dark ? DARK : LIGHT;
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError,    setSaveError]    = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [page, setPageRaw] = useState("dashboard");

  // Gate 2 — pre-signup pathname routing. /welcome, /welcome/consent,
  // /welcome/declined, /signup are unauthenticated routes that intercept
  // BEFORE the auth gate so prospective users can read consent first.
  const [welcomePath, setWelcomePath] = useState(() => {
    if (typeof window === 'undefined') return null;
    const p = window.location.pathname;
    if (p === '/welcome' || p === '/welcome/consent' || p === '/welcome/declined' || p === '/signup') {
      return p;
    }
    return null;
  });

  const [apps, setApps] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [contactResults, setContactResults] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  const [customCompanies, setCustomCompanies] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [groqKey, setGroqKey] = useState("");
  const [serperKey, setSerperKey] = useState("");

  const saveTimer = useRef(null);
  const stateRef = useRef({});

  // Live clock for header — ticks every second
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const clockDisplay = useMemo(() => {
    const date = clockNow.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const time = clockNow.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date, time };
  }, [clockNow]);

  // Keep stateRef current
  useEffect(() => {
    stateRef.current = {apps, pipeline, searchResults, contactResults, dark, currentJob, customCompanies, templates};
  });

  // Catch PASSWORD_RECOVERY event from Supabase reset-link redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load user profile to gate onboarding wizard
  useEffect(() => {
    if (!user) return;
    Storage.fetchUserProfile().then(p => setProfile(p || null)).catch(() => setProfile(null));
  }, [user]);

  // Load all data from Supabase once the user is confirmed
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [dbApps, dbJobs, dbContacts, dbTemplates, dbSettings, savedJob, savedCompanies] = await Promise.all([
          Storage.fetchApplications(),
          Storage.fetchJobs(),
          Storage.fetchContacts(),
          Storage.fetchTemplates(),
          Storage.fetchSettings(),
          Storage.loadCurrentJob(),
          Storage.loadCustomCompanies(),
        ]);

        const pipelineJobs = dbJobs.filter(j => j.in_pipeline && j.status !== 'completed');

        setApps(dbApps);
        setPipeline(pipelineJobs.map(j => ({...j, status: 'active'})));
        setContacts(dbContacts);
        if (dbTemplates.length > 0) setTemplates(dbTemplates);
        if (dbSettings.dark) setDark(dbSettings.dark === 'true');
        // Load API keys from per-user integrations table (falls back to settings for migration period)
        Storage.fetchUserIntegrations().then(integrations => {
          if (integrations.groq)   setGroqKey(integrations.groq);
          else if (dbSettings.groq_api_key) setGroqKey(dbSettings.groq_api_key);
          if (integrations.serper) setSerperKey(integrations.serper);
          else if (dbSettings.serper_api_key) setSerperKey(dbSettings.serper_api_key);
        }).catch(() => {
          if (dbSettings.groq_api_key)   setGroqKey(dbSettings.groq_api_key);
          if (dbSettings.serper_api_key) setSerperKey(dbSettings.serper_api_key);
        });
        if (savedJob) setCurrentJob(savedJob);
        if (savedCompanies.length > 0) setCustomCompanies(savedCompanies);
      } catch(e) {
        console.warn('Supabase load error (will use local state):', e.message);
      }
      setLoaded(true);
    })();
  }, [user?.id]);

  // Debounced save helper
  const debouncedSave = useCallback((saveFn) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      setPendingSaves(n => Math.max(0, n - 1));
    }
    setPendingSaves(n => n + 1);
    setSaveError(null);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveFn();
        setPendingSaves(n => Math.max(0, n - 1));
      } catch(e) {
        setPendingSaves(n => Math.max(0, n - 1));
        setSaveError(e.message || 'Unknown error');
        setTimeout(() => setSaveError(null), 10000);
        console.error("Save error:", e);
      }
    }, 2000);
  }, []);

  // Re-fetch apps when navigating to Dashboard so counts are always fresh.
  // Note: networkingLog is derived from contacts in Applied.jsx — no separate fetch needed.
  useEffect(() => {
    if (page !== 'dashboard' || !loaded) return;
    Storage.fetchApplications()
      .then(freshApps => setApps(freshApps))
      .catch(e => console.warn('Dashboard refresh error:', e));
  }, [page, loaded]);

  // Warn before page unload if a save is still in-flight (prevents pipeline loss on refresh)
  useEffect(() => {
    const handler = (e) => {
      if (pendingSaves > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingSaves]);

  // Route /connect-extension pathname to the connect-extension page
  useEffect(() => {
    if (window.location.pathname === '/connect-extension') {
      setPageRaw('connect-extension');
    }
  }, []);

  // Auto-save currentJob to Supabase whenever it changes
  useEffect(() => {
    if (!loaded || !currentJob) return;
    const timer = setTimeout(() => {
      Storage.saveCurrentJob(currentJob).catch(e => console.warn('currentJob save error:', e));
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentJob, loaded]);

  // Auto-save customCompanies whenever the user adds/removes companies
  useEffect(() => {
    if (!loaded) return;
    Storage.saveCustomCompanies(customCompanies).catch(e => console.warn('customCompanies save error:', e));
  }, [customCompanies, loaded]);

  // ─── State handlers ───────────────────────────────────────────────────────
  const setPage = useCallback((pg, jobData) => {
    if (jobData) setCurrentJob(prev => ({...prev, ...jobData}));
    setPageRaw(pg);
  }, []);

  const trackSave = useCallback((promise) => {
    setPendingSaves(n => n + 1);
    setSaveError(null);
    return promise
      .then(() => setPendingSaves(n => Math.max(0, n - 1)))
      .catch(e => {
        setPendingSaves(n => Math.max(0, n - 1));
        setSaveError(e.message || 'Unknown error');
        setTimeout(() => setSaveError(null), 10000);
        console.error('Save error:', e);
      });
  }, []);

  // Discrete pipeline mutations save immediately — do NOT use debouncedSave here.
  // debouncedSave uses a single shared timer: rapid successive adds cancel each
  // other so only the last job would persist. Direct saves ensure every job lands.
  const addToPipeline = useCallback((job) => {
    const newJob = {...job, status:"active", addedAt:Date.now(), in_pipeline: true};
    setPipeline(p => p.find(j => j.id === job.id) ? p : [...p, newJob]);
    trackSave(Storage.upsertJob(newJob));
  }, [trackSave]);

  const removePipeline = useCallback((id) => {
    setPipeline(p => p.filter(j => j.id !== id));
    trackSave(Storage.softRemoveJob(id));
  }, [trackSave]);

  const completePipeline = useCallback((id) => {
    // Set in_pipeline:false in state so any pending debouncedSave (e.g. from
    // updatePipelineJob) reads the correct value and doesn't re-write in_pipeline:true.
    setPipeline(p => p.map(j => j.id === id ? {...j, status:"completed", in_pipeline: false} : j));
    const job = stateRef.current.pipeline.find(j => j.id === id);
    if (!job) return;
    trackSave(Storage.upsertJob({...job, status:"completed", in_pipeline: false}));
  }, [trackSave]);

  const updatePipelineJob = useCallback((id, updates) => {
    setPipeline(p => p.map(j => j.id === id ? {...j, ...updates} : j));
    debouncedSave(() => {
      const job = stateRef.current.pipeline.find(j => j.id === id);
      if (job) return Storage.upsertJob({...job, ...updates});
    });
  }, [debouncedSave]);

  const updateContact = useCallback(async (id, fields) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c));
    try {
      await Storage.updateContactFields(id, fields);
    } catch (e) {
      console.warn('updateContact error:', e);
    }
  }, []);

  const addContact = useCallback(async (contact) => {
    setContacts(prev => prev.find(c => c.id === contact.id) ? prev : [contact, ...prev]);
    try {
      await Storage.upsertContact(contact);
    } catch (e) {
      console.warn('addContact error:', e);
    }
  }, []);

  const logApplication = useCallback((app) => {
    setApps(p => [...p, app]);
    trackSave(Storage.upsertApplication(app));
  }, [trackSave]);

  const updateApplicationStatus = useCallback((id, status) => {
    setApps(p => p.map(a => a.id === id ? {...a, status} : a));
    trackSave(Storage.upsertApplication({...stateRef.current.apps.find(a => a.id === id), status}));
  }, [trackSave]);

  const setSearchResultsWithSave = useCallback((updater) => {
    setSearchResults(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Only save rows that originated from the DB feed (have a _feedId).
      // External/uploaded jobs have no _feedId and their IDs don't exist in
      // normalized_jobs, so upsert would fail the FK constraint.
      const dbJobs = next.filter(j => j._feedId);
      if (dbJobs.length > 0) {
        debouncedSave(() => Storage.upsertJobs(dbJobs.map(j => ({...j, in_pipeline: false}))));
      }
      return next;
    });
  }, [debouncedSave]);

  const pendingPipeline = pipeline.filter(j => j.status === "active").length;

  const renderSyncStatus = () => {
    if (!loaded) return null;
    if (saveError) return (
      <span style={{color:t.red,fontWeight:700,fontSize:10.5}}>Sync error</span>
    );
    if (pendingSaves > 0) return (
      <span style={{color:t.muted,fontWeight:700,fontSize:10.5}}>Saving...</span>
    );
    return (
      <span style={{display:"flex",alignItems:"center",gap:3,color:t.green,fontWeight:700,fontSize:10.5}}>
        <span style={{width:5,height:5,borderRadius:"50%",background:t.green,display:"inline-block"}}/>Synced
      </span>
    );
  };


  const pages = {
    dashboard: (
      <Dashboard
        apps={apps} pipeline={pipeline} searchResults={searchResults}
        contacts={contacts} setPage={setPage} t={t}
      />
    ),
    search: (
      <FindJobs
        searchResults={searchResults} setSearchResults={setSearchResultsWithSave}
        pipeline={pipeline} addToPipeline={addToPipeline} setPage={setPage}
        findCompany={findCompany} normalizeJob={normalizeJob} isBlacklisted={isBlacklisted}
        checkITAR={checkITAR} customCompanies={customCompanies}
        setCustomCompanies={setCustomCompanies} t={t}
      />
    ),
    pipeline: (
      <Pipeline
        pipeline={pipeline} removePipeline={removePipeline}
        completePipeline={completePipeline} onLogApp={logApplication}
        setPage={setPage} setCurrentJob={setCurrentJob} apps={apps} t={t}
      />
    ),
    analyze: (
      <JobAnalysis
        key={currentJob?.id || 'no-job'}
        currentJob={currentJob} updatePipelineJob={updatePipelineJob}
        completePipeline={completePipeline} onLogApp={logApplication}
        setPage={setPage} setCurrentJob={setCurrentJob} apps={apps}
        findCompany={findCompany} isBlacklisted={isBlacklisted} checkITAR={checkITAR}
        groqKey={groqKey} t={t}
      />
    ),
    networking: (
      <Networking
        currentJob={currentJob} setCurrentJob={setCurrentJob}
        contactResults={contactResults} setContactResults={setContactResults}
        contacts={contacts} addContact={addContact} updateContact={updateContact}
        setPage={setPage} templates={templates} groqKey={groqKey} serperKey={serperKey} t={t}
      />
    ),
    applied: (
      <Applied apps={apps} contacts={contacts} setPage={setPage} updateApplicationStatus={updateApplicationStatus} t={t}/>
    ),
    intel: (
      <CompanyIntel
        customCompanies={customCompanies}
        setCustomCompanies={setCustomCompanies}
        onStartOutreach={(companyName) => {
          setCurrentJob(prev => ({...(prev||{}), company: companyName}));
          setPageRaw('networking');
        }}
        t={t}
      />
    ),
    resume: (
      <Resume profile={profile} groqKey={groqKey} t={t}/>
    ),
    profile: (
      <Profile t={t}/>
    ),
    settings: (
      <AppSettings templates={templates} setTemplates={setTemplates} groqKey={groqKey} setGroqKey={setGroqKey} serperKey={serperKey} setSerperKey={setSerperKey} user={user} onSignOut={signOut} t={t}/>
    ),
    'connect-extension': (
      <ConnectExtension t={t} />
    ),
  };

  // ── Auth gate ────────────────────────────────────────────────────────────────
  if (authLoading || (user && profile === undefined)) return (
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span style={{color:t.sub,fontSize:14}}>Loading…</span>
    </div>
  );
  if (passwordRecovery) return <ResetPassword t={t} onDone={() => setPasswordRecovery(false)} />;

  // Gate 2 — pre-signup consent routes. Render whichever welcome step matches
  // the pathname; only kicks in when no session exists. Authenticated users
  // get auto-redirected to the dashboard so deep-link sharing doesn't break.
  if (!user && welcomePath === '/welcome')           return <Welcome  t={t} />;
  if (!user && welcomePath === '/welcome/consent')   return <Consent  t={t} />;
  if (!user && welcomePath === '/welcome/declined')  return <Declined t={t} />;
  if (!user && welcomePath === '/signup')            return <Signup   t={t} />;
  if (user  && welcomePath) { window.location.assign('/'); return null; }

  if (!user) return <Login t={t} />;
  if (profile === null) return <Onboarding t={t} onComplete={() => Storage.fetchUserProfile().then(p => setProfile(p))} />;

  return (
    <div style={{display:"flex",height:"100vh",background:t.bg,color:t.tx,fontFamily:"'Geist','Inter',system-ui,sans-serif",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap');
        @keyframes lp-dot{0%,100%{transform:translateY(0);opacity:.25}50%{transform:translateY(-5px);opacity:1}}
        @keyframes lp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${t.border};border-radius:5px}
        *{box-sizing:border-box}a{text-decoration:none}
        input::placeholder,textarea::placeholder{color:${t.muted}}
        button{transition:opacity .12s,background .12s,border-color .12s}
      `}</style>

      {/* SIDEBAR */}
      <div style={{width:240,background:t.sb,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:t.pri,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Zap size={18} color="#fff"/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:800,color:t.tx}}>JobAgent</div>
            <div style={{fontSize:10.5,fontWeight:600,color:t.muted,display:"flex",alignItems:"center",gap:5}}>
              <span>v6.1 · Supabase</span>
              {loaded && renderSyncStatus()}
            </div>
          </div>
        </div>

        <nav style={{padding:"0 8px",flex:1,overflowY:"auto",paddingTop:8}}>
          {NAV_GROUPS.map(({label: groupLabel, items}) => (
            <div key={groupLabel}>
              <div style={{padding:"12px 10px 5px",fontSize:10,fontWeight:700,color:t.muted,textTransform:"uppercase",letterSpacing:1.8}}>{groupLabel}</div>
              {items.map(({id, label, Icon}) => {
                const a = page === id;
                return (
                  <div key={id} onClick={() => setPage(id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,marginBottom:1,cursor:"pointer",background:a?t.priL:"transparent",transition:"all .12s"}}
                    onMouseEnter={e => { if(!a) e.currentTarget.style.background=t.hover; }}
                    onMouseLeave={e => { if(!a) e.currentTarget.style.background="transparent"; }}>
                    <Icon size={15} color={a?t.pri:t.muted}/>
                    <span style={{fontSize:13,fontWeight:a?600:400,color:a?t.pri:t.sub}}>{label}</span>
                    {id === "pipeline" && pendingPipeline > 0 && (
                      <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:20,background:t.pri+"22",color:t.pri}}>{pendingPipeline}</span>
                    )}
                    {id === "networking" && contacts.filter(c => c.outreach_sent).length > 0 && (
                      <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:20,background:t.green+"22",color:t.green}}>{contacts.filter(c => c.outreach_sent).length}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {currentJob?.role && (
          <div style={{margin:"0 10px 10px",padding:"11px 14px",background:t.priL,border:`1px solid ${t.priBd}`,borderRadius:10}}>
            <div style={{fontSize:9.5,fontWeight:800,color:t.pri,textTransform:"uppercase",letterSpacing:2,marginBottom:5}}>Active Job</div>
            <div style={{fontSize:13,fontWeight:700,color:t.tx,marginBottom:1}}>{currentJob.role}</div>
            <div style={{fontSize:11.5,color:t.sub}}>{currentJob.company}</div>
          </div>
        )}

        <div style={{padding:"12px 10px",borderTop:`1px solid ${t.border}`}}>
          <div onClick={() => {
            const next = !dark;
            setDark(next);
            Storage.saveSetting('dark', String(next)).catch(e => console.warn('dark save error:', e));
          }} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 12px",borderRadius:9,cursor:"pointer",color:t.sub}}
            onMouseEnter={e => e.currentTarget.style.background=t.hover}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            {dark ? <Sun size={16}/> : <Moon size={16}/>}
            <span style={{fontSize:13.5,fontWeight:500}}>{dark ? "Light Mode" : "Dark Mode"}</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{height:52,borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 28px",background:t.sb,flexShrink:0}}>
          <div style={{fontSize:13,fontWeight:600,color:t.sub}}>
            {NAV_ITEMS_FLAT.find(n => n.id === page)?.label || "Dashboard"}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12.5,fontWeight:600,color:t.sub,fontFamily:"'Geist Mono','Courier New',monospace"}}>{clockDisplay.date}</span>
            <span style={{width:1,height:16,background:t.border}}/>
            <span style={{fontSize:13,fontWeight:700,color:t.tx,fontFamily:"'Geist Mono','Courier New',monospace",minWidth:72,textAlign:"right"}}>{clockDisplay.time}</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          {!loaded ? (
            <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"center",height:"100%"}}>
              {[0,1,2].map(i => <div key={i} style={{width:8,height:8,borderRadius:"50%",background:t.pri,animation:`lp-dot .8s ${i*.15}s ease-in-out infinite`,opacity:.3}}/>)}
            </div>
          ) : (
            pages[page] || pages.dashboard
          )}
        </div>
      </div>
    </div>
  );
}
