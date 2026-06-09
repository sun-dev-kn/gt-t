import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB — must match the exact import path enricher.js uses
// getDb is itself a vi.fn so tests can override its return value per-test.
vi.mock('../db.js', () => {
  const makeDb = () => ({
    prepare: vi.fn(() => ({
      get: vi.fn(() => null),   // no cache hit by default
      run: vi.fn(),
    })),
  });
  return {
    getDb: vi.fn(makeDb),
    _makeDb: makeDb,
  };
});

// Mock AI caller — must match the exact import path enricher.js uses
vi.mock('./ai.js', () => ({
  callAI: vi.fn(async () => JSON.stringify({
    cve_id: 'CVE-2024-1234',
    cvss_score: 7.5,
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    remediation: 'Disable phpinfo in production.',
    references: ['https://php.net/phpinfo'],
    ai_summary: 'PHP info page exposes server configuration.',
  })),
}));

const { enrichFinding } = await import('./enricher.js');

describe('enrichFinding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns enrichment from AI on cache miss', async () => {
    const result = await enrichFinding({
      checkId: 'phpinfo',
      checkLabel: 'PHP Info',
      siteUrl: 'https://example.com',
      matchedPath: '/phpinfo.php',
      responseSnippet: '<?php phpinfo(); ?>',
    });
    expect(result).not.toBeNull();
    expect(result.cve_id).toBe('CVE-2024-1234');
    expect(result.cvss_score).toBe(7.5);
    expect(result.remediation).toContain('phpinfo');
  });

  it('returns null when AI throws', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockRejectedValueOnce(new Error('API timeout'));
    const result = await enrichFinding({
      checkId: 'env',
      checkLabel: '.env file',
      siteUrl: 'https://example.com',
      matchedPath: '/.env',
    });
    expect(result).toBeNull();
  });

  it('returns cached result without calling AI', async () => {
    const { getDb } = await import('../db.js');
    const { callAI } = await import('./ai.js');

    // Override getDb to return a cache hit for this test
    const cachedRow = {
      cve_id: 'CVE-2023-9999',
      cvss_score: 5.0,
      cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N',
      remediation: 'Keep secrets out of .env files.',
      references: '["https://example.com/ref"]',
      ai_summary: 'Exposed .env file.',
    };
    // Replace the mock implementation for this one call
    getDb.mockImplementationOnce(() => ({
      prepare: vi.fn(() => ({
        get: vi.fn(() => cachedRow),
        run: vi.fn(),
      })),
    }));

    const result = await enrichFinding({
      checkId: 'env',
      checkLabel: '.env file',
      siteUrl: 'https://example.com',
      matchedPath: '/.env',
    });

    expect(result).not.toBeNull();
    expect(result.cve_id).toBe('CVE-2023-9999');
    expect(callAI).not.toHaveBeenCalled();
  });
});
