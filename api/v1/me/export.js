// api/v1/me/export.js — Gate 3: SAR Article 15 data export
//
// Refs: docs/architecture/gates/gate-03-sar-article-15-stub.md
//
// EC rulings (owner-signed 2026-05-19):
//   EC1 = Option B — redact user_integrations.api_key (Recital 63 carve-out;
//         keys are trade-secret credentials, not personal data).
//   EC2 = Option A — query exports using caller's JWT. RLS enforces isolation.
//   EC3 = Option C — static third_party_providers pointer block (no per-vendor
//         enumeration). Points to /privacy.html#third-party.

import { authenticate, jsonResponse, handleCors } from '../../lib/auth.js';

const SCHEMA_VERSION = '1.0';

const THIRD_PARTY_PROVIDERS = {
  notice: 'For the current list of subprocessors and the data shared with each, see https://hyreagent.ai/privacy.html#third-party. This pointer is stable; the underlying list may change as vendors are added or removed.',
  reference_url: '/privacy.html#third-party',
};

// Tables to export, in the order they appear in the JSON payload.
// Each entry: { key, table, redact? }. RLS on every table scopes rows to caller.
const EXPORT_TABLES = [
  { key: 'profile',           table: 'user_profiles' },
  { key: 'resumes',           table: 'resumes' },
  { key: 'role_targets',      table: 'role_targets' },
  { key: 'templates',         table: 'templates' },
  { key: 'applications',      table: 'applications' },
  { key: 'user_job_feed',     table: 'user_job_feed' },
  { key: 'contacts',          table: 'contacts' },
  { key: 'linkedin_dm_contacts', table: 'linkedin_dm_contacts' },
  { key: 'user_integrations', table: 'user_integrations', redact: ['api_key'] },
  { key: 'consent_ledger',    table: 'consent_ledger' },
  { key: 'consent_audit',     table: 'consent_audit' },
];

function applyRedactions(rows, redactFields) {
  if (!redactFields || !rows || rows.length === 0) return rows;
  return rows.map((row) => {
    const cleaned = { ...row };
    for (const field of redactFields) {
      if (field in cleaned) cleaned[field] = '[REDACTED]';
    }
    return cleaned;
  });
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  const { supabase, user, error: authError } = await authenticate(req);
  if (authError) return jsonResponse(res, 401, { error: authError });

  const data = {};
  const errors = [];

  for (const { key, table, redact } of EXPORT_TABLES) {
    // RLS-scoped: caller's JWT is on the supabase client → only their rows.
    const { data: rows, error } = await supabase.from(table).select('*');
    if (error) {
      // A table missing in the schema (or RLS denying) is non-fatal; record it
      // and continue so the rest of the export still ships.
      errors.push({ table, message: error.message });
      data[key] = [];
      continue;
    }
    data[key] = applyRedactions(rows || [], redact);
  }

  const payload = {
    schema_version:        SCHEMA_VERSION,
    exported_at:           new Date().toISOString(),
    user_id:               user.id,
    user_email:            user.email,
    data,
    third_party_providers: THIRD_PARTY_PROVIDERS,
    export_errors:         errors,
  };

  const filename = `hyreagent-data-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.status(200).send(JSON.stringify(payload, null, 2));
}
