'use client';

import { useState, useCallback } from 'react';
import { track } from '@vercel/analytics';
import {
  SAFE_ZONES,
  ZONE_TYPE_ICONS,
  ZONE_TYPE_COLORS,
  ZONE_TYPE_LABELS,
  findNearestZones,
  type SafeZone,
} from './data/safe-zones';

type Screen = 'home' | 'find_safe_zone' | 'need_help';

export default function CEGDashboard() {
  const [screen, setScreen] = useState<Screen>('home');
  const [zones, setZones] = useState<Array<SafeZone & { distance?: number }>>(SAFE_ZONES);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');
  const [filterPets, setFilterPets] = useState(false);
  const [filterAda, setFilterAda] = useState(false);

  const handleFindNearest = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const sorted = findNearestZones(pos.coords.latitude, pos.coords.longitude);
        setZones(sorted);
        setGpsStatus('done');
        track('gps_sort', { page: 'safe_zones' });
      },
      () => {
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const filteredZones = zones.filter((z) => {
    if (filterPets && !z.petFriendly) return false;
    if (filterAda && !z.adaAccessible) return false;
    return true;
  });

  // ── HOME SCREEN ──
  if (screen === 'home') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        {/* Header */}
        <header className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-lg font-bold">
              C
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Community Emergency Guide</h1>
              <p className="text-sm text-slate-400">Topanga &middot; Malibu &middot; Calabasas</p>
            </div>
          </div>
        </header>

        {/* 911 Banner */}
        <a
          href="tel:911"
          className="mx-4 mb-6 flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors"
        >
          <span className="text-2xl">📞</span>
          <div>
            <p className="font-bold text-base">Life-threatening emergency?</p>
            <p className="text-sm text-red-200">Tap to call 911</p>
          </div>
        </a>

        {/* Primary Actions */}
        <div className="px-4 space-y-3 mb-8">
          <button
            onClick={() => { track('nav_click', { target: 'find_safe_zone' }); setScreen('find_safe_zone'); }}
            className="w-full flex items-center gap-4 bg-slate-800 rounded-xl px-5 py-4 active:bg-slate-700 transition-colors border border-slate-700 text-left"
          >
            <span className="text-3xl">📍</span>
            <div>
              <p className="font-bold text-lg">Find Safe Zone</p>
              <p className="text-sm text-slate-400">Nearest evacuation assembly points</p>
            </div>
          </button>

          <a
            href="/checkin"
            className="w-full flex items-center gap-4 bg-emerald-700 rounded-xl px-5 py-4 active:bg-emerald-800 transition-colors border border-emerald-600 text-left block"
          >
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-bold text-lg">Check In Safe</p>
              <p className="text-sm text-emerald-200">Let people know you&apos;re OK</p>
            </div>
          </a>

          <button
            onClick={() => { track('nav_click', { target: 'need_help' }); setScreen('need_help'); }}
            className="w-full flex items-center gap-4 bg-amber-700 rounded-xl px-5 py-4 active:bg-amber-800 transition-colors border border-amber-600 text-left"
          >
            <span className="text-3xl">🆘</span>
            <div>
              <p className="font-bold text-lg">I Need Help</p>
              <p className="text-sm text-amber-200">EMS, stuck, or sheltering in place</p>
            </div>
          </button>

          <a
            href="/hospitals"
            className="w-full flex items-center gap-4 bg-red-800 rounded-xl px-5 py-4 active:bg-red-900 transition-colors border border-red-700 text-left block"
          >
            <span className="text-3xl">🏥</span>
            <div>
              <p className="font-bold text-lg">Nearby Emergency Rooms</p>
              <p className="text-sm text-red-200">Trauma centers &amp; ERs sorted by distance</p>
            </div>
          </a>

          <a
            href="/reunify"
            className="w-full flex items-center gap-4 bg-purple-700 rounded-xl px-5 py-4 active:bg-purple-800 transition-colors border border-purple-600 text-left block"
          >
            <span className="text-3xl">👨‍👩‍👧‍👦</span>
            <div>
              <p className="font-bold text-lg">Find My Family</p>
              <p className="text-sm text-purple-200">Search for a loved one&apos;s status</p>
            </div>
          </a>
        </div>

        {/* Life-Saving Skills */}
        <div className="px-4 mb-6">
          <a
            href="/skills"
            className="flex items-center gap-4 bg-slate-800 rounded-xl px-5 py-4 border border-slate-700 active:bg-slate-700 transition-colors"
          >
            <span className="text-3xl">🩺</span>
            <div>
              <p className="font-bold text-base">Life-Saving Skills</p>
              <p className="text-sm text-slate-400">CPR, bleeding, AED, fire, evacuation</p>
            </div>
          </a>
        </div>

        {/* Resource Links */}
        <div className="px-4 mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Live Resources
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <ResourceLink href="https://www.watchduty.org/" label="Watch Duty" sub="Live fire map" />
            <ResourceLink href="https://alert.la/" label="Alert LA" sub="County alerts" />
            <ResourceLink href="https://www.genasys.com/protective-communications/zonehaven" label="Genasys" sub="Evac zones" />
            <ResourceLink href="https://quickmap.dot.ca.gov/" label="QuickMap" sub="Road closures" />
            <ResourceLink
              href="https://www.redcross.org/get-help/disaster-relief-and-recovery-services/find-an-open-shelter.html"
              label="Red Cross"
              sub="Open shelters"
            />
            <ResourceLink href="https://lacounty.gov/emergency/" label="LA County" sub="Emergency info" />
          </div>
        </div>

        {/* Footer */}
        <footer className="px-4 pb-8 text-center">
          <p className="text-xs text-slate-500">
            CEG &middot; Community Emergency Guide &middot;{' '}
            <a href="https://sfg.ac" className="underline">
              sfg.ac
            </a>
          </p>
        </footer>
      </main>
    );
  }

  // ── FIND SAFE ZONE SCREEN ──
  if (screen === 'find_safe_zone') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        {/* Top bar */}
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => setScreen('home')}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold flex-1">Find Safe Zone</h1>
          <a
            href="https://www.google.com/maps/search/evacuation+shelter+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-400 underline"
          >
            Open in Maps
          </a>
        </header>

        {/* GPS + Filters */}
        <div className="px-4 py-3 space-y-3 border-b border-slate-800">
          <button
            onClick={handleFindNearest}
            disabled={gpsStatus === 'loading'}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 rounded-xl px-4 py-3 font-semibold active:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {gpsStatus === 'loading' ? (
              <>
                <span className="animate-spin">⏳</span> Locating...
              </>
            ) : gpsStatus === 'done' ? (
              <>📍 Sorted by distance</>
            ) : gpsStatus === 'denied' ? (
              <>⚠️ Location unavailable — tap to retry</>
            ) : (
              <>📍 Find Nearest to Me</>
            )}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => { track('filter_toggle', { filter: 'pets', on: !filterPets }); setFilterPets(!filterPets); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                filterPets
                  ? 'bg-amber-700 border-amber-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              🐾 Pet-Friendly
            </button>
            <button
              onClick={() => { track('filter_toggle', { filter: 'ada', on: !filterAda }); setFilterAda(!filterAda); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                filterAda
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              ♿ ADA Accessible
            </button>
          </div>
        </div>

        {/* Zone count */}
        <div className="px-4 py-2">
          <p className="text-sm text-slate-400">
            {filteredZones.length} zone{filteredZones.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Zone List */}
        <div className="px-4 pb-8 space-y-3">
          {filteredZones.map((zone) => (
            <ZoneCard key={zone.id} zone={zone} />
          ))}
        </div>
      </main>
    );
  }

  // ── NEED HELP SCREEN ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Top bar */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <button
          onClick={() => setScreen('home')}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">I Need Help</h1>
      </header>

      {/* 911 Banner */}
      <a
        href="tel:911"
        className="mx-4 mt-4 mb-2 flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors"
      >
        <span className="text-2xl">📞</span>
        <div>
          <p className="font-bold text-base">Life-threatening emergency?</p>
          <p className="text-sm text-red-200">Tap to call 911 now</p>
        </div>
      </a>

      <div className="px-4 py-4 space-y-3">
        {/* Medical / Triage */}
        <a
          href="/help"
          className="flex items-center gap-4 bg-red-900/60 rounded-xl px-5 py-4 border border-red-700 active:bg-red-900 transition-colors"
        >
          <span className="text-3xl">🚑</span>
          <div>
            <p className="font-bold text-lg">Medical / Triage</p>
            <p className="text-sm text-red-200">
              Describe what&apos;s happening — the system will route you
            </p>
          </div>
        </a>

        {/* Stuck / Can't Evacuate */}
        <a
          href="/stuck"
          className="flex items-center gap-4 bg-amber-900/60 rounded-xl px-5 py-4 border border-amber-700 active:bg-amber-900 transition-colors"
        >
          <span className="text-3xl">🚗</span>
          <div>
            <p className="font-bold text-lg">Stuck / Can&apos;t Evacuate</p>
            <p className="text-sm text-amber-200">
              Report your location so responders can find you
            </p>
          </div>
        </a>

        {/* Sheltering in Place */}
        <a
          href="/shelter"
          className="flex items-center gap-4 bg-slate-800 rounded-xl px-5 py-4 border border-slate-600 active:bg-slate-700 transition-colors"
        >
          <span className="text-3xl">🏠</span>
          <div>
            <p className="font-bold text-lg">Sheltering in Place</p>
            <p className="text-sm text-slate-300">
              Share your location with responders
            </p>
          </div>
        </a>
      </div>

      {/* Shelter-in-Place Tips */}
      <div className="px-4 py-4">
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
      </div>
    </main>
  );
}

