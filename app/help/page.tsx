'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveToOutbox } from '@/lib/offline-store';
import { trySyncNow } from '@/lib/outbox-sync';

// ── COMPLAINT DATA ──
// Tier is HIDDEN from the user. "The system triages. The patient just describes."

interface Complaint {
  code: string;
  label: string;
  emoji: string;
  tier: 1 | 2 | 3;
  dispatchNote: string;
}

const COMPLAINTS: Complaint[] = [
  { code: 'CHEST_PAIN', label: 'Chest pain or pressure', emoji: '💔', tier: 1, dispatchNote: 'Possible cardiac event' },
  { code: 'NOT_BREATHING', label: 'Not breathing', emoji: '😶', tier: 1, dispatchNote: 'Respiratory arrest' },
  { code: 'UNCONSCIOUS', label: 'Unconscious / unresponsive', emoji: '😵', tier: 1, dispatchNote: 'Unresponsive patient' },
  { code: 'SEVERE_BLEEDING', label: 'Severe bleeding', emoji: '🩸', tier: 1, dispatchNote: 'Hemorrhage control needed' },
  { code: 'CHOKING', label: 'Choking', emoji: '🫁', tier: 1, dispatchNote: 'Airway obstruction' },
  { code: 'BURNS', label: 'Burns', emoji: '🔥', tier: 2, dispatchNote: 'Burn injury' },
  { code: 'BROKEN_BONE', label: 'Possible broken bone', emoji: '🦴', tier: 2, dispatchNote: 'Orthopedic injury' },
  { code: 'BREATHING_HARD', label: 'Difficulty breathing', emoji: '😮‍💨', tier: 2, dispatchNote: 'Respiratory distress' },
  { code: 'CUT_WOUND', label: 'Cut or wound', emoji: '🩹', tier: 2, dispatchNote: 'Laceration' },
  { code: 'DIZZY_FAINT', label: 'Dizzy or faint', emoji: '💫', tier: 2, dispatchNote: 'Syncope / near-syncope' },
  { code: 'ALLERGIC', label: 'Allergic reaction', emoji: '🤧', tier: 2, dispatchNote: 'Allergic reaction' },
  { code: 'HEAT_COLD', label: 'Heat or cold exposure', emoji: '🌡️', tier: 2, dispatchNote: 'Environmental exposure' },
  { code: 'OTHER', label: 'Something else', emoji: '📋', tier: 2, dispatchNote: 'Unclassified complaint' },
];

// ── DETERMINISTIC SHUFFLE ──
// Seeded by incident_id so every device sees the same order for the same incident.
// Zone leads can say "tap the third one" and it works for everyone.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function shuffleComplaints(incidentId: string): Complaint[] {
  const rng = mulberry32(hashString(incidentId));
  const arr = [...COMPLAINTS];
  // Fisher-Yates with seeded RNG
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── TYPES ──

type Screen = 'info' | 'complaints' | 'other_text' | 'critical' | 'minor' | 'guidance';

interface GpsState {
  lat: number;
  lon: number;
}

export default function HelpPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <HelpPage />
    </Suspense>
  );
}

