-- SP-007 Gate 1: consent_audit table for anonymised deletion records
-- EC1 Option B: sha256(user_id) stored so deletion is verifiable without PII

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS consent_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_hash     text NOT NULL,           -- sha256(user_id::text) hex string
  event         text NOT NULL,           -- 'account_deleted'
  ip_hint       text,                    -- first 3 octets only, e.g. '192.168.1'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- No RLS needed — server-only writes via service role
-- Retention: keep forever for GDPR erasure audit trail
