'use client';

import { useState, useEffect, useCallback } from 'react';
import { logEvent } from '@/lib/analytics';
import {
  SAFE_ZONES,
  ZONE_TYPE_ICONS,
  ZONE_TYPE_COLORS,
  ZONE_TYPE_LABELS,
  findNearestZones,
  type SafeZone,
} from './data/safe-zones';

type Screen = 'home' | 'find_safe_zone' | 'need_help' | 'post_911';

export default function CEGDashboard() {
  const [screen, setScreen] = useState<Screen>('home');
  const [zones, setZones] = useState<Array<SafeZone & { distance?: number }>>(SAFE_ZONES);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');
  const [filterPets, setFilterPets] = useState(false);
  const [filterAda, setFilterAda] = useState(false);
  const [show911Prompt, setShow911Prompt] = useState(false);
  const [calling911, setCalling911] = useState(false);

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
        logEvent('gps_sort', { page: 'safe_zones' });
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
        <button
          onClick={() => { logEvent('911_prompt_open'); setShow911Prompt(true); }}
          className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors text-left"
        >
          <span className="text-2xl">📞</span>
          <div>
            <p className="font-bold text-base">Life-threatening emergency?</p>
            <p className="text-sm text-red-200">Tap to call 911</p>
          </div>
        </button>

        {/* Field Care Card */}
        <a
          href="/fcc"
          className="mx-4 mb-6 flex items-center gap-3 bg-blue-800 rounded-xl px-4 py-3 active:bg-blue-900 transition-colors border border-blue-700"
        >
          <span className="text-2xl">🏠</span>
          <div>
            <p className="font-bold text-base">Field Care Card</p>
            <p className="text-sm text-blue-200">Medical profiles for first responders</p>
          </div>
        </a>

        {/* 911 Confirmation Modal */}
        {show911Prompt && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-5">
            <div className="bg-gray-900 rounded-2xl border border-red-700 p-6 w-full max-w-xs text-center">
              <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-red-500/30">
                📞
              </div>
              <p className="text-xl font-extrabold">Call 911</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                This will open your phone&apos;s dialer to call 911.<br/>
                Your Field Care Card will be ready when you return.
              </p>
              <button
                onClick={() => {
                  setShow911Prompt(false);
                  setCalling911(true);
                  logEvent('911_call_initiated');
                  window.location.href = 'tel:911';
                  setTimeout(() => {
                    setCalling911(false);
                    setScreen('post_911');
                  }, 2500);
                }}
                className="w-full mt-5 bg-gradient-to-r from-red-600 to-red-800 rounded-xl px-4 py-4 text-lg font-extrabold tracking-wide shadow-lg shadow-red-500/40 active:from-red-700 active:to-red-900 transition-colors"
              >
                Call 911 Now
              </button>
              <button
                onClick={() => setShow911Prompt(false)}
                className="w-full mt-2.5 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 active:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Calling 911 Overlay */}
        {calling911 && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-4xl mb-4 animate-pulse">
              📞
            </div>
            <p className="text-2xl font-extrabold tracking-wider">Calling 911...</p>
            <p className="text-xs text-slate-400 mt-2">Your Field Care Card will load when you return</p>
          </div>
        )}

        {/* Primary Actions */}
        <div className="px-4 space-y-3 mb-8">
          <button
            onClick={() => { logEvent('nav_click', { target: 'find_safe_zone' }); setScreen('find_safe_zone'); }}
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
            onClick={() => { logEvent('nav_click', { target: 'need_help' }); setScreen('need_help'); }}
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

        {/* Household Pre-Plan */}
        <div className="px-4 mb-6">
          <a
            href="/household"
            className="flex items-center gap-4 bg-slate-800 rounded-xl px-5 py-4 border border-slate-700 active:bg-slate-700 transition-colors"
          >
            <span className="text-3xl">🏠</span>
            <div>
              <p className="font-bold text-base">Household Pre-Plan</p>
              <p className="text-sm text-slate-400">Members, pets, go-bag checklist</p>
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

  // ── POST-911 FCC SCREEN ──
  if (screen === 'post_911') {
    return <Post911Screen onReturn={() => setScreen('home')} />;
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
              onClick={() => { logEvent('filter_toggle', { filter: 'pets', on: !filterPets }); setFilterPets(!filterPets); }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                filterPets
                  ? 'bg-amber-700 border-amber-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              🐾 Pet-Friendly
            </button>
            <button
              onClick={() => { logEvent('filter_toggle', { filter: 'ada', on: !filterAda }); setFilterAda(!filterAda); }}
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
      onClick={() => logEvent('resource_click', { resource: label })}
      className="bg-slate-800 rounded-lg px-3 py-3 border border-slate-700 active:bg-slate-700 transition-colors block"
    >
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </a>
  );
}

function Post911Screen({ onReturn }: { onReturn: () => void }) {
  const [notifiedContacts, setNotifiedContacts] = useState(false);
  const [checklist, setChecklist] = useState({ door: false, meds: false, directive: false });
  const [household, setHousehold] = useState<{
    access_code?: string; hazards?: string; best_door?: string; animals?: string;
    fcc_members?: { directive_location?: string | null }[];
    fcc_emergency_contacts?: { id: string; name: string; relation: string; phone: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fcc/household');
        const data = await res.json();
        setHousehold(data.household || null);
      } catch {
        // not logged in or no household
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const accessCode = household?.access_code || '';
  const hazards = household?.hazards;
  const contacts = household?.fcc_emergency_contacts || [];
  const directive = household?.fcc_members?.[0]?.directive_location;

  const checklistItems: Array<{ key: keyof typeof checklist; label: string; detail: string }> = [
    { key: 'door', label: 'Unlock the front door', detail: household?.best_door || 'Make entry clear for EMS' },
    { key: 'meds', label: 'Gather current medications', detail: 'Bring med bottles to the door if possible' },
    { key: 'directive', label: 'Locate advance directive', detail: directive || 'If applicable' },
  ];

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Red priority header */}
      <div className="bg-gradient-to-r from-red-700 to-red-800 px-4 py-3.5 text-center">
        <p className="text-xs font-bold tracking-widest text-red-200/70 uppercase font-mono">911 Called — Help is on the way</p>
        <p className="font-extrabold text-sm mt-1">
          {household ? 'Your Field Care Card is Active' : 'Follow these steps while you wait'}
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ACCESS CODE */}
        {loading ? (
          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl border-2 border-green-600 p-5 text-center">
            <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : accessCode ? (
          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl border-2 border-green-600 p-5 text-center shadow-lg shadow-green-900/20">
            <p className="text-xs font-bold tracking-widest text-green-300 uppercase font-mono">Read This Code to Dispatch</p>
            <p className="text-5xl font-extrabold tracking-[0.35em] font-mono mt-2">{accessCode.split('').join(' ')}</p>
            <p className="text-xs text-green-300 mt-2 leading-relaxed">
              &quot;My SFG code is {accessCode.split('').join('-')}&quot;<br/>
              <span className="text-green-400/60">This gives EMS access to your care profiles</span>
            </p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 text-center">
            <p className="text-xs text-slate-400">Set up a Field Care Card to give EMS instant access to your medical info.</p>
            <a href="/fcc" className="inline-block mt-3 text-xs text-blue-400 font-semibold">Create Field Care Card →</a>
          </div>
        )}

        {/* Hazard reminder */}
        {hazards && (
          <div className="bg-gradient-to-r from-red-950 to-red-900 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-xs font-bold text-red-300 uppercase tracking-wider font-mono">Remind Dispatch</p>
              <p className="font-bold text-sm">{hazards}</p>
            </div>
          </div>
        )}

        {/* While You Wait checklist */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono mb-3">While You Wait</h3>
          {checklistItems.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleCheck(item.key)}
              className="flex items-start gap-3 w-full py-2.5 border-b border-slate-700 last:border-0 text-left"
            >
              <div className={`w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center text-xs font-bold transition-colors ${
                checklist[item.key]
                  ? 'bg-green-500 border-2 border-green-500'
                  : 'border-2 border-slate-600'
              }`}>
                {checklist[item.key] && '✓'}
              </div>
              <div>
                <p className={`text-sm font-semibold transition-colors ${checklist[item.key] ? 'text-green-400' : ''}`}>{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Emergency contacts */}
        {contacts.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h3 className="text-xs font-bold tracking-widest text-blue-400 uppercase font-mono mb-3">Emergency Contacts</h3>
            {contacts.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between py-2 ${i < contacts.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.relation} · {c.phone}</p>
                </div>
                <a
                  href={`tel:${c.phone.replace(/\D/g, '')}`}
                  className="bg-gray-900 border border-slate-600 rounded-md px-3 py-1.5 text-xs font-semibold text-blue-400 active:bg-slate-700"
                >
                  Call
                </a>
              </div>
            ))}
            {!notifiedContacts ? (
              <button
                onClick={() => { setNotifiedContacts(true); logEvent('911_notify_contacts'); }}
                className="w-full mt-3 bg-blue-600 rounded-lg px-4 py-2.5 text-xs font-bold active:bg-blue-700 transition-colors"
              >
                Notify All Contacts
              </button>
            ) : (
              <div className="w-full mt-3 bg-green-900 border border-green-700 rounded-lg px-4 py-2.5 text-xs font-bold text-green-400 text-center">
                ✓ Contacts Notified
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {household && (
          <a
            href="/fcc"
            className="block w-full bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl px-5 py-3.5 border border-blue-600 active:from-blue-800 active:to-blue-700 transition-colors text-center font-bold text-sm tracking-wide"
          >
            View Full Care Profiles →
          </a>
        )}

        <button
          onClick={onReturn}
          className="w-full border border-slate-700 rounded-xl px-4 py-3 text-xs font-semibold text-slate-400 active:bg-slate-800 transition-colors"
        >
          Return to CEG Home
        </button>
      </div>
    </main>
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
          onClick={() => logEvent('zone_directions', { zone: zone.name })}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 rounded-lg px-3 py-2.5 text-sm font-semibold active:bg-blue-700 transition-colors"
        >
          Directions
        </a>
        {zone.phone && (
          <a
            href={`tel:${zone.phone}`}
            onClick={() => logEvent('zone_call', { zone: zone.name })}
            className="flex items-center justify-center gap-1 bg-slate-700 rounded-lg px-4 py-2.5 text-sm font-semibold active:bg-slate-600 transition-colors"
          >
            Call
          </a>
        )}
      </div>
    </div>
  );
}
