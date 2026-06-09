import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimitMap,
  buildStealthHeaders,
  isOriginSuspended,
  markRateLimited,
  trackHttp403,
} from './stealth.js';

beforeEach(() => rateLimitMap.clear());

describe('buildStealthHeaders', () => {
  it('includes required stealth headers', () => {
    const h = buildStealthHeaders('https://example.com');
    expect(h['Accept']).toContain('text/html');
    expect(h['Accept-Language']).toBe('en-US,en;q=0.9');
    expect(h['Cache-Control']).toBe('no-cache');
    expect(h['Pragma']).toBe('no-cache');
    expect(h['Referer']).toBe('https://example.com/');
  });

  it('sets Referer to origin + trailing slash', () => {
    expect(buildStealthHeaders('https://target.io')['Referer']).toBe('https://target.io/');
  });
});

describe('isOriginSuspended', () => {
  it('returns false for unknown origin', () => {
    expect(isOriginSuspended('https://new.com')).toBe(false);
  });

  it('returns true immediately after markRateLimited', () => {
    markRateLimited('https://target.com');
    expect(isOriginSuspended('https://target.com')).toBe(true);
  });

  it('auto-clears when suspension window has expired', () => {
    rateLimitMap.set('https://old.com', {
      count403: 5,
      suspended: true,
      suspendedUntil: Date.now() - 1,
    });
    expect(isOriginSuspended('https://old.com')).toBe(false);
  });
});

describe('trackHttp403', () => {
  it('returns false for first 4 consecutive hits', () => {
    for (let i = 0; i < 4; i++) {
      expect(trackHttp403('https://x.com')).toBe(false);
    }
  });

  it('returns true and suspends origin on 5th hit', () => {
    for (let i = 0; i < 4; i++) trackHttp403('https://x.com');
    expect(trackHttp403('https://x.com')).toBe(true);
    expect(isOriginSuspended('https://x.com')).toBe(true);
  });

  it('tracks separate origins independently', () => {
    for (let i = 0; i < 5; i++) trackHttp403('https://a.com');
    expect(isOriginSuspended('https://a.com')).toBe(true);
    expect(isOriginSuspended('https://b.com')).toBe(false);
  });
});
