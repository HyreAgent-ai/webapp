// ─── Groq AI Helper ───────────────────────────────────────────────────────────
// Routes through /api/groq proxy (Vercel serverless) to avoid CORS issues and
// keep the API key server-side. apiKey param retained for signature compatibility
// but the proxy fetches the key from Supabase — it is not sent over the wire.

import { supabase } from '../supabase.js';
import { z } from 'zod';

const MODEL = 'llama-3.3-70b-versatile';

// ─── AI-01/AI-03 — Prompt-injection defense ───────────────────────────────────
// (1) zod schema-validates every LLM JSON response before it reaches Supabase.
// (2) Prompt construction (UNTRUSTED_DATA_NOTICE, wrapUntrusted, system prompts)
//     has moved to api/groq.js (AI-03 server-side allowlist). The client now
//     sends kind + structured data; the server builds all messages.

function safeParseJson(rawText, schema, label) {
  // Strip common LLM artefacts: markdown fences, leading/trailing prose.
  let cleaned = String(rawText ?? '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fall back to first balanced { … } block if the model wrapped JSON in
    // prose. This is a recoverable case and the schema still gates correctness.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`${label}: AI returned non-JSON output. Try again.`);
    try { parsed = JSON.parse(m[0]); }
    catch { throw new Error(`${label}: AI returned malformed JSON. Try again.`); }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Schema violation — most likely caused by prompt injection or the model
    // ignoring its output instructions. Bad data never reaches Supabase.
    const issues = result.error.issues.slice(0, 3)
      .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ');
    throw new Error(`${label}: AI output failed schema validation (${issues}). Try again.`);
  }
  return result.data;
}

// ─── Schemas for AI-01 schema-validated JSON outputs ──────────────────────────

const AnalyzeJobSchema = z.object({
  top5_jd_skills:   z.array(z.string()),
  primary_category: z.string(),
  mod2_skilllines:  z.array(z.object({
    category: z.string(),
    items:    z.string(),
  })).min(1),
  missing_keywords: z.array(z.string()).optional().default([]),
  ats_coverage:     z.string().optional().default(''),
  resumeReason:     z.string().optional().default(''),
  top_matches:      z.array(z.string()).optional().default([]),
  ai_insights:      z.string().max(5000).optional().default(''),
});

const ResumeAnalysisSchema = z.object({
  score:      z.enum(['A', 'B', 'C', 'D']),
  summary:    z.string().max(2000),
  highlights: z.array(z.object({
    section: z.string(),
    note:    z.string(),
  })),
  issues:     z.array(z.object({
    severity:   z.enum(['urgent', 'critical', 'optional']),
    problem:    z.string(),
    why:        z.string(),
    suggestion: z.string(),
  })),
});

const ResumeParseSchema = z.object({
  summary: z.string().nullable().optional(),
  skills: z.array(z.object({
    category: z.string(),
    items:    z.array(z.string()),
  })),
  experience: z.array(z.object({
    company:    z.string().optional().default(''),
    role:       z.string().optional().default(''),
    date_range: z.string().optional().default(''),
    location:   z.string().optional().default(''),
    bullets:    z.array(z.string()).optional().default([]),
  })),
  education: z.array(z.object({
    school:     z.string().optional().default(''),
    degree:     z.string().optional().default(''),
    field:      z.string().optional().default(''),
    date_range: z.string().optional().default(''),
    gpa:        z.string().optional().default(''),
  })).optional().default([]),
  certifications: z.array(z.string()).optional().default([]),
});

// ─── Dynamic Context Builders ──────────────────────────────────────────────────

export function buildCandidateContext(ss) {
  const lines = [];

  if (ss.education?.length) {
    const edu = ss.education[0];
    lines.push(`Education: ${edu.degree}, ${edu.school}, ${edu.date_range}`);
  }

  if (ss.experience?.length) {
    lines.push('\nExperience:');
    for (const exp of ss.experience) {
      lines.push(`- ${exp.company} | ${exp.role} | ${exp.date_range}`);
      for (const b of (exp.bullets || [])) {
        lines.push(`  • ${b}`);
      }
    }
  }

  if (ss.skills?.length) {
    lines.push('\nSkills:');
    for (const s of ss.skills) {
      lines.push(`  ${s.category}: ${(s.items || []).join(', ')}`);
    }
  }

  return lines.join('\n');
}

export function buildSkillLinesPrompt(skills) {
  return skills.map(s => ({
    category: s.category,
    items: (s.items || []).join(', '),
  }));
}

export function resolvePrimaryCategory(primaryCategory, skills) {
  if (!primaryCategory || !skills?.length) return skills?.[0]?.category ?? '';
  const cats = skills.map(s => s.category);
  // 1. Exact match
  if (cats.includes(primaryCategory)) return primaryCategory;
  // 2. Case-insensitive
  const lower = primaryCategory.toLowerCase();
  const ci = cats.find(c => c.toLowerCase() === lower);
  if (ci) return ci;
  // 3. Substring
  const sub = cats.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
  if (sub) { console.warn(`[groq] primary_category fuzzy match: "${primaryCategory}" → "${sub}"`); return sub; }
  // 4. Fallback to first
  console.warn(`[groq] primary_category no match for "${primaryCategory}", using "${cats[0]}"`);
  return cats[0];
}

