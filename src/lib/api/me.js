import { supabase } from '../../supabase.js';

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
