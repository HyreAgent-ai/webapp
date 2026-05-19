// Vercel serverless proxy for Groq API.
// Requires a valid Supabase JWT in Authorization header.
// Fetches the Groq API key from user_integrations — never accepts it from the client.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://wefcbqfxzvvgremxhubi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZmNicWZ4enZ2Z3JlbXhodWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTI1NjUsImV4cCI6MjA4ODkyODU2NX0.vXTs_vh0dMvEt83FR589vKY9JfcMBFVgN82QblQH6OU';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  // ── Fetch API key server-side ────────────────────────────────────────────────
  const { data: integration, error: dbError } = await supabase
    .from('user_integrations')
    .select('api_key')
    .eq('user_id', user.id)
    .eq('service', 'groq')
    .maybeSingle();

  if (dbError) {
    console.error('Failed to fetch groq integration:', dbError.message);
  }

  const key = integration?.api_key || process.env.GROQ_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'No Groq API key — add it in Settings.' });
  }

  // ── Model allowlist + token cap ──────────────────────────────────────────────
  const ALLOWED_MODELS = ['llama-3.3-70b-versatile'];
  const MAX_TOKENS_CAP = 2500;

  if (!ALLOWED_MODELS.includes(req.body.model)) {
    return res.status(400).json({ error: 'Model not allowed' });
  }
  req.body.max_tokens = Math.min(req.body.max_tokens ?? 1000, MAX_TOKENS_CAP);

  // ── Forward to Groq (apiKey from body is intentionally ignored) ─────────────
  const { apiKey: _ignored, ...groqBody } = req.body || {};

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await groqRes.json();
    return res.status(groqRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
