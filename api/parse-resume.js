// Parses PDF text (extracted client-side) into structured_sections using Groq.
// Called only for PDF uploads — .tex uses the GCR /parse endpoint.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text field required' });

  const truncated = text.slice(0, 8000);

  // Fetch the user's Groq key or fall back to env
  const { data: integrations } = await supabase
    .from('user_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('service', 'groq')
    .single();
  const groqKey = integrations?.api_key || GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'No Groq API key configured' });

  const prompt = `Extract the following resume text into a structured JSON object.

Return ONLY valid JSON matching this schema exactly:
{
  "schema_version": 1,
  "summary": "text or null if no summary section exists",
  "section_order": ["ordered list of section keys present: skills, experience, education, summary, certifications"],
  "skills": [{"category": "Category Name", "items": ["skill1", "skill2"]}],
  "experience": [{"company": "...", "role": "...", "date_range": "...", "location": "...", "bullets": ["bullet1", "bullet2"]}],
  "education": [{"school": "...", "degree": "...", "date_range": "...", "location": "..."}],
  "certifications": ["cert1", "cert2"]
}

RESUME TEXT:
${truncated}`;

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.json().catch(() => ({}));
    return res.status(502).json({ error: 'Groq error', detail: err.error?.message });
  }

  const groqData = await groqRes.json();
  const content = groqData.choices?.[0]?.message?.content || '';

  let parsed;
  try { parsed = JSON.parse(content); }
  catch { return res.status(200).json({ parse_error: 'unparseable_groq_response' }); }

  if (!Array.isArray(parsed.skills) || parsed.skills.length === 0) {
    return res.status(200).json({ parse_error: 'incomplete_parse' });
  }

  return res.status(200).json(parsed);
}
