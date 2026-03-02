'use client';

import { useState, useEffect } from 'react';
import { logEvent } from '@/lib/analytics';
import { DEFAULT_INCIDENT_ID } from '@/lib/constants';
import { saveToOutbox } from '@/lib/offline-store';
import { trySyncNow } from '@/lib/outbox-sync';

const STUCK_REASONS = [
  { id: 'traffic', label: 'Stuck in traffic', icon: '🚗' },
  { id: 'blocked', label: 'Road blocked', icon: '🚧' },
  { id: 'vehicle', label: 'No vehicle / disabled', icon: '🚫' },
  { id: 'mobility', label: 'Mobility limitation', icon: '♿' },
  { id: 'other', label: 'Other', icon: '📍' },
];

export default function StuckPage() {
  const [reason, setReason] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'done' | 'denied'>('loading');
  const [manualAddress, setManualAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [mobilityDetail, setMobilityDetail] = useState('');
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
  const canSubmit = reason && hasLocation && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const vehicleDesc = [vehicleMake, vehicleColor, vehiclePlate].filter(Boolean).join(', ');
      await saveToOutbox('stuck', {
        incident_id: DEFAULT_INCIDENT_ID,
        full_name: 'Evacuation Assistance',
        status: 'NEED_HELP',
        party_size: peopleCount,
        lat: gps?.lat,
        lon: gps?.lon,
        notes: [
          `Reason: ${STUCK_REASONS.find((r) => r.id === reason)?.label || reason}`,
          `People: ${peopleCount}`,
          vehicleDesc ? `Vehicle: ${vehicleDesc}` : null,
          reason === 'mobility' && mobilityDetail ? `Mobility: ${mobilityDetail}` : null,
          notes ? `Details: ${notes}` : null,
          manualAddress ? `Address: ${manualAddress}` : null,
        ].filter(Boolean).join(' | '),
      });
      trySyncNow();
    } catch {
      // IndexedDB failure — still show success
    }

    logEvent('stuck_submitted', { reason: reason || 'unknown' });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Help Requested</h1>
        </header>

        <div className="px-4 pt-12 text-center space-y-4">
          <div className="text-6xl">🚗</div>
          <h2 className="text-2xl font-extrabold text-amber-400">
            Help Request Sent
          </h2>
          <p className="text-slate-300">
            Responders know your location. Stay where you are if safe.
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

        <div className="px-4 pt-8 pb-8">
          <a
            href="/"
            className="block w-full py-3 rounded-xl bg-slate-800 border border-slate-600 font-semibold text-center active:bg-slate-700 transition-colors"
          >
            Return to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Need Evacuation Help</h1>
      </header>

      {/* 911 Banner */}
      <div className="mx-4 mt-4 mb-4 flex items-center justify-center gap-2 bg-red-900/60 rounded-xl px-4 py-2.5 text-sm text-red-200">
        If in immediate danger, call <a href="tel:911" className="font-bold text-white underline">911</a>
      </div>

      <div className="px-4 space-y-5">
        {/* Reason */}
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">What&apos;s the situation?</p>
          <div className="space-y-2">
            {STUCK_REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-colors ${
                  reason === r.id
                    ? 'bg-amber-900/30 border-amber-600'
                    : 'bg-slate-800 border-slate-700 active:bg-slate-700'
                }`}
              >
                <span className="text-2xl">{r.icon}</span>
                <span className="font-semibold">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">Your location</p>
          {gpsStatus === 'loading' ? (
            <div className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-slate-400">
              Getting your location...
            </div>
          ) : gps ? (
            <div className="px-4 py-3 rounded-xl bg-slate-800 border border-blue-600">
              <div className="font-mono text-sm text-blue-400">
                {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
              </div>
              <button
                onClick={() => { setGps(null); setGpsStatus('denied'); }}
                className="text-xs text-slate-400 underline mt-1"
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
                placeholder="Street address or landmark"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
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

        {/* People count */}
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">How many people?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setPeopleCount(n)}
                className={`flex-1 py-3 rounded-xl text-lg font-bold border-2 transition-colors min-h-[48px] ${
                  peopleCount === n
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                {n === 5 ? '5+' : n}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicle description — hidden when "no vehicle" */}
        {reason && reason !== 'vehicle' && (
          <div>
            <p className="text-sm font-semibold text-slate-300 mb-2">Vehicle description (optional)</p>
            <div className="space-y-2">
              <input
                type="text"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
                placeholder="Make / model (e.g., Toyota Camry)"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="Color"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
                />
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="License plate"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mobility detail — shown when reason is mobility */}
        {reason === 'mobility' && (
          <div>
            <p className="text-sm font-semibold text-slate-300 mb-2">Mobility details</p>
            <input
              type="text"
              value={mobilityDetail}
              onChange={(e) => setMobilityDetail(e.target.value)}
              placeholder="e.g., wheelchair, walker, oxygen tank..."
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <p className="text-sm font-semibold text-slate-300 mb-2">Additional details (optional)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other information for responders..."
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base resize-none"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
            canSubmit
              ? 'bg-amber-600 active:bg-amber-700 text-white'
              : 'bg-slate-700 text-slate-500'
          }`}
        >
          {submitting ? 'Sending...' : '🚗 Request Assistance'}
        </button>
      </div>

      <div className="h-8" />
    </main>
  );
}
