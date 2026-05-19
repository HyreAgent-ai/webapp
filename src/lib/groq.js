// ─── Groq AI Helper ───────────────────────────────────────────────────────────
// Routes through /api/groq proxy (Vercel serverless) to avoid CORS issues and
// keep the API key server-side. apiKey param retained for signature compatibility
// but the proxy fetches the key from Supabase — it is not sent over the wire.

import { supabase } from '../supabase.js';

const MODEL = 'llama-3.3-70b-versatile';

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

export async function callGroq(systemPrompt, userPrompt, apiKey, maxTokens = 1000) {
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
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Job Analysis ─────────────────────────────────────────────────────────────
// ─── Summary Generation — focused separate call ───────────────────────────────
// Receives pre-extracted keywords + title from the data call so the model
// only has ONE job: write 3 sentences. No JSON, no competing fields.
export async function generateSummary(jd, primaryCategory, keywords, title, structuredSections, apiKey) {
  const candidateContext = buildCandidateContext(structuredSections);

  const system = `You are writing a 3-sentence resume summary. Output ONLY the 3 sentences as plain text — no JSON, no labels, no formatting markers.

CANDIDATE BACKGROUND (use only these facts, never invent):
${candidateContext}

RESUME ANGLE: ${primaryCategory}

First derive in one sentence what this role most needs from the JD and how the candidate's background answers it. Then write the 3 sentences using that as your lens.

SENTENCE 1 — Identity + role fit (25–35 words): Position the candidate as a graduate targeting this role. Open with who they are in relation to the role.
SENTENCE 2 — Proof for the keywords (20–30 words): Use 2–3 JD keywords, each attached to a specific experience and outcome.
SENTENCE 3 — What the candidate brings as a person (12–18 words): Write a BEHAVIOR, not an output.

BANNED words: passionate, motivated, results-driven, dynamic, fast-paced, team player, leveraging, (Learning)`;

  const user = `TARGET ROLE: ${title}
JD KEYWORDS TO USE (already extracted — do not re-extract): ${keywords.join(', ')}

JD (first 1200 chars for context):
${jd.slice(0, 1200)}

---

WRITE EXACTLY 3 SENTENCES using the logic below. Plain text only. No bold, no dashes as bullet points, no labels like "Sentence 1:".`;

  return callGroq(system, user, apiKey, 300);
}

export async function analyzeJobWithGroq(jd, structuredSections, apiKey) {
  if (!structuredSections || typeof structuredSections !== 'object') {
    throw new Error('structuredSections is required for job analysis.');
  }
  const candidateContext = buildCandidateContext(structuredSections);
  const baseSkillLines = buildSkillLinesPrompt(structuredSections.skills || []);
  const baseLinesJson = JSON.stringify(baseSkillLines, null, 2);

  const system = `You are a resume data extractor helping tailor a resume to a job description.

CANDIDATE BACKGROUND (use only these facts, never invent):
${candidateContext}

OUTPUT RULES:
1. Return valid JSON only — no markdown fences, no extra text
2. top5_jd_skills: exactly 5 DIFFERENT specific technical terms (no soft skills)
3. primary_category: must be EXACTLY one of the category names from the base skill lines below
4. mod2_skilllines: reorder items within each category to match JD — never add new skills, never rename categories
5. Remove (Learning) — never output this tag`;

  const user = `JD (first 3500 chars):
${jd.slice(0, 3500)}

BASE SKILL CATEGORIES (reorder items only — do not rename categories or add new skills):
${baseLinesJson}

Return ONLY this JSON:
{
  "top5_jd_skills": ["kw1","kw2","kw3","kw4","kw5"],
  "primary_category": "exact category name from base skill lines that best fits this JD",
  "mod2_skilllines": [
    {"category":"same label as base","items":"reordered items string"}
  ],
  "missing_keywords": ["kw1","kw2"],
  "ats_coverage": "XX%",
  "resumeReason": "one sentence why this category ordering fits the JD",
  "top_matches": ["kw1","kw2","kw3"],
  "ai_insights": "3-5 actionable tips for this specific JD"
}`;

  const dataText = await callGroq(system, user, apiKey, 1400);

  let parsed;
  try {
    const cleaned = dataText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    const match = dataText.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); }
      catch { throw new Error('Groq returned unparseable JSON. Try again.'); }
    } else {
      throw new Error('Groq returned no JSON. Try again.');
    }
  }

  // Strict validation
  if (!Array.isArray(parsed.mod2_skilllines) || parsed.mod2_skilllines.length === 0) {
    throw new Error('Groq output missing mod2_skilllines. Try again.');
  }
  for (const line of parsed.mod2_skilllines) {
    if (typeof line.category !== 'string' || typeof line.items !== 'string') {
      throw new Error('Groq output has malformed skillline. Try again.');
    }
  }
  if (!Array.isArray(parsed.top5_jd_skills) || new Set(parsed.top5_jd_skills).size < 5) {
    throw new Error('Groq output has fewer than 5 distinct JD skills. Try again.');
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
  const role     = job?.role || 'engineering position';
  const company  = contact.company || job?.company || '';
  const jobId    = job?.id || job?.jobId || job?.job_id || '';
  const location = job?.location || job?.city || '';

  // Job reference line — always include role + company; add ID and location when available
  const jobRef = [
    `the ${role} role at ${company}`,
    jobId    ? `(Job ID: ${jobId})`    : '',
    location ? `based in ${location}`  : '',
  ].filter(Boolean).join(' ');

  const intentSummary = intent === 'job_application_ask'
    ? `applied for the ${role} role at ${company} and found this contact while searching for people at the company`
    : `interested in ${company}'s work in aerospace and advanced manufacturing`;

  const personaAsk = {
    'Recruiter':        'confirm my application is under active review, or point me to the right hiring contact',
    'Hiring Manager':   'have a 15-minute call to learn what you are looking for in this role',
    'Peer Engineer':    'share your honest take on the team experience and day-to-day work',
    'Executive':        'have a brief call to discuss whether my background maps to what the team needs',
    'UIUC Alumni':      'share your advice on the culture and how engineering decisions get made at the company',
    'Senior Engineer':  'share your perspective on how composites manufacturing experience fits the team',
  }[persona] || 'have a brief conversation';

  // Persona-specific angle for the connection note's one clause
  const connectionNoteAngle = {
    'Recruiter': intent === 'job_application_ask'
      ? `I applied for ${jobRef} and am looking for the right person to connect with so my application gets the right visibility. I want to make sure it reaches the right hiring contact or team.`
      : `I am exploring composites and aerospace manufacturing roles at ${company} and wanted to connect with the right person on the recruiting side.`,

    'Hiring Manager': intent === 'job_application_ask'
      ? `I applied for ${jobRef} and wanted to introduce myself directly to the team. I am looking for the right direction to put my application in front of the people making the hiring decision.`
      : `I have been following ${company}'s work in aerospace manufacturing and wanted to connect with the engineering leadership directly.`,

    'Peer Engineer': intent === 'job_application_ask'
      ? `I applied for ${jobRef} and would love to hear what the engineering work looks like day to day from someone on the team.`
      : `I am a composites and manufacturing engineer exploring opportunities at ${company} and wanted to connect with someone doing the hands-on engineering work.`,

    'Executive': intent === 'job_application_ask'
      ? `I applied for ${jobRef} and wanted to introduce my background directly to someone in the leadership team who can point me in the right direction.`
      : `I have been following ${company}'s direction in aerospace and advanced manufacturing and wanted to introduce myself to the leadership.`,

    'UIUC Alumni':
      `Fellow Illini, I saw you are at ${company}${intent === 'job_application_ask' ? ` and I applied for ${jobRef}` : ''}. As a current M.S. Aerospace student at UIUC I would love to hear your perspective on the team and work there.`,

    'Senior Engineer': intent === 'job_application_ask'
      ? `I applied for ${jobRef} and wanted to connect with a senior engineer on the team who can give me a real sense of what the work involves and whether my composites background is a strong fit.`
      : `I am a composites and manufacturing engineer with autoclave processing and quality systems experience and wanted to connect with someone doing similar work at ${company}.`,
  }[persona] || `I am interested in ${company}'s work and wanted to connect.`;

  const formatRules = {
    connection_note:
`TASK: Write a LinkedIn Connection Note.
HARD LIMIT: 300 characters total. Count every character including spaces. Trim if over.
STRUCTURE (exactly this):
  Hi [FirstName], I am Siddardth, M.S. Aerospace from UIUC. [One clause drawn from THE ANGLE below]. Would love to connect.

THE ANGLE — use this as the basis for the one clause (adapt wording to fit 300 chars, do not copy verbatim):
${connectionNoteAngle}

REFERENCE REQUIREMENT:
- The note MUST mention at least one of: the role title, the company name, or the job location. The reader must immediately know what specific opportunity this is about.
${jobId ? `- Job ID to reference if space allows: ${jobId}` : ''}

CONNECTION NOTE RULES — ABSOLUTE, NO EXCEPTIONS:
- CONTEXT ONLY. The only job of this note is to tell the reader WHY you are connecting and WHAT role you are talking about. Nothing else.
- The "one clause" must reflect THE ANGLE above — different personas get meaningfully different reasons for connecting.
- ZERO metrics. ZERO numbers. ZERO stats. Not "15% to 3%". Not "2,700 lbf". Not "defect rates". Not "autoclave at 275F". Not "8 hours to 5 minutes". Not any achievement number whatsoever.
- ZERO achievement statements. "At Tata Boeing I reduced..." is FORBIDDEN here. So is any variant of it.
- The reader decides whether to accept based on your context and intent, not your resume. Save the resume for the follow-up.
- No subject line. No sign-off. No dashes. No em-dashes. No exclamation marks. No bullets.`,

    followup:
`TASK: Write a LinkedIn Follow-up Message (sent after the connection is accepted).
HARD LIMIT: 100 words.
STRUCTURE (4 sentences, natural paragraph):
  S1: Thank you for connecting.
  S2: Why you reached out: Siddardth ${intentSummary}.
  S3: One relevant stat — choose the best fit: Tata Boeing defect rate 15% to 3% using SPC and 8D, OR SAMPE 24-inch composite fuselage sustained 2,700 lbf at test (2.7x design requirement) via autoclave at 275F and 40 psi, OR Beckman Institute cure cycle from 8 hours to 5 minutes.
  S4: One specific ask: ${personaAsk}.
Sign off: Siddardth
No bullets. No dashes. No jargon.`,

    cold_email:
`TASK: Write a Cold Email.
OUTPUT FORMAT — first line is the subject line, then one blank line, then the body:
Subject: [60 chars max — include role or company name, UIUC, and hint of STEM OPT availability]

BODY — 4 paragraphs, under 150 words total:
P1: Siddardth Pathipaka. M.S. Aerospace Engineering, UIUC, December 2025. ${intent === 'job_application_ask' ? `Applied for the ${role} position at ${company}.` : `Writing to introduce myself and explore opportunities at ${company}.`}
P2: Reference their specific work area. Connect to Tata Boeing composites (defect rate 15% to 3%), SAMPE (24-inch fuselage sustained 2,700 lbf at test via autoclave at 275F and 40 psi), or ABAQUS/ANSYS structural analysis. Be specific. 2 to 3 sentences.
P3: Write this exact sentence verbatim: "I am authorized to work in the US for 3 years under STEM OPT with no sponsorship cost to the employer."
P4: One clear ask: ${personaAsk}.
Closing: Thank you for your time.
Signature: Siddardth Pathipaka, siddardth.pathipaka@gmail.com
No bullets. No dashes. No jargon.`,
  }[format] || '';

  const system = `You are writing outreach messages for Siddardth Pathipaka, an aerospace engineering job applicant. Follow every rule exactly or the output will be rejected.

CANDIDATE:
- Full name: Siddardth Pathipaka
- Degree: M.S. Aerospace Engineering, University of Illinois Urbana-Champaign (UIUC), December 2025
- Work authorization: STEM OPT, 3 years, zero sponsorship cost to employer
- Tata Boeing Aerospace: reduced defect rates from 15% to 3% using SPC and 8D methodology
- SAMPE: built 24-inch composite fuselage via prepreg layup and autoclave cure (275F, 40 psi) — part sustained 2,700 lbf at test (2.7x design requirement)
- Beckman Institute: reduced cure cycle from 8 hours to 5 minutes using novel resin system
- Tools: ABAQUS, ANSYS, SolidWorks, CATIA, MATLAB, Python
- Skills: composites manufacturing, quality engineering, GD&T, CMM, Lean, SPC, FMEA, NDT

ABSOLUTE RULES — apply to all message types:
1. No dashes or em-dashes anywhere. Use commas, periods, or the word "and".
2. No bullet points in the message body. Natural sentences and paragraphs only.
3. No jargon: no "synergy", "leverage", "circle back", "passionate about", "pick your brain", "touch base", "excited to", "thrilled to".
4. Active voice. Short sentences, 12 to 18 words average.
5. Maximum one exclamation mark per entire message.
6. Never fabricate facts about the company or the contact.
7. Never invent skills or experiences Siddardth does not have.
8. CONNECTION NOTES: absolute zero metrics, zero stats, zero numbers from achievements. Context and intent only.
9. STEM OPT sentence appears in cold emails only. Never in LinkedIn messages.
10. LinkedIn sign-off: "Siddardth". Email sign-off: full name and email address.`;

  const user = `CONTACT:
- Name: ${contact.name}
- Persona: ${persona}
- Job title: ${contact.title || persona}
- Company: ${company}
- Context about them: ${contact.why || `works at ${company}`}
- UIUC alumni: ${contact.uiuc ? 'Yes' : 'No'}

JOB / COMPANY:
- Role: ${role}
- Company: ${company}

OUTREACH INTENT: ${intent === 'job_application_ask' ? 'Job Application Ask — applied for this role, reaching out to find right contact or get insights' : 'Cold Outreach — no specific open role, reaching out to explore opportunities and learn about the company'}

${formatRules}

Return ONLY the final message text. No explanation. No label like "Here is the message:" before it.${regenNote ? `\n\nREGENERATION DIRECTION (apply to this revision): ${regenNote}` : ''}`;

  return callGroq(system, user, apiKey, 600);
}

