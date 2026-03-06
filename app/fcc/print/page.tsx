'use client';

import { useState, useEffect, useCallback } from 'react';
import { logEvent } from '@/lib/analytics';
import QRCode from 'qrcode';

type PrintFormat = 'magnet' | 'wallet' | 'binder';

interface Member {
  id: string;
  full_name: string;
  date_of_birth: string;
  photo_url?: string | null;
  baseline_mental: string | null;
  primary_language: string;
  code_status: string;
  directive_location: string | null;
  fcc_member_clinical?: Clinical | Clinical[];
}

interface Clinical {
  critical_flags: { flag: string; type: string }[];
  medications: { name: string; dose: string; freq: string; last_dose: string }[];
  history: string[];
  mobility_status: string | null;
  lift_method: string | null;
  precautions: string | null;
  pain_notes: string | null;
  stair_chair_needed: boolean;
  equipment: { item: string; location: string }[];
  life_needs: string[];
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

function getClinical(m: Member): Clinical {
  const c = m.fcc_member_clinical;
  if (!c) return emptyClinical();
  if (Array.isArray(c)) return c[0] || emptyClinical();
  return c;
}

function emptyClinical(): Clinical {
  return { critical_flags: [], medications: [], history: [], mobility_status: null, lift_method: null, precautions: null, pain_notes: null, stair_chair_needed: false, equipment: [], life_needs: [] };
}

export default function FCCPrintPage() {
  const [format, setFormat] = useState<PrintFormat>('magnet');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fcc/household');
        const data = await res.json();
        setHousehold(data.household || null);
      } catch {
        // fetch failed — handled by !household check below
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const generateQR = useCallback(async () => {
    if (!household) return;
    try {
      const url = await QRCode.toDataURL(`https://ceg.sfg.ac/fcc/${household.id}`, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      // QR generation failed
    }
  }, [household]);

  useEffect(() => {
    if (household) generateQR();
  }, [household, generateQR]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!household) {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/fcc" aria-label="Back to dashboard" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Print Formats</h1>
        </header>
        <div className="px-4 pt-8 text-center">
          <p className="text-sm text-slate-400">Create a household first to generate print cards.</p>
          <a href="/fcc/edit" className="inline-block mt-4 bg-amber-600 rounded-lg px-6 py-3 text-sm font-bold text-black">Get Started</a>
        </div>
      </main>
    );
  }

  const address = [household.address_line1, household.address_line2].filter(Boolean).join(', ') + `, ${household.city}, ${household.state} ${household.zip}`;
  const members = household.fcc_members || [];
  const contacts = household.fcc_emergency_contacts || [];
  const shortId = household.id.slice(0, 8);

  const formats: { key: PrintFormat; label: string; size: string; desc: string }[] = [
    { key: 'magnet', label: '4×6 Fridge Magnet', size: '4" × 6"', desc: 'Most visible — put on fridge or front door' },
    { key: 'wallet', label: '2.5×3.5 Wallet Card', size: '2.5" × 3.5"', desc: 'Carry in purse or wallet — give to caregiver' },
    { key: 'binder', label: '8.5×11 Binder Sheet', size: '8.5" × 11"', desc: 'Full detail — keep in emergency binder' },
  ];

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800 print:hidden">
        <a href="/fcc" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Print Formats</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8 print:hidden">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Print Artifacts</p>
          <p className="text-xs text-slate-400 mt-1">Choose a format for physical placement</p>
        </div>

        <div className="space-y-2">
          {formats.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={`w-full text-left rounded-xl px-4 py-3.5 border transition-colors ${
                format === f.key
                  ? 'bg-blue-900/50 border-blue-500'
                  : 'bg-slate-800 border-slate-700 active:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.desc}</p>
                </div>
                <span className="text-xs text-slate-500 font-mono shrink-0 ml-2">{f.size}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => { logEvent('fcc_print', { format }); window.print(); }}
          className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors"
        >
          Print {formats.find((f) => f.key === format)?.label}
        </button>
      </div>

      {/* Print preview */}
      <div className="px-4 py-4">
        {format === 'magnet' && (
          <div className="bg-white text-black rounded-xl p-6 max-w-[4in] mx-auto print:shadow-none print:rounded-none print:max-w-full" style={{ minHeight: '6in' }}>
            <p className="text-[10px] font-extrabold tracking-widest text-amber-700 uppercase font-mono">SafetyForGenerations.com</p>
            <p className="text-lg font-extrabold text-black mt-0.5">Field Care Card</p>

            <div className="border-y-2 border-black py-2 my-3">
              <p className="text-sm font-bold">{household.name}</p>
              <p className="text-[10px] text-gray-600">{address}</p>
              <p className="text-[10px] text-gray-600">{household.member_count} registered member{household.member_count !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex justify-center my-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" width={160} height={160} className="border-2 border-black rounded-lg" />
              ) : (
                <div className="w-[160px] h-[160px] bg-gray-100 border-2 border-black rounded-lg" />
              )}
            </div>

            <p className="text-center text-xs font-extrabold font-mono tracking-wide">CEG.SFG.AC/FCC/{shortId}</p>
            <p className="text-center text-[9px] text-gray-600 mt-0.5">Scan QR or tap NFC with phone</p>

            <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-400 my-3">
              <p className="text-[9px] font-extrabold text-amber-800 uppercase tracking-wider font-mono mb-1">For Responding Personnel</p>
              <div className="text-[10px] text-amber-900 leading-relaxed">
                <p>1. Scan QR or tap NFC</p>
                <p>2. Enter one of:</p>
                <p className="font-bold ml-3">· Resident code (from dispatch)</p>
                <p className="font-bold ml-3">· Incident number (from CAD)</p>
                <p className="font-bold ml-3">· PCR number</p>
                <p>3. View care profiles</p>
              </div>
            </div>

            {household.hazards && (
              <div className="bg-red-50 rounded-lg p-2 border border-red-400 flex items-center gap-2">
                <p className="text-[10px] font-bold text-red-800">⚠ {household.hazards}</p>
              </div>
            )}

            <p className="text-center text-[8px] text-gray-400 mt-3 font-mono">
              User-entered emergency summary · Not a medical record<br/>SAFETYFORGENERATIONS.COM
            </p>
          </div>
        )}

        {format === 'wallet' && (
          <div className="space-y-4 max-w-[2.5in] mx-auto">
            {/* Front */}
            <div className="bg-white text-black rounded-lg p-3 print:shadow-none" style={{ minHeight: '3.5in' }}>
              <p className="text-[8px] font-extrabold tracking-widest text-amber-700 uppercase font-mono">SFG Field Care Card</p>
              <p className="text-xs font-bold mt-1">{household.name}</p>
              <p className="text-[9px] text-gray-600">{address}</p>
              <p className="text-[9px] text-gray-600">{household.member_count} member{household.member_count !== 1 ? 's' : ''}</p>

              <div className="flex justify-center my-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR" width={100} height={100} className="border border-black rounded" />
                ) : (
                  <div className="w-[100px] h-[100px] bg-gray-100 border border-black rounded" />
                )}
              </div>

              <p className="text-center text-[8px] font-bold font-mono">CEG.SFG.AC/FCC/{shortId}</p>

              {household.hazards && (
                <p className="text-center text-[8px] font-bold text-red-600 mt-2">⚠ {household.hazards}</p>
              )}
            </div>

            {/* Back */}
            <div className="bg-white text-black rounded-lg p-3 print:shadow-none" style={{ minHeight: '3.5in' }}>
              <p className="text-[8px] font-extrabold tracking-widest text-gray-600 uppercase font-mono mb-2">For EMS / Fire / Rescue</p>
              <div className="text-[9px] leading-relaxed space-y-1">
                <p>1. Scan QR or tap NFC</p>
                <p>2. Enter access code:</p>
                <p className="ml-2">· Resident code</p>
                <p className="ml-2">· Incident number</p>
                <p className="ml-2">· PCR number</p>
                <p>3. View care profiles</p>
              </div>

              {contacts.length > 0 && (
                <div className="border-t border-gray-300 mt-3 pt-2">
                  <p className="text-[8px] font-bold text-gray-600 uppercase mb-1">Emergency Contacts</p>
                  {contacts.map((c) => (
                    <p key={c.id} className="text-[9px]">{c.name} — {c.phone}</p>
                  ))}
                </div>
              )}

              <p className="text-center text-[7px] text-gray-400 mt-3 font-mono">
                Not a medical record · SAFETYFORGENERATIONS.COM
              </p>
            </div>
          </div>
        )}

        {format === 'binder' && (
          <div className="bg-white text-black rounded-xl p-6 max-w-2xl mx-auto print:shadow-none print:rounded-none print:max-w-full text-[11px] leading-relaxed">
            <div className="border-b-2 border-black pb-3 mb-4">
              <p className="text-center text-xs font-extrabold tracking-widest uppercase">SafetyForGenerations.com — Field Care Card</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-mono">Household</p>
                <p className="font-bold">{household.name}</p>
                <p>{address}</p>
                <p>{household.member_count} registered member{household.member_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex justify-end">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR" width={80} height={80} className="border border-black rounded" />
                ) : (
                  <div className="w-[80px] h-[80px] bg-gray-100 border border-black rounded" />
                )}
              </div>
            </div>

            {household.hazards && (
              <div className="bg-red-50 border border-red-400 rounded px-3 py-2 mb-4 font-bold text-red-800">
                ⚠ HAZARDS: {household.hazards}
              </div>
            )}

            {members.map((member, idx) => {
              const clinical = getClinical(member);
              return (
                <div key={member.id} className={`border-t-2 border-black pt-3 mt-4 ${idx > 0 ? 'print:break-before-page' : ''}`} style={{ breakInside: 'avoid' }}>
                  <div className="flex items-center gap-3">
                    {member.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.photo_url} alt="" className="w-[60px] h-[60px] rounded-lg object-cover border border-gray-400 shrink-0" />
                    )}
                    <p className="font-bold text-sm uppercase tracking-wide">
                      {member.full_name} <span className="font-normal text-gray-500 ml-2">DOB: {member.date_of_birth} (Age {calcAge(member.date_of_birth)})</span>
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 mt-1">
                    <p>Code Status: <strong>{CODE_STATUS_LABELS[member.code_status] || member.code_status}</strong></p>
                    <p>Language: {member.primary_language}</p>
                    {member.baseline_mental && <p className="col-span-2">Baseline: {member.baseline_mental}</p>}
                    {member.directive_location && <p className="col-span-2">Directive: {member.directive_location}</p>}
                  </div>

                  {clinical.critical_flags.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-red-700">Critical Flags</p>
                      {clinical.critical_flags.map((f) => (
                        <p key={f.flag}>• {f.flag} ({f.type})</p>
                      ))}
                    </div>
                  )}

                  {clinical.medications.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-gray-600">Medications</p>
                      {clinical.medications.map((m, i) => (
                        <p key={i}>{m.name} — {m.dose} — {m.freq}</p>
                      ))}
                    </div>
                  )}

                  {clinical.history.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-gray-600">History</p>
                      <p>{clinical.history.join(', ')}</p>
                    </div>
                  )}

                  {(clinical.mobility_status || clinical.lift_method) && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-gray-600">Mobility</p>
                      <p>
                        {clinical.mobility_status && `Status: ${clinical.mobility_status}`}
                        {clinical.lift_method && ` | Lift: ${clinical.lift_method}`}
                      </p>
                      {clinical.precautions && <p>Precautions: {clinical.precautions}</p>}
                      {clinical.stair_chair_needed && <p>Stair Chair: Required</p>}
                    </div>
                  )}

                  {clinical.equipment.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-gray-600">Equipment</p>
                      {clinical.equipment.map((e, i) => (
                        <p key={i}>{e.item} — {e.location}</p>
                      ))}
                    </div>
                  )}

                  {clinical.life_needs.length > 0 && (
                    <div className="mt-2">
                      <p className="font-bold text-[10px] uppercase text-gray-600">Life Needs</p>
                      {clinical.life_needs.map((n, i) => (
                        <p key={i}>• {n}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="border-t-2 border-black pt-3 mt-4">
              <p className="font-bold text-[10px] uppercase text-gray-600">Access Information</p>
              {household.best_door && <p>Best Entry: {household.best_door}</p>}
              {household.gate_code && <p>Gate Code: {household.gate_code}</p>}
              {household.animals && <p>Animals: {household.animals}</p>}
              {household.stair_info && <p>Stairs: {household.stair_info}</p>}
              <p>AED: {household.aed_onsite ? 'Yes — on site' : 'No'}</p>
              {household.backup_power && <p>Backup Power: {household.backup_power}</p>}
            </div>

            {contacts.length > 0 && (
              <div className="border-t-2 border-black pt-3 mt-4">
                <p className="font-bold text-[10px] uppercase text-gray-600">Emergency Contacts</p>
                {contacts.map((c) => (
                  <p key={c.id}>{c.name} — {c.relation} — {c.phone}</p>
                ))}
              </div>
            )}

            <div className="border-t border-gray-300 mt-4 pt-2 text-center text-[9px] text-gray-400">
              User-entered emergency summary. Not a medical record. This document does not replace clinical assessment.<br/>
              SAFETYFORGENERATIONS.COM
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @media print {
          main {
            background: white !important;
            color: black !important;
            min-height: auto !important;
            padding: 0 !important;
          }
          /* Hide everything except the print preview */
          main > div:first-of-type { padding: 0 !important; }
        }
        @media print and (orientation: portrait) {
          @page { margin: 0.25in; }
        }
      `}</style>
    </main>
  );
}
