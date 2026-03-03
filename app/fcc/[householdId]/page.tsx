'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import {
  MOCK_HOUSEHOLD,
  type FccMember,
  type FccHousehold,
  type FccCriticalFlag,
  type FccMedication,
  type FccEmergencyContact,
  type FccFlagType,
} from '../../data/mock-fcc-household';

type Screen = 'access' | 'code_entry' | 'viewing';
type AccessMethod = 'resident_code' | 'incident_number' | 'pcr_number';

// ── Inline sub-components ──

const FLAG_COLORS: Record<FccFlagType, string> = {
  allergy: 'bg-red-900/60 text-red-300 border-red-800',
  med: 'bg-amber-900/60 text-amber-200 border-amber-800',
  equipment: 'bg-blue-900/60 text-blue-300 border-blue-800',
  safety: 'bg-green-900/60 text-green-300 border-green-800',
};

function StatusBadge({ label, type }: { label: string; type: FccFlagType }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold border tracking-wide ${FLAG_COLORS[type]}`}>
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

function MedRow({ med, isLast }: { med: FccMedication; isLast: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${isLast ? '' : 'border-b border-slate-700'}`}>
      <div>
        <span className="font-bold text-sm">{med.name}</span>
        <span className="text-xs text-slate-400 ml-1.5">{med.dose} — {med.freq}</span>
      </div>
      {med.lastDose && (
        <span className="text-xs text-green-400 font-mono shrink-0 ml-2">{med.lastDose}</span>
      )}
    </div>
  );
}

