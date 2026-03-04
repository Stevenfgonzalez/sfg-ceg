'use client';

import { useState, useEffect } from 'react';

interface AccessLog {
  id: string;
  access_method: string;
  access_value: string;
  agency_code: string | null;
  accessed_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

const METHOD_CONFIG: Record<string, { label: string; color: string }> = {
  resident_code: { label: 'Resident Code', color: 'bg-blue-900/60 text-blue-300 border-blue-700' },
  incident_number: { label: 'Incident #', color: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  pcr_number: { label: 'PCR #', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseUserAgent(ua: string): string {
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

export default function FCCAccessLog() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fcc/access-logs');
        const data = await res.json();
        setLogs(data.logs || []);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/fcc" aria-label="Back to dashboard" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold flex-1">Access Log</h1>
        {logs.length > 0 && (
          <span className="text-xs text-slate-400 font-mono bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
            {logs.length}
          </span>
        )}
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Access History</p>
          <p className="text-xs text-slate-400 mt-1">Every time EMS accesses your care card</p>
        </div>

        {fetchError && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-red-300">Failed to load access log. Check your connection and refresh.</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 && !fetchError ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3 text-2xl">
              📋
            </div>
            <p className="font-bold text-sm">No Access Events</p>
            <p className="text-xs text-slate-400 mt-1">
              When someone unlocks your Field Care Card via QR scan,<br/>
              the event will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const date = new Date(log.accessed_at);
              const expires = new Date(log.expires_at);
              const isExpired = expires.getTime() < Date.now();
              const config = METHOD_CONFIG[log.access_method] || { label: log.access_method, color: 'bg-slate-700 text-slate-300 border-slate-600' };

              return (
                <div key={log.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold font-mono px-2 py-0.5 rounded border ${config.color}`}>
                        {config.label}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isExpired
                          ? 'bg-slate-700 text-slate-500'
                          : 'bg-green-900/60 text-green-400 border border-green-800'
                      }`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{relativeTime(log.accessed_at)}</span>
                  </div>

                  <p className="text-sm font-semibold">
                    {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>

                  <div className="text-xs text-slate-400 mt-1.5 space-y-0.5">
                    {log.access_method !== 'resident_code' && log.access_value !== '****' && (
                      <p>ID: <span className="font-mono text-slate-300">{log.access_value}</span></p>
                    )}
                    {log.agency_code && <p>Agency: <span className="text-slate-300">{log.agency_code}</span></p>}
                    <p className="text-slate-500">
                      Expires {expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {log.ip_address && ` · ${log.ip_address}`}
                      {log.user_agent && ` · ${parseUserAgent(log.user_agent)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">What gets logged</p>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>· Date and time of access</li>
            <li>· Access method (resident code, incident #, PCR #)</li>
            <li>· Session status (active or expired)</li>
            <li>· IP address and device type</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
