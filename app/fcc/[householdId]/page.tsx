'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import { isNfcSupported, startNfcScan } from '@/lib/nfc';

type Screen = 'loading' | 'not_found' | 'access' | 'code_entry' | 'viewing' | 'expired';
type AccessMethod = 'resident_code' | 'incident_number' | 'pcr_number' | 'temp_code';
type FlagType = 'allergy' | 'med' | 'equipment' | 'safety';

interface PublicInfo {
  id: string;
  name: string;
  address: string;
  hazards: string | null;
  member_count: number;
}

interface CriticalFlag { flag: string; type: FlagType }
interface Medication { name: string; dose: string; freq: string; last_dose: string }
interface Equipment { item: string; location: string }

interface Clinical {
  critical_flags: CriticalFlag[];
  medications: Medication[];
  history: string[];
  mobility_status: string | null;
  lift_method: string | null;
  precautions: string | null;
  pain_notes: string | null;
  stair_chair_needed: boolean;
  equipment: Equipment[];
  life_needs: string[];
}

interface Member {
  id: string;
  full_name: string;
  date_of_birth: string;
  photo_url: string | null;
  baseline_mental: string | null;
  primary_language: string;
  code_status: string;
  directive_location: string | null;
  fcc_member_clinical: Clinical | Clinical[];
}

interface HouseholdData {
  id: string;
  name: string;
  address: string;
  best_door: string | null;
  gate_code: string | null;
  animals: string | null;
  stair_info: string | null;
  hazards: string | null;
  aed_onsite: boolean;
  backup_power: string | null;
}

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
}

interface UnlockResponse {
  session_token: string;
  expires_at: string;
  household: HouseholdData;
  members: Member[];
  contacts: Contact[];
}

// Get clinical data from member (handles both object and array from Supabase)
function getClinical(member: Member): Clinical {
  const c = member.fcc_member_clinical;
  if (Array.isArray(c)) return c[0] || emptyClinical();
  return c || emptyClinical();
}

function emptyClinical(): Clinical {
  return { critical_flags: [], medications: [], history: [], mobility_status: null, lift_method: null, precautions: null, pain_notes: null, stair_chair_needed: false, equipment: [], life_needs: [] };
}

// ── Inline sub-components ──

const FLAG_COLORS: Record<FlagType, string> = {
  allergy: 'bg-red-900/60 text-red-300 border-red-800',
  med: 'bg-amber-900/60 text-amber-200 border-amber-800',
  equipment: 'bg-blue-900/60 text-blue-300 border-blue-800',
  safety: 'bg-green-900/60 text-green-300 border-green-800',
};

function StatusBadge({ label, type }: { label: string; type: FlagType }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold border tracking-wide ${FLAG_COLORS[type] || FLAG_COLORS.safety}`}>
      {label}
    </span>
  );
}

function HistoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-indigo-950 text-violet-300 border border-indigo-800">
      {label}
    </span>
  );
}

function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <h3 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${color} mb-2 mt-5 pb-1.5 border-b-2 border-current`}>
      <span>{icon}</span> {title}
    </h3>
  );
}

function MedRow({ med, isLast }: { med: Medication; isLast: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${isLast ? '' : 'border-b border-slate-700'}`}>
      <div>
        <span className="font-bold text-sm">{med.name}</span>
        <span className="text-xs text-slate-400 ml-1.5">{med.dose} — {med.freq}</span>
      </div>
      {med.last_dose && (
        <span className="text-xs text-green-400 font-mono shrink-0 ml-2">{med.last_dose}</span>
      )}
    </div>
  );
}

function ContactRow({ contact, isLast }: { contact: Contact; isLast: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${isLast ? '' : 'border-b border-slate-700'}`}>
      <div>
        <p className="font-semibold text-sm">{contact.name}</p>
        <p className="text-xs text-slate-400">{contact.relation}</p>
      </div>
      <a
        href={`tel:${contact.phone.replace(/\D/g, '')}`}
        className="text-sm text-blue-400 font-mono shrink-0 ml-2 active:text-blue-300"
      >
        {contact.phone}
      </a>
    </div>
  );
}

const CODE_STATUS_LABELS: Record<string, string> = {
  full_code: 'Full Code',
  dnr: 'DNR',
  dnr_polst: 'DNR/POLST',
};

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ── Main page ──

