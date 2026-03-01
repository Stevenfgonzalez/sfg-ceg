'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logEvent } from '@/lib/analytics';

// ── Types ──

interface CheckinRecord {
  id: string;
  full_name: string;
  status: string;
  priority: string;
  party_size: number;
  assembly_point: string | null;
  zone: string | null;
  lat: number | null;
  lon: number | null;
  needs_categories: string[] | null;
  ems_notes: string | null;
  notes: string | null;
  created_at: string;
}

interface HelpRecord {
  id: string;
  caller_name: string | null;
  complaint_code: string;
  complaint_label: string;
  triage_tier: number;
  dispatch_note: string | null;
  party_size: number;
  assembly_point: string | null;
  lat: number | null;
  lon: number | null;
  status: string;
  manual_address: string | null;
  created_at: string;
}

interface QueueData {
  checkins: CheckinRecord[];
  help_requests: HelpRecord[];
  timestamp: string;
}

// ── Helpers ──

function elapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function gpsLink(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null) return null;
  return `https://maps.google.com/?q=${lat},${lon}`;
}

// ── PIN Gate Component ──

function PinGate({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dispatch/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      if (res.ok) {
        logEvent('dispatch_auth_success');
        onAuth();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Error ${res.status}`);
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Dispatch Dashboard</h1>
          <p className="text-slate-400 mt-1">Enter dispatch PIN to continue</p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="form-input text-center text-2xl tracking-widest"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin.trim()}
          className="w-full py-4 rounded-xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Authenticate'}
        </button>
      </form>
    </main>
  );
}

// ── Dashboard Component ──

function Dashboard() {
  const [data, setData] = useState<QueueData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueue = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/dispatch/queue', { credentials: 'include' });
      if (res.status === 401) return false;
      if (!res.ok) {
        setError(`Server error ${res.status}`);
        return true;
      }
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date().toLocaleTimeString());
      setError('');
      return true;
    } catch {
      setError('Network error');
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  // Return false from fetchQueue means 401 → need re-auth
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchQueue().then((ok) => {
      if (mounted && !ok) setAuthed(false);
    });

    intervalRef.current = setInterval(() => {
      fetchQueue().then((ok) => {
        if (mounted && !ok) setAuthed(false);
      });
    }, 30_000);

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchQueue]);

  if (!authed) {
    // Cookie expired — reload to show PIN gate
    if (typeof window !== 'undefined') window.location.reload();
    return null;
  }

  const logout = () => {
    // Clear cookie by setting it expired
    document.cookie = 'ceg_dispatch_token=; path=/; max-age=0';
    window.location.reload();
  };

  const manualRefresh = () => {
    setLoading(true);
    fetchQueue();
  };

  const tier1 = data?.help_requests.filter((h) => h.triage_tier === 1) ?? [];
  const tier2 = data?.help_requests.filter((h) => h.triage_tier === 2) ?? [];
  const immediateCheckins = data?.checkins ?? [];

  const totalActive = immediateCheckins.length + tier1.length + tier2.length;

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">CEG Dispatch</h1>
            <p className="text-xs text-slate-400">
              {lastRefresh ? `Last refresh: ${lastRefresh}` : 'Loading...'}
              {totalActive > 0 && (
                <span className="ml-2 text-amber-400">
                  {totalActive} active
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={manualRefresh}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-slate-700 active:bg-slate-600 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '...' : 'Refresh'}
            </button>
            <button
              onClick={logout}
              className="px-3 py-2 rounded-lg bg-slate-700 active:bg-slate-600 text-sm font-medium text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/50 border border-red-700 rounded-xl px-4 py-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="px-4 py-4 space-y-6">
        {/* Section: IMMEDIATE Check-ins */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Immediate Check-ins
            </h2>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {immediateCheckins.length}
            </span>
          </div>

          {immediateCheckins.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {immediateCheckins.map((c) => (
                <CheckinCard key={c.id} record={c} />
              ))}
            </div>
          )}
        </section>

        {/* Section: Tier 1 — Critical */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Tier 1 — Critical
            </h2>
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {tier1.length}
            </span>
          </div>

          {tier1.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {tier1.map((h) => (
                <HelpCard key={h.id} record={h} />
              ))}
            </div>
          )}
        </section>

        {/* Section: Tier 2 — Callback */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              Tier 2 — Callback
            </h2>
            <span className="bg-amber-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {tier2.length}
            </span>
          </div>

          {tier2.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {tier2.map((h) => (
                <HelpCard key={h.id} record={h} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ── Card Components ──

function EmptyState() {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 px-4 py-6 text-center text-slate-500 text-sm">
      No active requests
    </div>
  );
}

function CheckinCard({ record: c }: { record: CheckinRecord }) {
  const gps = gpsLink(c.lat, c.lon);

  return (
    <div className="bg-slate-800 rounded-xl border border-red-800/50 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{c.full_name}</p>
          <p className="text-sm text-slate-400">
            {c.status} &middot; Party of {c.party_size}
          </p>
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {elapsed(c.created_at)}
        </span>
      </div>

      {c.assembly_point && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">AP:</span> {c.assembly_point}
        </p>
      )}

      {c.needs_categories && c.needs_categories.length > 0 && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Needs:</span>{' '}
          {c.needs_categories.join(', ')}
        </p>
      )}

      {c.ems_notes && (
        <p className="text-sm text-amber-300">
          <span className="text-slate-500">EMS:</span> {c.ems_notes}
        </p>
      )}

      {c.notes && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Notes:</span> {c.notes}
        </p>
      )}

      {gps && (
        <a
          href={gps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-400 underline"
        >
          Open in Maps
        </a>
      )}
    </div>
  );
}

function HelpCard({ record: h }: { record: HelpRecord }) {
  const gps = gpsLink(h.lat, h.lon);
  const tierColor = h.triage_tier === 1 ? 'border-red-800/50' : 'border-amber-800/50';

  return (
    <div className={`bg-slate-800 rounded-xl border ${tierColor} px-4 py-3 space-y-2`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{h.caller_name || 'Unknown caller'}</p>
          <p className="text-sm text-slate-400">
            {h.complaint_label} &middot; Party of {h.party_size}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 whitespace-nowrap">
            {elapsed(h.created_at)}
          </span>
          <p className="text-xs text-slate-500 mt-0.5">{h.status}</p>
        </div>
      </div>

      {h.assembly_point && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">AP:</span> {h.assembly_point}
        </p>
      )}

      {h.manual_address && (
        <p className="text-sm text-slate-300">
          <span className="text-slate-500">Addr:</span> {h.manual_address}
        </p>
      )}

      {h.dispatch_note && (
        <p className="text-sm text-amber-300">
          <span className="text-slate-500">Dispatch:</span> {h.dispatch_note}
        </p>
      )}

      {gps && (
        <a
          href={gps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-blue-400 underline"
        >
          Open in Maps
        </a>
      )}
    </div>
  );
}

// ── Page Component ──

export default function DispatchPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // On mount, try fetching queue to check if cookie is valid
  useEffect(() => {
    fetch('/api/dispatch/queue', { credentials: 'include' })
      .then((res) => setAuthenticated(res.ok))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </main>
    );
  }

  if (!authenticated) {
    return <PinGate onAuth={() => setAuthenticated(true)} />;
  }

  return <Dashboard />;
}
