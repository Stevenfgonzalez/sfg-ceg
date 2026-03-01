'use client';

import { useState, useCallback } from 'react';
import { logEvent } from '@/lib/analytics';
import {
  HOSPITALS,
  TRAUMA_LEVEL_LABELS,
  TRAUMA_LEVEL_COLORS,
  CAPABILITY_LABELS,
  findNearestHospitals,
  type Hospital,
} from '../data/hospitals';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Array<Hospital & { distance?: number }>>(HOSPITALS);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');
  const [filterTrauma, setFilterTrauma] = useState(false);
  const [filterPediatric, setFilterPediatric] = useState(false);
  const [filterBurn, setFilterBurn] = useState(false);
  const [filterLD, setFilterLD] = useState(false);

  const handleFindNearest = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const sorted = findNearestHospitals(pos.coords.latitude, pos.coords.longitude);
        setHospitals(sorted);
        setGpsStatus('done');
        logEvent('gps_sort', { page: 'hospitals' });
      },
      () => {
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const filteredHospitals = hospitals.filter((h) => {
    if (filterTrauma && h.traumaLevel === null) return false;
    if (filterPediatric && !h.pediatric) return false;
    if (filterBurn && !h.burn) return false;
    if (filterLD && !h.laborDelivery) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Top bar */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          &larr;
        </a>
        <h1 className="text-lg font-bold flex-1">Nearby Emergency Rooms</h1>
      </header>

      {/* 911 Banner */}
      <a
        href="tel:911"
        className="mx-4 mt-4 mb-2 flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors"
      >
        <span className="text-2xl">&#x1F4DE;</span>
        <div>
          <p className="font-bold text-base">Life-threatening emergency?</p>
          <p className="text-sm text-red-200">Tap to call 911 now</p>
        </div>
      </a>

      {/* GPS + Filters */}
      <div className="px-4 py-3 space-y-3 border-b border-slate-800">
        <button
          onClick={handleFindNearest}
          disabled={gpsStatus === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 rounded-xl px-4 py-3 font-semibold active:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {gpsStatus === 'loading' ? (
            <>
              <span className="animate-spin">&#x23F3;</span> Locating...
            </>
          ) : gpsStatus === 'done' ? (
            <>&#x1F4CD; Sorted by distance</>
          ) : gpsStatus === 'denied' ? (
            <>&#x26A0;&#xFE0F; Location unavailable &mdash; tap to retry</>
          ) : (
            <>&#x1F4CD; Find Nearest to Me</>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { logEvent('filter_toggle', { filter: 'trauma', on: !filterTrauma }); setFilterTrauma(!filterTrauma); }}
            className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              filterTrauma
                ? 'bg-red-700 border-red-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            Trauma Center
          </button>
          <button
            onClick={() => { logEvent('filter_toggle', { filter: 'pediatric', on: !filterPediatric }); setFilterPediatric(!filterPediatric); }}
            className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              filterPediatric
                ? 'bg-blue-700 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            Pediatric
          </button>
          <button
            onClick={() => { logEvent('filter_toggle', { filter: 'burn', on: !filterBurn }); setFilterBurn(!filterBurn); }}
            className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              filterBurn
                ? 'bg-orange-700 border-orange-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            Burn Center
          </button>
          <button
            onClick={() => { logEvent('filter_toggle', { filter: 'labor_delivery', on: !filterLD }); setFilterLD(!filterLD); }}
            className={`rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              filterLD
                ? 'bg-pink-700 border-pink-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            Labor &amp; Delivery
          </button>
        </div>
      </div>

      {/* Hospital count */}
      <div className="px-4 py-2">
        <p className="text-sm text-slate-400">
          {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Hospital List */}
      <div className="px-4 pb-8 space-y-3">
        {filteredHospitals.map((hospital) => (
          <HospitalCard key={hospital.id} hospital={hospital} />
        ))}
      </div>
    </main>
  );
}

function HospitalCard({ hospital }: { hospital: Hospital & { distance?: number } }) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lon}`;
  const traumaKey = String(hospital.traumaLevel);
  const traumaLabel = TRAUMA_LEVEL_LABELS[traumaKey] || 'Emergency Room';
  const traumaColor = TRAUMA_LEVEL_COLORS[traumaKey] || 'bg-neutral-600 text-white';

  // Build capability pills from boolean flags + capabilities array
  const pills: { key: string; label: string }[] = [];
  if (hospital.burn) pills.push({ key: 'burn', label: CAPABILITY_LABELS.burn });
  if (hospital.pediatric) pills.push({ key: 'peds', label: CAPABILITY_LABELS.peds });
  if (hospital.stroke) pills.push({ key: 'stroke', label: CAPABILITY_LABELS.stroke });
  if (hospital.stemi) pills.push({ key: 'stemi', label: CAPABILITY_LABELS.stemi });
  if (hospital.capabilities.includes('cardiac') && !hospital.burn && !hospital.stemi) {
    pills.push({ key: 'cardiac', label: CAPABILITY_LABELS.cardiac });
  }
  if (hospital.laborDelivery) pills.push({ key: 'laborDelivery', label: CAPABILITY_LABELS.laborDelivery });
  if (hospital.helipad) pills.push({ key: 'helipad', label: CAPABILITY_LABELS.helipad });

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${traumaColor}`}>
                {traumaLabel}
              </span>
            </div>
            <h3 className="font-bold text-base leading-tight">{hospital.name}</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {hospital.address}, {hospital.city}
            </p>
          </div>
          {hospital.distance !== undefined && (
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-blue-400">{hospital.distance.toFixed(1)}</p>
              <p className="text-xs text-slate-400">mi</p>
            </div>
          )}
        </div>
      </div>

      {/* Capability pills */}
      {pills.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5">
          {pills.map((p) => (
            <span key={p.key} className="bg-slate-700 px-2 py-0.5 rounded text-xs text-slate-300">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3 pt-1 flex gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => logEvent('hospital_directions', { hospital: hospital.shortName })}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 rounded-lg px-3 py-2.5 text-sm font-semibold active:bg-blue-700 transition-colors"
        >
          Directions
        </a>
        <a
          href={`tel:${hospital.phone}`}
          onClick={() => logEvent('hospital_call', { hospital: hospital.shortName })}
          className="flex items-center justify-center gap-1 bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold active:bg-slate-600 transition-colors"
        >
          Call ER
        </a>
      </div>
    </div>
  );
}
