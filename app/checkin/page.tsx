'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import { findNearestZones, ZONE_TYPE_ICONS, type SafeZone } from '../data/safe-zones';
import { saveToOutbox } from '@/lib/offline-store';
import { trySyncNow } from '@/lib/outbox-sync';
import { NEED_CATEGORIES } from '@/lib/constants';
import type { NeedCategoryCode, Priority } from '@/lib/constants';

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

type Step = 'status' | 'needs' | 'details' | 'submitting' | 'done' | 'error';

// Statuses that require the needs assessment step
const NEEDS_STATUSES: StatusKey[] = ['NEED_HELP', 'NEED_MEDICAL', 'SHELTERING_HERE', 'LOOKING_FOR_SOMEONE'];

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
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [petCount, setPetCount] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [emsNotes, setEmsNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [needsTransport, setNeedsTransport] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Needs assessment state
  const [priority, setPriority] = useState<Priority | null>(null);
  const [needsCategories, setNeedsCategories] = useState<NeedCategoryCode[]>([]);
  const [checkinToken, setCheckinToken] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  // PASS claim state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmail, setClaimEmail] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ success: boolean; display_name?: string; error?: string } | null>(null);

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
      setStep(NEEDS_STATUSES.includes(presetStatus) ? 'needs' : 'details');
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
      const partySize = Math.max(1, adultCount + childCount);
      const clientToken = crypto.randomUUID().slice(0, 12);
      const body: Record<string, unknown> = {
        incident_id: hasValidIncident ? incidentId : '00000000-0000-0000-0000-000000000000',
        full_name: nameToSubmit,
        status,
        assembly_point: assemblyPoint || undefined,
        party_size: partySize,
        adult_count: adultCount,
        child_count: childCount,
        pet_count: petCount,
        needs_transport: needsTransport,
        contact_name: contactName.trim() || undefined,
        priority,
        needs_categories: needsCategories,
        checkin_token: clientToken,
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
      setCheckinToken(clientToken);
      logEvent('checkin_submitted', { status, party_size: partySize });
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  }

  // Update needs — uses PATCH endpoint with checkin_token
  async function handleUpdateNeeds() {
    if (!checkinToken) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/public/checkin/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkin_token: checkinToken,
          priority,
          needs_categories: needsCategories,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Update failed');
      }
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed');
      setStep('error');
    } finally {
      setIsUpdating(false);
    }
  }

  // Claim check-in with PASS account
  async function handleClaimWithPass() {
    if (!checkinToken || !claimEmail.trim()) return;
    setClaiming(true);
    setClaimResult(null);
    try {
      const res = await fetch('/api/public/checkin/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkin_token: checkinToken, email: claimEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setClaimResult({ success: true, display_name: data.display_name });
        setShowClaimModal(false);
      } else {
        setClaimResult({ success: false, error: data.error || 'Failed to link account' });
      }
    } catch {
      setClaimResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setClaiming(false);
    }
  }

  // Toggle a needs category
  function toggleNeed(code: NeedCategoryCode) {
    setNeedsCategories(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : prev.length < 10
          ? [...prev, code]
          : prev
    );
  }

  // Reset form for "check in another"
  function resetForm() {
    setStep('status');
    setStatus(null);
    setAdultCount(1);
    setChildCount(0);
    setPetCount(0);
    setFullName('');
    setPhone('');
    setContactName('');
    setEmsNotes('');
    setNotes('');
    setNeedsTransport(false);
    setErrorMsg('');
    setPriority(null);
    setNeedsCategories([]);
    setCheckinToken(null);
    setShowClaimModal(false);
    setClaimEmail('');
    setClaiming(false);
    setClaimResult(null);
  }

  // ─── STEP 1: Status Selection ───
  if (step === 'status') {
    return (
      <Shell>
        <Header subtitle={assemblyPoint ? `Assembly Point: ${assemblyPoint}` : undefined} />

        {/* Adult/child split + pets (before status) */}
        <div className="px-4 pb-4 space-y-4">
          {/* Adults */}
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              Adults
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setAdultCount(n === 5 && adultCount >= 5 ? adultCount : n)}
                  className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${
                    adultCount === n || (n === 5 && adultCount >= 5)
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
            </div>
            {adultCount >= 5 && (
              <input
                type="number"
                value={adultCount}
                onChange={(e) => setAdultCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="w-full mt-2 px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-lg text-white text-center text-lg"
                min={1}
                max={50}
              />
            )}
          </div>

          {/* Children */}
          <div>
            <label className="block text-sm font-semibold text-slate-400 mb-2">
              Children
            </label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setChildCount(n === 4 && childCount >= 4 ? childCount : n)}
                  className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${
                    childCount === n || (n === 4 && childCount >= 4)
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {n === 4 ? '4+' : n}
                </button>
              ))}
            </div>
            {childCount >= 4 && (
              <input
                type="number"
                value={childCount}
                onChange={(e) => setChildCount(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                className="w-full mt-2 px-4 py-3 bg-slate-800 border-2 border-slate-600 rounded-lg text-white text-center text-lg"
                min={0}
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
            onClick={() => { logEvent('checkin_status', { status: 'SAFE' }); setStatus('SAFE'); setStep('details'); }}
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
              const nextStep = NEEDS_STATUSES.includes(key) ? 'needs' : 'details';
              return (
                <button
                  key={key}
                  onClick={() => { logEvent('checkin_status', { status: key }); setStatus(key); setStep(nextStep); }}
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
                    onClick={() => { logEvent('checkin_status', { status: key }); setStatus(key); setStep('needs'); }}
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

  // ─── STEP 2: Needs Assessment ───
  if (step === 'needs') {
    const cfg = STATUS_OPTIONS[status!];
    return (
      <Shell>
        <Header subtitle={assemblyPoint ? `Assembly Point: ${assemblyPoint}` : undefined} />
        <div className="px-4">
          <button
            onClick={() => setStep('status')}
            className="text-slate-400 text-sm mb-3 flex items-center gap-1"
          >
            ← Change status
          </button>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white mb-4 ${cfg.bg.split(' ')[0]}`}>
            {cfg.icon} {cfg.label}
          </div>

          {/* Priority */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-300 mb-3">How urgent?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPriority('IMMEDIATE')}
                className={`py-4 rounded-xl text-center font-bold border-2 transition-colors ${
                  priority === 'IMMEDIATE'
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-lg block mb-1">I need help now</span>
                <span className="text-xs opacity-70">IMMEDIATE</span>
              </button>
              <button
                onClick={() => setPriority('CAN_WAIT')}
                className={`py-4 rounded-xl text-center font-bold border-2 transition-colors ${
                  priority === 'CAN_WAIT'
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-lg block mb-1">I can wait</span>
                <span className="text-xs opacity-70">CAN WAIT</span>
              </button>
            </div>
          </div>

          {/* Needs categories checklist */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-slate-300 mb-3">What do you need? (select all that apply)</p>
            <div className="space-y-2">
              {NEED_CATEGORIES.map((cat) => {
                const selected = needsCategories.includes(cat.code);
                return (
                  <button
                    key={cat.code}
                    onClick={() => toggleNeed(cat.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left border-2 transition-colors ${
                      selected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs ${
                      selected ? 'bg-blue-600 border-blue-400' : 'border-slate-600'
                    }`}>
                      {selected && '✓'}
                    </span>
                    <span className="text-sm">{cat.label}</span>
                    {cat.needs_ems && (
                      <span className="ml-auto text-xs text-red-400 font-semibold">EMS</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Continue or Update */}
          {checkinToken ? (
            <button
              onClick={handleUpdateNeeds}
              disabled={isUpdating}
              className="w-full py-4 rounded-xl text-lg font-bold text-white bg-amber-600 active:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update My Needs'}
            </button>
          ) : (
            <button
              onClick={() => setStep('details')}
              className="w-full py-4 rounded-xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
        <div className="h-8" />
      </Shell>
    );
  }

  // ─── STEP 3: Details ───
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

            {/* Summary: adults + children + pets */}
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Party</span>
                <span className="font-bold">
                  {adultCount} {adultCount === 1 ? 'adult' : 'adults'}
                  {childCount > 0 && `, ${childCount} ${childCount === 1 ? 'child' : 'children'}`}
                  {petCount > 0 && ` + ${petCount} ${petCount === 1 ? 'pet' : 'pets'}`}
                </span>
              </div>
              {priority && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Priority</span>
                  <span className={`font-bold ${priority === 'IMMEDIATE' ? 'text-red-400' : 'text-amber-400'}`}>
                    {priority}
                  </span>
                </div>
              )}
              {needsCategories.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Needs</span>
                  <span className="font-bold text-blue-400">{needsCategories.length} selected</span>
                </div>
              )}
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
    const partySize = Math.max(1, adultCount + childCount);
    const nearestZones = gps ? findNearestZones(gps.lat, gps.lon).slice(0, 2) : [];

    return (
      <Shell>
        <div className="px-4 py-8 text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${cfg.bg.split(' ')[0]}`}>
            <span className="text-4xl">{cfg.icon}</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Checked In</h2>

          <p className="text-slate-400 mb-1">
            {adultCount} {adultCount === 1 ? 'adult' : 'adults'}
            {childCount > 0 && `, ${childCount} ${childCount === 1 ? 'child' : 'children'}`}
            {petCount > 0 && ` + ${petCount} ${petCount === 1 ? 'pet' : 'pets'}`}
          </p>

          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold text-white mb-4 ${cfg.bg.split(' ')[0]}`}>
            {cfg.label}
          </div>

          {priority && (
            <p className={`text-sm font-bold mb-2 ${priority === 'IMMEDIATE' ? 'text-red-400' : 'text-amber-400'}`}>
              Priority: {priority}
            </p>
          )}

          {needsCategories.length > 0 && (
            <p className="text-sm text-slate-400 mb-4">
              Needs: {needsCategories.map(c =>
                NEED_CATEGORIES.find(n => n.code === c)?.label ?? c
              ).join(', ')}
            </p>
          )}

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
            {/* Update My Needs — only for statuses that had needs assessment */}
            {NEEDS_STATUSES.includes(status!) && checkinToken && (
              <button
                onClick={() => setStep('needs')}
                className="w-full py-3.5 rounded-xl bg-amber-600 border-2 border-amber-500 text-white font-semibold active:bg-amber-700 transition-colors"
              >
                Update My Needs
              </button>
            )}

            {/* PASS Account Link */}
            {claimResult?.success ? (
              <div className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-900/40 border-2 border-indigo-500 rounded-xl">
                <span className="text-indigo-300 font-semibold text-sm">
                  Linked to {claimResult.display_name || 'PASS'} — Verified
                </span>
              </div>
            ) : checkinToken && !claimResult?.success ? (
              <button
                onClick={() => setShowClaimModal(true)}
                className="w-full py-3.5 rounded-xl bg-indigo-600 border-2 border-indigo-500 text-white font-semibold active:bg-indigo-700 transition-colors"
              >
                Link to PASS Account
              </button>
            ) : null}

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

        {/* Claim Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
              <h3 className="text-lg font-bold mb-1">Link to PASS Account</h3>
              <p className="text-sm text-slate-400 mb-4">
                Enter the email associated with your SFG PASS account.
              </p>
              <input
                type="email"
                value={claimEmail}
                onChange={(e) => { setClaimEmail(e.target.value); setClaimResult(null); }}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-slate-900 border-2 border-slate-600 rounded-lg text-white placeholder-slate-500 mb-3 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              {claimResult && !claimResult.success && (
                <p className="text-sm text-red-400 mb-3">{claimResult.error}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowClaimModal(false); setClaimResult(null); }}
                  className="flex-1 py-3 rounded-lg bg-slate-700 text-white font-semibold active:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClaimWithPass}
                  disabled={claiming || !claimEmail.trim()}
                  className="flex-1 py-3 rounded-lg bg-indigo-600 text-white font-semibold active:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {claiming ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </div>
          </div>
        )}
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
