import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase module
vi.mock('../supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from '../supabase.js';
import {
  fetchContacts,
  upsertContact,
  updateContactFields,
  updateContactNotes,
} from '../lib/storage.js';

const MOCK_USER_ID = 'test-user-123';
const mockUser = () =>
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: MOCK_USER_ID } } });

const mockChain = (returnVal) => {
  const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), update: vi.fn(),
                  upsert: vi.fn(), maybeSingle: vi.fn() };
  // All methods return the chain by default for chaining
  Object.values(chain).forEach(fn => fn.mockReturnValue(chain));
  // order: first call returns chain, second call resolves (fetchContacts uses 2 orders)
  let orderCallCount = 0;
  chain.order.mockImplementation(() => {
    orderCallCount++;
    if (orderCallCount < 2) return chain;
    return Promise.resolve(returnVal);
  });
  chain.upsert.mockResolvedValue({ error: null });
  // eq: second call resolves (updateContactFields uses .eq('id').eq('user_id'))
  // first call returns chain, second resolves
  let eqCallCount = 0;
  chain.eq.mockImplementation(() => {
    eqCallCount++;
    if (eqCallCount < 2) return chain;
    return Promise.resolve({ error: null });
  });
  return chain;
};

beforeEach(() => { vi.clearAllMocks(); mockUser(); });

describe('fetchContacts', () => {
  it('queries contacts table filtered by user_id ordered by priority desc', async () => {
    const chain = mockChain({ data: [], error: null });
    supabase.from.mockReturnValue(chain);
    await fetchContacts();
    expect(supabase.from).toHaveBeenCalledWith('contacts');
    expect(chain.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
  });
});

describe('upsertContact', () => {
  it('upserts with user_id and onConflict id', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);
    await upsertContact({ id: 'abc', name: 'Jane', outreach_sent: true });
    expect(supabase.from).toHaveBeenCalledWith('contacts');
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'abc', user_id: MOCK_USER_ID }),
      { onConflict: 'id' }
    );
  });
});

describe('updateContactFields', () => {
  it('updates fields filtered by id and user_id', async () => {
    const chain = mockChain({ error: null });
    supabase.from.mockReturnValue(chain);
    await updateContactFields('abc', { outreach_status: 'Accepted' });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ outreach_status: 'Accepted', updated_at: expect.any(String) })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'abc');
    expect(chain.eq).toHaveBeenCalledWith('user_id', MOCK_USER_ID);
  });
});
