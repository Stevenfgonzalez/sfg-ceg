// Structured JSON logger — outputs to stdout for Vercel log drain
// No PII in logs: no names, no phone hashes, no GPS coordinates

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  event: string;
  route: string;
  incident_id?: string;
  duration_ms?: number;
  error?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export function log(entry: Omit<LogEntry, 'timestamp'>) {
  const line: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(line));
}
