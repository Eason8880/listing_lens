interface RateLimitState {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitState>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const freshState = {
      count: 1,
      resetAt: now + windowMs,
    };

    store.set(key, freshState);

    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt: freshState.resetAt,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}
