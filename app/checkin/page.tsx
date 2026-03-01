'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { findNearestZones, ZONE_TYPE_ICONS, type SafeZone } from '../data/safe-zones';
import { saveToOutbox } from '@/lib/offline-store';
import { trySyncNow } from '@/lib/outbox-sync';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type StatusKey =
  | 'SAFE'
  | 'EVACUATING'
  | 'AT_MUSTER'
  | 'SHELTERING_HERE'
  | 'NEED_HELP'
  | 'NEED_MEDICAL'
  | 'LOOKING_FOR_SOMEONE';

type Step = 'status' | 'details' | 'submitting' | 'done' | 'error';

interface StatusConfig {
  label: string;
  sub: string;
  icon: string;
  bg: string;
  border: string;
  requiresContact: boolean;
}

const STATUS_OPTIONS: Record<StatusKey, StatusConfig> = {
  SAFE: {
    label: "WE'RE SAFE",
    sub: 'Accounted for, no assistance needed',
    icon: '✓',
    bg: 'bg-green-600 active:bg-green-700',
    border: 'border-green-500',
    requiresContact: false,
  },
  EVACUATING: {
    label: 'EVACUATING',
    sub: 'Leaving now, on the road',
    icon: '→',
    bg: 'bg-orange-600 active:bg-orange-700',
    border: 'border-orange-500',
    requiresContact: false,
  },
  AT_MUSTER: {
    label: 'AT MUSTER POINT',
    sub: 'Arrived at an assembly point',
    icon: '◉',
    bg: 'bg-violet-600 active:bg-violet-700',
    border: 'border-violet-500',
    requiresContact: false,
  },
  SHELTERING_HERE: {
    label: 'SHELTER IN PLACE',
    sub: 'Staying at current location',
    icon: '⌂',
    bg: 'bg-blue-600 active:bg-blue-700',
    border: 'border-blue-500',
    requiresContact: false,
  },
  NEED_HELP: {
    label: 'NEED HELP',
    sub: "Can't evacuate alone",
    icon: '🆘',
    bg: 'bg-red-600 active:bg-red-700',
    border: 'border-red-500',
    requiresContact: true,
  },
  NEED_MEDICAL: {
    label: 'NEED MEDICAL',
    sub: 'Medical emergency',
    icon: '🏥',
    bg: 'bg-red-800 active:bg-red-900',
    border: 'border-red-600',
    requiresContact: true,
  },
  LOOKING_FOR_SOMEONE: {
    label: 'LOOKING FOR SOMEONE',
    sub: 'Searching for family member',
    icon: '?',
    bg: 'bg-purple-700 active:bg-purple-800',
    border: 'border-purple-500',
    requiresContact: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PAGE WRAPPER (Suspense boundary for useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════

export default function CheckInPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckInFlow />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-lg text-slate-400">Loading check-in...</p>
      </div>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FLOW
// ═══════════════════════════════════════════════════════════════════════════

function CheckInFlow() {
  const searchParams = useSearchParams();
  const incidentId = searchParams.get('incident') ?? '';
  const assemblyPoint = searchParams.get('ap') ?? '';
  const presetStatus = searchParams.get('status') as StatusKey | null;

  // Form state
  const [step, setStep] = useState<Step>('status');
  const [status, setStatus] = useState<StatusKey | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [petCount, setPetCount] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [emsNotes, setEmsNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [needsTransport, setNeedsTransport] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // GPS state
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');

  // Capture GPS on mount
  useEffect(() => {
    if (navigator.geolocation) {
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setGpsStatus('done');
        },
        () => setGpsStatus('denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Handle preset status from URL (e.g., from "I Need Help" page)
  useEffect(() => {
    if (presetStatus && presetStatus in STATUS_OPTIONS) {
      setStatus(presetStatus);
      setStep('details');
    }
  }, [presetStatus]);

  const handleRetryGps = useCallback(() => {
    if (!navigator.geolocation) return;
    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsStatus('done');
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Validate incident
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const hasValidIncident = incidentId && uuidRegex.test(incidentId);

  // Submit — offline-first: save locally, then sync in background
  async function handleSubmit() {
    if (!status) return;

    // For help statuses, require at least a name or phone
    const cfg = STATUS_OPTIONS[status];
    if (cfg.requiresContact && !contactName.trim() && !phone.trim()) return;

    // For non-help statuses, require full_name
    const nameToSubmit = cfg.requiresContact ? (contactName.trim() || 'Anonymous') : fullName.trim();
    if (!cfg.requiresContact && !nameToSubmit) return;

    setStep('submitting');

    try {
      const body: Record<string, unknown> = {
        incident_id: hasValidIncident ? incidentId : '00000000-0000-0000-0000-000000000000',
        full_name: nameToSubmit,
        status,
        assembly_point: assemblyPoint || undefined,
        party_size: partySize,
        pet_count: petCount,
        needs_transport: needsTransport,
        contact_name: contactName.trim() || undefined,
      };

      if (phone.trim()) body.phone = phone.trim();
      if (emsNotes.trim()) body.ems_notes = emsNotes.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (gps) {
        body.lat = gps.lat;
        body.lon = gps.lon;
      }

      // Offline-first: save to local outbox, then try background sync
      await saveToOutbox('checkin', body);
      trySyncNow();

      // Show success immediately — server sync happens in the background
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  }

  // Reset form for "check in another"
  function resetForm() {
    setStep('status');
    setStatus(null);
    setPartySize(1);
    setPetCount(0);
    setFullName('');
    setPhone('');
    setContactName('');
    setEmsNotes('');
    setNotes('');
    setNeedsTransport(false);
    setErrorMsg('');
  }

  // ─── STEP 1: Status Selection ───
  if (step === 'status') {
    return (
      <Shell>
        <Header subtitle={assemblyPoint ? `Assembly Point: ${assemblyPoint}` : undefined} />

        {/* Party size + pets (before status — BRASS pattern) */}
        <div className="px-4 pb-4 space-y-4">
          {/* Party size */}
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              How many people?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n === 5 && partySize >= 5 ? partySize : n)}
                  className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${
                    partySize === n || (n === 5 && partySize >= 5)
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
            </div>
            {partySize >= 5 && (
              <input
                type="number"
                value={partySize}
                onChange={(e) => setPartySize(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-full mt-2 px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-lg text-white text-center text-lg"
                min={1}
                max={50}
              />
            )}
          </div>

          {/* Pet count */}
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              Any pets?
            </label>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setPetCount(n)}
                  className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${
                    petCount === n
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {n === 0 ? 'No' : n === 3 ? '3+' : n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Primary: WE'RE SAFE */}
        <div className="px-4 mb-3">
          <button
            onClick={() => { setStatus('SAFE'); setStep('details'); }}
            className="w-full py-5 rounded-xl text-white text-center bg-green-600 active:bg-green-700 transition-colors shadow-lg"
          >
            <span className="text-2xl font-bold flex items-center justify-center gap-3">
              ✓ WE&apos;RE SAFE
            </span>
          </button>
        </div>

        {/* Secondary statuses */}
        <div className="px-4">
          <p className="text-sm text-slate-500 text-center mb-3">or select your situation:</p>
          <div className="space-y-2">
            {(['EVACUATING', 'AT_MUSTER', 'SHELTERING_HERE'] as StatusKey[]).map((key) => {
              const cfg = STATUS_OPTIONS[key];
              return (
                <button
                  key={key}
                  onClick={() => { setStatus(key); setStep('details'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white text-left border-2 transition-colors ${cfg.bg} ${cfg.border}`}
                >
                  <span className="text-xl w-8 text-center">{cfg.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-80">{cfg.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Help statuses */}
        <div className="px-4 mt-4">
          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm text-slate-500 text-center mb-3">Need something?</p>
            <div className="space-y-2">
              {(['NEED_HELP', 'NEED_MEDICAL', 'LOOKING_FOR_SOMEONE'] as StatusKey[]).map((key) => {
                const cfg = STATUS_OPTIONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => { setStatus(key); setStep('details'); }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white text-left border-2 transition-colors ${cfg.bg} ${cfg.border}`}
                  >
                    <span className="text-xl w-8 text-center">{cfg.icon}</span>
                    <div>
                      <p className="font-bold text-sm">{cfg.label}</p>
                      <p className="text-xs opacity-80">{cfg.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 911 banner */}
        <div className="px-4 py-4">
          <a
            href="tel:911"
            className="flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors"
          >
            <span className="text-xl">📞</span>
            <div>
              <p className="font-bold text-sm">Life-threatening emergency?</p>
              <p className="text-xs text-red-200">Tap to call 911</p>
            </div>
          </a>
        </div>
      </Shell>
    );
  }

  // ─── STEP 2: Details ───
  if (step === 'details') {
    const cfg = STATUS_OPTIONS[status!];
    const isHelpStatus = cfg.requiresContact;

    return (
      <Shell>
        <Header subtitle={assemblyPoint ? `Assembly Point: ${assemblyPoint}` : undefined} />

        <div className="px-4">
          {/* Back button + Status badge */}
          <button
            onClick={() => setStep('status')}
            className="text-slate-400 text-sm mb-3 flex items-center gap-1"
          >
            ← Change status
          </button>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white mb-6 ${cfg.bg.split(' ')[0]}`}>
            {cfg.icon} {cfg.label}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            className="space-y-5"
          >
            {/* Name */}
            <FormField label={isHelpStatus ? 'Your name' : 'Full Name *'}>
              {isHelpStatus ? (
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="First and last name"
                  className="form-input"
                />
              ) : (
                <input
                  type="text"
                  required
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="First and last name"
                  className="form-input"
                />
              )}
            </FormField>

            {/* Phone */}
            <FormField label="Phone number" hint="For family reunification lookup">
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(818) 555-1234"
                className="form-input"
              />
            </FormField>

            {/* Summary: party + pets */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Party</span>
                <span className="font-bold">
                  {partySize} {partySize === 1 ? 'person' : 'people'}
                  {petCount > 0 && ` + ${petCount} ${petCount === 1 ? 'pet' : 'pets'}`}
                </span>
              </div>
            </div>

            {/* GPS Location */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-300">Location</p>
                  {gpsStatus === 'done' && gps ? (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {gps.lat.toFixed(4)}, {gps.lon.toFixed(4)}
                    </p>
                  ) : gpsStatus === 'loading' ? (
                    <p className="text-xs text-slate-500 mt-0.5">Acquiring GPS...</p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-0.5">Not available</p>
                  )}
                </div>
                {gpsStatus !== 'done' && (
                  <button
                    type="button"
                    onClick={handleRetryGps}
                    className="text-xs text-blue-400 underline"
                  >
                    {gpsStatus === 'loading' ? 'Locating...' : 'Try GPS'}
                  </button>
                )}
                {gpsStatus === 'done' && (
                  <span className="text-green-400 text-sm">📍</span>
                )}
              </div>
            </div>

            {/* EMS/Help-specific fields */}
            {(isHelpStatus || status === 'SHELTERING_HERE') && (
              <>
                {/* Transport needs */}
                <FormField label="Need transport assistance?">
                  <div className="flex gap-3">
                    <ToggleBtn active={needsTransport} onClick={() => setNeedsTransport(true)} label="Yes" />
                    <ToggleBtn active={!needsTransport} onClick={() => setNeedsTransport(false)} label="No" />
                  </div>
                </FormField>

                {/* Situation description */}
                <FormField label="Describe your situation" hint="Injury, mobility, medications, who you're looking for">
                  <textarea
                    value={emsNotes}
                    onChange={(e) => setEmsNotes(e.target.value)}
                    placeholder={
                      status === 'LOOKING_FOR_SOMEONE'
                        ? 'Name and description of person you are looking for'
                        : status === 'NEED_MEDICAL'
                        ? 'Injury type, mobility, current medications'
                        : 'What kind of help do you need?'
                    }
                    rows={3}
                    className="form-input"
                  />
                </FormField>
              </>
            )}

            {/* Additional notes */}
            <FormField label="Additional notes" hint="Optional">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else responders should know"
                rows={2}
                className="form-input"
              />
            </FormField>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isHelpStatus ? !fullName.trim() : (!contactName.trim() && !phone.trim())}
              className={`w-full py-4 rounded-xl text-lg font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cfg.bg}`}
            >
              Submit Check-In
            </button>
          </form>
        </div>

        <div className="h-8" />
      </Shell>
    );
  }

  // ─── SUBMITTING ───
  if (step === 'submitting') {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-lg text-slate-400">Submitting check-in...</p>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── DONE ───
  if (step === 'done') {
    const cfg = STATUS_OPTIONS[status!];
    const nearestZones = gps ? findNearestZones(gps.lat, gps.lon).slice(0, 2) : [];

    return (
      <Shell>
        <div className="px-4 py-8 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${cfg.bg.split(' ')[0]}`}>
            <span className="text-4xl">{cfg.icon}</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Checked In</h2>

          <p className="text-slate-400 mb-1">
            {partySize} {partySize === 1 ? 'person' : 'people'}
            {petCount > 0 && ` + ${petCount} ${petCount === 1 ? 'pet' : 'pets'}`}
          </p>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white mb-6 ${cfg.bg.split(' ')[0]}`}>
            {cfg.label}
          </div>

          {assemblyPoint && (
            <p className="text-sm text-slate-500 mb-6">Assembly Point: {assemblyPoint}</p>
          )}

          {/* Nearest safe zones */}
          {nearestZones.length > 0 && (
            <NearestZonesCard zones={nearestZones} />
          )}

          <p className="text-sm text-slate-500 mb-6">
            Incident Command has been notified. Follow instructions from emergency personnel.
          </p>

          <div className="space-y-3">
            <button
              onClick={resetForm}
              className="w-full py-3.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-semibold active:bg-slate-700 transition-colors"
            >
              Check In Another Person
            </button>
            <a
              href="/"
              className="block w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-center active:bg-blue-700 transition-colors"
            >
              Back to CEG Home
            </a>
          </div>

          <div className="mt-6 bg-slate-800 rounded-lg p-3 text-sm text-slate-400">
            <strong>For emergencies, call 911</strong>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── ERROR ───
  return (
    <Shell>
      <div className="px-4 py-8 text-center">
        <div className="w-24 h-24 rounded-full bg-red-900/50 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✗</span>
        </div>
        <h2 className="text-2xl font-bold mb-2">Check-In Failed</h2>
        <p className="text-red-400 mb-6">{errorMsg}</p>
        <button
          onClick={() => setStep('details')}
          className="px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold active:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {children}
    </main>
  );
}

function Header({ subtitle }: { subtitle?: string }) {
  return (
    <header className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-800 mb-4">
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <div>
          <h1 className="text-lg font-bold">Check In</h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <span className="text-xs text-slate-500 font-mono">CEG.SFG.AC</span>
    </header>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-300 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-6 py-2.5 rounded-lg font-semibold transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-slate-800 text-slate-400 border border-slate-700 active:bg-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function NearestZonesCard({ zones }: { zones: Array<SafeZone & { distance: number }> }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6 text-left">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Nearest Safe Zones
      </p>
      {zones.map((zone) => (
        <div key={zone.id} className="flex items-start gap-3 py-2 border-t border-slate-700 first:border-0 first:pt-0">
          <span className="text-xl">{ZONE_TYPE_ICONS[zone.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{zone.name}</p>
            <p className="text-xs text-slate-400">{zone.address}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span>{zone.distance.toFixed(1)} mi</span>
              <span>Cap: {zone.capacity}</span>
              {zone.petFriendly && <span>🐾</span>}
              {zone.adaAccessible && <span>♿</span>}
            </div>
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${zone.lat},${zone.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 underline shrink-0 pt-1"
          >
            Directions
          </a>
        </div>
      ))}
    </div>
  );
}
