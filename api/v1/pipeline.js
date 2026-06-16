// GET /api/v1/pipeline
// Returns in-pipeline jobs for the authenticated user (extension popup use).

import { authenticate, jsonResponse, handleCors } from '../lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const auth = await authenticate(req);
  if (auth.error) return jsonResponse(res, auth.status, { error: auth.error });
  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from('user_job_feed')
    .select(`
      job_id,
      resume_variant,
      user_relevance_score,
      status,
      normalized_jobs!inner (
        job_title,
        company_name,
        location,
        job_url
      )
    `)
    .eq('user_id', userId)
    .eq('in_pipeline', true)
    .order('pipeline_added_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[api/v1/pipeline] error', { userId, error: error.message });
    return jsonResponse(res, 500, { error: 'Failed to fetch pipeline' });
  }

  const jobs = (data || []).map(row => ({
    id:            row.job_id,
    role:          row.normalized_jobs?.job_title || '',
    company:       row.normalized_jobs?.company_name || '',
    location:      row.normalized_jobs?.location || '',
    applyUrl:      row.normalized_jobs?.job_url || row.job_id,
    resumeVariant: row.resume_variant || null,
    match:         row.user_relevance_score || null,
    verdict:       null,
  }));

  return jsonResponse(res, 200, { ok: true, jobs });
}
