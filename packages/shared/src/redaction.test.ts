import { describe, expect, it } from 'vitest';
import { redactPII, truncate } from './redaction.js';

describe('redactPII', () => {
  it('redacts email addresses', () => {
    const r = redactPII('reach me at jane.doe@example.com today');
    expect(r.text).toContain('[REDACTED_EMAIL]');
    expect(r.text).not.toContain('jane.doe@example.com');
    expect(r.counts.EMAIL).toBe(1);
    expect(r.redacted).toBe(true);
  });

  it('redacts SSN, credit card and phone numbers', () => {
    const r = redactPII('SSN 123-45-6789, card 4111 1111 1111 1111, call 415-555-2671');
    expect(r.counts.SSN).toBe(1);
    expect(r.counts.CREDIT_CARD).toBe(1);
    expect(r.counts.PHONE).toBeGreaterThanOrEqual(1);
    expect(r.text).not.toMatch(/4111/);
  });

  it('leaves clean text untouched', () => {
    const r = redactPII('just a perfectly ordinary sentence');
    expect(r.redacted).toBe(false);
    expect(Object.keys(r.counts)).toHaveLength(0);
  });

  it('handles empty / nullish input', () => {
    expect(redactPII(undefined).text).toBe('');
    expect(redactPII(null).redacted).toBe(false);
  });
});

describe('truncate', () => {
  it('truncates long text, ellipsis included, never exceeding max', () => {
    const result = truncate('abcdef', 3);
    expect(result).toBe('ab…');
    expect(result.length).toBe(3);
  });

  it('returns short text unchanged', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });
});
