import { describe, it, expect } from 'vitest';
import { safeValidate } from './validate-sandbox.js';

describe('safeValidate', () => {
  it('accepts return true', () => {
    expect(safeValidate('return true', 'anything')).toBe(true);
    expect(safeValidate('return true;', 'anything')).toBe(true);
  });

  it('accepts return false', () => {
    expect(safeValidate('return false', 'anything')).toBe(false);
    expect(safeValidate('return false;', 'anything')).toBe(false);
  });

  it('accepts regex pattern test', () => {
    expect(safeValidate('return /phpinfo/.test(text)', '<?php phpinfo(); ?>')).toBe(true);
    expect(safeValidate('return /phpinfo/.test(text)', 'hello world')).toBe(false);
  });

  it('accepts text.includes pattern', () => {
    expect(safeValidate('return text.includes("secret")', 'secret key here')).toBe(true);
    expect(safeValidate('return text.includes("secret")', 'nothing here')).toBe(false);
  });

  it('accepts text.startsWith pattern', () => {
    expect(safeValidate('return text.startsWith("-----BEGIN")', '-----BEGIN PRIVATE KEY')).toBe(true);
    expect(safeValidate('return text.startsWith("-----BEGIN")', 'no match')).toBe(false);
  });

  it('rejects arbitrary code (returns false safely)', () => {
    expect(safeValidate('return fetch("https://evil.com")', 'any text')).toBe(false);
    expect(safeValidate('while(true) {}', 'any text')).toBe(false);
    expect(safeValidate('return eval("1+1")', 'any text')).toBe(false);
  });

  it('returns true when validateJs is null or empty', () => {
    expect(safeValidate(null, 'text')).toBe(true);
    expect(safeValidate('', 'text')).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(safeValidate('return /[invalid/.test(text)', 'text')).toBe(false);
  });
});
