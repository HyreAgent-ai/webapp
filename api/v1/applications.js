// POST /api/v1/applications
// Inserts/upserts a row into applications for the authenticated user.
// Replaces extension's direct POST /rest/v1/applications (BOLA-01).

import { authenticate, jsonResponse, handleCors } from '../lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const auth = await authenticate(req);
  if (auth.error) return jsonResponse(res, auth.status, { error: auth.error });
  const { supabase, userId } = auth;

  const body = req.body;
  if (!body || !body.id || !body.role || !body.company) {
    return jsonResponse(res, 400, { error: 'Missing required fields: id, role, company' });
  }

  const row = {
    id:            String(body.id),
    user_id:       userId,
    role:          body.role || null,
    company:       body.company || null,
    location:      body.location || null,
    link:          body.link || null,
    company_link:  body.companyLink || body.company_link || null,
    match:         body.match != null ? (parseInt(body.match) ?? null) : null,
    verdict:       body.verdict || null,
    status:        body.status || 'Applied',
    date:          body.date || new Date().toISOString().slice(0, 10),
    location_type: body.locationType || body.location_type || null,
    type:          body.type || null,
    salary:        body.salary || null,
    resume_variant: body.resumeVariant || body.resume_variant || null,
    fit_level:     body.fitLevel || body.fit_level || null,
  };

  const { data, error } = await supabase
    .from('applications')
    .upsert(row, { onConflict: 'id', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    console.error('[api/v1/applications] upsert error', { userId, error: error.message });
    return jsonResponse(res, 500, { error: error.message });
  }

  return jsonResponse(res, 200, { ok: true, application: data });
}
