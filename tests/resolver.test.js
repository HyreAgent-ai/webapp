import { describe, it, expect } from 'vitest';
import { isAggregatorUrl } from '../extension/lib/resolver.js';

describe('isAggregatorUrl', () => {
  it('detects adzuna', () => {
    expect(isAggregatorUrl('https://www.adzuna.com/jobs/details/12345')).toBe(true);
  });

  it('detects click2apply', () => {
    expect(isAggregatorUrl('https://www.click2apply.net/v2/jobs/apply/12345')).toBe(true);
  });

  it('detects prng.co', () => {
    expect(isAggregatorUrl('https://prng.co/r/abc123')).toBe(true);
  });

  it('detects aerocontact', () => {
    expect(isAggregatorUrl('https://www.aerocontact.com/en/job/12345')).toBe(true);
  });

  it('detects appcast', () => {
    expect(isAggregatorUrl('https://click.appcast.io/track/abc')).toBe(true);
  });

  it('returns false for Greenhouse URL', () => {
    expect(isAggregatorUrl('https://boards.greenhouse.io/rocketlab/jobs/123')).toBe(false);
  });

  it('returns false for Lever URL', () => {
    expect(isAggregatorUrl('https://jobs.lever.co/shieldai/abc')).toBe(false);
  });

  it('returns false for direct company career page', () => {
    expect(isAggregatorUrl('https://careers.spacex.com/jobs/12345')).toBe(false);
  });

  it('returns false for null/empty', () => {
    expect(isAggregatorUrl(null)).toBe(false);
    expect(isAggregatorUrl('')).toBe(false);
    expect(isAggregatorUrl(undefined)).toBe(false);
  });
});
