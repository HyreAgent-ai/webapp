// EC3 v0 PII deny-list — single source of truth for client + server scrub.
// Keys whose values are replaced with '[REDACTED]'. Case-insensitive match.
export const PII_DENY_LIST = new Set([
  'email', 'user_email', 'e_mail', 'contact_email', 'recruiter_email',
  'authorization', 'cookie', 'set-cookie',
  'apikey', 'api_key', 'token', 'access_token', 'refresh_token',
  'password', 'secret',
  'phone', 'phone_number', 'mobile',
  'full_name', 'first_name', 'last_name',
  'resume_text', 'jd_text',
]);

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubValue(key, value) {
  if (PII_DENY_LIST.has(String(key).toLowerCase())) return '[REDACTED]';
  if (typeof value === 'string' && EMAIL_RE.test(value)) {
    EMAIL_RE.lastIndex = 0;
    return value.replace(EMAIL_RE, '[REDACTED_EMAIL]');
  }
  EMAIL_RE.lastIndex = 0;
  return value;
}

export function scrubObject(obj, depth = 0) {
  if (depth > 8 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => scrubObject(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'object' && v !== null
      ? scrubObject(v, depth + 1)
      : scrubValue(k, v);
  }
  return out;
}
