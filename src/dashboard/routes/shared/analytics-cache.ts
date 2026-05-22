type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const analyticsCache = new Map<string, CacheEntry<unknown>>();

export function readThroughAnalyticsCache<T>(key: string, ttlMs: number, factory: () => T): T {
  const now = Date.now();
  const cached = analyticsCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const value = factory();
  analyticsCache.set(key, {
    expiresAt: now + ttlMs,
    value,
  });
  return value;
}

export function clearAnalyticsCache(prefix?: string): void {
  if (!prefix) {
    analyticsCache.clear();
    return;
  }

  for (const key of analyticsCache.keys()) {
    if (key.startsWith(prefix)) analyticsCache.delete(key);
  }
}