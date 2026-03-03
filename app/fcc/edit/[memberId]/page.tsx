'use client';

import { useParams } from 'next/navigation';
import { MOCK_HOUSEHOLD } from '../../../data/mock-fcc-household';

export default function FCCMemberEditPage() {
  const params = useParams();
  const memberId = Number(params.memberId);
  const member = MOCK_HOUSEHOLD.members.find((m) => m.id === memberId) ?? MOCK_HOUSEHOLD.members[0];

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/fcc/edit"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">{member.name}</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        {/* Identification */}
        <Section title="Identification">
          <Field label="Full Name" value={member.name} />
          <Field label="Date of Birth" value={member.dob} />
          <Field label="Baseline Mental Status" value={member.baseline} />
          <Field label="Primary Language" value={member.language} />
          <Field label="Code Status" value={member.codeStatus} />
          <Field label="Directive Location" value={member.directiveLocation} />
        </Section>

        {/* Critical Flags */}
        <Section title="Critical Flags">
          {member.criticalFlags.map((f) => (
            <div key={f.flag} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
              <span className="text-sm">{f.flag}</span>
              <span className="text-xs text-slate-400 capitalize">{f.type}</span>
            </div>
          ))}
          <button className="w-full mt-2 text-xs text-blue-400 font-semibold py-1.5">+ Add Flag</button>
        </Section>

        {/* Medications */}
        <Section title="Medications">
          {member.medications.map((m) => (
            <div key={m.name} className="py-1.5 border-b border-slate-700 last:border-0">
              <p className="text-sm font-semibold">{m.name} — {m.dose}</p>
              <p className="text-xs text-slate-400">{m.freq} · Last: {m.lastDose}</p>
            </div>
          ))}
          <button className="w-full mt-2 text-xs text-blue-400 font-semibold py-1.5">+ Add Medication</button>
        </Section>

        {/* History */}
        <Section title="Medical History">
          <div className="flex flex-wrap gap-1.5">
            {member.history.map((h) => (
              <span key={h} className="bg-slate-700 px-2.5 py-1 rounded text-xs font-semibold">{h}</span>
            ))}
          </div>
          <button className="w-full mt-2 text-xs text-blue-400 font-semibold py-1.5">+ Add Condition</button>
        </Section>

        {/* Mobility */}
        <Section title="Mobility &amp; Movement">
          <Field label="Status" value={member.mobility.status} />
          <Field label="Lift Method" value={member.mobility.liftMethod} />
          <Field label="Precautions" value={member.mobility.precautions} />
          <Field label="Pain Notes" value={member.mobility.pain} />
          <Field label="Stair Chair" value={member.mobility.stairChair} />
        </Section>

        {/* Equipment */}
        <Section title="Equipment">
          {member.equipment.map((e) => (
            <div key={e.item} className="py-1.5 border-b border-slate-700 last:border-0">
              <p className="text-sm font-semibold">{e.item}</p>
              <p className="text-xs text-slate-400">{e.location}</p>
            </div>
          ))}
          <button className="w-full mt-2 text-xs text-blue-400 font-semibold py-1.5">+ Add Equipment</button>
        </Section>

        {/* Life Needs */}
        <Section title="Life Needs">
          {member.lifeNeeds.map((n) => (
            <p key={n} className="text-sm py-1 border-b border-slate-700 last:border-0">{n}</p>
          ))}
          <button className="w-full mt-2 text-xs text-blue-400 font-semibold py-1.5">+ Add Need</button>
        </Section>

        <button className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors">
          Save Changes
        </button>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5 border-b border-slate-700 last:border-0">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}
