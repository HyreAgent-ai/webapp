import { supabase } from '../supabase.js';

// ── Auth helper ────────────────────────────────────────────────────────────────
async function getUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ── Field sanitizers ───────────────────────────────────────────────────────────

// Maps camelCase JS job fields → user_job_feed per-user columns
function sanitizeJobFeedUpdate(job) {
  return {
    job_id:               String(job.id),
    user_relevance_score: job.match != null ? parseInt(job.match) || null : null,
    in_pipeline:          job.in_pipeline || false,
    pipeline_added_at:    job.in_pipeline ? (job.pipeline_added_at || new Date().toISOString()) : null,
    analysis_result:      job.analysisResult || job.analysis_result || null,
    resume_variant:       job.resumeVariant || job.resume_variant || null,
    status:               job.in_pipeline ? 'viewed' : (job.status || 'new'),
  };
}

function sanitizeApplication(app) {
  return {
    id:            String(app.id),
    role:          app.role || null,
    company:       app.company || null,
    location:      app.location || null,
    link:          app.link || null,
    company_link:  app.companyLink || app.company_link || null,
    match:         app.match != null ? parseInt(app.match) || null : null,
    verdict:       app.verdict || null,
    status:        app.status || 'Applied',
    date:          app.date || null,
    location_type: app.locationType || app.location_type || null,
    type:          app.type || null,
    salary:        app.salary || null,
    resume_variant: app.resumeVariant || app.resume_variant || null,
    fit_level:     app.fitLevel || app.fit_level || null,
  };
}

// Field whitelists for the four upsert helpers that previously did mass-assignment
// (CODE-11). Each returns ONLY columns the UI legitimately edits — anything else
// the caller passes in is discarded so a logged-in user cannot set system-controlled
// columns (timestamps, ownership flags) by spreading an object into the upsert.

function sanitizeTemplate(t) {
  return {
    id:   t.id,
    name: t.name || null,
    body: t.body || null,
  };
}

function sanitizeRoleTarget(rt) {
  return {
    id:           rt.id,
    title:        rt.title || null,
    cluster:      rt.cluster || null,
    priority:     rt.priority != null ? parseInt(rt.priority) || null : null,
    keywords:     Array.isArray(rt.keywords) ? rt.keywords : [],
    boost_tags:   Array.isArray(rt.boost_tags) ? rt.boost_tags : [],
    require_h1b: !!rt.require_h1b,
    active:       rt.active !== undefined ? !!rt.active : true,
  };
}

function sanitizeResumeVariant(v) {
  return {
    id:              v.id,
    variant_key:     v.variant_key || null,
    name:            v.name || null,
    description:     v.description || null,
    target_clusters: Array.isArray(v.target_clusters) ? v.target_clusters : [],
  };
}

// Allowed columns for public.contacts. Built from observed reads/writes in
// src/components/networking/* and src/components/Dashboard.jsx. Anything not in
// this whitelist is dropped from upserts/updates.
const CONTACT_ALLOWED = new Set([
  'id', 'name', 'company', 'position', 'title', 'type', 'role_type', 'persona',
  'email', 'linkedin_url',
  'conv_status', 'conversation_stage',
  'last_contact', 'days_since', 'message_count',
  'follow_up', 'follow_up_priority', 'follow_up_snoozed_until',
  'outreach_status', 'outreach_date', 'outreach_sent', 'outreach_status_changed_at',
  'is_poc_candidate', 'is_confirmed_poc', 'poc_score',
  'priority', 'next_action',
  'promise_made', 'promise_status', 'promise_text',
  'two_way_conversation', 'relationship_strength',
  'uiuc', 'summary', 'notes', 'why',
]);

function sanitizeContact(c) {
  // Accept camelCase aliases the rest of the codebase emits.
  const normalized = { ...c, linkedin_url: c.linkedin_url || c.linkedinUrl || null };
  const out = {};
  for (const k of Object.keys(normalized)) {
    if (CONTACT_ALLOWED.has(k)) out[k] = normalized[k];
  }
  // Ensure id is always present (callers enforce it upstream).
  if (c.id !== undefined) out.id = c.id;
  return out;
}

export async function insertManualApplication(input) {
  // BOLA-02: reject caller-supplied IDs that could collide with scraper-generated IDs
  if (input.id !== undefined && !String(input.id).startsWith('manual-')) {
    throw new Error('Application ID must start with "manual-"');
  }
  const userId = await getUserId();
  const row = sanitizeApplication({
    ...input,
    id: input.id || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: input.status || 'Applied',
    date: input.date || new Date().toISOString().slice(0, 10),
  });
  row.user_id = userId;

  const { data, error } = await supabase
    .from('applications')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return hydrateApplication(data);
}

