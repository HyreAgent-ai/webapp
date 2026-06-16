import { supabase } from '../supabase.js';
import { useState, useEffect } from 'react';

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

// Gate 2 — pre-signup consent.
// Sends both consent grants in user_metadata so the on_auth_user_created
// trigger writes consent_ledger rows in the same transaction as the
// auth.users INSERT. Trigger fails closed on missing/non-'granted' values,
// so a non-consenting user cannot get an auth.users row.
export async function signUpWithConsent(email, password, consentPayload) {
  if (!consentPayload || consentPayload.data_storage !== 'granted' || consentPayload.beta_terms !== 'granted') {
    throw new Error('Both data_storage and beta_terms consent are required');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        consent_data_storage: consentPayload.data_storage,
        consent_beta_terms:   consentPayload.beta_terms,
        consent_version:      consentPayload.version || '2026-05-25',
      },
    },
  });
  if (error) throw error;
  return data.user;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email) {
  // Always redirect to production — localhost links break when not running locally
  const redirectTo = import.meta.env.VITE_APP_URL
    ? import.meta.env.VITE_APP_URL + '/'
    : 'https://jobagent-web.vercel.app/';
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// React hook — returns { user, loading }
export function useAuth() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve current session immediately on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Keep state in sync with auth events (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