// ─── Cover Letter Generation ───────────────────────────────────────────────────
// tone: 'professional' | 'technical' | 'conversational'
// regenNote: optional user direction for re-generation
export async function generateCoverLetterWithGroq(role, company, jd, analysis, tone, apiKey, regenNote = '') {
  const top5 = (analysis?.top5_jd_skills || []).slice(0, 5);

  const toneInstr = {
    professional:    'Formal and precise. Every sentence carries a specific fact, metric, or named skill. No warmth filler.',
    technical:       'Highly technical. Lead with engineering specifics, tools, and domain terminology before anything else.',
    conversational:  'Direct and approachable — factual but slightly warmer tone. Still zero buzzwords.',
  }[tone] || 'Formal and precise.';

  const system = `You are writing a cover letter for Siddardth Pathipaka, an aerospace engineering job applicant. Follow every rule exactly or the output will be rejected.

CANDIDATE:
- Full name: Siddardth Pathipaka
- Email: siddardth.pathipaka@gmail.com
- Degree: M.S. Aerospace Engineering, University of Illinois Urbana-Champaign (UIUC), December 2025
- Work authorization: STEM OPT, 3 years, zero sponsorship cost to employer
- Tata Boeing Aerospace: reduced composite defect rates from 15% to 3% using SPC and 8D root-cause methodology
- SAMPE student chapter: led fabrication of a 24-inch composite fuselage section; achieved 2% void content via autoclave cure at 275°F and 40 psi
- Beckman Institute: reduced resin cure cycle from 8 hours to 5 minutes using novel resin formulation
- Tools: ABAQUS, ANSYS Mechanical, SolidWorks, CATIA V5, MATLAB, Python
- Skills: composites manufacturing, quality engineering, GD&T, CMM inspection, Lean, SPC, FMEA, PFMEA, NDT, structural analysis

ABSOLUTE RULES:
1. Target: 320 to 360 words total in the body. Do not exceed 360. Count carefully.
2. Zero filler phrases: no "I am passionate about", "excited to join", "thrilled", "synergy", "leverage", "align with your values", "dynamic team", "fast-paced environment".
3. Every sentence must contain at least one specific fact, named skill, metric, tool, or JD-sourced requirement.
4. Reference at least 3 of the provided top JD requirements by their exact name.
5. Include at least 2 quantified achievements (use the Tata Boeing and SAMPE data above).
6. STEM OPT sentence: include this exact sentence once near the end of the final paragraph: "I am authorized to work in the US for 3 years under STEM OPT with no sponsorship cost to the employer."
7. No bullet points anywhere. Paragraphs only.
8. No dashes or em-dashes. Use commas, periods, or the word "and".
9. Do NOT include: date, address block, company address, or "Dear Hiring Manager" salutation. Start immediately with Paragraph 1.
10. End with exactly two lines: "Sincerely," then a blank line then "Siddardth Pathipaka".
11. Tone instruction: ${toneInstr}
12. Do not fabricate company details. Only use the company name and role title as provided.`;

  const user = `ROLE: ${role}
COMPANY: ${company}

TOP JD REQUIREMENTS (reference at least 3 by name):
${top5.length > 0 ? top5.map((k, i) => `${i + 1}. ${k}`).join('\n') : '(no analysis yet — infer from JD below)'}

JOB DESCRIPTION (first 1400 characters):
${jd.slice(0, 1400)}
${analysis?.ai_insights ? `\nAI INSIGHTS FROM JD ANALYSIS:\n${analysis.ai_insights}\n` : ''}
STRUCTURE TO FOLLOW:

Paragraph 1 (2-3 sentences): State the role and company. Degree from UIUC, December 2025. Open with the strongest skill match to the top JD requirements.

Paragraph 2 (3-4 sentences): Tata Boeing defect rate achievement (15% to 3%, SPC, 8D). Tie directly to 2 named JD requirements from the list. Be specific with the numbers.

Paragraph 3 (2-3 sentences): SAMPE fuselage achievement (24-inch, 2% void, autoclave) or Beckman cure cycle reduction. Reference 1 more named JD requirement. Name at least one tool (ABAQUS, ANSYS, SolidWorks, etc.).

Paragraph 4 (2-3 sentences): STEM OPT sentence verbatim. Request a conversation to discuss the role. Thank them for their time.

End: Sincerely,\n\nSiddardth Pathipaka

Return ONLY the cover letter body starting from Paragraph 1. No preamble, no "Here is the cover letter:" label.${regenNote ? `\n\nREGENERATION DIRECTION (apply to this revision): ${regenNote}` : ''}`;

  return callGroq(system, user, apiKey, 900);
}