// ── Hydrators — restore JS shape from DB rows ──────────────────────────────────

// Converts a user_job_feed + normalized_jobs joined row into the job shape the UI expects
export function hydrateJob(row) {
  return {
    ...row,
    analysisResult: row.analysis_result,
    locationType:   row.location_type,
    resumeVariant:  row.resume_variant,
    companyLink:    row.company_link,
  };
}

export function hydrateApplication(row) {
  return {
    ...row,
    companyLink:   row.company_link   || '',
    locationType:  row.location_type  || '',
    resumeVariant: row.resume_variant || '',
    fitLevel:      row.fit_level      || '',
  };
}

// ── Jobs (reads from user_job_feed ⨯ normalized_jobs) ─────────────────────────
export async function fetchJobs() {
  const userId = await getUserId();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const selectShape = `
    *,
    job:normalized_jobs (
      id, job_title, company_name, job_url, location, posted_date,
      description, source, itar_flag, tier, h1b, industry,
      verdict, relevance_score, boost_tags, employment_type,
      red_flags, legitimacy_tier
    )
  `;

  const [feedResult, pipelineResult] = await Promise.all([
    supabase
      .from('user_job_feed')
      .select(selectShape)
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_job_feed')
      .select(selectShape)
      .eq('user_id', userId)
      .eq('in_pipeline', true)
      .order('created_at', { ascending: false }),
  ]);

  if (feedResult.error) throw feedResult.error;
  if (pipelineResult.error) throw pipelineResult.error;

  // Merge and deduplicate by row id — pipeline rows take priority
  const seen = new Set();
  const merged = [...(pipelineResult.data || []), ...(feedResult.data || [])].filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return merged.map(row => ({
    id:               row.job_id,
    role:             row.job?.job_title       ?? null,
    company:          row.job?.company_name    ?? null,
    link:             row.job?.job_url         ?? null,
    location:         row.job?.location        ?? null,
    posted:           row.job?.posted_date     ?? null,
    description:      row.job?.description     ?? null,
    source:           row.job?.source          ?? null,
    itar_flag:        row.job?.itar_flag       ?? false,
    tier:             row.job?.tier            ?? null,
    h1b:              row.job?.h1b             ?? null,
    industry:         row.job?.industry        ?? null,
    verdict:          row.job?.verdict         ?? null,
    match:            row.user_relevance_score ?? row.job?.relevance_score ?? null,
    boost_tags:       row.job?.boost_tags      ?? [],
    employment_type:  row.job?.employment_type ?? null,
    red_flags:        row.job?.red_flags       ?? [],
    legitimacy_tier:  row.job?.legitimacy_tier ?? null,
    score_breakdown:  row.score_breakdown      ?? null,
    in_pipeline:      row.in_pipeline,
    status:           row.status,
    feed_date:        row.created_at ? row.created_at.slice(0, 10) : null,
    notes:            row.notes,
    resumeVariant:    row.resume_variant,
    resume_variant:   row.resume_variant,
    _feedId:          row.id,
    pipeline_added_at: row.pipeline_added_at   ?? null,
    analysisResult:   row.analysis_result      ?? null,
    analysis_result:  row.analysis_result      ?? null,
  }));
}

// Returns sorted unique date strings (YYYY-MM-DD) for the last 7 days that have feed rows
export async function fetchFeedDates() {
  const userId = await getUserId();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('user_job_feed')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const seen = new Set();
  const dates = [];
  for (const row of (data || [])) {
    const d = row.created_at.slice(0, 10);
    if (!seen.has(d)) { seen.add(d); dates.push(d); }
  }
  return dates;
}

