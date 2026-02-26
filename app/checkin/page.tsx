'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'SAFE' | 'SIP' | 'NEED_EMS';
type Step = 'status' | 'details' | 'submitting' | 'done' | 'error';

export default function CheckInPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CheckInForm />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="animate-spin text-4xl mb-4">&#9696;</div>
        <p className="text-lg text-slate-600">Loading check-in form...</p>
      </div>
    </main>
  );
}

function CheckInForm() {
  const searchParams = useSearchParams();
  const incidentId = searchParams.get('incident') ?? '';
  const assemblyPoint = searchParams.get('ap') ?? '';

  const [step, setStep] = useState<Step>('status');
  const [status, setStatus] = useState<Status | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(1);
  const [hasDependents, setHasDependents] = useState(false);
  const [dependentNames, setDependentNames] = useState('');
  const [needsTransport, setNeedsTransport] = useState(false);
  const [emsNotes, setEmsNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Validate incident ID on load
  const [validIncident, setValidIncident] = useState(true);
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!incidentId || !uuidRegex.test(incidentId)) {
      setValidIncident(false);
    }
  }, [incidentId]);

  if (!validIncident) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#9888;</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Check-In Link</h1>
          <p className="text-slate-600">
            This QR code is missing incident information. Please scan the correct QR code
            at your assembly point.
          </p>
        </div>
      </main>
    );
  }

  async function handleSubmit() {
    if (!status || !fullName.trim()) return;

    setStep('submitting');

    try {
      const body: Record<string, unknown> = {
        incident_id: incidentId,
        full_name: fullName.trim(),
        status,
        assembly_point: assemblyPoint || undefined,
        party_size: partySize,
        has_dependents: hasDependents,
        needs_transport: needsTransport,
      };

      if (phone.trim()) body.phone = phone.trim();
      if (hasDependents && dependentNames.trim()) {
        body.dependent_names = dependentNames.split(',').map((n) => n.trim()).filter(Boolean);
      }
      if (status !== 'SAFE' && emsNotes.trim()) body.ems_notes = emsNotes.trim();
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Check-in failed');
      }

      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
    }
  }

  // ─── Step 1: Status Selection ───
  if (step === 'status') {
    return (
      <Layout>
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
          Emergency Check-In
        </h1>
        {assemblyPoint && (
          <p className="text-sm text-slate-500 text-center mb-6">
            Assembly Point: <span className="font-semibold">{assemblyPoint}</span>
          </p>
        )}
        <p className="text-lg text-slate-700 text-center mb-8">
          What is your current status?
        </p>

        <div className="space-y-4">
          <StatusButton
            label="I AM SAFE"
            sublabel="No injuries, no assistance needed"
            color="bg-green-600 active:bg-green-700"
            onClick={() => { setStatus('SAFE'); setStep('details'); }}
          />
          <StatusButton
            label="SHELTER IN PLACE"
            sublabel="I am sheltering and unable to evacuate"
            color="bg-amber-500 active:bg-amber-600"
            onClick={() => { setStatus('SIP'); setStep('details'); }}
          />
          <StatusButton
            label="NEED EMS"
            sublabel="I need medical assistance"
            color="bg-red-600 active:bg-red-700"
            onClick={() => { setStatus('NEED_EMS'); setStep('details'); }}
          />
        </div>
      </Layout>
    );
  }

  // ─── Step 2: Details ───
  if (step === 'details') {
    const isEms = status === 'NEED_EMS' || status === 'SIP';

    return (
      <Layout>
        <button
          onClick={() => setStep('status')}
          className="text-slate-500 text-sm mb-4 flex items-center gap-1"
        >
          &#8592; Change status
        </button>

        <StatusBadge status={status!} />

        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          className="space-y-5 mt-6"
        >
          {/* Name — required */}
          <Field label="Full Name *">
            <input
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="First and Last Name"
              className="form-input"
            />
          </Field>

          {/* Phone — optional, for reunification */}
          <Field label="Phone Number" hint="For family reunification lookup">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(818) 555-1234"
              className="form-input"
            />
          </Field>

          {/* Party size */}
          <Field label="How many people are with you?" hint="Including yourself">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                className="w-12 h-12 rounded-full bg-slate-200 text-xl font-bold active:bg-slate-300"
              >
                &minus;
              </button>
              <span className="text-3xl font-bold w-12 text-center">{partySize}</span>
              <button
                type="button"
                onClick={() => setPartySize(partySize + 1)}
                className="w-12 h-12 rounded-full bg-slate-200 text-xl font-bold active:bg-slate-300"
              >
                +
              </button>
            </div>
          </Field>

          {/* Dependents */}
          <Field label="Do you have dependents with you?" hint="Children, elderly, pets">
            <div className="flex gap-3">
              <ToggleButton
                active={hasDependents}
                onClick={() => setHasDependents(true)}
                label="Yes"
              />
              <ToggleButton
                active={!hasDependents}
                onClick={() => setHasDependents(false)}
                label="No"
              />
            </div>
            {hasDependents && (
              <input
                type="text"
                value={dependentNames}
                onChange={(e) => setDependentNames(e.target.value)}
                placeholder="Names, separated by commas"
                className="form-input mt-3"
              />
            )}
          </Field>

          {/* EMS fields — only if SIP or NEED_EMS */}
          {isEms && (
            <>
              <Field label="Do you need medical transport?">
                <div className="flex gap-3">
                  <ToggleButton
                    active={needsTransport}
                    onClick={() => setNeedsTransport(true)}
                    label="Yes"
                  />
                  <ToggleButton
                    active={!needsTransport}
                    onClick={() => setNeedsTransport(false)}
                    label="No"
                  />
                </div>
              </Field>

              <Field label="Describe your situation" hint="Injury type, mobility, medications">
                <textarea
                  value={emsNotes}
                  onChange={(e) => setEmsNotes(e.target.value)}
                  placeholder="e.g. Twisted ankle, can walk with assistance"
                  rows={3}
                  className="form-input"
                />
              </Field>
            </>
          )}

          {/* Additional notes */}
          <Field label="Additional notes" hint="Optional">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else responders should know"
              rows={2}
              className="form-input"
            />
          </Field>

          <button
            type="submit"
            disabled={!fullName.trim()}
            className="w-full py-4 rounded-xl text-lg font-bold text-white bg-blue-600 active:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
          >
            Submit Check-In
          </button>
        </form>
      </Layout>
    );
  }

  // ─── Submitting ───
  if (step === 'submitting') {
    return (
      <Layout>
        <div className="text-center py-16">
          <div className="animate-spin text-4xl mb-4">&#9696;</div>
          <p className="text-lg text-slate-600">Submitting your check-in...</p>
        </div>
      </Layout>
    );
  }

  // ─── Done ───
  if (step === 'done') {
    return (
      <Layout>
        <div className="text-center py-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-green-600">&#10003;</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Check-In Received</h2>
          <StatusBadge status={status!} />
          <p className="text-slate-600 mt-4 mb-2">
            <span className="font-semibold">{fullName}</span>
            {partySize > 1 && <> + {partySize - 1} {partySize === 2 ? 'person' : 'people'}</>}
          </p>
          {assemblyPoint && (
            <p className="text-sm text-slate-500">Assembly Point: {assemblyPoint}</p>
          )}
          <p className="text-slate-500 text-sm mt-6">
            Incident Command has been notified. Stay at your assembly point
            and follow instructions from emergency personnel.
          </p>
          <button
            onClick={() => {
              setStep('status');
              setStatus(null);
              setFullName('');
              setPhone('');
              setPartySize(1);
              setHasDependents(false);
              setDependentNames('');
              setNeedsTransport(false);
              setEmsNotes('');
              setNotes('');
            }}
            className="mt-8 px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-semibold active:bg-slate-300"
          >
            Check in another person
          </button>
        </div>
      </Layout>
    );
  }

  // ─── Error ───
  return (
    <Layout>
      <div className="text-center py-8">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl text-red-600">&#10007;</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Check-In Failed</h2>
        <p className="text-red-600 mb-6">{errorMsg}</p>
        <button
          onClick={() => setStep('details')}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold active:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </Layout>
  );
}

// ─── Shared Components ───

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-100 flex items-start justify-center p-4 pt-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
        {children}
      </div>
    </main>
  );
}

function StatusButton({
  label,
  sublabel,
  color,
  onClick,
}: {
  label: string;
  sublabel: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-5 px-6 rounded-xl text-white text-left transition-transform active:scale-[0.98] ${color}`}
    >
      <div className="text-xl font-bold">{label}</div>
      <div className="text-sm opacity-90 mt-1">{sublabel}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const config = {
    SAFE: { label: 'SAFE', bg: 'bg-green-100', text: 'text-green-700' },
    SIP: { label: 'SHELTER IN PLACE', bg: 'bg-amber-100', text: 'text-amber-700' },
    NEED_EMS: { label: 'NEED EMS', bg: 'bg-red-100', text: 'text-red-700' },
  };
  const c = config[status];
  return (
    <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${c.bg} ${c.text}`}>
      {c.label}
    </div>
  );
}

function Field({
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
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      {children}
    </div>
  );
}

function ToggleButton({
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
          : 'bg-slate-100 text-slate-600 active:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
