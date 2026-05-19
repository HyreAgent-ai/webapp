import { describe, it, expect } from 'vitest';
import { detectAts, extractGreenhouseSlug, extractLeverSlug, matchPipelineJob } from '../extension/adapters/index.js';

describe('detectAts', () => {
  it('detects boards.greenhouse.io', () => {
    expect(detectAts('https://boards.greenhouse.io/rocketlab/jobs/7883012')).toBe('greenhouse');
  });

  it('detects job-boards.greenhouse.io', () => {
    expect(detectAts('https://job-boards.greenhouse.io/axiomspace/jobs/4045617007')).toBe('greenhouse');
  });

  it('detects jobs.greenhouse.io numeric', () => {
    expect(detectAts('https://jobs.greenhouse.io/7883012')).toBe('greenhouse');
  });

  it('detects lever', () => {
    expect(detectAts('https://jobs.lever.co/shieldai/abc-123')).toBe('lever');
  });

  it('returns null for unrecognized URL', () => {
    expect(detectAts('https://careers.google.com/jobs/12345')).toBeNull();
    expect(detectAts('https://www.linkedin.com/jobs/view/12345')).toBeNull();
  });
});

describe('extractGreenhouseSlug', () => {
  it('extracts slug from boards.greenhouse.io', () => {
    expect(extractGreenhouseSlug('https://boards.greenhouse.io/rocketlab/jobs/7883012')).toBe('rocketlab');
  });

  it('extracts slug from job-boards.greenhouse.io', () => {
    expect(extractGreenhouseSlug('https://job-boards.greenhouse.io/axiomspace/jobs/4045617007')).toBe('axiomspace');
  });

  it('returns null for jobs.greenhouse.io (no slug)', () => {
    expect(extractGreenhouseSlug('https://jobs.greenhouse.io/7883012')).toBeNull();
  });
});

describe('extractLeverSlug', () => {
  it('extracts slug from lever URL', () => {
    expect(extractLeverSlug('https://jobs.lever.co/shieldai/abc-123-def')).toBe('shieldai');
  });
});

describe('matchPipelineJob', () => {
  const pipeline = [
    { id: '1', applyUrl: 'https://boards.greenhouse.io/rocketlab/jobs/7883012', role: 'Mech Eng', company: 'Rocket Lab' },
    { id: '2', applyUrl: 'https://jobs.lever.co/shieldai/abc', role: 'Systems Eng', company: 'Shield AI' },
    { id: '3', applyUrl: 'https://boards.greenhouse.io/axiomspace/jobs/999', role: 'Structural Eng', company: 'Axiom Space' },
  ];

  it('matches greenhouse job by slug', () => {
    const match = matchPipelineJob('https://boards.greenhouse.io/rocketlab/jobs/7883012', pipeline);
    expect(match?.id).toBe('1');
  });

  it('matches lever job by slug', () => {
    const match = matchPipelineJob('https://jobs.lever.co/shieldai/xyz', pipeline);
    expect(match?.id).toBe('2');
  });

  it('returns null when no match', () => {
    const match = matchPipelineJob('https://boards.greenhouse.io/google/jobs/999', pipeline);
    expect(match).toBeNull();
  });

  it('returns null for unrecognized URL', () => {
    expect(matchPipelineJob('https://careers.google.com/jobs/1', pipeline)).toBeNull();
  });
});

import { detect as ghDetect, extractSlug as ghExtractSlug } from '../extension/adapters/greenhouse.js';

describe('greenhouse adapter detect()', () => {
  it('detects boards.greenhouse.io', () => {
    expect(ghDetect('https://boards.greenhouse.io/rocketlab/jobs/7883012')).toBe(true);
  });

  it('detects job-boards.greenhouse.io', () => {
    expect(ghDetect('https://job-boards.greenhouse.io/axiomspace/jobs/4045617007')).toBe(true);
  });

  it('detects jobs.greenhouse.io numeric', () => {
    expect(ghDetect('https://jobs.greenhouse.io/7883012')).toBe(true);
  });

  it('rejects lever', () => {
    expect(ghDetect('https://jobs.lever.co/shieldai/abc')).toBe(false);
  });

  it('rejects generic URL', () => {
    expect(ghDetect('https://careers.google.com/jobs/1')).toBe(false);
  });
});

describe('greenhouse adapter extractSlug()', () => {
  it('extracts slug from boards.greenhouse.io', () => {
    expect(ghExtractSlug('https://boards.greenhouse.io/rocketlab/jobs/7883012')).toBe('rocketlab');
  });

  it('extracts slug from job-boards.greenhouse.io', () => {
    expect(ghExtractSlug('https://job-boards.greenhouse.io/axiomspace/jobs/999')).toBe('axiomspace');
  });

  it('returns null for jobs.greenhouse.io (no slug)', () => {
    expect(ghExtractSlug('https://jobs.greenhouse.io/7883012')).toBeNull();
  });
});

import { detect as leverDetect, extractSlug as leverExtractSlug } from '../extension/adapters/lever.js';

describe('lever adapter detect()', () => {
  it('detects lever job page', () => {
    expect(leverDetect('https://jobs.lever.co/shieldai/abc-123')).toBe(true);
  });

  it('detects lever job page with subpath', () => {
    expect(leverDetect('https://jobs.lever.co/betatechnologies/xyz/apply')).toBe(true);
  });

  it('rejects greenhouse', () => {
    expect(leverDetect('https://boards.greenhouse.io/rocketlab/jobs/123')).toBe(false);
  });

  it('rejects generic URL', () => {
    expect(leverDetect('https://careers.google.com/jobs/1')).toBe(false);
  });
});

describe('lever adapter extractSlug()', () => {
  it('extracts slug from lever URL', () => {
    expect(leverExtractSlug('https://jobs.lever.co/shieldai/abc-123')).toBe('shieldai');
  });

  it('extracts hyphenated slug', () => {
    expect(leverExtractSlug('https://jobs.lever.co/beta-technologies/xyz')).toBe('beta-technologies');
  });

  it('returns null for non-lever URL', () => {
    expect(leverExtractSlug('https://boards.greenhouse.io/rocketlab/jobs/123')).toBeNull();
  });
});