// Returns jobs for a specific date in YYYY-MM-DD format (same shape as fetchJobs())
export async function fetchJobsByDate(dateStr) {
  const userId = await getUserId();
  // Parse as local midnight to avoid UTC off-by-one for non-UTC timezones
  const [y, m, d] = dateStr.split('-').map(Number);
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0);
  const endLocal   = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  const start = startLocal.toISOString();
  const end   = endLocal.toISOString();
  const { data, error } = await supabase
    .from('user_job_feed')
    .select(`
      *,
      job:normalized_jobs (
        id, job_title, company_name, job_url, location, posted_date,
        description, source, itar_flag, tier, h1b, industry,
        verdict, relevance_score, boost_tags, employment_type,
        red_flags, legitimacy_tier
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).map(row => ({
    id:               row.job_id,
    role:             row.job?.job_title       ?? null,
    company:          row.job?.company_name    ?? null,
    link:             row.job?.job_url         ?? null,
    location:         row.job?.location        ?? null,
    posted:           row.job?.posted_date     ?? null,
    jd:               row.job?.description     ?? null,
    source:           row.job?.source          ?? null,
    itar_flag:        row.job?.itar_flag       ?? false,
    tier:             row.job?.tier            ?? null,
    h1b:              row.job?.h1b             ?? null,
    industry:         row.job?.industry        ?? null,
    verdict:          row.job?.verdict         ?? null,
    employment_type:  row.job?.employment_type  ?? null,
    red_flags:        row.job?.red_flags        ?? [],
    legitimacy_tier:  row.job?.legitimacy_tier  ?? 'high',
    score_breakdown:  row.score_breakdown       ?? null,
    match:            row.user_relevance_score ?? row.job?.relevance_score ?? null,
    in_pipeline:      row.in_pipeline,
    pipeline_added_at: row.pipeline_added_at,
    analysis_result:  row.analysis_result,
    analysisResult:   row.analysis_result,
    resume_variant:   row.resume_variant,
    resumeVariant:    row.resume_variant,
    status:           row.status,
    feed_date:        row.created_at ? row.created_at.slice(0, 10) : null,
    locationType: (() => {
      const loc = (row.job?.location || '').toLowerCase();
      if (loc.includes('remote')) return 'Remote';
      if (loc.includes('hybrid')) return 'Hybrid';
      return 'Onsite';
    })(),
    _feedId:          row.id,
  }));
}

// Updates per-user fields on a job's feed row (in_pipeline, analysis, variant, etc.)
// Does NOT write to normalized_jobs — pipeline owns that table.
export async function upsertJob(job) {
  const userId = await getUserId();
  const feedUpdate = sanitizeJobFeedUpdate(job);
  const { error } = await supabase
    .from('user_job_feed')
    .upsert(
      { ...feedUpdate, user_id: userId },
      { onConflict: 'user_id,job_id' }
    );
  if (error) throw error;
}

// Batch version — updates user_job_feed rows in chunks of 50
export async function upsertJobs(jobs) {
  if (!jobs.length) return;
  const userId = await getUserId();
  const rows = jobs.map(j => ({ ...sanitizeJobFeedUpdate(j), user_id: userId }));
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from('user_job_feed')
      .upsert(rows.slice(i, i + 50), { onConflict: 'user_id,job_id' });
    if (error) throw error;
  }
}

// Removes a job from this user's feed (does not touch normalized_jobs)
export async function deleteJob(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_job_feed')
    .delete()
    .eq('user_id', userId)
    .eq('job_id', id);
  if (error) throw error;
}

// Soft-removes a job by setting status='removed' and in_pipeline=false.
// Preserves the row for audit/history — does not delete it.
export async function softRemoveJob(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_job_feed')
    .update({ status: 'removed', in_pipeline: false })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Applications ───────────────────────────────────────────────────────────────
export async function fetchApplications() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(hydrateApplication);
}

export async function upsertApplication(app) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('applications')
    .upsert({ ...sanitizeApplication(app), user_id: userId }, { onConflict: 'id' });
  if (error) throw error;
}

// ── Templates ──────────────────────────────────────────────────────────────────
export async function fetchTemplates() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function upsertTemplate(template) {
  if (!template.id) throw new Error('upsertTemplate: id is required');
  const userId = await getUserId();
  const { error } = await supabase
    .from('templates')
    .upsert({ ...sanitizeTemplate(template), user_id: userId }, { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteTemplate(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Settings (per-user key-value — theme, netlog_meta, current_job) ───────────
// Keys are prefixed with `{userId}:` so each user's settings are isolated.
export async function fetchSettings() {
  const userId = await getUserId();
  const prefix = `${userId}:`;
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .like('key', `${prefix}%`);
  if (error) throw error;
  const result = {};
  (data || []).forEach(row => { result[row.key.slice(prefix.length)] = row.value; });
  return result;
}

export async function saveSetting(key, value) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: `${userId}:${key}`, value: String(value) }, { onConflict: 'key' });
  if (error) throw error;
}

export async function saveCurrentJob(job) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: `${userId}:current_job`, value: JSON.stringify(job) }, { onConflict: 'key' });
  if (error) throw error;
}

export async function loadCurrentJob() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', `${userId}:current_job`)
    .maybeSingle();
  if (error || !data) return null;
  try { return JSON.parse(data.value); } catch { return null; }
}

// ── User Integrations (API keys — replaces settings groq/serper keys) ─────────
export async function fetchUserIntegrations() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('service, api_key, is_valid')
    .eq('user_id', userId);
  if (error) throw error;
  const result = {};
  (data || []).forEach(row => { result[row.service] = row.api_key; });
  return result;
}

export async function saveUserIntegration(service, apiKey) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_integrations')
    .upsert(
      { user_id: userId, service, api_key: apiKey },
      { onConflict: 'user_id,service' }
    );
  if (error) throw error;
}

export async function fetchLinkedInStats(contacts) {
  // Compute intelligence metrics from the already-fetched contacts array.
  // Accepts the result of fetchLinkedInContacts() so no extra DB round-trip.
  const c = contacts || [];
  const now = Date.now();

  const twoWay       = c.filter(x => x.two_way_conversation).length;
  const warm         = c.filter(x => ['Warm','Strong','POC Candidate','Confirmed POC'].includes(x.relationship_strength)).length;
  const pocCandidates= c.filter(x => x.is_poc_candidate).length;
  const confirmedPoc = c.filter(x => x.is_confirmed_poc).length;
  const recruiters   = c.filter(x => x.persona === 'Recruiter').length;
  const hiringMgrs   = c.filter(x => x.persona === 'Hiring Manager').length;
  const followUps    = c.filter(x => x.follow_up).length;
  const urgentFu     = c.filter(x => x.follow_up_priority === 'urgent').length;
  const referrals    = c.filter(x => x.referral_discussed).length;
  const refSecured   = c.filter(x => x.referral_secured).length;
  const promises     = c.filter(x => x.promise_made).length;
  const dormant      = c.filter(x => x.conversation_stage === 'Dormant').length;
  const strongRapport= c.filter(x => x.conversation_stage === 'Strong Rapport').length;

  return {
    total:         c.length,
    twoWay,
    warm,
    pocCandidates,
    confirmedPoc,
    recruiters,
    hiringMgrs,
    followUps,
    urgentFu,
    referrals,
    refSecured,
    promises,
    dormant,
    strongRapport,
  };
}

// ── User Profile ───────────────────────────────────────────────────────────────
export async function fetchUserProfile() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertUserProfile(profile) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { ...profile, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

// ── Role Targets ───────────────────────────────────────────────────────────────
export async function fetchRoleTargets() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('role_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('priority');
  if (error) throw error;
  return data || [];
}

export async function upsertRoleTarget(target) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('role_targets')
    .upsert({ ...sanitizeRoleTarget(target), user_id: userId }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoleTarget(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('role_targets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Resume Variants ────────────────────────────────────────────────────────────
export async function fetchResumeVariants() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('resume_variants')
    .select('*')
    .eq('user_id', userId)
    .order('variant_key');
  if (error) throw error;
  return data || [];
}

export async function upsertResumeVariant(variant) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('resume_variants')
    .upsert({ ...sanitizeResumeVariant(variant), user_id: userId }, { onConflict: 'user_id,variant_key' });
  if (error) throw error;
}

// ── User Company Targets ───────────────────────────────────────────────────────
export async function fetchUserCompanyTargets() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_company_targets')
    .select('*, company:company_intelligence(*)')
    .eq('user_id', userId)
    .order('priority');
  if (error) throw error;
  return data || [];
}

export async function addUserCompanyTarget(companyId, isPrimary = false) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_company_targets')
    .upsert(
      { user_id: userId, company_id: companyId, is_primary: isPrimary },
      { onConflict: 'user_id,company_id' }
    );
  if (error) throw error;
}

export async function addCompanyToIntelligence(company) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('company_intelligence')
    .insert({ ...company, added_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Resumes ────────────────────────────────────────────────────────────────────
const MAX_RESUMES = 5;

export async function fetchResumes() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('resumes')
    .select('id, name, is_primary, target_roles, last_analyzed_at, created_at, updated_at, analysis_report')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Fetches all resumes including structured_sections — used by JobAnalysis for
// dynamic resume selection. Primary resume is sorted first.
export async function fetchAllResumesWithSections() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('resumes')
    .select('id, name, is_primary, target_roles, structured_sections')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchResume(id) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function upsertResume(resume) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('resumes')
    .upsert(
      {
        ...resume,
        user_id:    userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id')
    .single();
  if (error) {
    // DB trigger fires RESUME_LIMIT_EXCEEDED for concurrent inserts past the limit
    if (error.message?.includes('RESUME_LIMIT_EXCEEDED')) {
      throw new Error(`Maximum ${MAX_RESUMES} resumes allowed. Delete one to add another.`);
    }
    throw error;
  }
  return data.id;
}

export async function deleteResume(id) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('resumes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// Sets is_primary=true for `id`, false for all other user resumes.
// Uses server-side RPC to execute atomically and prevent race conditions.
export async function setPrimaryResume(id) {
  const { error } = await supabase.rpc('set_primary_resume', { p_resume_id: id });
  if (error) throw error;
}

export async function saveResumeAnalysis(id, report) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('resumes')
    .update({
      analysis_report:  report,
      last_analyzed_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── User Preferences ───────────────────────────────────────────────────────────
export async function fetchPreferences() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data || {};
}

export async function savePreferences(prefs) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { ...prefs, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

// ── Custom Company Intel ───────────────────────────────────────────────────────
const COMPANY_ALLOWED = new Set([
  'id', 'name', 'tier', 'h1b', 'itar', 'industry', 'roles',
  'ats_platform', 'domain', 'ats_board_url',
]);

function sanitizeUserCompany(c) {
  const out = {};
  for (const k of Object.keys(c)) {
    if (COMPANY_ALLOWED.has(k)) out[k] = c[k];
  }
  if (c.id !== undefined) out.id = c.id;
  return out;
}

export async function fetchUserCompanies() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('user_companies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertUserCompany(company) {
  const userId = await getUserId();
  const payload = {
    ...sanitizeUserCompany(company),
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('user_companies')
    .upsert(payload, { onConflict: 'user_id,name' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUserCompany(companyId) {
  const userId = await getUserId();
  const { error } = await supabase
    .from('user_companies')
    .delete()
    .eq('id', companyId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Unified Contacts ───────────────────────────────────────────────────────────
export async function fetchContacts() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .neq('source', 'linkedin_intelligence_v2')
    .order('priority',    { ascending: false })
    .order('last_contact', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    linkedinUrl: row.linkedin_url || null,
  }));
}

export async function upsertContact(contact) {
  if (!contact.id) throw new Error('upsertContact: id is required');
  const userId = await getUserId();
  const { error } = await supabase
    .from('contacts')
    .upsert({ ...sanitizeContact(contact), user_id: userId, updated_at: new Date().toISOString() },
             { onConflict: 'id' });
  if (error) throw error;
}

export async function updateContactFields(id, updates) {
  if (!id) throw new Error('updateContactFields: id is required');
  const userId = await getUserId();
  // sanitizeContact strips disallowed keys from partial updates; id is applied
  // via .eq(), not in the payload, so remove it before the update call.
  const payload = sanitizeContact(updates);
  delete payload.id;
  payload.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from('contacts')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateContactNotes(id, notes) {
  if (!id) throw new Error('updateContactNotes: id is required');
  const userId = await getUserId();
  const { error } = await supabase
    .from('contacts')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export function computeContactStats(contacts) {
  const c = contacts || [];
  const outreached    = c.filter(x => x.outreach_sent);
  const overdue       = outreached.filter(x => {
    if (!['Accepted','Replied'].includes(x.outreach_status)) return false;
    const snoozed = x.follow_up_snoozed_until;
    if (snoozed && new Date(snoozed) >= new Date()) return false;
    const last = x.last_contact ? new Date(x.last_contact) : null;
    return last && Math.floor((Date.now() - last) / 86400000) >= 7;
  });
  return {
    total:          c.length,
    outreached:     outreached.length,
    overdue:        overdue.length,
    pocConfirmed:   c.filter(x => x.is_confirmed_poc).length,
    pocCandidates:  c.filter(x => x.is_poc_candidate && !x.is_confirmed_poc).length,
    promisesPending:c.filter(x => x.promise_made && x.promise_status !== 'kept').length,
    newConnections: c.filter(x => {
      if (x.outreach_status !== 'Accepted') return false;
      if (!x.outreach_status_changed_at) return false;
      return Math.floor((Date.now() - new Date(x.outreach_status_changed_at)) / 86400000) <= 7;
    }).length,
  };
}