export default function FccPublicEntry() {
  const router = useRouter();
  const params = useParams();
  const householdId = params.householdId as string;

  const [screen, setScreen] = useState<Screen>('loading');
  const [accessMethod, setAccessMethod] = useState<AccessMethod | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [publicInfo, setPublicInfo] = useState<PublicInfo | null>(null);
  const [householdData, setHouseholdData] = useState<HouseholdData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeMember, setActiveMember] = useState(0);
  const [expiresAt, setExpiresAt] = useState('');
  const [sessionExpiresMs, setSessionExpiresMs] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const nfcAbortRef = useRef<AbortController | null>(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // NFC auto-scan on access screen — if tag with different household detected, navigate
  useEffect(() => {
    if (screen !== 'access' || !isNfcSupported()) return;

    const controller = startNfcScan(
      (url) => {
        // Extract household ID from FCC URL
        const match = url.match(/\/fcc\/([a-f0-9-]+)/i);
        if (match && match[1] !== householdId) {
          router.push(`/fcc/${match[1]}`);
        }
      },
      () => {
        // Scan error — silently ignore, NFC is optional
      },
    );

    if (controller) {
      nfcAbortRef.current = controller;
      setNfcScanning(true);
    }

    return () => {
      if (nfcAbortRef.current) {
        nfcAbortRef.current.abort();
        nfcAbortRef.current = null;
      }
      setNfcScanning(false);
    };
  }, [screen, householdId, router]);

  // Fetch public household info on mount
  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch(`/api/fcc/${householdId}/info`);
        if (!res.ok) {
          setScreen('not_found');
          return;
        }
        const data: PublicInfo = await res.json();
        setPublicInfo(data);
        setScreen('access');
      } catch {
        setScreen('not_found');
      }
    }
    fetchInfo();
  }, [householdId]);

  const exitToHome = useCallback(() => {
    logEvent('fcc_ems_exit');
    router.replace('/');
  }, [router]);

  const handleSelectMethod = useCallback((method: AccessMethod) => {
    setAccessMethod(method);
    setCodeInput('');
    setError('');
    setScreen('code_entry');
    logEvent('fcc_ems_method', { method });
  }, []);

  const handleVerify = useCallback(async () => {
    if (verifying || !accessMethod) return;
    setError('');
    setVerifying(true);

    try {
      const res = await fetch(`/api/fcc/${householdId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_method: accessMethod,
          access_value: codeInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many attempts. Wait 60 seconds.');
        } else if (res.status === 401) {
          setError(
            accessMethod === 'resident_code'
              ? 'Invalid code. Request code from resident or use Incident/PCR number.'
              : accessMethod === 'temp_code'
                ? 'Invalid or expired temporary code. Request a new code from the household.'
                : 'Could not verify. Try another access method or contact dispatch.'
          );
        } else {
          setError(data.error || 'Verification failed');
        }
        return;
      }

      // Detect if response came from service worker cache
      if (res.headers.get('X-FCC-Offline') === 'true') {
        setIsOfflineData(true);
      }

      const unlock: UnlockResponse = data;
      setHouseholdData(unlock.household);
      setMembers(unlock.members);
      setContacts(unlock.contacts);
      setActiveMember(0);

      const exp = new Date(unlock.expires_at);
      setExpiresAt(exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setSessionExpiresMs(exp.getTime());
      setRemaining(exp.getTime() - Date.now());
      setScreen('viewing');
      logEvent('fcc_ems_verified', { method: accessMethod, household: householdId });
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setVerifying(false);
    }
  }, [verifying, accessMethod, codeInput, householdId]);

  // Countdown timer — ticks every second when session is active
  useEffect(() => {
    if (screen !== 'viewing' || !sessionExpiresMs) return;
    const id = setInterval(() => {
      const left = sessionExpiresMs - Date.now();
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        setScreen('expired');
        // Clear FCC data cache on session expiry
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage('CLEAR_FCC_CACHE');
        }
        logEvent('fcc_session_expired', { household: householdId });
      } else {
        setRemaining(left);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [screen, sessionExpiresMs, householdId]);

  // Warn before closing tab while session is active
  useEffect(() => {
    if (screen !== 'viewing') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [screen]);

  function formatCountdown(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  // ── LOADING ──
  if (screen === 'loading') {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading care card...</p>
        </div>
      </main>
    );
  }

  // ── NOT FOUND ──
  if (screen === 'not_found') {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-bold text-lg">Care Card Not Found</p>
          <p className="text-sm text-slate-400 mt-2">This household ID does not exist or has been removed.</p>
          <button onClick={exitToHome} className="mt-6 bg-slate-800 border border-slate-700 rounded-lg px-6 py-3 text-sm font-semibold active:bg-slate-700">
            Go to CEG Home
          </button>
        </div>
      </main>
    );
  }

  // ── EXPIRED SCREEN ──
  if (screen === 'expired') {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-red-900/60 flex items-center justify-center mx-auto mb-4 text-3xl">
            ⏰
          </div>
          <p className="font-bold text-xl">Session Expired</p>
          <p className="text-sm text-slate-400 mt-2">Your 4-hour access window has ended.</p>
          <p className="text-xs text-slate-500 mt-1">Patient data has been cleared from this device.</p>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => {
                setScreen('access');
                setHouseholdData(null);
                setMembers([]);
                setContacts([]);
                setCodeInput('');
                setError('');
                setSessionExpiresMs(null);
                setRemaining(null);
              }}
              className="flex-1 bg-blue-600 rounded-lg px-4 py-3 text-sm font-bold active:bg-blue-700 transition-colors"
            >
              Request New Access
            </button>
            <button
              onClick={exitToHome}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm font-semibold active:bg-slate-700 transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── ACCESS SCREEN ──
  if (screen === 'access' && publicInfo) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <div className="text-center px-4 pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center mx-auto mb-3 text-3xl">
            🏥
          </div>
          <p className="text-xs font-bold tracking-widest text-slate-400 font-mono">SFG FIELD CARE CARD</p>
          <p className="text-xs font-bold tracking-widest text-blue-400 uppercase mt-1.5 font-mono">EMS Access Portal</p>
          <p className="text-base font-bold mt-1.5">{publicInfo.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{publicInfo.address}</p>
          <p className="text-xs text-slate-400">{publicInfo.member_count} registered member{publicInfo.member_count !== 1 ? 's' : ''}</p>
        </div>

        {publicInfo.hazards && (
          <div className="mx-4 mb-4 bg-gradient-to-r from-red-950 to-red-900 rounded-lg px-3 py-2 flex items-center gap-2 justify-center">
            <span className="text-sm">⚠️</span>
            <span className="text-xs font-bold text-red-300">{publicInfo.hazards}</span>
          </div>
        )}

        <div className="px-4 mb-2">
          <p className="text-xs text-slate-400 text-center mb-3">Select access method</p>
        </div>

        <div className="px-4 space-y-2 mb-8">
          <button
            onClick={() => handleSelectMethod('resident_code')}
            className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3.5 border border-slate-700 active:border-blue-500 transition-colors text-left"
          >
            <span className="text-2xl">🔑</span>
            <div>
              <p className="font-bold text-sm">Resident Code</p>
              <p className="text-xs text-slate-400">Code provided by resident or dispatch</p>
            </div>
          </button>

          <button
            onClick={() => handleSelectMethod('incident_number')}
            className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3.5 border border-slate-700 active:border-blue-500 transition-colors text-left"
          >
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-bold text-sm">Incident Number</p>
              <p className="text-xs text-slate-400">From your CAD dispatch sheet</p>
            </div>
          </button>

          <button
            onClick={() => handleSelectMethod('pcr_number')}
            className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3.5 border border-slate-700 active:border-blue-500 transition-colors text-left"
          >
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-bold text-sm">PCR Number</p>
              <p className="text-xs text-slate-400">Patient Care Report number</p>
            </div>
          </button>

          <button
            onClick={() => handleSelectMethod('temp_code')}
            className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3.5 border border-purple-800/50 active:border-purple-500 transition-colors text-left"
          >
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-bold text-sm text-purple-300">Temporary Code</p>
              <p className="text-xs text-slate-400">6-digit code sent by household member</p>
            </div>
          </button>
        </div>

        <div className="px-4 pb-8 text-center space-y-3">
          <button
            onClick={exitToHome}
            className="text-xs text-slate-500 font-mono border border-slate-700 rounded-lg px-4 py-2.5 active:bg-slate-800 transition-colors w-full"
          >
            Exit → CEG.SFG.AC
          </button>
          {nfcScanning && (
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              NFC scanning active
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── CODE ENTRY SCREEN ──
  if (screen === 'code_entry') {
    const methodConfig: Record<AccessMethod, { icon: string; label: string; desc: string; placeholder: string; maxLen: number; isBig: boolean }> = {
      resident_code: { icon: '🔑', label: 'Resident Code', desc: 'Code provided by resident or dispatch', placeholder: '• • • •', maxLen: 10, isBig: true },
      incident_number: { icon: '📋', label: 'Incident Number', desc: 'From your CAD dispatch sheet', placeholder: 'INC-2026-', maxLen: 20, isBig: false },
      pcr_number: { icon: '📄', label: 'PCR Number', desc: 'Patient Care Report number', placeholder: 'PCR-', maxLen: 20, isBig: false },
      temp_code: { icon: '📱', label: 'Temporary Code', desc: '6-digit code sent by household member', placeholder: '• • • • • •', maxLen: 6, isBig: true },
    };

    const method = accessMethod!;
    const config = methodConfig[method];

    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => { setScreen('access'); setError(''); setCodeInput(''); }}
            aria-label="Back to access methods"
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">{config.label}</h1>
        </header>

        <div className="px-4 pt-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.icon}</span>
              <p className="font-bold text-sm">{config.label}</p>
            </div>
            <p className="text-xs text-slate-400 mb-4">{config.desc}</p>

            <input
              type="text"
              inputMode={method === 'resident_code' || method === 'temp_code' ? 'numeric' : 'text'}
              value={codeInput}
              onChange={(e) => {
                const val = method === 'resident_code' || method === 'temp_code'
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value;
                setCodeInput(val.slice(0, config.maxLen));
                setError('');
              }}
              placeholder={config.placeholder}
              autoFocus
              className={`w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3.5 text-center font-bold font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${
                config.isBig ? 'text-3xl tracking-[0.4em]' : 'text-base tracking-wider'
              }`}
            />

            {error && (
              <p className="mt-3 text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={handleVerify}
              disabled={(method === 'temp_code' ? codeInput.length !== 6 : codeInput.length < 4) || verifying}
              className={`w-full mt-4 rounded-lg px-4 py-3.5 font-bold text-sm transition-all ${
                (method === 'temp_code' ? codeInput.length === 6 : codeInput.length >= 4)
                  ? 'bg-blue-600 text-white active:bg-blue-700'
                  : 'bg-slate-900 text-slate-500'
              } disabled:opacity-60`}
            >
              {verifying ? 'Verifying...' : 'Unlock Field Care Card'}
            </button>

            <p className="text-xs text-slate-500 text-center mt-3 italic">
              Access expires in 4 hours · All access is logged
            </p>
          </div>
        </div>

        <div className="px-4 pt-6 text-center">
          <button
            onClick={exitToHome}
            className="text-xs text-slate-500 font-mono border border-slate-700 rounded-lg px-4 py-2.5 active:bg-slate-800 transition-colors w-full"
          >
            Exit → CEG.SFG.AC
          </button>
        </div>
      </main>
    );
  }

  // ── VIEWING SCREEN (EMS read-only care card) ──
  if (screen !== 'viewing' || !householdData || members.length === 0) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-4xl mb-3">🏥</p>
          <p className="font-bold text-lg">Loading Care Card...</p>
          <p className="text-sm text-slate-400 mt-2">If this persists, go back and try again.</p>
          <button onClick={exitToHome} className="mt-6 bg-slate-800 border border-slate-700 rounded-lg px-6 py-3 text-sm font-semibold active:bg-slate-700">
            Go to CEG Home
          </button>
        </div>
      </main>
    );
  }

  const safeIndex = activeMember < members.length ? activeMember : 0;
  const member = members[safeIndex];
  const clinical = getClinical(member);
  const isDNR = member.code_status === 'dnr' || member.code_status === 'dnr_polst';

  return (
    <main className="min-h-screen bg-slate-900 text-white pb-8">
      <div className={`px-4 py-2.5 flex items-center justify-between transition-colors ${
        remaining !== null && remaining <= 60_000
          ? 'bg-gradient-to-r from-red-800 to-red-600'
          : remaining !== null && remaining <= 300_000
            ? 'bg-gradient-to-r from-amber-800 to-amber-600'
            : 'bg-gradient-to-r from-blue-800 to-blue-600'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">🏥</span>
          <span className="text-xs font-bold tracking-wider font-mono">EMS ACCESS — READ ONLY</span>
        </div>
        <span className={`text-xs font-mono font-bold ${
          remaining !== null && remaining <= 60_000 ? 'text-red-200' :
          remaining !== null && remaining <= 300_000 ? 'text-amber-200' : 'text-blue-200'
        }`}>
          {remaining !== null ? formatCountdown(remaining) : `Expires ${expiresAt}`}
        </span>
      </div>

      {isDNR ? (
        <div className="bg-gradient-to-r from-red-950 to-red-900 px-4 py-2.5 text-center">
          <p className="text-sm font-extrabold tracking-wider font-mono">⚠ {CODE_STATUS_LABELS[member.code_status] || 'DNR'} ON FILE</p>
          {member.directive_location && (
            <p className="text-xs text-red-300 mt-0.5">{member.directive_location}</p>
          )}
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-900 to-green-800 px-4 py-2.5 text-center">
          <p className="text-sm font-extrabold tracking-wider font-mono">✓ FULL CODE</p>
        </div>
      )}

      {/* Offline banner */}
      {(isOffline || isOfflineData) && (
        <div className="bg-gradient-to-r from-amber-900 to-amber-800 px-4 py-2 text-center">
          <p className="text-xs font-bold text-amber-200 tracking-wide">
            {isOffline ? 'OFFLINE — Data may be stale' : 'CACHED DATA — Loaded from offline cache'}
          </p>
        </div>
      )}

      {/* Member tabs */}
      <div role="tablist" aria-label="Household members" className="flex bg-gray-900 border-b border-slate-800 overflow-x-auto">
        {members.map((m, i) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={i === safeIndex}
            aria-label={`View ${m.full_name}`}
            onClick={() => setActiveMember(i)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap px-3 ${
              i === safeIndex
                ? 'bg-slate-800 border-b-2 border-amber-500 text-white'
                : 'text-slate-400'
            }`}
          >
            {m.full_name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="px-4">
        {/* Identification */}
        <SectionHeader icon="👤" title="Identification" color="text-blue-400" />
        <div className="flex gap-3 items-start">
          {member.photo_url && (
            <div className="w-16 h-16 rounded-xl bg-slate-700 overflow-hidden shrink-0 border border-slate-600">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs flex-1">
          <p><span className="text-slate-400">Name:</span> <span className="font-semibold">{member.full_name}</span></p>
          <p><span className="text-slate-400">DOB:</span> <span className="font-semibold">{member.date_of_birth}</span> <span className="text-blue-400 font-bold">({calcAge(member.date_of_birth)} y/o)</span></p>
          {member.baseline_mental && (
            <p className="col-span-2"><span className="text-slate-400">Baseline:</span> <span className="font-semibold">{member.baseline_mental}</span></p>
          )}
          <p><span className="text-slate-400">Language:</span> <span className="font-semibold">{member.primary_language}</span></p>
          </div>
        </div>

        {/* Critical Flags */}
        {clinical.critical_flags.length > 0 && (
          <>
            <SectionHeader icon="🚨" title="Critical Flags" color="text-red-400" />
            <div className="bg-gradient-to-br from-red-950/60 to-red-950/30 border border-red-800 rounded-lg p-3">
              <div className="flex flex-wrap gap-1.5">
                {clinical.critical_flags.map((flag) => (
                  <StatusBadge key={flag.flag} label={flag.flag} type={flag.type as FlagType} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Medications */}
        {clinical.medications.length > 0 && (
          <>
            <SectionHeader icon="💊" title="Current Medications" color="text-amber-500" />
            <div className="bg-gray-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3">
                {clinical.medications.map((med, i) => (
                  <MedRow key={`${med.name}-${i}`} med={med} isLast={i === clinical.medications.length - 1} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* History */}
        {clinical.history.length > 0 && (
          <>
            <SectionHeader icon="📋" title="Relevant History" color="text-violet-400" />
            <div className="flex flex-wrap gap-1.5">
              {clinical.history.map((h) => (
                <HistoryBadge key={h} label={h} />
              ))}
            </div>
          </>
        )}

        {/* Mobility */}
        {(clinical.mobility_status || clinical.lift_method) && (
          <>
            <SectionHeader icon="🚶" title="Mobility &amp; Movement Plan" color="text-green-400" />
            <div className="bg-gray-900 rounded-lg border border-slate-800 p-3 text-xs space-y-1.5">
              {clinical.mobility_status && (
                <p><span className="text-green-400 font-bold">Status:</span> {clinical.mobility_status}</p>
              )}
              {clinical.lift_method && (
                <p><span className="text-green-400 font-bold">Lift:</span> {clinical.lift_method}</p>
              )}
              {clinical.precautions && (
                <p><span className="text-amber-400 font-bold">Precaution:</span> {clinical.precautions}</p>
              )}
              {clinical.pain_notes && (
                <p><span className="text-slate-400 font-bold">Pain:</span> {clinical.pain_notes}</p>
              )}
              {clinical.stair_chair_needed && householdData.stair_info && (
                <p><span className="text-red-400 font-bold">⚠ Stair chair required:</span> {householdData.stair_info}</p>
              )}
            </div>
          </>
        )}

        {/* Equipment */}
        {clinical.equipment.length > 0 && (
          <>
            <SectionHeader icon="🔧" title="Equipment &amp; Life Support" color="text-pink-400" />
            <div className="bg-gray-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3">
                {clinical.equipment.map((eq, i) => (
                  <div key={`${eq.item}-${i}`} className={`flex justify-between py-2 text-xs ${i < clinical.equipment.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <span className="font-semibold">{eq.item}</span>
                    <span className="text-slate-400">{eq.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Access & Hazards */}
        <SectionHeader icon="🚪" title="Access &amp; Hazards" color="text-amber-400" />
        <div className="bg-gray-900 rounded-lg border border-slate-800 p-3 text-xs space-y-1">
          {householdData.best_door && (
            <p><span className="text-amber-400 font-bold">Door:</span> {householdData.best_door}</p>
          )}
          {householdData.gate_code && (
            <p><span className="text-amber-400 font-bold">Gate:</span> {householdData.gate_code}</p>
          )}
          {householdData.animals && (
            <p><span className="text-amber-400 font-bold">Animals:</span> {householdData.animals}</p>
          )}
          {householdData.stair_info && (
            <p><span className="text-amber-400 font-bold">Stairs:</span> {householdData.stair_info}</p>
          )}
          {householdData.aed_onsite && (
            <p><span className="text-green-400 font-bold">AED:</span> On site</p>
          )}
          {householdData.backup_power && (
            <p><span className="text-amber-400 font-bold">Backup Power:</span> {householdData.backup_power}</p>
          )}
          {householdData.hazards && (
            <div className="mt-2 bg-red-900/60 rounded px-2.5 py-1.5 font-semibold text-red-300">
              ⚠ {householdData.hazards}
            </div>
          )}
        </div>

        {/* Life Needs */}
        {clinical.life_needs.length > 0 && (
          <>
            <SectionHeader icon="❤️" title="Life Needs" color="text-orange-400" />
            <div className="bg-gray-900 rounded-lg border border-slate-800 p-3">
              {clinical.life_needs.map((need) => (
                <p key={need} className="text-xs py-1 flex gap-2">
                  <span className="text-orange-400">•</span> {need}
                </p>
              ))}
            </div>
          </>
        )}

        {/* Emergency Contacts */}
        {contacts.length > 0 && (
          <>
            <SectionHeader icon="📞" title="Emergency Contacts" color="text-blue-400" />
            <div className="px-1">
              {contacts.map((c, i) => (
                <ContactRow key={c.id} contact={c} isLast={i === contacts.length - 1} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-4 mt-6 flex gap-2 border-t border-slate-800 pt-3">
        <button
          onClick={() => {
            setScreen('access');
            setHouseholdData(null);
            setMembers([]);
            setContacts([]);
            setCodeInput('');
            setError('');
          }}
          className="flex-1 bg-gray-900 rounded-lg px-4 py-2.5 text-xs font-semibold border border-slate-800 active:bg-slate-800 transition-colors text-slate-400"
        >
          Back to Auth
        </button>
        <button
          onClick={exitToHome}
          className="flex-1 bg-gray-900 rounded-lg px-4 py-2.5 text-xs font-semibold border border-slate-800 active:bg-slate-800 transition-colors text-slate-400"
        >
          Exit → CEG.SFG.AC
        </button>
      </div>
    </main>
  );
}
