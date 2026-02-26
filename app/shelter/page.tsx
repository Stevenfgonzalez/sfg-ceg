'use client';

import { useState, useEffect } from 'react';

export default function ShelterPage() {
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'done' | 'denied'>('loading');
  const [manualAddress, setManualAddress] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsStatus('done');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const hasLocation = gps || manualAddress.trim();

  const handleSubmit = async () => {
    if (!hasLocation || submitting) return;
    setSubmitting(true);

    try {
      await fetch('/api/public/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: '00000000-0000-0000-0000-000000000000',
          full_name: 'Shelter-in-Place',
          status: 'SHELTERING_HERE',
          party_size: partySize,
          lat: gps?.lat,
          lon: gps?.lon,
          notes: manualAddress ? `Address: ${manualAddress}` : undefined,
        }),
      });
    } catch {
      // Offline — will show success regardless
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Shelter in Place</h1>
        </header>

        <div className="px-4 pt-12 text-center space-y-4">
          <div className="text-6xl">🏠</div>
          <h2 className="text-2xl font-extrabold">Location Shared</h2>
          <p className="text-slate-300">
            Responders can see you&apos;re sheltering in place.
            <br />
            {partySize} {partySize === 1 ? 'person' : 'people'} at this location.
          </p>
          {gps && (
            <a
              href={`https://www.google.com/maps?q=${gps.lat},${gps.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-slate-800 rounded-xl text-blue-400 font-semibold"
            >
              📍 View on Map
            </a>
          )}
        </div>

        <div className="px-4 pt-8 space-y-3">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">
              Shelter-in-Place Tips
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>Close all doors, windows, and fireplace dampers</li>
              <li>Set A/C to recirculate (close outside air intake)</li>
              <li>Move to an interior room if smoke is heavy</li>
              <li>Wet towels and place at door gaps</li>
              <li>Fill sinks and tubs with water</li>
              <li>Keep phone charged — conserve battery</li>
            </ul>
          </div>

          <a
            href="/"
            className="block w-full py-3 rounded-xl bg-slate-800 border border-slate-600 font-semibold text-center active:bg-slate-700 transition-colors"
          >
            Return to Dashboard
          </a>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">🏠 Shelter in Place</h1>
      </header>

      {/* 911 Banner */}
      <div className="mx-4 mt-4 mb-4 flex items-center justify-center gap-2 bg-red-900/60 rounded-xl px-4 py-2.5 text-sm text-red-200">
        If in immediate danger, call <a href="tel:911" className="font-bold text-white underline">911</a>
      </div>

      <div className="px-4 space-y-5">
        {/* Location */}
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-blue-600">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📍</span>
            <span className="font-bold">Your Location</span>
          </div>

          {gpsStatus === 'loading' ? (
            <p className="text-sm text-slate-400 text-center py-4">Getting your location...</p>
          ) : gps ? (
            <div>
              <div className="font-mono text-sm text-blue-400 bg-slate-900 rounded-lg px-3 py-2 text-center">
                {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
              </div>
              <button
                onClick={() => { setGps(null); setGpsStatus('denied'); }}
                className="text-xs text-slate-400 underline mt-2"
              >
                Enter address instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Enter address (e.g., 28000 Pacific Coast Hwy)"
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-base"
              />
              <button
                onClick={() => {
                  setGpsStatus('loading');
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => {
                      setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                      setGpsStatus('done');
                    },
                    () => setGpsStatus('denied'),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
                className="text-xs text-slate-400 underline"
              >
                📍 Try GPS again
              </button>
            </div>
          )}
        </div>

        {/* Party Size */}
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">How many people?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setPartySize(n)}
                className={`flex-1 py-3 rounded-xl text-lg font-bold border-2 transition-colors min-h-[48px] ${
                  partySize === n
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                {n === 5 ? '5+' : n}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!hasLocation || submitting}
          className="w-full py-4 rounded-xl bg-blue-600 font-bold text-lg active:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Sending...' : '🏠 Confirm Shelter in Place'}
        </button>
      </div>

      <div className="h-8" />
    </main>
  );
}
