'use client';

export default function FCCAccessLog() {
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/fcc"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">Access Log</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Access History</p>
          <p className="text-xs text-slate-400 mt-1">Every time EMS accesses your care card</p>
        </div>

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

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">What gets logged</p>
          <ul className="text-xs text-slate-400 space-y-1.5">
            <li>Date and time of access</li>
            <li>Access method used (incident #, PCR #, or resident code)</li>
            <li>Session duration and which members were viewed</li>
            <li>IP address and device type</li>
          </ul>
        </div>

        <button className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold active:bg-slate-700 transition-colors">
          Export Log (CSV)
        </button>
      </div>
    </main>
  );
}