function HelpPage() {
  const params = useSearchParams();
  const incidentId = params.get('incident') || '00000000-0000-0000-0000-000000000000';
  const assemblyPoint = params.get('ap') || '';

  // ── State ──
  const [screen, setScreen] = useState<Screen>('info');
  const [callerName, setCallerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [gps, setGps] = useState<GpsState | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'done' | 'denied'>('loading');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [otherText, setOtherText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);

  // Deterministic complaint order for this incident
  const [orderedComplaints] = useState(() => shuffleComplaints(incidentId));

  // Auto-capture GPS on mount
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

  // ── SUBMIT — offline-first ──
  const submit = useCallback(async (complaint: Complaint, otherDetail?: string) => {
    if (submitting || submitted) return;
    setSubmitting(true);

    try {
      await saveToOutbox('help', {
        incident_id: incidentId,
        complaint_code: complaint.code,
        complaint_label: complaint.label,
        triage_tier: complaint.tier,
        dispatch_note: complaint.dispatchNote,
        caller_name: callerName.trim() || null,
        phone: phone || null,
        party_size: partySize,
        assembly_point: assemblyPoint || null,
        lat: gps?.lat,
        lon: gps?.lon,
        manual_address: manualAddress || null,
        other_text: otherDetail?.slice(0, 200) || null,
      });
      trySyncNow();
    } catch {
      // IndexedDB failure — still show success (data loss is acceptable vs. blocking the user)
    }

    setSubmitted(true);
    setSubmitting(false);
  }, [submitting, submitted, incidentId, callerName, phone, partySize, assemblyPoint, gps, manualAddress]);

  // ── HANDLE COMPLAINT SELECTION ──
  const handleComplaintSelect = useCallback((c: Complaint) => {
    setSelectedComplaint(c);

    if (c.code === 'OTHER') {
      setScreen('other_text');
      return;
    }

    if (c.tier === 1) {
      // CRITICAL: Show confirmation screen with CERT card FIRST.
      // We write to help_requests even though they may dial —
      // gives IC "Tier 1 triggered from this zone" count.
      // NO auto-dial. User must confirm before calling 911.
      setScreen('critical');
      setShowCallConfirm(true);
      submit(c);
    } else if (c.tier === 3) {
      setScreen('guidance');
      submit(c);
    } else {
      // Tier 2 — callback queue
      setScreen('minor');
      submit(c);
    }
  }, [submit]);

  const handleOtherSubmit = useCallback(() => {
    if (!selectedComplaint) return;
    // Re-classify based on what they typed? No — keep it Tier 2 (callback queue).
    setScreen('minor');
    submit(selectedComplaint, otherText);
  }, [selectedComplaint, otherText, submit]);

  // ── CERT / DISPATCHER CARD ──
  // This panel shows at the top of every post-selection screen.
  // It renders BEFORE the 911 dial prompt — that's the key UX requirement.
  const CertCard = () => {
    if (!selectedComplaint) return null;

    return (
      <div className="mx-4 mb-4 bg-slate-800 rounded-xl border-2 border-blue-600 overflow-hidden">
        <div className="bg-blue-900 px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">CERT / Dispatcher Card</span>
          <button
            onClick={() => {
              const text = [
                `Complaint: ${selectedComplaint.label}`,
                `Caller: ${callerName || 'Unknown'}`,
                `Phone: ${phone || 'Not provided'}`,
                `People: ${partySize}`,
                assemblyPoint ? `Assembly: ${assemblyPoint}` : null,
                gps ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : null,
                manualAddress ? `Address: ${manualAddress}` : null,
              ].filter(Boolean).join('\n');
              navigator.clipboard?.writeText(text);
            }}
            className="text-xs text-blue-300 underline"
          >
            Copy
          </button>
        </div>
        <div className="px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Complaint</span>
            <span className="font-semibold text-right">{selectedComplaint.emoji} {selectedComplaint.label}</span>
          </div>
          {callerName && (
            <div className="flex justify-between">
              <span className="text-slate-400">Caller</span>
              <span className="font-semibold">{callerName}</span>
            </div>
          )}
          {phone && (
            <div className="flex justify-between">
              <span className="text-slate-400">Phone</span>
              <span className="font-mono">{phone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">People</span>
            <span className="font-semibold">{partySize}</span>
          </div>
          {assemblyPoint && (
            <div className="flex justify-between">
              <span className="text-slate-400">Assembly</span>
              <span className="font-semibold">{assemblyPoint}</span>
            </div>
          )}
          {gps && (
            <div className="flex justify-between">
              <span className="text-slate-400">GPS</span>
              <span className="font-mono text-xs text-blue-400">{gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}</span>
            </div>
          )}
          {manualAddress && (
            <div className="flex justify-between">
              <span className="text-slate-400">Address</span>
              <span className="text-right">{manualAddress}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── BACK BUTTON ──
  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
    >
      ←
    </button>
  );

  // ── SCREEN: INFO CAPTURE ──
  if (screen === 'info') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">I Need Help</h1>
        </header>

        {/* 911 Banner */}
        <a
          href="tel:911"
          className="mx-4 mt-4 mb-4 flex items-center gap-3 bg-red-700 rounded-xl px-4 py-3 active:bg-red-800 transition-colors"
        >
          <span className="text-2xl">📞</span>
          <div>
            <p className="font-bold text-base">Life-threatening emergency?</p>
            <p className="text-sm text-red-200">Tap to call 911 now</p>
          </div>
        </a>

        <div className="px-4 space-y-4">
          <p className="text-sm text-slate-400">
            Tell us about yourself so responders can find you. Then describe what&apos;s happening.
          </p>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your name</label>
            <input
              type="text"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
              placeholder="First name or nickname"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(310) 555-0100"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
            />
          </div>

          {/* Party Size */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">How many people need help?</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setPartySize(n)}
                  className={`flex-1 py-3 rounded-xl text-lg font-bold border-2 transition-colors ${
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

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your location</label>
            {gpsStatus === 'loading' ? (
              <div className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-slate-400 text-sm">
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
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="Street address or landmark"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
              />
            )}
          </div>

          {/* Continue */}
          <button
            onClick={() => setScreen('complaints')}
            className="w-full py-4 rounded-xl bg-amber-600 font-bold text-lg active:bg-amber-700 transition-colors mt-2"
          >
            Next: What&apos;s happening?
          </button>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  // ── SCREEN: COMPLAINT GRID ──
  if (screen === 'complaints') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <BackButton onClick={() => setScreen('info')} />
          <h1 className="text-lg font-bold">What&apos;s happening?</h1>
        </header>

        <p className="px-4 pt-3 pb-2 text-sm text-slate-400">
          Tap the one that best describes the situation.
        </p>

        <div className="px-4 pb-8 space-y-2">
          {orderedComplaints.map((c) => (
            <button
              key={c.code}
              onClick={() => handleComplaintSelect(c)}
              className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-4 border border-slate-700 active:bg-slate-700 transition-colors text-left"
            >
              <span className="text-2xl w-8 text-center shrink-0">{c.emoji}</span>
              <span className="font-semibold text-base">{c.label}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ── SCREEN: OTHER TEXT ──
  if (screen === 'other_text') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <BackButton onClick={() => setScreen('complaints')} />
          <h1 className="text-lg font-bold">Describe the situation</h1>
        </header>

        <div className="px-4 pt-4 space-y-4">
          <textarea
            value={otherText}
            onChange={(e) => setOtherText(e.target.value.slice(0, 200))}
            placeholder="Briefly describe what's happening..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base resize-none"
          />
          <div className="text-right text-xs text-slate-500">
            {otherText.length}/200
          </div>

          <button
            onClick={handleOtherSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-amber-600 font-bold text-lg active:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Submit'}
          </button>
        </div>
      </main>
    );
  }

  // ── SCREEN: TIER 1 — CRITICAL (TWO-STEP 911 CONFIRMATION) ──
  if (screen === 'critical') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-red-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold text-red-400">Emergency</h1>
        </header>

        {/* Calming confirmation message */}
        {showCallConfirm && (
          <div className="mx-4 mt-4 bg-slate-800 rounded-xl border border-slate-600 p-5 text-center space-y-4">
            <p className="text-lg text-slate-200 leading-relaxed">
              Your information is ready.
              <br />
              When you call 911, read them the card below.
            </p>

            <a
              href="tel:911"
              className="block w-full py-5 rounded-xl bg-red-600 font-bold text-xl active:bg-red-700 transition-colors shadow-lg shadow-red-900/50"
            >
              Call 911 Now
            </a>

            <button
              onClick={() => setShowCallConfirm(false)}
              className="text-sm text-slate-400 underline"
            >
              I&apos;ll call later / Someone is already calling
            </button>
          </div>
        )}

        {/* CERT Card renders on screen — the key UX requirement */}
        <div className="pt-4">
          <CertCard />
        </div>

        {/* Fallback call button (visible after dismissing confirmation) */}
        {!showCallConfirm && (
          <div className="px-4 space-y-3">
            <a
              href="tel:911"
              className="block w-full py-4 rounded-xl bg-red-600 font-bold text-lg text-center active:bg-red-700 transition-colors"
            >
              Call 911
            </a>
          </div>
        )}

        <div className="px-4 pt-6">
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

  // ── SCREEN: TIER 2 — CALLBACK QUEUE ──
  if (screen === 'minor') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Help Requested</h1>
        </header>

        <div className="pt-4">
          <CertCard />
        </div>

        <div className="px-4 text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-extrabold text-emerald-400">YOU&apos;RE CHECKED IN</h2>
          <p className="text-slate-300">
            A dispatcher has your information and will follow up.
            {phone && ' You may receive a callback.'}
          </p>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-left">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-2">While you wait</h3>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>Stay where you are if safe</li>
              <li>Keep your phone charged and volume up</li>
              <li>If the situation worsens, call 911</li>
            </ul>
          </div>
        </div>

        <div className="px-4 pt-6 pb-8">
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

  // ── SCREEN: TIER 3 — GUIDANCE ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Information</h1>
      </header>

      <div className="pt-4">
        <CertCard />
      </div>

      <div className="px-4 text-center space-y-4">
        <div className="text-6xl">ℹ️</div>
        <h2 className="text-2xl font-extrabold">Noted</h2>
        <p className="text-slate-300">
          Your information has been logged. Check the skills page for self-help guidance.
        </p>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-3">
        <a
          href="/skills"
          className="block w-full py-3 rounded-xl bg-blue-600 font-semibold text-center active:bg-blue-700 transition-colors"
        >
          Life-Saving Skills
        </a>
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
