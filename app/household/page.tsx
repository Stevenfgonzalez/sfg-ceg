'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  type HouseholdMember,
  type Pet,
  type GrabLocation,
  type HouseholdData,
  generateGoBagChecklist,
  generateHouseholdCode,
  loadHousehold,
  saveHousehold,
} from '@/lib/household-checklist';

type Tab = 'members' | 'pets' | 'gobag' | 'locations';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function HouseholdPage() {
  const [tab, setTab] = useState<Tab>('members');
  const [data, setData] = useState<HouseholdData>({ members: [], pets: [], locations: [], checklist: [], vault: [], householdCode: '' });
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loaded = loadHousehold();
    // Auto-generate a code if none exists
    if (!loaded.householdCode) {
      loaded.householdCode = generateHouseholdCode();
      saveHousehold(loaded);
    }
    setData(loaded);
    setLoaded(true);
  }, []);

  const save = useCallback((next: HouseholdData) => {
    setData(next);
    saveHousehold(next);
  }, []);

  if (!loaded) return <div className="min-h-screen bg-slate-900" />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'members', label: 'Members' },
    { id: 'pets', label: 'Pets' },
    { id: 'gobag', label: 'Go-Bag' },
    { id: 'locations', label: 'Locations' },
  ];

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
        <a href="/" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
        <h1 className="text-lg font-bold">Household Pre-Plan</h1>
      </header>

      {/* Household Code */}
      {data.householdCode && (
        <div className="mx-4 mt-3 mb-1 bg-blue-950/60 border border-blue-800 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Household Code</div>
            <div className="text-xl font-black tracking-[0.15em] font-mono text-white">{data.householdCode}</div>
            <div className="text-xs text-slate-400 mt-0.5">Use this code when checking in</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.householdCode).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="px-3 py-2 rounded-lg bg-blue-600 active:bg-blue-700 text-xs font-bold transition-colors shrink-0"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              tab === t.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'members' && <MembersTab data={data} save={save} />}
      {tab === 'pets' && <PetsTab data={data} save={save} />}
      {tab === 'gobag' && <GoBagTab data={data} save={save} />}
      {tab === 'locations' && <LocationsTab data={data} save={save} />}

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          header, .no-print { display: none !important; }
          main { min-height: auto !important; background: white !important; }
        }
      `}</style>
    </main>
  );
}

// ── MEMBERS TAB ──

function MembersTab({ data, save }: { data: HouseholdData; save: (d: HouseholdData) => void }) {
  const [editing, setEditing] = useState<string | null>(null);

  const addMember = () => {
    const member: HouseholdMember = {
      id: uid(),
      name: '',
      type: 'adult',
      age: null,
      afn: { medical: false, mobility: false, sensory: false, cognitive: false, medication: false },
      medicalNotes: '',
    };
    save({ ...data, members: [...data.members, member] });
    setEditing(member.id);
  };

  const updateMember = (id: string, updates: Partial<HouseholdMember>) => {
    save({
      ...data,
      members: data.members.map(m => m.id === id ? { ...m, ...updates } : m),
    });
  };

  const removeMember = (id: string) => {
    save({ ...data, members: data.members.filter(m => m.id !== id) });
    if (editing === id) setEditing(null);
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-sm text-slate-400">
        Add everyone in your household so your go-bag checklist is personalized.
      </p>

      {data.members.map((m) => (
        <div key={m.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div
            className="px-4 py-3 flex items-center justify-between cursor-pointer"
            onClick={() => setEditing(editing === m.id ? null : m.id)}
          >
            <div>
              <span className="font-semibold">{m.name || 'Unnamed'}</span>
              <span className="text-sm text-slate-400 ml-2">
                {m.type}{m.age !== null ? `, ${m.age}` : ''}
              </span>
            </div>
            <span className="text-slate-500">{editing === m.id ? '▲' : '▼'}</span>
          </div>

          {editing === m.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-700 pt-3">
              <input
                type="text"
                value={m.name}
                onChange={(e) => updateMember(m.id, { name: e.target.value })}
                placeholder="Name"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />

              <div className="flex gap-2">
                {(['adult', 'child', 'elderly'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateMember(m.id, { type: t })}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      m.type === t
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-600 text-slate-300'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <input
                type="number"
                value={m.age ?? ''}
                onChange={(e) => updateMember(m.id, { age: e.target.value ? parseInt(e.target.value, 10) : null })}
                placeholder="Age"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
              />

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Additional Functional Needs (AFN)</p>
                <div className="flex flex-wrap gap-2">
                  {(['medical', 'mobility', 'sensory', 'cognitive', 'medication'] as const).map((flag) => (
                    <button
                      key={flag}
                      onClick={() => updateMember(m.id, { afn: { ...m.afn, [flag]: !m.afn[flag] } })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        m.afn[flag]
                          ? 'bg-amber-600 border-amber-400 text-white'
                          : 'bg-slate-900 border-slate-600 text-slate-400'
                      }`}
                    >
                      {flag.charAt(0).toUpperCase() + flag.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={m.medicalNotes}
                onChange={(e) => updateMember(m.id, { medicalNotes: e.target.value.slice(0, 200) })}
                placeholder="Medical notes (optional)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm resize-none"
              />

              <button
                onClick={() => removeMember(m.id)}
                className="w-full py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm font-semibold"
              >
                Remove Member
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addMember}
        className="w-full py-3 rounded-xl bg-blue-600 font-bold text-base active:bg-blue-700 transition-colors no-print"
      >
        + Add Member
      </button>
    </div>
  );
}

