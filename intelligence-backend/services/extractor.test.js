import { describe, it, expect, vi } from 'vitest';

// Mock DB — must match the exact import path extractor.js uses
vi.mock('../db.js', () => ({
  getDb: () => ({
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(() => null) })),
  }),
}));

// Mock AI caller — must match the exact import path extractor.js uses
vi.mock('./ai.js', () => ({
  callAI: vi.fn(async () => JSON.stringify({
    checks: [{
      id: 'dynamic_phpinfo',
      label: 'PHP Info Exposure',
      category: 'debug',
      paths: ['/phpinfo.php', '/info.php'],
      validate_js: 'return /phpinfo/.test(text);',
      severity: 'medium',
      cve_id: null,
    }],
  })),
}));

const { extractChecksFromMessage } = await import('./extractor.js');

describe('extractChecksFromMessage', () => {
  it('returns check IDs extracted from message', async () => {
    const result = await extractChecksFromMessage(
      'PHP info page exposure at /phpinfo.php reveals server config',
      'security_news',
      1001
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('prefixes check IDs with dynamic_ if missing', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockResolvedValueOnce(JSON.stringify({
      checks: [{
        id: 'phpinfo',          // no dynamic_ prefix
        label: 'PHP Info',
        paths: ['/phpinfo.php'],
        severity: 'medium',
      }],
    }));
    const result = await extractChecksFromMessage('php exposure', 'chan', 2002);
    expect(result[0]).toBe('dynamic_phpinfo');
  });

  it('returns empty array when AI extracts no checks', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockResolvedValueOnce(JSON.stringify({ checks: [] }));
    const result = await extractChecksFromMessage('completely unrelated news', 'news', 999);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when AI call fails', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockRejectedValueOnce(new Error('timeout'));
    const result = await extractChecksFromMessage('some text', 'chan', 1);
    expect(result).toHaveLength(0);
  });

  it('skips checks missing required fields (id, label, paths)', async () => {
    const { callAI } = await import('./ai.js');
    callAI.mockResolvedValueOnce(JSON.stringify({
      checks: [
        { id: 'dynamic_bad', label: 'Bad Check' },  // missing paths
        { label: 'No ID', paths: ['/foo'] },          // missing id
      ],
    }));
    const result = await extractChecksFromMessage('something', 'chan', 3003);
    expect(result).toHaveLength(0);
  });
});
