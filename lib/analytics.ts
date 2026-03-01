/**
 * Lightweight analytics — logs events to Supabase via /api/analytics.
 * Fire-and-forget: never blocks UI, never throws.
 */
export function logEvent(event: string, props?: Record<string, unknown>) {
  try {
    const body: Record<string, unknown> = { event };
    if (props && Object.keys(props).length > 0) body.props = props;
    if (typeof window !== 'undefined') {
      body.page = window.location.pathname;
      body.referrer = document.referrer || undefined;
    }
    navigator.sendBeacon?.('/api/analytics', JSON.stringify(body))
      || fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
  } catch {
    // Never block the user
  }
}
