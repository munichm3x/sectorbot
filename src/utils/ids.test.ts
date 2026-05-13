import { describe, it, expect } from 'vitest';
import { makeId, parseId, sanitizeChannelName } from './ids';

describe('makeId / parseId', () => {
  it('round-trips id with payload', () => {
    const id = makeId('ticket_close', '123456789');
    const { prefix, payload } = parseId(id);
    expect(prefix).toBe('ticket_close');
    expect(payload).toBe('123456789');
  });

  it('handles id without colon', () => {
    const { prefix, payload } = parseId('accept_rules');
    expect(prefix).toBe('accept_rules');
    expect(payload).toBe('');
  });

  it('handles payload containing colon (channel ids with colons)', () => {
    const id = makeId('ticket_close', 'a:b:c');
    const { prefix, payload } = parseId(id);
    expect(prefix).toBe('ticket_close');
    expect(payload).toBe('a:b:c');
  });
});

describe('sanitizeChannelName', () => {
  it('lowercases and replaces spaces with dashes', () => {
    expect(sanitizeChannelName('Hello World')).toBe('hello-world');
  });

  it('collapses consecutive dashes', () => {
    expect(sanitizeChannelName('a--b')).toBe('a-b');
  });

  it('removes leading and trailing dashes', () => {
    expect(sanitizeChannelName('-hello-')).toBe('hello');
  });

  it('strips non-alphanumeric characters', () => {
    expect(sanitizeChannelName('ticket_user')).toBe('ticket-user');
  });

  it('truncates to 100 characters', () => {
    expect(sanitizeChannelName('a'.repeat(200)).length).toBeLessThanOrEqual(100);
  });
});
