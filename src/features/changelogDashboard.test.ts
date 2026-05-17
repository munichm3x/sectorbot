import { describe, it, expect } from 'vitest';
import { formatChangelogEntries, splitFieldValue } from './changelogDashboard';

describe('formatChangelogEntries', () => {
  it('normalises dash bullets', () => {
    expect(formatChangelogEntries('- foo\n- bar')).toBe('• foo\n• bar');
  });

  it('normalises asterisk bullets', () => {
    expect(formatChangelogEntries('* foo\n* bar')).toBe('• foo\n• bar');
  });

  it('normalises existing bullet char', () => {
    expect(formatChangelogEntries('• foo')).toBe('• foo');
  });

  it('adds bullet to plain lines', () => {
    expect(formatChangelogEntries('foo\nbar')).toBe('• foo\n• bar');
  });

  it('strips empty lines', () => {
    expect(formatChangelogEntries('foo\n\nbar')).toBe('• foo\n• bar');
  });

  it('trims whitespace', () => {
    expect(formatChangelogEntries('  foo  \n  bar  ')).toBe('• foo\n• bar');
  });

  it('returns null for blank input', () => {
    expect(formatChangelogEntries('')).toBeNull();
    expect(formatChangelogEntries('   \n  ')).toBeNull();
  });
});

describe('splitFieldValue', () => {
  it('returns single-element array when under limit', () => {
    expect(splitFieldValue('• foo\n• bar')).toHaveLength(1);
  });

  it('splits when over limit', () => {
    const long = Array.from({ length: 80 }, (_, i) => `• item number ${i}`).join('\n');
    const parts = splitFieldValue(long, 1024);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(1024);
  });

  it('never cuts mid-line', () => {
    const long = Array.from({ length: 80 }, (_, i) => `• item number ${i}`).join('\n');
    const parts = splitFieldValue(long, 1024);
    const rejoined = parts.join('\n');
    expect(rejoined).toBe(long);
  });
});