// ─── Application Q&A ──────────────────────────────────────────────────────────
// Answers open-ended application form questions with full job context.
// question: the form question the user is filling in (e.g. "Message to the hiring team")
// ctx: { company, role, jd, summary, top5Skills }
export async function answerApplicationQuestion(question, { company, role, jd, summary, top5Skills }, apiKey) {
  const skillsList = (top5Skills || []).join(', ');

  const system = `You are writing application form answers for Siddardth Pathipaka, an aerospace engineering candidate. Answer naturally in first person, as Siddardth.

CANDIDATE FACTS (use these — do not invent):
- MS Aerospace Engineering, UIUC, December 2025
- STEM OPT eligible — 3 years, zero sponsorship cost to employer
- Tata Boeing: cut defect rate from 15% to 3% using SPC and 8D methodology
- SAMPE: fabricated 24-inch composite fuselage, 2% void content, autoclave at 275°F and 40 psi
- Beckman Institute: reduced cure cycle from 8 hours to 5 minutes
- Tools: SolidWorks, CATIA, ABAQUS, ANSYS, MATLAB, Python, GD&T, CMM, PFMEA, DOE, Lean/Six Sigma

ROLE CONTEXT:
- Company: ${company || 'the company'}
- Role: ${role || 'the position'}
- Key JD requirements targeted: ${skillsList || 'aerospace manufacturing, quality, composites'}
- Resume summary tailored for this role: ${summary || ''}

RULES:
- Answer ONLY the question asked. Do not pad, do not add disclaimers.
- Use at least one specific metric or achievement from the candidate facts above
- Tie the answer directly to the role and company when possible
- NO filler: no "passionate", "excited to", "dynamic", "hands-on individual"
- Tone: direct, confident, specific
- Length: match the question type — short form questions get 2-3 sentences, longer prompts get a short paragraph
- Return ONLY the answer text. No "Here is my answer:" preamble.`;

  const user = `JD SNIPPET (for context, first 2000 chars):
${(jd || '').slice(0, 2000)}

QUESTION TO ANSWER:
${question}`;

  return callGroq(system, user, apiKey, 400);
}

