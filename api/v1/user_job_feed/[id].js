// PATCH /api/v1/user_job_feed/:id
// Updates a user_job_feed row for the authenticated user (e.g., in_pipeline=false).
// Replaces extension's broken PATCH /rest/v1/jobs (RELI-17).

import { authenticate, jsonResponse, handleCors } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'PATCH') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const auth = await authenticate(req);
  if (auth.error) return jsonResponse(res, auth.status, { error: auth.error });
  const { supabase, userId } = auth;

  const { id } = req.query;
  if (!id) return jsonResponse(res, 400, { error: 'Missing id in path' });

  const ALLOWED_FIELDS = ['in_pipeline', 'pipeline_added_at', 'resume_variant', 'status'];
  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (req.body && key in req.body) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return jsonResponse(res, 400, { error: 'No valid fields to update' });
  }

  const { data, error } = await supabase
    .from('user_job_feed')
    .update(updates)
    .eq('job_id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[api/v1/user_job_feed/[id]] update error', { userId, id, error: error.message });
    return jsonResponse(res, 500, { error: error.message });
  }
  if (!data) return jsonResponse(res, 404, { error: 'Job not found in feed' });

  return jsonResponse(res, 200, { ok: true, row: data });
}