// ── COMPONENTS ──

function ResourceLink({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('resource_click', { resource: label })}
      className="bg-slate-800 rounded-lg px-3 py-3 border border-slate-700 active:bg-slate-700 transition-colors block"
    >
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </a>
  );
}

function ZoneCard({ zone }: { zone: SafeZone & { distance?: number } }) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${zone.lat},${zone.lon}`;
  const typeIcon = ZONE_TYPE_ICONS[zone.type];
  const typeColor = ZONE_TYPE_COLORS[zone.type];
  const typeLabel = ZONE_TYPE_LABELS[zone.type];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white ${typeColor}`}>
                {typeIcon} {typeLabel}
              </span>
              {zone.topangaGuideDesignation && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-600 text-white">
                  {zone.topangaGuideDesignation === 'PSR' ? 'PSR' : 'Primary Shelter'}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base leading-tight">{zone.name}</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {zone.address}, {zone.city}
            </p>
          </div>
          {zone.distance !== undefined && (
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-blue-400">{zone.distance.toFixed(1)}</p>
              <p className="text-xs text-slate-400">mi</p>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="px-4 pb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span>👥 {zone.capacity.toLocaleString()}</span>
        {zone.petFriendly && <span>🐾 Pets OK</span>}
        {zone.adaAccessible && <span>♿ ADA</span>}
        {zone.amenities.slice(0, 4).map((a) => (
          <span key={a} className="bg-slate-700 px-1.5 py-0.5 rounded">
            {a}
          </span>
        ))}
        {zone.amenities.length > 4 && (
          <span className="text-slate-500">+{zone.amenities.length - 4}</span>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 pt-1 flex gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('zone_directions', { zone: zone.name })}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 rounded-lg px-3 py-2.5 text-sm font-semibold active:bg-blue-700 transition-colors"
        >
          Directions
        </a>
        {zone.phone && (
          <a
            href={`tel:${zone.phone}`}
            onClick={() => track('zone_call', { zone: zone.name })}
            className="flex items-center justify-center gap-1 bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold active:bg-slate-600 transition-colors"
          >
            Call
          </a>
        )}
      </div>
    </div>
  );
}
