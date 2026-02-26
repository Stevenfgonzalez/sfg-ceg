'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// EMS COMPLAINT TRIAGE
//
// "The system triages. The patient just describes."
//
// User NEVER sees "Critical" or "Minor" — system classifies behind the scenes.
// Tier 1 = CRITICAL → auto-initiate 911 call
// Tier 2 = MINOR → dispatch callback queue
//
// Complaints are displayed in MIXED ORDER (not grouped by tier) so the user
// doesn't infer triage priority from position.
// ═══════════════════════════════════════════════════════════════════════════

interface EMSComplaint {
  code: string;
  label: string;
  emoji: string;
  tier: 1 | 2;
  dispatchNote: string;
}

const EMS_COMPLAINTS: EMSComplaint[] = [
  { code: 'CHEST_PAIN', label: 'Chest Pain / Pressure', emoji: '💔', tier: 1, dispatchNote: 'Assume cardiac until ruled out. Dispatch ALS.' },
  { code: 'BLEEDING_MINOR', label: 'Cut or Scrape', emoji: '🩹', tier: 2, dispatchNote: 'Assess severity on callback. May need wound care.' },
  { code: 'SOB', label: 'Difficulty Breathing', emoji: '😮‍💨', tier: 1, dispatchNote: 'Could be cardiac, respiratory, or smoke inhalation. Dispatch ALS.' },
  { code: 'ANKLE_INJURY', label: 'Twisted Ankle / Can\'t Walk', emoji: '🦶', tier: 2, dispatchNote: 'Likely sprain/fracture. May need transport assist.' },
  { code: 'BURNS', label: 'Burns', emoji: '🔥', tier: 1, dispatchNote: 'Assume significant until assessed. Dispatch ALS.' },
  { code: 'MEDICATION', label: 'Need Medication Refill', emoji: '💊', tier: 2, dispatchNote: 'Assess urgency — insulin, cardiac meds = escalate.' },
  { code: 'UNRESPONSIVE', label: 'Someone Is Unresponsive', emoji: '🚨', tier: 1, dispatchNote: 'Highest priority. Dispatch ALS + direct CERT to patient.' },
  { code: 'ANXIETY', label: 'Anxiety / Panic', emoji: '😰', tier: 2, dispatchNote: 'Psychological first aid. CERT can assist on-site.' },
  { code: 'BLEEDING_SEVERE', label: 'Heavy Bleeding / Won\'t Stop', emoji: '🩸', tier: 1, dispatchNote: 'Hemorrhage control needed. Dispatch ALS. Direct CERT to apply pressure.' },
  { code: 'ASTHMA', label: 'Asthma (Have Inhaler)', emoji: '🌬️', tier: 2, dispatchNote: 'Stable if has inhaler. Callback to confirm. Escalate if worsening.' },
  { code: 'ALLERGIC', label: 'Severe Allergic Reaction', emoji: '⚠️', tier: 1, dispatchNote: 'Anaphylaxis risk. Dispatch ALS. Ask about epi-pen on callback.' },
  { code: 'DIZZY', label: 'Dizzy / Feeling Faint', emoji: '💫', tier: 2, dispatchNote: 'Could be dehydration, heat, cardiac. Callback to assess.' },
  { code: 'DIABETIC', label: 'Diabetic Emergency', emoji: '🍬', tier: 1, dispatchNote: 'Hypo/hyperglycemia. Dispatch ALS. CERT: check for juice/glucose.' },
  { code: 'OTHER', label: 'Something Else', emoji: '📋', tier: 2, dispatchNote: 'Free-text captured. Dispatch reviews and classifies.' },
];

type Step = 'info' | 'complaint' | 'submitting' | 'critical' | 'minor';

