// Environment variable validation — fail fast on misconfiguration

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

function optionalEnv(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

// Validated environment — import this instead of using process.env directly
export const env = {
  // Supabase (required)
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),

  // Service role key — required server-side only, optional client-side
  get supabaseServiceKey(): string {
    return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  },

  // Phone hash secret — required for v2 hashing
  phoneHashSecret: optionalEnv('PHONE_HASH_SECRET'),

  // Upstash Redis — optional, rate limiting degrades to fail-open without it
  upstashRedisUrl: optionalEnv('UPSTASH_REDIS_REST_URL'),
  upstashRedisToken: optionalEnv('UPSTASH_REDIS_REST_TOKEN'),
} as const;
