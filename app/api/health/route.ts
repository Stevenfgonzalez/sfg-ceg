import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

  // Check rate limiter
  checks.rate_limiter = process.env.UPSTASH_REDIS_REST_URL ? "redis" : "in_memory";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      subsystems: checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
