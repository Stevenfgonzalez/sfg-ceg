import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const APP_VERSION = "0.1.0";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Check Supabase connectivity
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (url) {
      const resp = await fetch(`${url}/rest/v1/`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
        signal: AbortSignal.timeout(3000),
      });
      checks.database = resp.ok ? "ok" : "degraded";
      if (!resp.ok) healthy = false;
    } else {
      checks.database = "not_configured";
    }
  } catch {
    checks.database = "unreachable";
    healthy = false;
  }

  // Check rate limiter — verify Redis is actually reachable if configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    try {
      const resp = await fetch(`${upstashUrl}/ping`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(2000),
      });
      checks.rate_limiter = resp.ok ? "redis" : "memory_fallback";
    } catch {
      checks.rate_limiter = "memory_fallback";
    }
  } else {
    checks.rate_limiter = "in_memory";
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      subsystems: checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
