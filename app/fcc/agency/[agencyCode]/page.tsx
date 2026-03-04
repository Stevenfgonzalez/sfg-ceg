'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface AgencyInfo {
  name: string;
  code: string;
  contact_email: string | null;
}

interface Stats {
  accesses_this_week: number;
  accesses_this_month: number;
  unique_households_this_month: number;
}

interface AccessEntry {
  id: string;
  household_name: string;
  access_method: string;
  accessed_at: string;
  status: 'active' | 'expired' | 'revoked';
}

const METHOD_LABELS: Record<string, string> = {
  resident_code: 'Resident Code',
  incident_number: 'Incident #',
  pcr_number: 'PCR #',
  temp_code: 'Temp Code',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-900/40',
  expired: 'text-slate-500 bg-slate-700/50',
  revoked: 'text-red-400 bg-red-900/40',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AgencyDashboard() {
  const params = useParams();
  const agencyCode = params.agencyCode as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [accesses, setAccesses] = useState<AccessEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/fcc/agency/${agencyCode}`);
        if (res.status === 404) {
          setError('Agency not found');
          return;
        }
        if (res.status === 429) {
          setError('Too many requests. Please wait.');
          return;
        }
        if (!res.ok) {
          setError('Failed to load dashboard');
          return;
        }
        const data = await res.json();
        setAgency(data.agency);
        setStats(data.stats);
        setAccesses(data.recent_accesses);
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [agencyCode]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (error || !agency || !stats) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-4xl mb-3">🚒</p>
          <p className="font-bold text-lg">{error || 'Not Found'}</p>
          <p className="text-sm text-slate-400 mt-2">Check the agency code and try again.</p>
          <a href="/" className="inline-block mt-6 bg-slate-800 border border-slate-700 rounded-lg px-6 py-3 text-sm font-semibold">
            Go to CEG Home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <div>
          <h1 className="text-lg font-bold">{agency.name}</h1>
          <p className="text-xs text-slate-400 font-mono">{agency.code}</p>
        </div>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-blue-400 uppercase font-mono">Agency Dashboard</p>
          <p className="text-xs text-slate-400 mt-1">FCC Access Overview</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
            <p className="text-2xl font-bold text-blue-400 font-mono">{stats.accesses_this_week}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">This Week</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400 font-mono">{stats.accesses_this_month}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">This Month</p>
          </div>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
            <p className="text-2xl font-bold text-green-400 font-mono">{stats.unique_households_this_month}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">Unique HH</p>
          </div>
        </div>

        {/* Recent Accesses */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">
            Recent Accesses ({accesses.length})
          </p>
          {accesses.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No access events recorded</p>
          ) : (
            <div className="space-y-1.5">
              {accesses.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-sm font-semibold">{a.household_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {METHOD_LABELS[a.access_method] || a.access_method} · {relativeTime(a.accessed_at)}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono capitalize ${STATUS_COLORS[a.status] || ''}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {agency.contact_email && (
          <p className="text-[10px] text-slate-500 text-center font-mono">Contact: {agency.contact_email}</p>
        )}
      </div>
    </main>
  );
}
