// api/lib/auth.js — Shared JWT verification for api/v1/* endpoints
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wefcbqfxzvvgremxhubi.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export async function authenticate(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { error: 'Missing bearer token', status: 401 };
  }
  const token = authHeader.slice(7);

  // User-scoped client: all .from() calls go through RLS as the authenticated user.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  return { supabase, user, userId: user.id };
}

export function jsonResponse(res, status, body) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (body === null) {
    res.status(status).end();
  } else {
    res.status(status).json(body);
  }
}

export function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 204, null);
    return true;
  }
  return false;
}
