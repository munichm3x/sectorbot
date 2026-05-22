import type { TicketSummaryJSON } from '../types';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export function validateTicketSummary(raw: string): TicketSummaryJSON | null {
  if (!raw || raw.trim().length === 0) return null;

  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1] ?? '';

  let parsed: Record<string, unknown>;
  try {
    const p = JSON.parse(cleaned);
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;
    parsed = p as Record<string, unknown>;
  } catch {
    return null;
  }

  const STRING_FIELDS = [
    'short_summary', 'problem', 'user_request',
    'actions_taken', 'resolution', 'open_points',
  ] as const;

  const result: Partial<TicketSummaryJSON> = {};

  for (const field of STRING_FIELDS) {
    result[field] =
      typeof parsed[field] === 'string' && (parsed[field] as string).length > 0
        ? (parsed[field] as string)
        : 'Nicht erkennbar';
  }

  const rawPriority = String(parsed['priority'] ?? '').toLowerCase().trim();
  result.priority = (VALID_PRIORITIES as readonly string[]).includes(rawPriority)
    ? (rawPriority as TicketSummaryJSON['priority'])
    : 'medium';

  result.tags = Array.isArray(parsed['tags'])
    ? (parsed['tags'] as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 8)
    : [];

  const nf = parsed['needs_followup'];
  result.needs_followup = nf === true || nf === 'true' || nf === 1;

  return result as TicketSummaryJSON;
}
