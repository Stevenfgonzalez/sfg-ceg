'use client';

import { useState, useEffect, useCallback } from 'react';
import { logEvent } from '@/lib/analytics';
import QRCode from 'qrcode';
import { MOCK_HOUSEHOLD } from '../../data/mock-fcc-household';

type PrintFormat = 'magnet' | 'wallet' | 'binder';

export default function FCCPrintPage() {
  const [format, setFormat] = useState<PrintFormat>('magnet');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const household = MOCK_HOUSEHOLD;
  const householdId = household.householdId;

  const generateQR = useCallback(async () => {
    try {
      const url = await QRCode.toDataURL(`https://ceg.sfg.ac/fcc/${householdId}`, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      // QR generation failed
    }
  }, [householdId]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  const formats: { key: PrintFormat; label: string; size: string; desc: string }[] = [
    { key: 'magnet', label: '4×6 Fridge Magnet', size: '4" × 6"', desc: 'Most visible — put on fridge or front door' },
    { key: 'wallet', label: '2.5×3.5 Wallet Card', size: '2.5" × 3.5"', desc: 'Carry in purse or wallet — give to caregiver' },
    { key: 'binder', label: '8.5×11 Binder Sheet', size: '8.5" × 11"', desc: 'Full detail — keep in emergency binder' },
  ];

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800 print:hidden">
        <a
          href="/fcc"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">Print Formats</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8 print:hidden">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Print Artifacts</p>
          <p className="text-xs text-slate-400 mt-1">Choose a format for physical placement</p>
        </div>

        {/* Format selector */}
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
          onClick={() => {
            logEvent('fcc_print', { format });
            window.print();
          }}
          className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors"
        >
          Print {formats.find((f) => f.key === format)?.label}
        </button>
      </div>

      {/* Print preview — always rendered, shown on screen and in print */}
      <div className="px-4 py-4">
        {format === 'magnet' && (
          <div className="bg-white text-black rounded-xl p-6 max-w-[4in] mx-auto print:shadow-none print:rounded-none print:max-w-full" style={{ minHeight: '6in' }}>
            <p className="text-[10px] font-extrabold tracking-widest text-amber-700 uppercase font-mono">Safety For Generations</p>
            <p className="text-lg font-extrabold text-black mt-0.5">Field Care Card</p>

            <div className="border-y-2 border-black py-2 my-3">
              <p className="text-sm font-bold">Delgado Household</p>
              <p className="text-[10px] text-gray-600">{household.address}</p>
              <p className="text-[10px] text-gray-600">{household.members.length} registered members</p>
            </div>

            <div className="flex justify-center my-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" width={160} height={160} className="border-2 border-black rounded-lg" />
              ) : (
                <div className="w-[160px] h-[160px] bg-gray-100 border-2 border-black rounded-lg" />
              )}
            </div>

            <p className="text-center text-xs font-extrabold font-mono tracking-wide">CEG.SFG.AC/FCC/{householdId}</p>
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

            {household.access.hazards && (
              <div className="bg-red-50 rounded-lg p-2 border border-red-400 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <p className="text-[10px] font-bold text-red-800">{household.access.hazards}</p>
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
              <p className="text-xs font-bold mt-1">Delgado Household</p>
              <p className="text-[9px] text-gray-600">{household.address}</p>
              <p className="text-[9px] text-gray-600">{household.members.length} members</p>

              <div className="flex justify-center my-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR" width={100} height={100} className="border border-black rounded" />
                ) : (
                  <div className="w-[100px] h-[100px] bg-gray-100 border border-black rounded" />
                )}
              </div>

              <p className="text-center text-[8px] font-bold font-mono">CEG.SFG.AC/FCC/{householdId}</p>

              {household.access.hazards && (
                <p className="text-center text-[8px] font-bold text-red-600 mt-2">⚠ {household.access.hazards}</p>
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

              <div className="border-t border-gray-300 mt-3 pt-2">
                <p className="text-[8px] font-bold text-gray-600 uppercase mb-1">Emergency Contacts</p>
                {household.emergencyContacts.map((c) => (
                  <p key={c.phone} className="text-[9px]">{c.name} — {c.phone}</p>
                ))}
              </div>

              <p className="text-center text-[7px] text-gray-400 mt-3 font-mono">
                Not a medical record · safetyforgenerations.com
              </p>
            </div>
          </div>
        )}

        {format === 'binder' && (
          <div className="bg-white text-black rounded-xl p-6 max-w-2xl mx-auto print:shadow-none print:rounded-none print:max-w-full text-[11px] leading-relaxed">
            <div className="border-b-2 border-black pb-3 mb-4">
              <p className="text-center text-xs font-extrabold tracking-widest uppercase">Safety For Generations — Field Care Card</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[9px] text-gray-500 uppercase font-mono">Household</p>
                <p className="font-bold">Delgado Household</p>
                <p>{household.address}</p>
                <p>{household.members.length} registered members</p>
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

            {household.access.hazards && (
              <div className="bg-red-50 border border-red-400 rounded px-3 py-2 mb-4 font-bold text-red-800">
                ⚠ HAZARDS: {household.access.hazards}
              </div>
            )}

            {household.members.map((member) => (
              <div key={member.id} className="border-t-2 border-black pt-3 mt-4">
                <p className="font-bold text-sm uppercase tracking-wide">
                  {member.name} <span className="font-normal text-gray-500 ml-2">DOB: {member.dob}</span>
                </p>
                <div className="grid grid-cols-2 gap-x-4 mt-1">
                  <p>Code Status: <strong>{member.codeStatus}</strong></p>
                  <p>Language: {member.language}</p>
                  <p className="col-span-2">Baseline: {member.baseline}</p>
                  {member.directiveLocation && <p className="col-span-2">Directive: {member.directiveLocation}</p>}
                </div>

                {member.criticalFlags.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold text-[10px] uppercase text-red-700">Critical Flags</p>
                    {member.criticalFlags.map((f) => (
                      <p key={f.flag}>• {f.flag} ({f.type})</p>
                    ))}
                  </div>
                )}

                <div className="mt-2">
                  <p className="font-bold text-[10px] uppercase text-gray-600">Medications</p>
                  {member.medications.map((m) => (
                    <p key={m.name}>{m.name} — {m.dose} — {m.freq}</p>
                  ))}
                </div>

                <div className="mt-2">
                  <p className="font-bold text-[10px] uppercase text-gray-600">History</p>
                  <p>{member.history.join(', ')}</p>
                </div>

                <div className="mt-2">
                  <p className="font-bold text-[10px] uppercase text-gray-600">Mobility</p>
                  <p>Status: {member.mobility.status} | Lift: {member.mobility.liftMethod}</p>
                  {member.mobility.precautions !== 'None' && <p>Precautions: {member.mobility.precautions}</p>}
                  {member.mobility.stairChair.startsWith('Yes') && <p>Stair Chair: {member.mobility.stairChair}</p>}
                </div>

                {member.equipment.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold text-[10px] uppercase text-gray-600">Equipment</p>
                    {member.equipment.map((e) => (
                      <p key={e.item}>{e.item} — {e.location}</p>
                    ))}
                  </div>
                )}

                {member.lifeNeeds.length > 0 && (
                  <div className="mt-2">
                    <p className="font-bold text-[10px] uppercase text-gray-600">Life Needs</p>
                    {member.lifeNeeds.map((n) => (
                      <p key={n}>• {n}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="border-t-2 border-black pt-3 mt-4">
              <p className="font-bold text-[10px] uppercase text-gray-600">Access Information</p>
              <p>Best Entry: {household.access.bestDoor}</p>
              <p>Gate Code: {household.access.gateCode}</p>
              <p>Animals: {household.access.dogs}</p>
              <p>Stairs: {household.access.stairInfo}</p>
              <p>AED: {household.access.aed}</p>
              <p>Backup Power: {household.access.backupPower}</p>
            </div>

            <div className="border-t-2 border-black pt-3 mt-4">
              <p className="font-bold text-[10px] uppercase text-gray-600">Emergency Contacts</p>
              {household.emergencyContacts.map((c) => (
                <p key={c.phone}>{c.name} — {c.relation} — {c.phone}</p>
              ))}
            </div>

            <div className="border-t border-gray-300 mt-4 pt-2 text-center text-[9px] text-gray-400">
              User-entered emergency summary. Not a medical record. This document does not replace clinical assessment.<br/>
              SAFETYFORGENERATIONS.COM
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @media print {
          main { background: white !important; color: black !important; min-height: auto !important; }
        }
      `}</style>
    </main>
  );
}