export async function callGroq(kind, data, maxTokens = 1000) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not signed in — please sign in to use AI features.');
  }

  const res = await fetch('/api/groq', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ kind, ...data, maxTokens }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Groq error: ${res.status}`);
  }

  const responseData = await res.json();
  return responseData.choices?.[0]?.message?.content || '';
}

// ─── Job Analysis ─────────────────────────────────────────────────────────────
// ─── Summary Generation — focused separate call ───────────────────────────────
// Receives pre-extracted keywords + title from the data call so the model
// only has ONE job: write 3 sentences. No JSON, no competing fields.
export async function generateSummary(jd, primaryCategory, keywords, title, structuredSections, apiKey) {
  const candidateContext = buildCandidateContext(structuredSections);
  return callGroq('generate_summary', { jd, primaryCategory, keywords, title, candidateContext }, 300);
}

export async function analyzeJobWithGroq(jd, structuredSections, apiKey) {
  if (!structuredSections || typeof structuredSections !== 'object') {
    throw new Error('structuredSections is required for job analysis.');
  }
  const candidateContext = buildCandidateContext(structuredSections);
  const baseSkillLines = buildSkillLinesPrompt(structuredSections.skills || []);
  const baseLinesJson = JSON.stringify(baseSkillLines, null, 2);

  const dataText = await callGroq('analyse_job', { jd, candidateContext, baseSkillLines }, 1400);
  const parsed = safeParseJson(dataText, AnalyzeJobSchema, 'Job analysis');

  // Additional rule the schema can't express: top5_jd_skills must contain 5
  // distinct entries. Kept as a runtime guard because zod can't enforce
  // set-uniqueness cleanly.
  if (new Set(parsed.top5_jd_skills).size < 5) {
    throw new Error('Job analysis: AI returned fewer than 5 distinct JD skills. Try again.');
  }
  if (!/^\d+%$/.test(parsed.ats_coverage || '')) {
    parsed.ats_coverage = '—';
  }

  // Resolve primary_category with fuzzy fallback
  parsed.primary_category = resolvePrimaryCategory(parsed.primary_category, structuredSections.skills);

  // Build mod2_skills LaTeX string for compiler
  parsed.mod2_skills = parsed.mod2_skilllines
    .map(row => {
      const label = (row.category || '').replace(/&/g, '\\&');
      const skills = (row.items || '').replace(/&/g, '\\&');
      return `\\skillline{${label}:}{${skills}}`;
    })
    .join('\n');

  // Summary disabled by default — caller enables via separate _generateSummary call
  parsed.mod1_summary = '';
  parsed.mod1_summary_latex = '';

  return parsed;
}

// ─── Message Drafting ─────────────────────────────────────────────────────────
// persona: 'Recruiter' | 'Hiring Manager' | 'Peer Engineer' | 'Executive' | 'UIUC Alumni' | 'Senior Engineer'
// intent:  'job_application_ask' | 'cold_outreach'
// format:  'connection_note' | 'followup' | 'cold_email'
export async function draftMessageWithGroq(persona, intent, format, contact, job, apiKey, regenNote = '') {
  return callGroq('draft_message', { persona, intent, format, contact, job, regenNote }, 600);
}

// ─── Cover Letter Generation ───────────────────────────────────────────────────
// tone: 'professional' | 'technical' | 'conversational'
// regenNote: optional user direction for re-generation
export async function generateCoverLetterWithGroq(role, company, jd, analysis, tone, apiKey, regenNote = '') {
  const top5 = (analysis?.top5_jd_skills || []).slice(0, 5);
  const aiInsights = analysis?.ai_insights || '';
  return callGroq('cover_letter', { role, company, jd, top5, aiInsights, tone, regenNote }, 900);
}

// ─── Application Q&A ──────────────────────────────────────────────────────────
// Answers open-ended application form questions with full job context.
// question: the form question the user is filling in (e.g. "Message to the hiring team")
// ctx: { company, role, jd, summary, top5Skills }
export async function answerApplicationQuestion(question, { company, role, jd, summary, top5Skills }, apiKey) {
  const skillsList = (top5Skills || []).join(', ');
  return callGroq('q_and_a', { question, company, role, jd, summary, skillsList }, 400);
}

// ─── Resume Analysis ──────────────────────────────────────────────────────────
// Returns a structured JSON report. Throws if Groq fails or returns malformed JSON.
export async function analyzeResumeWithGroq(structuredSections, targetRoles, apiKey) {
  const sections = structuredSections || {};
  const experience = (sections.experience || [])
    .map(e => `${e.role} at ${e.company} (${e.start_date}–${e.current ? 'Present' : e.end_date})\n${(e.bullets || []).map(b => `  • ${b}`).join('\n')}`)
    .join('\n\n');
  const skills = (sections.skills || [])
    .map(s => `${s.category}: ${(s.items || []).join(', ')}`)
    .join('\n');
  const education = (sections.education || [])
    .map(e => `${e.degree} in ${e.field}, ${e.school} (${e.end_date})${e.gpa ? `, GPA ${e.gpa}` : ''}`)
    .join('\n');
  const summary = sections.summary || '';
  const raw = await callGroq('analyse_resume', { experience, skills, education, summary, targetRoles }, 1200);
  return safeParseJson(raw, ResumeAnalysisSchema, 'Resume analysis');
}

// ─── Resume Parsing ───────────────────────────────────────────────────────────
// Parses plain text extracted from a PDF into structured_sections via /api/groq.
export async function parseResumeTextWithGroq(text) {
  const raw = await callGroq('parse_resume', { text }, 2000);
  return safeParseJson(raw, ResumeParseSchema, 'Resume parsing');
}
