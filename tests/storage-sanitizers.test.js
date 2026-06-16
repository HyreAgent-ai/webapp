import { describe, it, expect, vi, beforeEach } from 'vitest';

// Verifies CODE-11 (mass-assignment) fix: the four storage helpers that used to
// spread the client-supplied object directly into the Supabase upsert now route
// through sanitize<Entity>() whitelists, so forbidden keys (timestamps,
// ownership flags, ad-hoc columns) cannot reach the DB even if the caller
// passes them.
//
// The test spies on the upsert payload that supabase-js receives and asserts
// the keys are exactly the allowed whitelist.

const upsertSpy = vi.fn(() => ({
  select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: '1' }, error: null })) })),
  // some helpers don't chain .select().single() — they just await the upsert builder.
  // Returning a thenable that resolves to { error: null } covers both shapes.
  then: (cb) => cb({ error: null }),
}));

vi.mock('../src/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({ upsert: upsertSpy })),
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  },
}));

describe('CODE-11 sanitizer whitelist enforcement', () => {
  beforeEach(() => upsertSpy.mockClear());

  it('upsertTemplate strips disallowed fields (created_at, user_id override, arbitrary key)', async () => {
    const { upsertTemplate } = await import('../src/lib/storage.js');
    await upsertTemplate({
      id: 't-1',
      name: 'My template',
      body: 'Hi {{firstName}}',
      created_at: '1970-01-01',         // attempt to forge timestamp
      user_id: 'someone-else',          // attempt to forge ownership
      is_primary: true,                 // arbitrary column not in table
      malicious_jsonb: { evil: true },
    });
    const payload = upsertSpy.mock.calls.at(-1)[0];
    expect(Object.keys(payload).sort()).toEqual(['body', 'id', 'name', 'user_id'].sort());
    expect(payload.user_id).toBe('user-1'); // server-asserted, not client-supplied
    expect(payload.created_at).toBeUndefined();
    expect(payload.is_primary).toBeUndefined();
    expect(payload.malicious_jsonb).toBeUndefined();
  });

  it('upsertRoleTarget strips disallowed fields', async () => {
    const { upsertRoleTarget } = await import('../src/lib/storage.js');
    await upsertRoleTarget({
      id: 'rt-1',
      title: 'Quality Engineer',
      cluster: 'aerospace',
      priority: 1,
      keywords: ['ASME', 'GD&T'],
      boost_tags: ['urgent'],
      require_h1b: true,
      created_at: '1970-01-01',
      user_id: 'someone-else',
      analysis_report: { fake: 'data' },
    });
    const payload = upsertSpy.mock.calls.at(-1)[0];
    const allowed = ['id', 'title', 'cluster', 'priority', 'keywords', 'boost_tags', 'require_h1b', 'active', 'user_id'];
    expect(Object.keys(payload).every(k => allowed.includes(k))).toBe(true);
    expect(payload.user_id).toBe('user-1');
    expect(payload.created_at).toBeUndefined();
    expect(payload.analysis_report).toBeUndefined();
  });

  it('upsertResumeVariant strips disallowed fields', async () => {
    const { upsertResumeVariant } = await import('../src/lib/storage.js');
    await upsertResumeVariant({
      id: 'rv-1',
      variant_key: 'aerospace-v1',
      name: 'Aerospace variant',
      description: 'For aerospace roles',
      target_clusters: ['aerospace'],
      created_at: '1970-01-01',
      user_id: 'someone-else',
      injected: 'value',
    });
    const payload = upsertSpy.mock.calls.at(-1)[0];
    const allowed = ['id', 'variant_key', 'name', 'description', 'target_clusters', 'user_id'];
    expect(Object.keys(payload).every(k => allowed.includes(k))).toBe(true);
    expect(payload.created_at).toBeUndefined();
    expect(payload.injected).toBeUndefined();
  });

  it('upsertContact strips disallowed fields and keeps the server-asserted updated_at', async () => {
    const { upsertContact } = await import('../src/lib/storage.js');
    await upsertContact({
      id: 'c-1',
      name: 'Test Contact',
      company: 'Acme',
      position: 'Recruiter',
      role_type: 'recruiter',
      conv_status: 'intro_sent',
      priority: 1,
      linkedin_url: 'https://linkedin.com/in/test',
      email: 'test@example.com',
      created_at: '1970-01-01',         // forbidden
      user_id: 'someone-else',          // forbidden override
      ai_insights: 'forged-llm-output', // arbitrary
    });
    const payload = upsertSpy.mock.calls.at(-1)[0];
    expect(payload.user_id).toBe('user-1');           // server-asserted
    expect(payload.updated_at).toBeDefined();         // server-asserted
    expect(payload.created_at).toBeUndefined();       // stripped
    expect(payload.ai_insights).toBeUndefined();      // stripped
    expect(payload.name).toBe('Test Contact');        // legitimate field passes through
  });
});

describe('BOLA-02 insertManualApplication ID guard', () => {
  it('rejects a caller-supplied ID that does not start with "manual-"', async () => {
    const { insertManualApplication } = await import('../src/lib/storage.js');
    await expect(
      insertManualApplication({ id: 'greenhouse-acme-123', role: 'SWE', company: 'Acme' })
    ).rejects.toThrow('Application ID must start with "manual-"');
  });

  it('rejects a lever-prefixed ID', async () => {
    const { insertManualApplication } = await import('../src/lib/storage.js');
    await expect(
      insertManualApplication({ id: 'lever-corp-456', role: 'PM', company: 'Corp' })
    ).rejects.toThrow('Application ID must start with "manual-"');
  });

  it('accepts a manual-prefixed ID without throwing', async () => {
    const { insertManualApplication } = await import('../src/lib/storage.js');
    // Supabase insert mock: from().insert().select().single()
    const { supabase } = await import('../src/supabase.js');
    supabase.from.mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { id: 'manual-valid-1', role: 'SWE', company: 'X', user_id: 'user-1' }, error: null })),
        })),
      })),
    });
    await expect(
      insertManualApplication({ id: 'manual-valid-1', role: 'SWE', company: 'X' })
    ).resolves.toBeDefined();
  });

  it('auto-generates a manual- prefixed ID when no id supplied', async () => {
    const { insertManualApplication } = await import('../src/lib/storage.js');
    const { supabase } = await import('../src/supabase.js');
    let capturedId;
    supabase.from.mockReturnValueOnce({
      insert: vi.fn((row) => {
        capturedId = row.id;
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { ...row }, error: null })),
          })),
        };
      }),
    });
    await insertManualApplication({ role: 'SWE', company: 'X' });
    expect(capturedId).toMatch(/^manual-/);
  });
});
