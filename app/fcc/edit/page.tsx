'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  id: string;
  full_name: string;
  date_of_birth: string;
  code_status: string;
  fcc_member_clinical?: {
    critical_flags?: { flag: string; type: string }[];
    medications?: { name: string }[];
    equipment?: { item: string }[];
  }[];
}

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  sort_order: number;
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

type Screen = 'loading' | 'wizard' | 'household_edit' | 'add_member' | 'add_contact' | 'edit_contact';

const CODE_STATUS_LABELS: Record<string, string> = {
  full_code: 'Full Code',
  dnr: 'DNR',
  dnr_polst: 'DNR/POLST',
};

const STEP_LABELS = ['Household', 'Members', 'Contacts'];

export default function FCCEditPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>('loading');
  const [step, setStep] = useState(1); // 1=Household, 2=Members, 3=Contacts
  const [household, setHousehold] = useState<Household | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Household form state
  const [hForm, setHForm] = useState({
    name: '', address_line1: '', address_line2: '', city: '', state: '', zip: '',
    access_code: '', best_door: '', gate_code: '', animals: '', stair_info: '',
    hazards: '', aed_onsite: false, backup_power: '',
  });

  // New member form state
  const [mForm, setMForm] = useState({
    full_name: '', date_of_birth: '', baseline_mental: '', primary_language: 'English',
    code_status: 'full_code', directive_location: '',
  });

  // Contact form state
  const [cForm, setCForm] = useState({ name: '', relation: '', phone: '' });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadHousehold(); }, []);

  async function loadHousehold(goToStep?: number) {
    try {
      const res = await fetch('/api/fcc/household');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load household');
        setScreen('wizard');
        setStep(1);
        return;
      }
      if (data.household) {
        setHousehold(data.household);
        populateHouseholdForm(data.household);
        setScreen('wizard');
        if (goToStep) {
          setStep(goToStep);
        } else {
          // Auto-detect best step for onboarding
          const members = data.household.fcc_members || [];
          const contacts = data.household.fcc_emergency_contacts || [];
          if (members.length === 0) setStep(2);
          else if (contacts.length === 0) setStep(3);
          else setStep(1); // All done, show household overview
        }
      } else {
        setScreen('wizard');
        setStep(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error loading household');
      setScreen('wizard');
      setStep(1);
    }
  }

  function populateHouseholdForm(h: Household) {
    setHForm({
      name: h.name, address_line1: h.address_line1, address_line2: h.address_line2 || '',
      city: h.city, state: h.state, zip: h.zip, access_code: h.access_code,
      best_door: h.best_door || '', gate_code: h.gate_code || '', animals: h.animals || '',
      stair_info: h.stair_info || '', hazards: h.hazards || '', aed_onsite: h.aed_onsite,
      backup_power: h.backup_power || '',
    });
  }

  async function saveHousehold(isCreate: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/fcc/household', {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hForm),
      });
      const data = await res.json();
      if (res.status === 409) {
        await loadHousehold(2);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setHousehold(data.household);
      if (isCreate) {
        await loadHousehold(2);
      } else {
        setScreen('wizard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function addMember() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/fcc/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      setMForm({ full_name: '', date_of_birth: '', baseline_mental: '', primary_language: 'English', code_status: 'full_code', directive_location: '' });
      await loadHousehold(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMember(memberId: string) {
    if (!confirm('Remove this member? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/fcc/members/${memberId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await loadHousehold(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function saveContact(isCreate: boolean) {
    setSaving(true);
    setError(null);
    try {
      const url = isCreate ? '/api/fcc/contacts' : `/api/fcc/contacts/${editingContactId}`;
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save contact');
      setCForm({ name: '', relation: '', phone: '' });
      setEditingContactId(null);
      await loadHousehold(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contactId: string) {
    if (!confirm('Remove this contact?')) return;
    try {
      const res = await fetch(`/api/fcc/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await loadHousehold(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const members = household?.fcc_members || [];
  const contacts = household?.fcc_emergency_contacts || [];

  // ── LOADING ──
  if (screen === 'loading') {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ── HOUSEHOLD EDIT (sub-screen) ──
  if (screen === 'household_edit') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <Header title="Edit Household" onBack={() => setScreen('wizard')} />
        <div className="px-4 pt-5 space-y-4 pb-8">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          <HouseholdForm form={hForm} setForm={setHForm} />
          <button
            onClick={() => saveHousehold(false)}
            disabled={saving || !hForm.name || !hForm.address_line1 || !hForm.city || !hForm.state || !hForm.zip || !hForm.access_code}
            className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    );
  }

  // ── ADD MEMBER (sub-screen) ──
  if (screen === 'add_member') {
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <Header title="Add Member" onBack={() => setScreen('wizard')} />
        <div className="px-4 pt-5 space-y-4 pb-8">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          <Section title="Identification">
            <Input label="Full Name" value={mForm.full_name} onChange={(v) => setMForm({ ...mForm, full_name: v })} required />
            <Input label="Date of Birth" value={mForm.date_of_birth} onChange={(v) => setMForm({ ...mForm, date_of_birth: v })} type="date" required />
            <Input label="Baseline Mental Status" value={mForm.baseline_mental} onChange={(v) => setMForm({ ...mForm, baseline_mental: v })} placeholder="e.g. A&O x4, mild hearing loss" />
            <Input label="Primary Language" value={mForm.primary_language} onChange={(v) => setMForm({ ...mForm, primary_language: v })} />
            <div className="py-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block mb-1">Code Status</label>
              <select
                value={mForm.code_status}
                onChange={(e) => setMForm({ ...mForm, code_status: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm"
              >
                <option value="full_code">Full Code</option>
                <option value="dnr">DNR</option>
                <option value="dnr_polst">DNR/POLST</option>
              </select>
            </div>
            <Input label="Directive Location" value={mForm.directive_location} onChange={(v) => setMForm({ ...mForm, directive_location: v })} placeholder="e.g. Filed with Dr. Smith, copy in kitchen drawer" />
          </Section>
          <button
            onClick={addMember}
            disabled={saving || !mForm.full_name || !mForm.date_of_birth}
            className="w-full bg-blue-600 rounded-xl px-4 py-3.5 text-sm font-bold active:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Member'}
          </button>
          <p className="text-[10px] text-slate-500 text-center">You can add medications, flags, and clinical details after creating the member.</p>
        </div>
      </main>
    );
  }

  // ── ADD / EDIT CONTACT (sub-screen) ──
  if (screen === 'add_contact' || screen === 'edit_contact') {
    const isEdit = screen === 'edit_contact';
    return (
      <main className="min-h-screen bg-slate-900 text-white">
        <Header title={isEdit ? 'Edit Contact' : 'Add Contact'} onBack={() => { setScreen('wizard'); setEditingContactId(null); }} />
        <div className="px-4 pt-5 space-y-4 pb-8">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
          <Section title="Emergency Contact">
            <Input label="Full Name" value={cForm.name} onChange={(v) => setCForm({ ...cForm, name: v })} required />
            <Input label="Relation" value={cForm.relation} onChange={(v) => setCForm({ ...cForm, relation: v })} placeholder="e.g. Daughter, PCP, Neighbor" required />
            <Input label="Phone" value={cForm.phone} onChange={(v) => setCForm({ ...cForm, phone: v })} type="tel" required />
          </Section>
          <button
            onClick={() => saveContact(!isEdit)}
            disabled={saving || !cForm.name || !cForm.relation || !cForm.phone}
            className="w-full bg-blue-600 rounded-xl px-4 py-3.5 text-sm font-bold active:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </main>
    );
  }

  // ── WIZARD ──
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      <Header title="Field Care Card Setup" backHref="/fcc" />

      <div className="px-4 pt-5 pb-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = household
              ? (stepNum === 1) ||
                (stepNum === 2 && members.length > 0) ||
                (stepNum === 3 && contacts.length > 0)
              : false;
            return (
              <button
                key={label}
                onClick={() => { if (household || stepNum === 1) setStep(stepNum); }}
                disabled={!household && stepNum > 1}
                className="flex items-center gap-1 group disabled:opacity-40"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive ? 'bg-amber-500 text-black' :
                  isDone ? 'bg-green-700 text-white' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {isDone && !isActive ? '\u2713' : stepNum}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wider transition-colors ${
                  isActive ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {label}
                </span>
                {i < 2 && <span className="text-slate-600 mx-1">—</span>}
              </button>
            );
          })}
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* STEP 1: Household */}
        {step === 1 && (
          <div className="space-y-4">
            {!household ? (
              <>
                <div className="text-center mb-2">
                  <p className="text-sm text-slate-400">Set up your household profile</p>
                </div>
                <HouseholdForm form={hForm} setForm={setHForm} />
                <button
                  onClick={() => saveHousehold(true)}
                  disabled={saving || !hForm.name || !hForm.address_line1 || !hForm.city || !hForm.state || !hForm.zip || !hForm.access_code}
                  className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Household & Continue'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Household</p>
                  <p className="font-bold text-base">{household.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[household.address_line1, household.address_line2].filter(Boolean).join(', ')}, {household.city}, {household.state} {household.zip}
                  </p>
                  {household.access_code && (
                    <p className="text-xs text-slate-500 mt-1 font-mono">Access code: {household.access_code}</p>
                  )}
                  {household.hazards && <p className="text-xs text-red-400 mt-1">{household.hazards}</p>}
                  <button
                    onClick={() => { populateHouseholdForm(household); setScreen('household_edit'); }}
                    className="mt-3 w-full bg-gray-900 border border-slate-700 rounded-lg px-4 py-2.5 text-xs font-semibold active:bg-slate-800 transition-colors"
                  >
                    Edit Household Info
                  </button>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="w-full bg-amber-600 rounded-xl px-4 py-3.5 text-sm font-bold text-black active:bg-amber-700 transition-colors"
                >
                  Next: Add Members →
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2: Members */}
        {step === 2 && household && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-slate-400">Add people who live in your household</p>
            </div>

            {members.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-3">
                  Members ({members.length}/6)
                </p>
                {members.map((member) => {
                  const clinical = member.fcc_member_clinical?.[0];
                  const flagCount = (clinical?.critical_flags as { flag: string }[] | undefined)?.length || 0;
                  const medCount = (clinical?.medications as { name: string }[] | undefined)?.length || 0;
                  const equipCount = (clinical?.equipment as { item: string }[] | undefined)?.length || 0;
                  return (
                    <div key={member.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-2">
                      <div className="flex items-center justify-between">
                        <a href={`/fcc/edit/${member.id}`} className="flex-1 active:opacity-70">
                          <p className="font-bold text-sm">{member.full_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            DOB: {member.date_of_birth} · {CODE_STATUS_LABELS[member.code_status] || member.code_status}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {flagCount} flag{flagCount !== 1 ? 's' : ''} · {medCount} med{medCount !== 1 ? 's' : ''} · {equipCount} equip
                          </p>
                        </a>
                        <div className="flex items-center gap-2 shrink-0">
                          <a href={`/fcc/edit/${member.id}`} className="text-blue-400 text-xs font-semibold">Edit</a>
                          <button onClick={() => deleteMember(member.id)} className="text-red-400 text-xs font-semibold">Del</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {members.length === 0 && (
              <div className="bg-slate-800/50 rounded-xl border border-dashed border-slate-600 p-6 text-center">
                <p className="text-slate-400 text-sm">No members added yet</p>
                <p className="text-[10px] text-slate-500 mt-1">Add at least one household member</p>
              </div>
            )}

            {members.length < 6 && (
              <button
                onClick={() => { setError(null); setScreen('add_member'); }}
                className="w-full bg-blue-600 rounded-xl px-4 py-3 text-sm font-bold active:bg-blue-700 transition-colors"
              >
                + Add Member
              </button>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold active:bg-slate-700 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-amber-600 rounded-xl px-4 py-3 text-sm font-bold text-black active:bg-amber-700 transition-colors"
              >
                Next: Contacts →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Emergency Contacts */}
        {step === 3 && household && (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-slate-400">Add emergency contacts for EMS to call</p>
            </div>

            {contacts.length > 0 && (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider font-mono mb-2">Emergency Contacts</p>
                {contacts.map((c, i) => (
                  <div key={c.id} className={`flex items-center justify-between py-2 ${i < contacts.length - 1 ? 'border-b border-slate-700' : ''}`}>
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.relation} · {c.phone}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setCForm({ name: c.name, relation: c.relation, phone: c.phone });
                          setEditingContactId(c.id);
                          setScreen('edit_contact');
                        }}
                        className="text-xs text-blue-400 active:text-blue-300"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteContact(c.id)} className="text-xs text-red-400 active:text-red-300">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {contacts.length === 0 && (
              <div className="bg-slate-800/50 rounded-xl border border-dashed border-slate-600 p-6 text-center">
                <p className="text-slate-400 text-sm">No emergency contacts yet</p>
                <p className="text-[10px] text-slate-500 mt-1">Add at least one emergency contact</p>
              </div>
            )}

            <button
              onClick={() => { setCForm({ name: '', relation: '', phone: '' }); setError(null); setScreen('add_contact'); }}
              className="w-full bg-blue-600 rounded-xl px-4 py-3 text-sm font-bold active:bg-blue-700 transition-colors"
            >
              + Add Contact
            </button>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold active:bg-slate-700 transition-colors"
              >
                ← Back
              </button>
              <a
                href="/fcc"
                className="flex-1 bg-green-600 rounded-xl px-4 py-3 text-sm font-bold text-center active:bg-green-700 transition-colors"
              >
                Done — View Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Shared Components ──

function Header({ title, backHref, onBack }: { title: string; backHref?: string; onBack?: () => void }) {
  return (
    <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-slate-800">
      {backHref ? (
        <a href={backHref} aria-label="Go back" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</a>
      ) : (
        <button onClick={onBack} aria-label="Go back" className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 active:bg-slate-700 text-lg">←</button>
      )}
      <h1 className="text-lg font-bold">{title}</h1>
    </header>
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

function Input({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="py-1.5">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
      <p className="text-xs text-red-300">{message}</p>
      <button onClick={onDismiss} className="text-red-400 text-xs ml-2">×</button>
    </div>
  );
}

function HouseholdForm({ form, setForm }: {
  form: {
    name: string; address_line1: string; address_line2: string; city: string; state: string; zip: string;
    access_code: string; best_door: string; gate_code: string; animals: string; stair_info: string;
    hazards: string; aed_onsite: boolean; backup_power: string;
  };
  setForm: (f: typeof form) => void;
}) {
  return (
    <>
      <Section title="Address">
        <Input label="Household Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Delgado Household" required />
        <Input label="Address Line 1" value={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} required />
        <Input label="Address Line 2" value={form.address_line2} onChange={(v) => setForm({ ...form, address_line2: v })} placeholder="Apt, Suite, Unit" />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
          </div>
          <div>
            <Input label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
          </div>
          <div>
            <Input label="ZIP" value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} required />
          </div>
        </div>
      </Section>

      <Section title="Access Code">
        <Input label="4-Digit Access Code" value={form.access_code} onChange={(v) => setForm({ ...form, access_code: v })} placeholder="e.g. 4827" required />
        <p className="text-[10px] text-slate-500 mt-1">Residents give this to dispatch. EMS enters it to unlock the care card.</p>
      </Section>

      <Section title="Property Access">
        <Input label="Best Door" value={form.best_door} onChange={(v) => setForm({ ...form, best_door: v })} placeholder="e.g. Front door — faces PCH, blue awning" />
        <Input label="Gate Code" value={form.gate_code} onChange={(v) => setForm({ ...form, gate_code: v })} placeholder="e.g. 4491" />
        <Input label="Animals" value={form.animals} onChange={(v) => setForm({ ...form, animals: v })} placeholder="e.g. 1 small dog (friendly), usually in back yard" />
        <Input label="Stair Info" value={form.stair_info} onChange={(v) => setForm({ ...form, stair_info: v })} placeholder='e.g. Straight staircase, 14 steps, 36" wide' />
        <Input label="Hazards" value={form.hazards} onChange={(v) => setForm({ ...form, hazards: v })} placeholder="e.g. Oxygen in use — no open flame" />
        <div className="py-1.5 flex items-center gap-3">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">AED On-site</label>
          <button
            type="button"
            onClick={() => setForm({ ...form, aed_onsite: !form.aed_onsite })}
            className={`w-11 h-6 rounded-full transition-colors ${form.aed_onsite ? 'bg-green-600' : 'bg-slate-600'}`}
          >
            <span className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${form.aed_onsite ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <Input label="Backup Power" value={form.backup_power} onChange={(v) => setForm({ ...form, backup_power: v })} placeholder="e.g. No generator" />
      </Section>
    </>
  );
}
