// Simple in-memory sliding window rate limiter
// For production at scale, replace with Redis or Upstash

interface RateWindow {
  timestamps: number[];
}

const store = new Map<string, RateWindow>();

const WINDOW_MS = 60_000;  // 1 minute
const MAX_REQUESTS = 5;    // per window

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  store.forEach((window, key) => {
    window.timestamps = window.timestamps.filter((t: number) => now - t < WINDOW_MS);
    if (window.timestamps.length === 0) {
      store.delete(key);
    }
  });
}, 300_000);

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let window = store.get(key);

  if (!window) {
    window = { timestamps: [] };
    store.set(key, window);
  }

  // Drop timestamps outside the window
  window.timestamps = window.timestamps.filter((t) => now - t < WINDOW_MS);

  if (window.timestamps.length >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  window.timestamps.push(now);
  return { allowed: true, remaining: MAX_REQUESTS - window.timestamps.length };
}
