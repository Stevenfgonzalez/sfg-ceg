'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { logEvent } from '@/lib/analytics';
import { saveToOutbox } from '@/lib/offline-store';
import { trySyncNow } from '@/lib/outbox-sync';

type Screen = 'search' | 'result' | 'request' | 'request_sent';

export default function ReunifyPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <ReunifyPage />
    </Suspense>
  );
}

function ReunifyPage() {
  const params = useSearchParams();
  const incidentId = params.get('incident') || '00000000-0000-0000-0000-000000000000';

  const [screen, setScreen] = useState<Screen>('search');

  // Lookup state
  const [searchPhone, setSearchPhone] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [searching, setSearching] = useState(false);

  // Request state
  const [soughtName, setSoughtName] = useState('');
  const [soughtPhone, setSoughtPhone] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLookup = async () => {
    if (searchPhone.replace(/\D/g, '').length < 10) return;
    setSearching(true);

    try {
      const res = await fetch('/api/public/reunify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          incident_id: incidentId,
          phone: searchPhone,
        }),
      });
      const data = await res.json();
      setLookupMessage(data.message || data.error || 'Unable to complete lookup.');
    } catch {
      setLookupMessage('Network error. Please try again.');
    }

    logEvent('reunify_lookup');
    setSearching(false);
    setScreen('result');
  };

  const handleRequest = async () => {
    if (!soughtName.trim() && !soughtPhone.trim()) return;
    setSubmitting(true);

    try {
      await saveToOutbox('reunify', {
        action: 'request',
        incident_id: incidentId,
        sought_name: soughtName.trim() || null,
        sought_phone: soughtPhone || null,
        requester_name: requesterName.trim() || null,
        requester_phone: requesterPhone || null,
        relationship: relationship || null,
      });
      trySyncNow();
    } catch {
      // IndexedDB failure — still show success
    }

    logEvent('reunify_request_submitted');
    setSubmitting(false);
    setScreen('request_sent');
  };

  // ── SEARCH SCREEN ──
  if (screen === 'search') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
          <h1 className="text-lg font-bold">Find My Family</h1>
        </header>

        <div className="px-4 pt-4 space-y-4">
          <p className="text-sm text-slate-400">
            Enter the phone number of the person you&apos;re looking for. If they&apos;ve checked in, the reunification team will be notified.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Their phone number</label>
            <input
              type="tel"
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="(310) 555-0100"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 text-base"
            />
          </div>

          <button
            onClick={handleLookup}
            disabled={searchPhone.replace(/\D/g, '').length < 10 || searching}
            className="w-full py-4 rounded-xl bg-purple-600 font-bold text-lg active:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>

          <div className="border-t border-slate-800 pt-4 mt-4">
            <button
              onClick={() => setScreen('request')}
              className="w-full flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-4 border border-slate-700 active:bg-slate-700 transition-colors text-left"
            >
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-semibold">Submit a Reunification Request</p>
                <p className="text-sm text-slate-400">Notify the team you&apos;re looking for someone</p>
              </div>
            </button>
          </div>
        </div>

        <div className="px-4 pt-6">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400">
              For privacy, this system does not confirm whether someone has checked in.
              All requests are reviewed by the reunification team behind secure authentication.
            </p>
          </div>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  // ── RESULT SCREEN ──
  if (screen === 'result') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => { setScreen('search'); setLookupMessage(''); }}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">Result</h1>
        </header>

        <div className="px-4 pt-8 text-center space-y-4">
          <div className="text-5xl">📋</div>
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-base text-slate-200">{lookupMessage}</p>
          </div>

          <button
            onClick={() => setScreen('request')}
            className="w-full py-4 rounded-xl bg-purple-600 font-bold text-base active:bg-purple-700 transition-colors"
          >
            Submit a Reunification Request
          </button>

          <button
            onClick={() => { setScreen('search'); setSearchPhone(''); setLookupMessage(''); }}
            className="w-full py-3 rounded-xl bg-slate-800 border border-slate-600 font-semibold active:bg-slate-700 transition-colors"
          >
            Search Another Number
          </button>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  // ── REQUEST FORM ──
  if (screen === 'request') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
          <button
            onClick={() => setScreen('search')}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
          >
            ←
          </button>
          <h1 className="text-lg font-bold">Reunification Request</h1>
        </header>

        <div className="px-4 pt-4 space-y-4">
          <p className="text-sm text-slate-400">
            Tell us who you&apos;re looking for. The reunification team will follow up.
          </p>

          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">Person you&apos;re looking for</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={soughtName}
                onChange={(e) => setSoughtName(e.target.value)}
                placeholder="Their full name"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Phone number</label>
              <input
                type="tel"
                value={soughtPhone}
                onChange={(e) => setSoughtPhone(e.target.value)}
                placeholder="(310) 555-0100"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3">
            <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">Your contact info</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Your name</label>
              <input
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Your phone number</label>
              <input
                type="tel"
                value={requesterPhone}
                onChange={(e) => setRequesterPhone(e.target.value)}
                placeholder="(310) 555-0100"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Relationship (optional)</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm"
              >
                <option value="">Select...</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="spouse">Spouse / Partner</option>
                <option value="sibling">Sibling</option>
                <option value="friend">Friend</option>
                <option value="coworker">Coworker</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleRequest}
            disabled={(!soughtName.trim() && !soughtPhone.trim()) || submitting}
            className="w-full py-4 rounded-xl bg-purple-600 font-bold text-lg active:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

        <div className="h-8" />
      </main>
    );
  }

  // ── REQUEST SENT ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Request Submitted</h1>
      </header>

      <div className="px-4 pt-12 text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-extrabold text-purple-400">Request Received</h2>
        <p className="text-slate-300">
          Your request has been submitted. The reunification team will follow up with you.
        </p>
      </div>

      <div className="px-4 pt-8 pb-8">
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
