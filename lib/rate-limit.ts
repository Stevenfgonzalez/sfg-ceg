// Serverless-compatible rate limiting via Upstash Redis
// Falls back to fail-open if Redis is unavailable (emergency app — availability > security)

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

// In-memory fallback for when Upstash is not configured
const fallbackStore = new Map<string, number[]>();

function fallbackCheck(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const timestamps = fallbackStore.get(key)?.filter(t => now - t < windowMs) ?? [];

  if (timestamps.length >= maxRequests) {
    fallbackStore.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  fallbackStore.set(key, timestamps);
  return { allowed: true, remaining: maxRequests - timestamps.length };
}

// Rate limit check — uses Upstash if configured, falls back to in-memory
// In-memory is imperfect on Vercel (per-instance) but better than nothing
export async function checkRateLimit(
  key: string,
  maxRequests: number = 5,
  windowMs: number = 60_000,
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!upstashUrl || !upstashToken) {
    return fallbackCheck(key, maxRequests, windowMs);
  }

  try {
    // Upstash REST API — sliding window via sorted set
    const windowKey = `ceg:rl:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Pipeline: remove old entries, add current, count, set TTL
    const pipeline = [
      ['ZREMRANGEBYSCORE', windowKey, '0', String(windowStart)],
      ['ZADD', windowKey, String(now), `${now}-${Math.random()}`],
      ['ZCARD', windowKey],
      ['PEXPIRE', windowKey, String(windowMs)],
    ];

    const res = await fetch(`${upstashUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) {
      // Redis error — fail open
      return { allowed: true, remaining: -1 };
    }

    const results = await res.json() as Array<{ result: unknown }>;
    const count = results[2]?.result as number ?? 0;

    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: maxRequests - count };
  } catch {
    // Redis unavailable — fail open for emergency app
    return { allowed: true, remaining: -1 };
  }
}

// Preset rate limiters
export async function checkReunificationRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`reunify:${ip}`, 5, 60_000); // 5 per minute — anti-stalking
}

export async function checkGeneralRateLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(`general:${ip}`, 30, 60_000); // 30 per minute — generous for emergency
}
