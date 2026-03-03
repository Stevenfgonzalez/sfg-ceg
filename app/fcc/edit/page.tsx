'use client';

import { logEvent } from '@/lib/analytics';
import { MOCK_HOUSEHOLD } from '../../data/mock-fcc-household';

export default function FCCEditPage() {
  const household = MOCK_HOUSEHOLD;

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a
          href="/fcc"
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg"
        >
          ←
        </a>
        <h1 className="text-lg font-bold">Edit Profiles</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 pb-8">
        <div className="text-center">
          <p className="text-xs font-bold tracking-widest text-amber-500 uppercase font-mono">Profile Builder</p>
          <p className="text-xs text-slate-400 mt-1">Manage household and member profiles</p>
        </div>

        {/* Household info */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Household</p>
          <p className="font-bold text-base">Delgado Household</p>
          <p className="text-xs text-slate-400 mt-0.5">{household.address}</p>
          <button
            onClick={() => logEvent('fcc_edit_household')}
            className="mt-3 w-full bg-gray-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs font-semibold active:bg-slate-800 transition-colors"
          >
            Edit Household Info
          </button>
        </div>

        {/* Members */}
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">Members</p>
          {household.members.map((member) => (
            <a
              key={member.id}
              href={`/fcc/edit/${member.id}`}
              className="block bg-slate-800 rounded-xl border border-slate-700 p-4 mb-2 active:bg-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{member.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    DOB: {member.dob} · {member.codeStatus === 'DNR/POLST' ? 'DNR/POLST' : 'Full Code'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {member.criticalFlags.length} flags · {member.medications.length} meds · {member.equipment.length} equipment
                  </p>
                </div>
                <span className="text-slate-500">→</span>
              </div>
            </a>
          ))}
          <button className="w-full mt-2 bg-blue-600 rounded-xl px-4 py-3 text-sm font-bold active:bg-blue-700 transition-colors">
            + Add Member
          </button>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Emergency Contacts</p>
          {household.emergencyContacts.map((c, i) => (
            <div key={i} className={`flex items-center justify-between py-2 ${i < household.emergencyContacts.length - 1 ? 'border-b border-slate-700' : ''}`}>
              <div>
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-xs text-slate-400">{c.relation} · {c.phone}</p>
              </div>
              <button className="text-xs text-blue-400 active:text-blue-300">Edit</button>
            </div>
          ))}
          <button className="w-full mt-3 bg-gray-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs font-semibold active:bg-slate-800 transition-colors">
            + Add Contact
          </button>
        </div>
      </div>
    </main>
  );
}
