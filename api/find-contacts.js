import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './lib/ratelimit.js';

const SUPABASE_URL      = 'https://wefcbqfxzvvgremxhubi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZmNicWZ4enZ2Z3JlbXhodWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTI1NjUsImV4cCI6MjA4ODkyODU2NX0.vXTs_vh0dMvEt83FR589vKY9JfcMBFVgN82QblQH6OU';

const PERSONA_MAP = {
  'Recruiter':       { keywords: ['recruiter', 'talent acquisition', 'recruiting'],                              query: 'recruiter OR "talent acquisition"' },
  'Hiring Manager':  { keywords: ['hiring manager'],                                                              query: '"hiring manager"' },
  'Peer Engineer':   { keywords: ['engineer', 'analyst', 'scientist', 'developer'],                              query: 'engineer OR analyst OR scientist' },
  'Executive':       { keywords: ['vp', 'vice president', 'director', 'president', 'ceo', 'cto', 'coo'],        query: 'director OR "vice president" OR vp' },
  'UIUC Alumni':     { keywords: ['uiuc', 'illinois', 'university of illinois'], checkSnippet: true,             query: '"university of illinois" OR uiuc' },
  'Senior Engineer': { keywords: ['senior engineer', 'staff engineer', 'principal'],                             query: '"senior engineer" OR "staff engineer" OR principal' },
};

const DEFAULT_PERSONAS = ['Recruiter', 'Hiring Manager', 'Peer Engineer', 'UIUC Alumni'];

async function serperSearch(query, apiKey, num = 10) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) {
    const raw = await res.text();
    console.error(`Serper error ${res.status}:`, raw);
    throw new Error(`Search service error (${res.status})`);
  }
  const data = await res.json();
  return data.organic || [];
}

function buildBroadQuery(company, role, location) {
  let q = `site:linkedin.com/in "${company}"`;
  if (role)     q += ` "${role}"`;
  if (location) q += ` "${location}"`;
  return q;
}

function buildTargetedQuery(company, persona, location) {
  const q = `site:linkedin.com/in "${company}" ${PERSONA_MAP[persona].query}`;
  return location ? q + ` "${location}"` : q;
}

function classifyPersona(result, personas) {
  const tl = (result.title   || '').toLowerCase();
  const sl = (result.snippet || '').toLowerCase();
  for (const persona of personas) {
    const cfg  = PERSONA_MAP[persona];
    if (!cfg) continue;
    const text = cfg.checkSnippet ? tl + ' ' + sl : tl;
    if (cfg.keywords.some(k => text.includes(k))) return persona;
  }
  return null;
}

function parseContact(result, company, personaSlot, idx) {
  const parts = (result.title || '').split(' - ');
  const name  = parts[0]?.replace(' | LinkedIn', '').trim() || `Contact ${idx + 1}`;
  const title = parts[1]?.trim() || '';
  const tl    = title.toLowerCase();
  const sl    = (result.snippet || '').toLowerCase();

  let type = 'HR';
  if      (tl.includes('recruiter') || tl.includes('talent acquisition') || tl.includes('recruiting'))                                                           type = 'Recruiter';
  else if (tl.includes('hiring manager'))                                                                                                                          type = 'Hiring Manager';
  else if (tl.includes('senior engineer') || tl.includes('staff engineer') || tl.includes('principal'))                                                           type = 'Senior Engineer';
  else if (tl.includes('vp') || tl.includes('vice president') || tl.includes('director') || tl.includes('president') || tl.includes('ceo') || tl.includes('cto') || tl.includes('coo')) type = 'Executive';
  else if (tl.includes('engineer') || tl.includes('manager') || tl.includes('lead') || tl.includes('analyst') || tl.includes('scientist'))                      type = 'Peer';

  const uiuc = tl.includes('uiuc') || tl.includes('illinois') || sl.includes('uiuc') || sl.includes('university of illinois');

  return {
    id:          `c${Date.now()}-${idx}`,
    name,
    title,
    type,
    personaSlot,
    company,
    linkedin_url: result.link || '',
    email:        '',
    why:          (result.snippet || '').slice(0, 100),
    uiuc,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── SP-023: Rate limit (30 req/min per user) ────────────────────────────────
  if (!await checkRateLimit(user.id, 'find-contacts')) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in 60s.' });
  }

  // ── Fetch API key server-side (never trust client-provided key) ─────────────
  const { data: integration, error: dbError } = await supabase
    .from('user_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('service', 'serper')
    .maybeSingle();

  if (dbError || !integration?.api_key) {
    return res.status(400).json({ error: 'No Serper API key configured. Add it in Settings.' });
  }

  const apiKey = integration.api_key;

  const {
    company,
    role     = '',
    location = '',
    personas = DEFAULT_PERSONAS,
    // serperKey intentionally ignored — fetched server-side above
  } = req.body || {};

  if (!company) return res.status(400).json({ error: 'company is required' });

  // Hard-cap personas to prevent unbounded Serper fan-out (CODE-15 / COST-01).
  // Each missing persona triggers up to 2 Serper calls; capping at 6 bounds
  // worst-case to 12 Serper calls (~$0.24) per authenticated request.
  if (!Array.isArray(personas)) {
    return res.status(400).json({ error: 'personas must be an array' });
  }
  if (personas.length > 6) {
    return res.status(400).json({ error: 'Maximum 6 personas per request' });
  }

  try {
    // ── Step 1: Broad call with location ──────────────────────────────────────
    let broad = await serperSearch(buildBroadQuery(company, role, location), apiKey, 10);
    if (broad.length === 0 && location) {
      broad = await serperSearch(buildBroadQuery(company, role, ''), apiKey, 10);
    }

    // ── Step 2: Classify broad results into persona buckets ───────────────────
    const buckets   = {};
    const usedLinks = new Set();
    for (const r of broad) {
      const persona = classifyPersona(r, personas);
      if (persona && !buckets[persona] && !usedLinks.has(r.link)) {
        buckets[persona] = r;
        usedLinks.add(r.link);
      }
    }

    // ── Step 3: Targeted fill-ins for missing personas ────────────────────────
    const missingPersonas = personas.filter(p => !buckets[p]);
    await Promise.all(missingPersonas.map(async (persona) => {
      let targeted = await serperSearch(buildTargetedQuery(company, persona, location), apiKey, 3);
      if (targeted.length === 0 && location) {
        targeted = await serperSearch(buildTargetedQuery(company, persona, ''), apiKey, 3);
      }
      const fresh = targeted.filter(r => !usedLinks.has(r.link));
      if (fresh.length > 0) {
        buckets[persona] = fresh[0];
        usedLinks.add(fresh[0].link);
      }
    }));

    // ── Step 4: Build final contacts — fallback to unused broad results ────────
    const fallback = broad.filter(r => !usedLinks.has(r.link));
    let fi = 0;
    const contacts = personas.map((persona, i) => {
      const r = buckets[persona] || fallback[fi++] || null;
      return r ? parseContact(r, company, persona, i) : null;
    }).filter(Boolean);

    return res.status(200).json(contacts);

  } catch (err) {
    console.error('[api/find-contacts] unhandled error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