function ContactRow({ contact, isLast }: { contact: FccEmergencyContact; isLast: boolean }) {
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

// ── Main page ──

export default function FccPublicEntry() {
  const router = useRouter();
  const params = useParams();
  const householdId = params.householdId as string;

  const [screen, setScreen] = useState<Screen>('access');
  const [accessMethod, setAccessMethod] = useState<AccessMethod | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [household, setHousehold] = useState<FccHousehold | null>(null);
  const [activeMember, setActiveMember] = useState(0);
  const [expiresAt, setExpiresAt] = useState('');
  const [showPush, setShowPush] = useState(false);

  // TODO: Fetch household public info from /api/fcc/[householdId]/info
  const publicInfo = MOCK_HOUSEHOLD;

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

  const handleVerify = useCallback(() => {
    if (verifying) return;
    setError('');
    setVerifying(true);

    // TODO: Replace with POST /api/fcc/[householdId]/unlock
    setTimeout(() => {
      let valid = false;
      if (accessMethod === 'resident_code') {
        valid = codeInput === '4827';
      } else {
        valid = codeInput.length >= 4;
      }

      if (valid) {
        setHousehold(MOCK_HOUSEHOLD);
        setActiveMember(0);
        const exp = new Date(Date.now() + 4 * 60 * 60 * 1000);
        setExpiresAt(exp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setScreen('viewing');
        logEvent('fcc_ems_verified', { method: accessMethod, household: householdId });
      } else {
        setError(
          accessMethod === 'resident_code'
            ? 'Invalid code. Request code from resident or use Incident/PCR number.'
            : 'Could not verify. Try another access method or contact dispatch.'
        );
      }
      setVerifying(false);
    }, 1200);
  }, [verifying, accessMethod, codeInput, householdId]);

  // ── ACCESS SCREEN ──
  if (screen === 'access') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <div className="text-center px-4 pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-800 to-blue-600 flex items-center justify-center mx-auto mb-3 text-3xl">
            🏥
          </div>
          <p className="text-xs font-bold tracking-widest text-slate-400 font-mono">CEG.SFG.AC/FCC/{householdId}</p>
          <p className="text-xs font-bold tracking-widest text-blue-400 uppercase mt-1.5 font-mono">SFG Field Care Card</p>
          <p className="text-base font-bold mt-1.5">Delgado Household</p>
          <p className="text-xs text-slate-400 mt-0.5">{publicInfo.address.split(',').slice(0, -1).join(',')}</p>
          <p className="text-xs text-slate-400">{publicInfo.members.length} registered members</p>
        </div>

        {publicInfo.access.hazards && (
          <div className="mx-4 mb-4 bg-gradient-to-r from-red-950 to-red-900 rounded-lg px-3 py-2 flex items-center gap-2 justify-center">
            <span className="text-sm">⚠️</span>
            <span className="text-xs font-bold text-red-300">{publicInfo.access.hazards}</span>
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

          <div className="h-px bg-slate-700 my-1" />

          <button
            onClick={() => {
              logEvent('fcc_ems_temp_code_request');
              setShowPush(true);
              setTimeout(() => setShowPush(false), 8000);
              handleSelectMethod('resident_code');
            }}
            className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3.5 border border-slate-700 active:border-blue-500 transition-colors text-left"
          >
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-bold text-sm">Request Temp Code</p>
              <p className="text-xs text-slate-400">Push notification to resident&apos;s device</p>
            </div>
          </button>
        </div>

        {showPush && (
          <div className="fixed top-3 left-3 right-3 z-50 animate-slide-down">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-3.5 border border-amber-500 shadow-2xl">
              <div className="flex justify-between items-start">
                <div className="flex gap-2.5 items-start">
                  <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center text-[10px] font-extrabold text-black font-mono shrink-0">SFG</div>
                  <div>
                    <p className="text-xs font-bold">Emergency Access Requested</p>
                    <p className="text-xs text-slate-400 mt-0.5">Someone scanned your Field Care Card QR</p>
                    <div className="mt-2 bg-gray-900 rounded-md border border-green-700 px-3.5 py-2 inline-block">
                      <p className="text-[10px] text-green-400 font-semibold">TEMPORARY CODE</p>
                      <p className="text-xl font-extrabold tracking-[0.3em] font-mono">7741</p>
                      <p className="text-[9px] text-slate-400">Expires in 4 hours</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowPush(false)} className="text-slate-400 text-base leading-none active:text-slate-300">×</button>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 pb-8 text-center">
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

  // ── CODE ENTRY SCREEN ──
  if (screen === 'code_entry') {
    const methodConfig: Record<AccessMethod, { icon: string; label: string; desc: string; placeholder: string; maxLen: number; isBig: boolean }> = {
      resident_code: { icon: '🔑', label: 'Resident Code', desc: 'Code provided by resident or dispatch', placeholder: '• • • •', maxLen: 4, isBig: true },
      incident_number: { icon: '📋', label: 'Incident Number', desc: 'From your CAD dispatch sheet', placeholder: 'INC-2026-', maxLen: 14, isBig: false },
      pcr_number: { icon: '📄', label: 'PCR Number', desc: 'Patient Care Report number', placeholder: 'PCR-', maxLen: 14, isBig: false },
    };

    const method = accessMethod!;
    const config = methodConfig[method];

    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => { setScreen('access'); setError(''); setCodeInput(''); }}
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
              inputMode={method === 'resident_code' ? 'numeric' : 'text'}
              value={codeInput}
              onChange={(e) => {
                const val = method === 'resident_code'
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
              disabled={codeInput.length < 4 || verifying}
              className={`w-full mt-4 rounded-lg px-4 py-3.5 font-bold text-sm transition-all ${
                codeInput.length >= 4
                  ? 'bg-blue-600 text-white active:bg-blue-700'
                  : 'bg-slate-900 text-slate-500'
              } disabled:opacity-60`}
            >
              {verifying ? 'Verifying...' : 'Unlock Field Care Card'}
            </button>

            <p className="text-xs text-slate-500 text-center mt-3 italic">
              Access expires in 4 hours · All access is logged
            </p>

            {method === 'resident_code' && (
              <p className="text-xs text-slate-600 text-center mt-1.5">Demo code: 4827</p>
            )}
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
  if (!household) return null;

  const member: FccMember = household.members[activeMember];
  const isDNR = member.codeStatus.includes('DNR');

  return (
    <main className="min-h-screen bg-slate-900 text-white pb-8">
      <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏥</span>
          <span className="text-xs font-bold tracking-wider font-mono">EMS ACCESS — READ ONLY</span>
        </div>
        <span className="text-xs text-blue-200 font-mono">Expires {expiresAt}</span>
      </div>

      {isDNR ? (
        <div className="bg-gradient-to-r from-red-950 to-red-900 px-4 py-2.5 text-center">
          <p className="text-sm font-extrabold tracking-wider font-mono">⚠ DNR / POLST ON FILE</p>
          <p className="text-xs text-red-300 mt-0.5">{member.directiveLocation}</p>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-900 to-green-800 px-4 py-2.5 text-center">
          <p className="text-sm font-extrabold tracking-wider font-mono">✓ FULL CODE</p>
        </div>
      )}

      <div className="flex bg-gray-900 border-b border-slate-800">
        {household.members.map((m: FccMember, i: number) => (
          <button
            key={m.id}
            onClick={() => setActiveMember(i)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              i === activeMember
                ? 'bg-slate-800 border-b-2 border-amber-500 text-white'
                : 'text-slate-400'
            }`}
          >
            {m.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="px-4">
        <SectionHeader icon="👤" title="Identification" color="text-blue-400" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <p><span className="text-slate-400">Name:</span> <span className="font-semibold">{member.name}</span></p>
          <p><span className="text-slate-400">DOB:</span> <span className="font-semibold">{member.dob}</span></p>
          <p className="col-span-2"><span className="text-slate-400">Baseline:</span> <span className="font-semibold">{member.baseline}</span></p>
          <p><span className="text-slate-400">Language:</span> <span className="font-semibold">{member.language}</span></p>
        </div>

        {member.criticalFlags.length > 0 && (
          <>
            <SectionHeader icon="🚨" title="Critical Flags" color="text-red-400" />
            <div className="bg-gradient-to-br from-red-950/60 to-red-950/30 border border-red-800 rounded-lg p-3">
              <div className="flex flex-wrap gap-1.5">
                {member.criticalFlags.map((flag: FccCriticalFlag) => (
                  <StatusBadge key={flag.flag} label={flag.flag} type={flag.type} />
                ))}
              </div>
            </div>
          </>
        )}

        <SectionHeader icon="💊" title="Current Medications" color="text-amber-500" />
        <div className="bg-gray-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="px-3">
            {member.medications.map((med: FccMedication, i: number) => (
              <MedRow key={med.name} med={med} isLast={i === member.medications.length - 1} />
            ))}
          </div>
        </div>

        <SectionHeader icon="📋" title="Relevant History" color="text-violet-400" />
        <div className="flex flex-wrap gap-1.5">
          {member.history.map((h: string) => (
            <HistoryBadge key={h} label={h} />
          ))}
        </div>

        <SectionHeader icon="🚶" title="Mobility &amp; Movement Plan" color="text-green-400" />
        <div className="bg-gray-900 rounded-lg border border-slate-800 p-3 text-xs space-y-1.5">
          <p><span className="text-green-400 font-bold">Status:</span> {member.mobility.status}</p>
          <p><span className="text-green-400 font-bold">Lift:</span> {member.mobility.liftMethod}</p>
          {member.mobility.precautions !== 'None' && (
            <p><span className="text-amber-400 font-bold">Precaution:</span> {member.mobility.precautions}</p>
          )}
          {member.mobility.pain !== 'None' && (
            <p><span className="text-slate-400 font-bold">Pain:</span> {member.mobility.pain}</p>
          )}
          {member.mobility.stairChair.startsWith('Yes') && (
            <p><span className="text-red-400 font-bold">⚠ Stair chair required:</span> {household.access.stairInfo}</p>
          )}
        </div>

        {member.equipment.length > 0 && (
          <>
            <SectionHeader icon="🔧" title="Equipment &amp; Life Support" color="text-pink-400" />
            <div className="bg-gray-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3">
                {member.equipment.map((eq, i) => (
                  <div key={eq.item} className={`flex justify-between py-2 text-xs ${i < member.equipment.length - 1 ? 'border-b border-slate-800' : ''}`}>
                    <span className="font-semibold">{eq.item}</span>
                    <span className="text-slate-400">{eq.location}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <SectionHeader icon="🚪" title="Access &amp; Hazards" color="text-amber-400" />
        <div className="bg-gray-900 rounded-lg border border-slate-800 p-3 text-xs space-y-1">
          <p><span className="text-amber-400 font-bold">Door:</span> {household.access.bestDoor}</p>
          <p><span className="text-amber-400 font-bold">Gate:</span> {household.access.gateCode}</p>
          <p><span className="text-amber-400 font-bold">Animals:</span> {household.access.dogs}</p>
          {household.access.hazards && (
            <div className="mt-2 bg-red-900/60 rounded px-2.5 py-1.5 font-semibold text-red-300">
              ⚠ {household.access.hazards}
            </div>
          )}
        </div>

        <SectionHeader icon="❤️" title="Life Needs" color="text-orange-400" />
        <div className="bg-gray-900 rounded-lg border border-slate-800 p-3">
          {member.lifeNeeds.map((need: string) => (
            <p key={need} className="text-xs py-1 flex gap-2">
              <span className="text-orange-400">•</span> {need}
            </p>
          ))}
        </div>

        <SectionHeader icon="📞" title="Emergency Contacts" color="text-blue-400" />
        <div className="px-1">
          {household.emergencyContacts.map((c: FccEmergencyContact, i: number) => (
            <ContactRow key={c.phone} contact={c} isLast={i === household.emergencyContacts.length - 1} />
          ))}
        </div>
      </div>

      <div className="px-4 mt-6 flex gap-2 border-t border-slate-800 pt-3">
        <button
          onClick={() => { setScreen('access'); setHousehold(null); setCodeInput(''); setError(''); }}
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
