import { describe, it, expect } from 'vitest';
import { validateTicketSummary } from '../validation/validateTicketSummary';

const VALID_JSON = {
  short_summary:  'User requested whitelist access.',
  problem:        'User not whitelisted.',
  user_request:   'Add to whitelist.',
  actions_taken:  'Admin verified Steam ID.',
  resolution:     'Whitelisted successfully.',
  open_points:    '',
  priority:       'medium',
  tags:           ['whitelist'],
  needs_followup: false,
};

describe('validateTicketSummary', () => {
  it('returns parsed object for valid JSON', () => {
    const result = validateTicketSummary(JSON.stringify(VALID_JSON));
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User requested whitelist access.');
    expect(result!.priority).toBe('medium');
    expect(result!.tags).toEqual(['whitelist']);
    expect(result!.needs_followup).toBe(false);
  });

  it('fills missing string fields with "Nicht erkennbar"', () => {
    const partial = { ...VALID_JSON };
    delete (partial as Partial<typeof partial>).open_points;
    const result = validateTicketSummary(JSON.stringify(partial));
    expect(result).not.toBeNull();
    expect(result!.open_points).toBe('Nicht erkennbar');
  });

  it('coerces priority "HIGH" to "high"', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, priority: 'HIGH' }));
    expect(result!.priority).toBe('high');
  });

  it('coerces unknown priority to "medium"', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, priority: 'critical' }));
    expect(result!.priority).toBe('medium');
  });

  it('coerces non-array tags to empty array', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, tags: 'ban' }));
    expect(result!.tags).toEqual([]);
  });

  it('coerces needs_followup string "true" to boolean true', () => {
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, needs_followup: 'true' }));
    expect(result!.needs_followup).toBe(true);
  });

  it('strips markdown code fences and parses JSON', () => {
    const fenced = '```json\n' + JSON.stringify(VALID_JSON) + '\n```';
    const result = validateTicketSummary(fenced);
    expect(result).not.toBeNull();
    expect(result!.short_summary).toBe('User requested whitelist access.');
  });

  it('returns null for completely invalid JSON', () => {
    expect(validateTicketSummary('this is not json')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(validateTicketSummary('')).toBeNull();
  });

  it('limits tags to 8 items', () => {
    const manyTags = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    const result = validateTicketSummary(JSON.stringify({ ...VALID_JSON, tags: manyTags }));
    expect(result!.tags).toHaveLength(8);
  });
});
