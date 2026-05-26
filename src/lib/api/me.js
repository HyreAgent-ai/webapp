import { supabase } from '../../supabase.js';

// Gate 3 — SAR Article 15 data export.
// Triggers a browser download of the user's full data as JSON. RLS isolation
// is enforced server-side: the endpoint runs with the caller's JWT.
export async function exportAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch('/api/v1/me/export', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) {
    let message = 'Export failed';
    try {
      const body = await res.json();
      message = body.error || message;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }

  const blob = await res.blob();
  // Pull filename out of Content-Disposition; fall back to a safe default.
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `hyreagent-data-export-${new Date().toISOString().slice(0, 10)}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

export async function deleteAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch('/api/v1/me/delete', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Deletion failed');
  return body;
}
