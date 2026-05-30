import { createClient } from '@supabase/supabase-js';
import { authenticate, jsonResponse, handleCors } from '../../lib/auth.js';
import { initSentry, captureServerEvent, deleteUserTelemetry, Sentry } from '../../lib/telemetry.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'DELETE') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const { user, error: authError } = await authenticate(req);
  if (authError) return jsonResponse(res, 401, { error: authError });

  initSentry();
  try {
    // 1. Fire deletion event before data wipe so it's in the timeline
    captureServerEvent(user.id, 'account_deletion_completed');

    // 2. Cascade-delete all user data via SECURITY DEFINER function
    const { error: deleteError } = await supabaseAdmin.rpc('delete_user_data', {
      p_user_id: user.id,
    });
    if (deleteError) throw deleteError;

    // 3. Delete auth user (must come after data deletion)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw authDeleteError;

    // 4. Best-effort: wipe PostHog person + Sentry user (outside Postgres tx)
    await deleteUserTelemetry(user.id);

    return jsonResponse(res, 200, { deleted: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[DELETE /v1/me] deletion failed');
    return jsonResponse(res, 500, { error: 'Deletion failed. Contact support.' });
  }
}
