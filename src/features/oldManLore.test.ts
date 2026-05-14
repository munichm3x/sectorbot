import { describe, it, expect } from 'vitest';
import {
  trimToLength,
  detectCommand,
  buildOldManPrompt,
  randomFallback,
} from './oldManLore';
import type { LoreCommand } from './oldManLore';

describe('trimToLength', () => {
  it('returns text unchanged when within limit', () => {
    expect(trimToLength('hello world', 100)).toBe('hello world');
  });

  it('trims at word boundary when text exceeds limit', () => {
    const text = 'one two three four';
    const result = trimToLength(text, 11);
    expect(result).toBe('one two');
    expect(result.length).toBeLessThanOrEqual(11);
  });

  it('hard-cuts when no space found before limit', () => {
    expect(trimToLength('abcdefgh', 4)).toBe('abcd');
  });
});

describe('detectCommand', () => {
  it('detects /story', () => {
    expect(detectCommand('/story tell me something')).toBe('story');
  });

  it('detects /wisdom', () => {
    expect(detectCommand('/wisdom')).toBe('wisdom');
  });

  it('detects /rumor', () => {
    expect(detectCommand('/rumor about the fence')).toBe('rumor');
  });

  it('detects /name', () => {
    expect(detectCommand('/name give me one')).toBe('name');
  });

  it('returns null for normal messages', () => {
    expect(detectCommand('what happened here?')).toBeNull();
  });

  it('returns null for unknown slash commands', () => {
    expect(detectCommand('/unknown')).toBeNull();
  });

  it('detects /lastwords', () => {
    expect(detectCommand('/lastwords')).toBe('lastwords');
  });

  it('detects /prison', () => {
    expect(detectCommand('/prison help')).toBe('prison');
  });

  it('detects /bunker', () => {
    expect(detectCommand('/bunker')).toBe('bunker');
  });
});

describe('buildOldManPrompt', () => {
  const baseMemory = { displayName: 'Sasha', messages: [] };

  it('includes the username and message', () => {
    const prompt = buildOldManPrompt('What happened here?', baseMemory, null);
    expect(prompt).toContain('Sasha');
    expect(prompt).toContain('What happened here?');
  });

  it('includes command directive for /story', () => {
    const prompt = buildOldManPrompt('/story', baseMemory, 'story');
    expect(prompt).toContain('survival story');
  });

  it('includes command directive for /wisdom', () => {
    const prompt = buildOldManPrompt('/wisdom', baseMemory, 'wisdom');
    expect(prompt).toContain('wisdom');
  });

  it('includes command directive for /rumor', () => {
    const prompt = buildOldManPrompt('/rumor', baseMemory, 'rumor');
    expect(prompt).toContain('rumor');
  });

  it('includes command directive for /name', () => {
    const prompt = buildOldManPrompt('/name', baseMemory, 'name');
    expect(prompt).toContain('nickname');
  });

  it('includes prior messages from memory', () => {
    const memory = { displayName: 'Sasha', messages: ['old message one', 'old message two'] };
    const prompt = buildOldManPrompt('new message', memory, null);
    expect(prompt).toContain('old message one');
    expect(prompt).toContain('old message two');
  });

  it('omits memory block when messages array is empty', () => {
    const prompt = buildOldManPrompt('hi', baseMemory, null);
    expect(prompt).not.toContain('Recent messages');
  });

  it('includes character identity rules', () => {
    const prompt = buildOldManPrompt('hi', baseMemory, null);
    expect(prompt).toContain('Old Man of Sector 13');
    expect(prompt).toContain('never admit to being an AI');
  });

  it('includes nickname context when memory has nickname', () => {
    const memory = { displayName: 'Sasha', messages: [], nickname: 'The Crow' };
    const prompt = buildOldManPrompt('hi', memory, null);
    expect(prompt).toContain('This survivor is known as: The Crow');
  });

  it('omits nickname context when memory has no nickname', () => {
    const prompt = buildOldManPrompt('hi', baseMemory, null);
    expect(prompt).not.toContain('This survivor is known as:');
  });

  it('includes command directive for /lastwords', () => {
    const prompt = buildOldManPrompt('/lastwords', baseMemory, 'lastwords');
    expect(prompt).toContain('radio transmission');
  });

  it('includes command directive for /prison', () => {
    const prompt = buildOldManPrompt('/prison', baseMemory, 'prison');
    expect(prompt).toContain('prison');
  });

  it('includes command directive for /bunker', () => {
    const prompt = buildOldManPrompt('/bunker', baseMemory, 'bunker');
    expect(prompt).toContain('bunker');
  });
});

describe('randomFallback', () => {
  it('returns a non-empty string', () => {
    const result = randomFallback();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns different values across calls (probabilistic)', () => {
    const results = new Set(Array.from({ length: 50 }, () => randomFallback()));
    expect(results.size).toBeGreaterThan(1);
  });

  it('returns a non-empty string for each mode', () => {
    const modes: Array<LoreCommand> = [
      'story', 'wisdom', 'rumor', 'name', 'lastwords', 'prison', 'bunker', null,
    ];
    for (const mode of modes) {
      const result = randomFallback(mode);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