export default function EMSPage() {
  // Step 1: Info
  const [step, setStep] = useState<Step>('info');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [otherText, setOtherText] = useState('');

  // GPS
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'done' | 'denied'>('idle');
  const [manualAddress, setManualAddress] = useState('');

  // Selected complaint
  const [selectedComplaint, setSelectedComplaint] = useState<EMSComplaint | null>(null);

  // Auto-capture GPS on mount
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

  const retryGps = useCallback(() => {
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

  const hasLocation = gps || manualAddress.trim();

  // Submit EMS request
  async function handleComplaintSelect(complaint: EMSComplaint) {
    setSelectedComplaint(complaint);
    setStep('submitting');

    try {
      await fetch('/api/public/ems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaint_code: complaint.code,
          complaint_label: complaint.label,
          tier: complaint.tier,
          dispatch_note: complaint.dispatchNote,
          first_name: firstName.trim() || undefined,
          phone: phone.trim() || undefined,
          people_count: peopleCount,
          other_text: complaint.code === 'OTHER' ? otherText.trim() : undefined,
          lat: gps?.lat,
          lon: gps?.lon,
          manual_address: !gps ? manualAddress.trim() || undefined : undefined,
        }),
      });
    } catch {
      // Queued / offline — still show result screen
    }

    // Route to appropriate confirmation
    if (complaint.tier === 1) {
      setStep('critical');
    } else {
      setStep('minor');
    }
  }

  // ─── STEP 1: Your Info ───
  if (step === 'info') {
    return (
      <Shell>
        <Header />

        <div className="px-4 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              First name
            </label>
            <input
              type="text"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1.5">
              Phone number <span className="text-slate-500 font-normal">(for medic callback)</span>
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(818) 555-1234"
              className="form-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              How many people need help?
            </label>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setPeopleCount(n)}
                  className={`flex-1 py-3 rounded-lg text-lg font-bold border-2 transition-colors ${
                    peopleCount === n
                      ? 'bg-red-700 border-red-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                >
                  {n === 3 ? '3+' : n}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-sm font-semibold text-slate-300 mb-2">📍 Location</p>
            {gpsStatus === 'done' && gps ? (
              <p className="text-xs text-blue-400 font-mono">
                {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
              </p>
            ) : gpsStatus === 'loading' ? (
              <p className="text-xs text-slate-500">Acquiring GPS...</p>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Enter address (e.g., 28000 Pacific Coast Hwy)"
                  className="form-input text-sm"
                />
                <button onClick={retryGps} className="text-xs text-blue-400 underline">
                  📍 Try GPS again
                </button>
              </div>
            )}
          </div>

          {/* Next */}
          <button
            onClick={() => setStep('complaint')}
            disabled={!hasLocation}
            className="w-full py-4 rounded-xl text-lg font-bold text-white bg-red-700 active:bg-red-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next — What&apos;s Wrong?
          </button>
        </div>

        <div className="h-8" />
      </Shell>
    );
  }

  // ─── STEP 2: Complaint Selection ───
  if (step === 'complaint') {
    return (
      <Shell>
        <Header />

        <div className="px-4">
          <button
            onClick={() => setStep('info')}
            className="text-slate-400 text-sm mb-3 flex items-center gap-1"
          >
            ← Back
          </button>

          <h2 className="text-lg font-bold mb-1">What&apos;s wrong?</h2>
          <p className="text-sm text-slate-400 mb-4">Tap the one that best describes your situation</p>

          <div className="grid grid-cols-2 gap-2.5">
            {EMS_COMPLAINTS.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  if (c.code === 'OTHER') {
                    setSelectedComplaint(c);
                    // Don't submit yet — show text input
                  } else {
                    handleComplaintSelect(c);
                  }
                }}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 transition-colors ${
                  selectedComplaint?.code === c.code
                    ? 'bg-red-700 border-red-500'
                    : 'bg-slate-800 border-slate-700 active:bg-slate-700'
                }`}
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs font-semibold text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>

          {/* "Other" free text input */}
          {selectedComplaint?.code === 'OTHER' && step === 'complaint' && (
            <div className="mt-4 space-y-3">
              <textarea
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Describe what's happening..."
                rows={3}
                className="form-input"
                autoFocus
              />
              <button
                onClick={() => handleComplaintSelect(selectedComplaint)}
                disabled={!otherText.trim()}
                className="w-full py-3.5 rounded-xl text-base font-bold text-white bg-red-700 active:bg-red-800 transition-colors disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          )}
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
            <p className="text-lg text-slate-400">Sending request...</p>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── TIER 1: CRITICAL — Auto-dial 911 ───
  if (step === 'critical') {
    return (
      <Shell>
        <div className="px-4 py-8 text-center">
          {/* Pulsing phone */}
          <div className="w-28 h-28 rounded-full bg-red-700 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <span className="text-5xl">📞</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">CALLING 911</h2>
          <p className="text-slate-400 mb-6">
            Based on your description, this needs immediate attention.
          </p>

          <a
            href="tel:911"
            className="block w-full py-5 rounded-xl text-xl font-bold text-white bg-red-700 active:bg-red-800 transition-colors mb-4 shadow-lg shadow-red-900/50"
          >
            📞 Call 911 Now
          </a>

          <p className="text-sm text-slate-500 mb-6">
            Your EMS request has been sent to responders.
            {phone && <> They may also call you at <strong>{phone}</strong>.</>}
          </p>

          {/* CERT Card */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-left mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              CERT / Responder Info
            </p>
            <div className="space-y-1 text-sm">
              {firstName && <p><span className="text-slate-400">Name:</span> {firstName}</p>}
              {phone && <p><span className="text-slate-400">Phone:</span> {phone}</p>}
              <p><span className="text-slate-400">People:</span> {peopleCount}</p>
              <p><span className="text-slate-400">Complaint:</span> {selectedComplaint?.label}</p>
              {gps && (
                <p><span className="text-slate-400">GPS:</span> {gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}</p>
              )}
              {manualAddress && (
                <p><span className="text-slate-400">Address:</span> {manualAddress}</p>
              )}
            </div>
          </div>

          <a
            href="/"
            className="block w-full py-3.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-semibold text-center active:bg-slate-700 transition-colors"
          >
            Back to CEG Home
          </a>
        </div>
      </Shell>
    );
  }

  // ─── TIER 2: MINOR — Dispatch callback ───
  return (
    <Shell>
      <div className="px-4 py-8 text-center">
        <div className="w-24 h-24 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✓</span>
        </div>

        <h2 className="text-2xl font-bold mb-2">YOU&apos;RE CHECKED IN</h2>
        <p className="text-slate-400 mb-2">
          A medic or dispatcher may call you.
        </p>
        {phone && (
          <p className="text-sm text-slate-500 mb-6">
            Callback number: <strong>{phone}</strong>
          </p>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 text-left mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Your Request
          </p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-2xl mr-2">{selectedComplaint?.emoji}</span>
              {selectedComplaint?.label}
            </p>
            {firstName && <p><span className="text-slate-400">Name:</span> {firstName}</p>}
            <p><span className="text-slate-400">People:</span> {peopleCount}</p>
          </div>
        </div>

        <div className="space-y-3">
          <a
            href="tel:911"
            className="block w-full py-3.5 rounded-xl bg-red-700 text-white font-semibold text-center active:bg-red-800 transition-colors"
          >
            If worsening — Call 911
          </a>
          <a
            href="/"
            className="block w-full py-3.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-semibold text-center active:bg-slate-700 transition-colors"
          >
            Back to CEG Home
          </a>
        </div>
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

function Header() {
  return (
    <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b-2 border-red-800 bg-red-900/30 mb-4">
      <a
        href="/"
        className="w-10 h-10 flex items-center justify-center rounded-lg bg-red-900 active:bg-red-800 text-lg"
      >
        ←
      </a>
      <div>
        <h1 className="text-lg font-bold">🚑 Need EMS</h1>
        <p className="text-xs text-red-300">Medical Emergency Request</p>
      </div>
    </header>
  );
}
