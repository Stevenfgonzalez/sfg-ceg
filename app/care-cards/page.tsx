'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import QRCode from 'qrcode';
import { MOCK_HOUSEHOLD } from '../data/mock-fcc-household';

type Screen = 'dashboard' | 'print_qr';

export default function CareCardsPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [showCode, setShowCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const household = MOCK_HOUSEHOLD;

  const generateQR = useCallback(async () => {
    try {
      const url = await QRCode.toDataURL('https://ceg.sfg.ac/fcc-ems', {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      // QR generation failed silently
    }
  }, []);

  useEffect(() => {
    if (screen === 'print_qr' && !qrDataUrl) {
      generateQR();
    }
  }, [screen, qrDataUrl, generateQR]);

  // ── PRINT QR SCREEN ──
  if (screen === 'print_qr') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        {/* Top bar */}
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800 print:hidden">
          <button
            onClick={() => setScreen('dashboard')}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">Print QR Card</h1>
        </header>

        <div className="px-4 pt-3 text-center print:hidden">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Print Preview</p>
          <p className="text-xs text-slate-400 mt-1">QR card for fridge, door, or binder</p>
        </div>

        {/* Printable card */}
        <div className="px-4 py-4">
          <div className="bg-white text-black rounded-xl p-5 max-w-xs mx-auto print:shadow-none print:rounded-none print:max-w-full">
            {/* Card header */}
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-amber-700 uppercase font-mono">Safety For Generations</p>
                <p className="text-base font-extrabold text-black mt-0.5">Field Care Card</p>
              </div>
              <p className="text-[9px] font-bold text-red-600 text-right leading-snug font-mono">EMERGENCY<br/>USE ONLY</p>
            </div>

            {/* Household info */}
            <div className="border-y-2 border-black py-2 mb-3">
              <p className="text-sm font-bold">Delgado Household</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{household.address}</p>
              <p className="text-[10px] text-gray-600">{household.members.length} registered members</p>
            </div>

            {/* QR code */}
            <div className="flex justify-center mb-3">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code — scan to access care card" width={140} height={140} className="border-2 border-black rounded-lg" />
              ) : (
                <div className="w-[140px] h-[140px] bg-gray-100 border-2 border-black rounded-lg flex flex-col items-center justify-center">
                  <span className="text-3xl mb-1">📱</span>
                  <span className="text-[8px] font-bold text-gray-600 font-mono">SCAN WITH PHONE</span>
                </div>
              )}
            </div>

            {/* URL */}
            <div className="text-center mb-3">
              <p className="text-xs font-extrabold text-black font-mono tracking-wide">CEG.SFG.AC/FCC-EMS</p>
              <p className="text-[9px] text-gray-600 mt-0.5">Scan QR or visit URL · Enter access code</p>
            </div>

            {/* EMS instructions */}
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

            {/* Hazard warning */}
            {household.access.hazards && (
              <div className="bg-red-50 rounded-lg p-2 border border-red-400 flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <p className="text-[10px] font-bold text-red-800">{household.access.hazards}</p>
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-[8px] text-gray-400 mt-3 font-mono leading-snug">
              User-entered emergency summary · Not a medical record<br/>SAFETYFORGENERATIONS.COM
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 max-w-xs mx-auto print:hidden">
            <button
              onClick={() => {
                logEvent('fcc_print_qr');
                window.print();
              }}
              className="flex-1 bg-amber-600 rounded-lg px-4 py-3 text-sm font-bold text-black active:bg-amber-700 transition-colors"
            >
              Print Card
            </button>
            <button
              className="flex-1 bg-slate-800 rounded-lg px-4 py-3 text-sm font-semibold border border-slate-700 active:bg-slate-700 transition-colors"
            >
              Save PDF
            </button>
          </div>
        </div>

        {/* Print styles */}
        <style jsx>{`
          @media print {
            main {
              background: white !important;
              color: black !important;
              min-height: auto !important;
            }
          }
        `}</style>
      </main>
    );
  }

  // ── DASHBOARD SCREEN ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Top bar */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">Field Care Cards</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        {/* Title */}
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Field Care Cards</p>
          <p className="text-xs text-slate-400 mt-1">Household Emergency Profiles</p>
        </div>

        {/* Household card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-base">Delgado Household</p>
              <p className="text-xs text-slate-400 mt-0.5">{household.address}</p>
              <p className="text-xs text-slate-400 mt-0.5">{household.members.length} members registered</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-[10px] font-extrabold text-black font-mono shrink-0">
              QR
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <a
              href="/fcc-ems"
              onClick={() => logEvent('fcc_owner_view')}
              className="flex-1 bg-amber-600 rounded-lg px-3 py-2.5 text-xs font-bold text-black text-center active:bg-amber-700 transition-colors"
            >
              View / Edit Profiles
            </a>
            <button
              onClick={() => {
                logEvent('fcc_open_print');
                setScreen('print_qr');
              }}
              className="flex-1 bg-gray-900 rounded-lg px-3 py-2.5 text-xs font-semibold border border-slate-700 text-center active:bg-slate-800 transition-colors"
            >
              Print QR Card
            </button>
          </div>
        </div>

        {/* Permanent access code */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="font-bold text-sm">Your Permanent Access Code</p>
          <p className="text-xs text-slate-400 mt-0.5">Give this to dispatch when you call 911</p>
          <button
            onClick={() => {
              setShowCode(!showCode);
              logEvent('fcc_toggle_code', { visible: !showCode });
            }}
            className={`w-full mt-3 rounded-lg px-4 py-3.5 font-extrabold transition-all ${
              showCode
                ? 'bg-gradient-to-r from-green-900 to-green-800 border border-green-700 text-3xl tracking-[0.3em] font-mono text-white'
                : 'bg-gray-900 border border-slate-600 text-sm tracking-wider text-amber-500 font-mono'
            }`}
          >
            {showCode ? '4 8 2 7' : 'Tap to Reveal Code'}
          </button>
        </div>

        {/* Access log */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="font-bold text-sm mb-2.5">Access Log</p>
          <p className="text-xs text-slate-500 italic">No emergency access events recorded</p>
        </div>

        {/* Simulate EMS scan */}
        <a
          href="/fcc-ems"
          onClick={() => logEvent('fcc_simulate_scan')}
          className="block w-full bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl px-5 py-3.5 border border-blue-600 active:from-blue-800 active:to-blue-700 transition-colors text-center"
        >
          <p className="font-bold text-sm tracking-wide">Simulate EMS QR Scan →</p>
        </a>
        <p className="text-[10px] text-slate-500 text-center -mt-2">Opens CEG.SFG.AC/FCC-EMS as crew would see it</p>
      </div>
    </main>
  );
}
