import { describe, it, expect } from 'vitest';
import { sanitizeForApply } from '../extension/lib/supabase.js';

describe('sanitizeForApply', () => {
  it('maps link column to applyUrl', () => {
    const row = {
      id: 42,
      role: 'Mechanical Engineer',
      company: 'Rocket Lab',
      location: 'Long Beach, CA',
      link: 'https://boards.greenhouse.io/rocketlab/jobs/12345',
      resume_variant: 'A',
      match: '87',
      verdict: 'GREEN',
      tier: '1',
      h1b: 'yes',
      itar_flag: false,
    };
    const result = sanitizeForApply(row);

    expect(result.applyUrl).toBe('https://boards.greenhouse.io/rocketlab/jobs/12345');
    expect(result.id).toBe('42');
    expect(result.role).toBe('Mechanical Engineer');
    expect(result.company).toBe('Rocket Lab');
    expect(result.resumeVariant).toBe('A');
    expect(result.match).toBe(87);
    expect(result.verdict).toBe('GREEN');
    expect(result.itarFlag).toBe(false);
  });

  it('handles missing optional fields gracefully', () => {
    const row = { id: 1, role: 'Engineer', company: 'Acme', link: 'https://example.com/apply' };
    const result = sanitizeForApply(row);

    expect(result.id).toBe('1');
    expect(result.applyUrl).toBe('https://example.com/apply');
    expect(result.resumeVariant).toBeNull();
    expect(result.match).toBeNull();
    expect(result.verdict).toBeNull();
    expect(result.itarFlag).toBe(false);
    expect(result.location).toBe('');
  });

  it('coerces match to integer', () => {
    expect(sanitizeForApply({ id: 1, match: '94.5' }).match).toBe(94);
    expect(sanitizeForApply({ id: 1, match: 0 }).match).toBe(0);
    expect(sanitizeForApply({ id: 1, match: null }).match).toBeNull();
    expect(sanitizeForApply({ id: 1 }).match).toBeNull();
  });

  it('returns empty strings for missing text fields, not null', () => {
    const result = sanitizeForApply({ id: 99 });
    expect(result.role).toBe('');
    expect(result.company).toBe('');
    expect(result.location).toBe('');
    expect(result.applyUrl).toBe('');
  });
});
