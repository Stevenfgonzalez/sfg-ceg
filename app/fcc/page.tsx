'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import { createAuthBrowserClient } from '@/lib/supabase-auth';
import QRCode from 'qrcode';

interface Clinical {
  critical_flags?: { flag: string }[];
  medications?: { name: string }[];
  equipment?: { item: string }[];
  life_needs?: string[];
  history?: string[];
  mobility_status?: string | null;
}

interface Member {
  id: string;
  full_name: string;
  date_of_birth: string;
  code_status: string;
  baseline_mental?: string | null;
  directive_location?: string | null;
  fcc_member_clinical?: Clinical | Clinical[];
}

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
}

interface Household {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  access_code: string;
  best_door?: string;
  gate_code?: string;
  animals?: string;
  stair_info?: string;
  hazards?: string;
  aed_onsite: boolean;
  backup_power?: string;
  member_count: number;
  fcc_members?: Member[];
  fcc_emergency_contacts?: Contact[];
}

interface AccessLog {
  id: string;
  access_method: string;
  accessed_at: string;
}

const CODE_STATUS_LABELS: Record<string, string> = {
  full_code: 'Full Code',
  dnr: 'DNR',
  dnr_polst: 'DNR/POLST',
};

function getClinical(m: Member): Clinical {
  const c = m.fcc_member_clinical;
  if (!c) return {};
  if (Array.isArray(c)) return c[0] || {};
  return c;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function profileCompleteness(household: Household): { pct: number; missing: string[] } {
  const missing: string[] = [];
  const members = household.fcc_members || [];
  const contacts = household.fcc_emergency_contacts || [];

  if (members.length === 0) missing.push('Add household members');
  if (contacts.length === 0) missing.push('Add emergency contacts');
  if (!household.best_door) missing.push('Best door entry');
  if (!household.hazards && !household.animals && !household.stair_info) missing.push('Access details (hazards, animals, stairs)');

  // Check if members have clinical data filled
  let membersWithMeds = 0;
  let membersWithFlags = 0;
  for (const m of members) {
    const c = getClinical(m);
    if ((c.medications?.length || 0) > 0) membersWithMeds++;
    if ((c.critical_flags?.length || 0) > 0) membersWithFlags++;
  }
  if (members.length > 0 && membersWithMeds === 0) missing.push('Add medications to members');
  if (members.length > 0 && membersWithFlags === 0) missing.push('Add critical flags');

  const total = 6; // base fields we check
  const filled = total - missing.length;
  return { pct: Math.round((filled / total) * 100), missing };
}

export default function FCCDashboard() {
  const router = useRouter();
  const [showCode, setShowCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastAccess, setLastAccess] = useState<AccessLog | null>(null);
  const [accessLogCount, setAccessLogCount] = useState(0);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    const supabase = createAuthBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? null);
    });
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [hRes, logRes] = await Promise.all([
          fetch('/api/fcc/household'),
          fetch('/api/fcc/access-logs'),
        ]);
        const hData = await hRes.json();
        const logData = await logRes.json();
        setHousehold(hData.household || null);
        const logs = logData.logs || [];
        setAccessLogCount(logs.length);
        if (logs.length > 0) setLastAccess(logs[0]);
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleLogout = async () => {
    const supabase = createAuthBrowserClient();
    await supabase.auth.signOut();
    logEvent('auth_logout');
    router.push('/');
    router.refresh();
  };

  const generateQR = useCallback(async () => {
    if (!household) return;
    try {
      const url = await QRCode.toDataURL(`https://ceg.sfg.ac/fcc/${household.id}`, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      // QR generation failed
    }
  }, [household]);

  useEffect(() => {
    if (household && !qrDataUrl) {
      generateQR();
    }
  }, [household, qrDataUrl, generateQR]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  // ── NO HOUSEHOLD — ONBOARDING ──
  if (!household) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" aria-label="Back to CEG home" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold flex-1">Field Care Card</h1>
          {userEmail && (
            <button onClick={handleLogout} className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 active:bg-slate-700 transition-colors">
              Sign Out
            </button>
          )}
        </header>

        <div className="px-4 pt-8 pb-8 space-y-5">
          <div className="text-center">
            <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Get Started</p>
            <p className="text-xl font-bold mt-2">Create Your Field Care Card</p>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Pre-register your household medical profiles so first responders can access critical information when seconds matter.
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex gap-3">
              <span className="text-2xl shrink-0">1</span>
              <div>
                <p className="font-bold text-sm">Set up your household</p>
                <p className="text-xs text-slate-400">Address, access info, hazards</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex gap-3">
              <span className="text-2xl shrink-0">2</span>
              <div>
                <p className="font-bold text-sm">Add household members</p>
                <p className="text-xs text-slate-400">Medical info, medications, equipment</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex gap-3">
              <span className="text-2xl shrink-0">3</span>
              <div>
                <p className="font-bold text-sm">Print your QR card</p>
                <p className="text-xs text-slate-400">Place on fridge, door, or carry in wallet</p>
              </div>
            </div>
          </div>

          <a
            href="/fcc/edit"
            className="block w-full bg-amber-600 rounded-xl px-5 py-4 text-center font-bold text-black active:bg-amber-700 transition-colors"
          >
            Start Setup
          </a>

          {userEmail && (
            <p className="text-[10px] text-slate-500 text-center font-mono">{userEmail}</p>
          )}
        </div>
      </main>
    );
  }

  const address = [household.address_line1, household.address_line2].filter(Boolean).join(', ') + `, ${household.city}, ${household.state} ${household.zip}`;
  const members = household.fcc_members || [];
  const contacts = household.fcc_emergency_contacts || [];
  const { pct, missing } = profileCompleteness(household);

  // ── PRINT QR SCREEN ──
  if (showPrint) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800 print:hidden">
          <button onClick={() => setShowPrint(false)} aria-label="Back to dashboard" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</button>
          <h1 className="text-lg font-bold">Print QR Card</h1>
        </header>

        <div className="px-4 pt-3 text-center print:hidden">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Print Preview</p>
          <p className="text-xs text-slate-400 mt-1">QR card for fridge, door, or binder</p>
        </div>

        <div className="px-4 py-4">
          <div className="bg-white text-black rounded-xl p-5 max-w-xs mx-auto print:shadow-none print:rounded-none print:max-w-full">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-amber-700 uppercase font-mono">Safety For Generations</p>
                <p className="text-base font-extrabold text-black mt-0.5">Field Care Card</p>
              </div>
              <p className="text-[9px] font-bold text-red-600 text-right leading-snug font-mono">EMERGENCY<br/>USE ONLY</p>
            </div>

            <div className="border-y-2 border-black py-2 mb-3">
              <p className="text-sm font-bold">{household.name}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{address}</p>
              <p className="text-[10px] text-gray-600">{household.member_count} registered member{household.member_count !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex justify-center mb-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Field Care Card QR code for EMS scanning" width={140} height={140} className="border-2 border-black rounded-lg" />
              ) : (
                <div className="w-[140px] h-[140px] bg-gray-100 border-2 border-black rounded-lg flex flex-col items-center justify-center">
                  <span className="text-[8px] font-bold text-gray-600 font-mono">GENERATING...</span>
                </div>
              )}
            </div>

            <div className="text-center mb-3">
              <p className="text-xs font-extrabold text-black font-mono tracking-wide">CEG.SFG.AC/FCC/{household.id.slice(0, 8)}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">Scan QR or visit URL · Enter access code</p>
            </div>

            <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-400 mb-2">
              <p className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider font-mono mb-1">For Responding Personnel</p>
              <div className="text-[10px] text-amber-900 leading-relaxed">
                <p>1. Scan QR with any phone camera</p>
                <p>2. Enter one of the following:</p>
                <p className="font-bold ml-3">· Resident code <span className="font-normal">(from dispatch)</span></p>
                <p className="font-bold ml-3">· Incident number <span className="font-normal">(from CAD)</span></p>
                <p className="font-bold ml-3">· PCR number</p>
                <p>3. View care profiles for all members</p>
              </div>
            </div>

            {household.hazards && (
              <div className="bg-red-50 rounded-lg p-2 border border-red-400 flex items-center gap-2">
                <p className="text-[10px] font-bold text-red-800">{household.hazards}</p>
              </div>
            )}

            <p className="text-center text-[8px] text-gray-400 mt-3 font-mono leading-snug">
              User-entered emergency summary · Not a medical record<br/>SAFETYFORGENERATIONS.COM
            </p>
          </div>

          <div className="flex gap-2 mt-4 max-w-xs mx-auto print:hidden">
            <button
              onClick={() => { logEvent('fcc_print_qr'); window.print(); }}
              className="flex-1 bg-amber-600 rounded-lg px-4 py-3 text-sm font-bold text-black active:bg-amber-700 transition-colors"
            >
              Print Card
            </button>
            <a href="/fcc/print" className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-sm font-semibold border border-slate-700 active:bg-slate-700 transition-colors text-center">
              More Formats
            </a>
          </div>
        </div>

        <style jsx>{`
          @media print {
            main {
              background: white !important;
              color: black !important;
              min-height: auto !important;
              padding: 0 !important;
            }
            @page { margin: 0.5in; }
          }
        `}</style>
      </main>
    );
  }

  // ── DASHBOARD SCREEN ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold flex-1">Field Care Card</h1>
        {userEmail && (
          <button onClick={handleLogout} className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 active:bg-slate-700 transition-colors">
            Sign Out
          </button>
        )}
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Field Care Card</p>
          <p className="text-xs text-slate-400 mt-1">Household Emergency Profiles</p>
          {userEmail && (
            <p className="text-[10px] text-slate-500 mt-1 font-mono">{userEmail}</p>
          )}
        </div>

        {fetchError && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-red-300">Failed to load data. Check your connection and refresh.</p>
          </div>
        )}

        {/* Profile completeness */}
        {pct < 100 && (
          <div className="bg-slate-800 rounded-xl border border-amber-800/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">Profile Completeness</p>
              <span className="text-xs font-bold text-amber-400 font-mono">{pct}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
              <div
                className="bg-gradient-to-r from-amber-600 to-amber-400 h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="space-y-1">
              {missing.map((item) => (
                <p key={item} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-amber-500">·</span> {item}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Household card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-base">{household.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">{address}</p>
              {household.hazards && (
                <p className="text-xs text-red-400 mt-1 font-semibold">{household.hazards}</p>
              )}
            </div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Household QR code" width={48} height={48} className="w-12 h-12 rounded-lg border border-slate-600 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[10px] font-extrabold text-black font-mono shrink-0">
                QR
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <a
              href="/fcc/edit"
              onClick={() => logEvent('fcc_owner_edit')}
              className="flex-1 bg-amber-600 rounded-lg px-3 py-2.5 text-xs font-bold text-black text-center active:bg-amber-700 transition-colors"
            >
              View / Edit Profiles
            </a>
            <button
              onClick={() => { logEvent('fcc_open_print'); setShowPrint(true); }}
              className="flex-1 bg-gray-900 rounded-lg px-3 py-2.5 text-xs font-semibold border border-slate-700 text-center active:bg-slate-800 transition-colors"
            >
              Print QR Card
            </button>
          </div>
        </div>

        {/* Member summary */}
        {members.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">
              Members ({members.length})
            </p>
            {members.map((m, i) => {
              const c = getClinical(m);
              const flagCount = c.critical_flags?.length || 0;
              const medCount = c.medications?.length || 0;
              const isDNR = m.code_status === 'dnr' || m.code_status === 'dnr_polst';
              return (
                <div key={m.id} className={`flex items-center justify-between py-2 ${i < members.length - 1 ? 'border-b border-slate-700' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold">{m.full_name} <span className="text-slate-500 font-normal text-xs">{calcAge(m.date_of_birth)}y</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {flagCount} flag{flagCount !== 1 ? 's' : ''} · {medCount} med{medCount !== 1 ? 's' : ''}
                      {isDNR && <span className="text-red-400 ml-1.5 font-semibold">{CODE_STATUS_LABELS[m.code_status]}</span>}
                    </p>
                  </div>
                  <a href={`/fcc/edit/${m.id}`} className="text-xs text-blue-400 font-semibold shrink-0">Edit</a>
                </div>
              );
            })}
          </div>
        )}

        {/* Permanent access code */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="font-bold text-sm">Your Permanent Access Code</p>
          <p className="text-xs text-slate-400 mt-0.5">Give this to dispatch when you call 911</p>
          <button
            onClick={() => {
              setShowCode(!showCode);
              logEvent('fcc_toggle_code', { visible: !showCode });
            }}
            aria-label={showCode ? 'Hide access code' : 'Reveal access code'}
            className={`w-full mt-3 rounded-lg px-4 py-3.5 font-extrabold transition-all ${
              showCode
                ? 'bg-gradient-to-r from-green-900 to-green-800 border border-green-700 text-3xl tracking-[0.3em] font-mono text-white'
                : 'bg-gray-900 border border-slate-600 text-sm tracking-wider text-amber-500 font-mono'
            }`}
          >
            {showCode ? household.access_code.split('').join(' ') : 'Tap to Reveal Code'}
          </button>
        </div>

        {/* Access log */}
        <a href="/fcc/log" className="block bg-slate-800 rounded-xl border border-slate-700 p-4 active:bg-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Access Log</p>
              {accessLogCount === 0 ? (
                <p className="text-xs text-slate-500 italic mt-0.5">No emergency access events recorded</p>
              ) : (
                <div className="mt-0.5">
                  <p className="text-xs text-slate-400">
                    {accessLogCount} event{accessLogCount !== 1 ? 's' : ''}
                    {lastAccess && (
                      <span className="text-slate-500"> · Last: {relativeTime(lastAccess.accessed_at)}</span>
                    )}
                  </p>
                </div>
              )}
            </div>
            <span className="text-slate-500 text-sm">→</span>
          </div>
        </a>

        {/* Emergency contacts summary */}
        {contacts.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Emergency Contacts ({contacts.length})</p>
            {contacts.map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between py-1.5 ${i < contacts.length - 1 ? 'border-b border-slate-700' : ''}`}>
                <p className="text-sm">{c.name} <span className="text-xs text-slate-400">· {c.relation}</span></p>
                <a href={`tel:${c.phone.replace(/\D/g, '')}`} className="text-xs text-blue-400 font-mono shrink-0">{c.phone}</a>
              </div>
            ))}
          </div>
        )}

        {/* Simulate EMS scan */}
        <a
          href={`/fcc/${household.id}`}
          onClick={() => logEvent('fcc_simulate_scan')}
          className="block w-full bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl px-5 py-3.5 border border-blue-600 active:from-blue-800 active:to-blue-700 transition-colors text-center"
        >
          <p className="font-bold text-sm tracking-wide">Simulate EMS QR Scan →</p>
        </a>
        <p className="text-[10px] text-slate-500 text-center -mt-2">Opens the EMS view as crew would see it</p>
      </div>
    </main>
  );
}
