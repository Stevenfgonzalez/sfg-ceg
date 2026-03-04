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

const METHOD_LABELS: Record<string, string> = {
  resident_code: 'Resident Code',
  incident_number: 'Incident #',
  pcr_number: 'PCR #',
};

export default function FCCAccessLog() {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fcc/access-logs');
        const data = await res.json();
        setLogs(data.logs || []);
      } catch {
        // failed to load
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/fcc" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Access Log</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Access History</p>
          <p className="text-xs text-slate-400 mt-1">Every time EMS accesses your care card</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3 text-2xl">
              📋
            </div>
            <p className="font-bold text-sm">No Access Events</p>
            <p className="text-xs text-slate-400 mt-1">
              When someone unlocks your Field Care Card via QR scan,<br/>
              the event will appear here with time, method, and duration.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const date = new Date(log.accessed_at);
              const expires = new Date(log.expires_at);
              return (
                <div key={log.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm">
                      {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-700 px-2 py-0.5 rounded">
                      {METHOD_LABELS[log.access_method] || log.access_method}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    {log.access_method !== 'resident_code' && (
                      <p>Value: <span className="font-mono">{log.access_value}</span></p>
                    )}
                    {log.agency_code && <p>Agency: {log.agency_code}</p>}
                    <p>Expires: {expires.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    {log.ip_address && <p className="text-slate-500">IP: {log.ip_address}</p>}
                    {log.user_agent && (
                      <p className="text-slate-500 truncate">Device: {log.user_agent.slice(0, 60)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">What gets logged</p>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>Date and time of access</li>
            <li>Access method used (incident #, PCR #, or resident code)</li>
            <li>Session expiration time</li>
            <li>IP address and device type</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