// ── PETS TAB ──

function PetsTab({ data, save }: { data: HouseholdData; save: (d: HouseholdData) => void }) {
  const addPet = () => {
    const pet: Pet = { id: uid(), type: 'dog', name: '', count: 1, notes: '' };
    save({ ...data, pets: [...data.pets, pet] });
  };

  const updatePet = (id: string, updates: Partial<Pet>) => {
    save({ ...data, pets: data.pets.map(p => p.id === id ? { ...p, ...updates } : p) });
  };

  const removePet = (id: string) => {
    save({ ...data, pets: data.pets.filter(p => p.id !== id) });
  };

  const typeLabels: Record<Pet['type'], string> = {
    dog: 'Dog', cat: 'Cat', horse: 'Horse', bird: 'Bird', other: 'Other',
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-sm text-slate-400">
        Add pets so your go-bag includes their supplies.
      </p>

      {data.pets.map((p) => (
        <div key={p.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['dog', 'cat', 'horse', 'bird', 'other'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updatePet(p.id, { type: t })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  p.type === t
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-400'
                }`}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={p.name}
              onChange={(e) => updatePet(p.id, { name: e.target.value })}
              placeholder="Pet name"
              className="flex-1 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
            />
            <input
              type="number"
              value={p.count}
              onChange={(e) => updatePet(p.id, { count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              min={1}
              className="w-16 px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm text-center"
            />
          </div>

          <input
            type="text"
            value={p.notes}
            onChange={(e) => updatePet(p.id, { notes: e.target.value })}
            placeholder="Notes (medications, special needs...)"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
          />

          <button
            onClick={() => removePet(p.id)}
            className="w-full py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm font-semibold"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={addPet}
        className="w-full py-3 rounded-xl bg-blue-600 font-bold text-base active:bg-blue-700 transition-colors no-print"
      >
        + Add Pet
      </button>
    </div>
  );
}

// ── GO-BAG TAB ──

function GoBagTab({ data, save }: { data: HouseholdData; save: (d: HouseholdData) => void }) {
  const checklist = generateGoBagChecklist(data);

  const toggleItem = (id: string) => {
    const updated = checklist.map(c => c.id === id ? { ...c, packed: !c.packed } : c);
    save({ ...data, checklist: updated });
  };

  const packed = checklist.filter(c => c.packed).length;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">
            Auto-generated from your household. {packed}/{checklist.length} packed.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-semibold no-print"
        >
          Print
        </button>
      </div>

      {checklist.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-400">Add household members to generate your checklist.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {checklist.map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                item.packed
                  ? 'bg-emerald-900/30 border border-emerald-800'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            >
              <span className={`text-lg shrink-0 ${item.packed ? 'opacity-100' : 'opacity-30'}`}>
                {item.packed ? '✅' : '⬜'}
              </span>
              <div className="min-w-0">
                <span className={`text-sm font-medium ${item.packed ? 'line-through text-slate-500' : ''}`}>
                  {item.label}
                </span>
                <span className="block text-xs text-slate-500">{item.reason}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LOCATIONS TAB ──

function LocationsTab({ data, save }: { data: HouseholdData; save: (d: HouseholdData) => void }) {
  const addLocation = () => {
    const loc: GrabLocation = { id: uid(), label: '', description: '' };
    save({ ...data, locations: [...data.locations, loc] });
  };

  const updateLocation = (id: string, updates: Partial<GrabLocation>) => {
    save({ ...data, locations: data.locations.map(l => l.id === id ? { ...l, ...updates } : l) });
  };

  const removeLocation = (id: string) => {
    save({ ...data, locations: data.locations.filter(l => l.id !== id) });
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-sm text-slate-400">
        Note where important items are stored so anyone can grab them quickly.
      </p>

      {data.locations.map((loc) => (
        <div key={loc.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-2">
          <input
            type="text"
            value={loc.label}
            onChange={(e) => updateLocation(loc.id, { label: e.target.value })}
            placeholder="Item (e.g., Important documents)"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
          />
          <input
            type="text"
            value={loc.description}
            onChange={(e) => updateLocation(loc.id, { description: e.target.value })}
            placeholder="Location (e.g., Top shelf of bedroom closet)"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500 text-sm"
          />
          <button
            onClick={() => removeLocation(loc.id)}
            className="w-full py-2 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm font-semibold"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        onClick={addLocation}
        className="w-full py-3 rounded-xl bg-blue-600 font-bold text-base active:bg-blue-700 transition-colors no-print"
      >
        + Add Location
      </button>
    </div>
  );
}