// ─── Resume Analysis ──────────────────────────────────────────────────────────
// Returns a structured JSON report. Throws if Groq fails or returns malformed JSON.
export async function analyzeResumeWithGroq(structuredSections, targetRoles, apiKey) {
  const SYSTEM = `You are a strict, honest resume evaluator for early-career engineering candidates
(Aerospace, Manufacturing, Industrial, Mechanical). You evaluate resumes for:
1. Impact: Are bullets quantified? Vague bullets fail.
2. Skills relevance: Do skills match modern engineering job descriptions?
3. Formatting clarity: Are sections structured, scannable, consistent?
4. Experience framing: Is work experience framed around outcomes, not tasks?
5. Overall readiness for ATS and recruiter review.

You MUST respond with ONLY valid JSON matching this exact shape:
{
  "score": "A" | "B" | "C" | "D",
  "summary": "2-3 sentence overall evaluation",
  "highlights": [
    { "section": "Experience | Skills | Education | Summary", "note": "what is working well" }
  ],
  "issues": [
    {
      "severity": "urgent" | "critical" | "optional",
      "problem": "specific problem statement",
      "why": "why this hurts your application",
      "suggestion": "exact improvement to make"
    }
  ]
}
Score guide: A = ready to send, B = minor fixes, C = significant work needed, D = major gaps.
Produce at minimum 3 issues and 2 highlights. Be specific — never generic.
Do NOT wrap in markdown code fences. Return raw JSON only.`;

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

  const USER = `Target roles: ${(targetRoles || []).join(', ') || 'Engineering (general)'}

RESUME:
---
SUMMARY
${sections.summary || '(none)'}

EXPERIENCE
${experience || '(none)'}

EDUCATION
${education || '(none)'}

SKILLS
${skills || '(none)'}
---

Evaluate this resume.`;

  const raw = await callGroq(SYSTEM, USER, apiKey, 1200);

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Resume analysis returned invalid JSON from Groq. Try again.');
  }
}

// ─── Resume Parsing ───────────────────────────────────────────────────────────
// Parses plain text extracted from a PDF into structured_sections via /api/groq.
export async function parseResumeTextWithGroq(text) {
  const system = `You are a resume parser. Extract the resume into structured JSON.
Return ONLY valid JSON matching this schema exactly — no markdown fences, no extra text:
{
  "summary": "professional summary text or null",
  "skills": [{"category": "Category Name", "items": ["skill1", "skill2"]}],
  "experience": [{"company": "...", "role": "...", "date_range": "...", "location": "...", "bullets": ["..."]}],
  "education": [{"school": "...", "degree": "...", "field": "...", "date_range": "...", "gpa": ""}],
  "certifications": ["cert1", "cert2"]
}`;

  const user = `RESUME TEXT:\n${text.slice(0, 8000)}`;

  const raw = await callGroq(system, user, null, 2000);
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch { throw new Error('Could not parse resume — try uploading as .tex or re-exporting the PDF.'); }

  if (!Array.isArray(parsed.skills) || !Array.isArray(parsed.experience)) {
    throw new Error('Resume parsing returned incomplete data. Try uploading as .tex instead.');
  }
  return parsed;
}
