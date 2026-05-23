import { describe, it, expect } from 'vitest';
import { validateAiReply } from '../validation/validateAiReply';

describe('validateAiReply', () => {
  it('fails on empty text', () => {
    const r = validateAiReply('', 'something');
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain('too_short');
  });

  it('fails on text shorter than 3 chars', () => {
    const r = validateAiReply('ab', 'something');
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain('too_short');
  });

  it('fails on meta-commentary starting with "Certainly"', () => {
    const r = validateAiReply('Certainly! Here is the answer.', 'what is this');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('meta_commentary'))).toBe(true);
  });

  it('fails on meta-commentary "Sure!"', () => {
    const r = validateAiReply('Sure! I can help with that.', 'can you help');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('meta_commentary'))).toBe(true);
  });

  it('fails on hallucination marker [source]', () => {
    const r = validateAiReply('According to [source] this is true.', 'is this true');
    expect(r.pass).toBe(false);
    expect(r.reasons.some(r => r.startsWith('hallucination_marker'))).toBe(true);
  });

  it('trims text over 600 chars to sentence boundary', () => {
    const long = 'Das ist ein langer Satz. '.repeat(30); // ~750 chars
    const r = validateAiReply(long, 'was ist das');
    expect(r.pass).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(600);
    expect(r.reasons.some(s => s.startsWith('too_long'))).toBe(true);
  });

  it('adds repeats_question reason when response echoes 70%+ of question', () => {
    const question = 'wie viele leben gibt es auf der insel heute noch';
    const response  = 'wie viele leben gibt es auf der insel heute? Nicht viele mehr.';
    const r = validateAiReply(response, question);
    expect(r.reasons).toContain('repeats_question');
    // but does NOT fail hard on this alone
    expect(r.pass).toBe(true);
  });

  it('passes clean short text', () => {
    const r = validateAiReply('Der Wald vergisst nichts.', 'was weißt du');
    expect(r.pass).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(r.text).toBe('Der Wald vergisst nichts.');
  });
});
