export function parsePositiveIntParam(value: unknown): number | null {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export function parsePageQuery(value: unknown, fallback = 1, maxPage = 10_000): number {
  const parsed = parsePositiveIntParam(value);
  if (!parsed) return fallback;
  return Math.min(parsed, maxPage);
}

export function parseLimitQuery(value: unknown, fallback = 50, min = 1, max = 200): number {
  const parsed = parsePositiveIntParam(value);
  if (!parsed) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseSearchQuery(value: unknown, maxLength = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function parseEnumQuery<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value !== 'string') return fallback;
  return (allowed as readonly string[]).includes(value) ? value as T : fallback;
}
