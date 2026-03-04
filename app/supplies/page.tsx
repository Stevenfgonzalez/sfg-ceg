"use client";

import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// Community Emergency Guide — Go-Bag + Emergency Vault
// Enter household → auto-generate smart checklist + vault
// ═══════════════════════════════════════════════════════════════

const C = {
  bg: "#F8F9FB", card: "#FFF", bdr: "#E2E5EA", bdrF: "#1A56DB",
  tx: "#0F1419", txM: "#5B6578", txL: "#9CA3AF",
  pri: "#1A56DB", priL: "#EBF0FD",
  red: "#D32F2F", redL: "#FDECEA", redBg: "#FEF2F2",
  warn: "#E67E22", warnL: "#FDF3E7",
  grn: "#1B8A4E", grnL: "#E8F5EF",
  purp: "#7C3AED", purpL: "#F3EAFF",
  org: "#EA580C", orgL: "#FFF4ED",
};
const F = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ── Types ──────────────────────────────────────────────────────

interface HouseholdMember {
  id: number;
  name: string;
  role: string;
  age: string;
  afn: boolean;
  afnFlags: string[];
  meds: string[];
  mobility: string;
}

interface HouseholdAnimal {
  id: number;
  name: string;
  category: string;
  species: string;
  count: number;
  needsTrailer: boolean;
  trailerAvail: boolean;
}

interface Household {
  name: string;
  area: string;
  primaryZone: string;
  members: HouseholdMember[];
  animals: HouseholdAnimal[];
}

interface BagItem {
  id: number;
  name: string;
  category: string;
  priority: string;
  packed: boolean;
  source: string;
  reason: string | null;
  notes: string | null;
  qty?: number;
  unit?: string;
  expires?: string;
  location?: string;
}

interface VaultItem {
  id: number;
  name: string;
  category: string;
  priority: string;
  has_copy: boolean;
  grab: boolean;
  grabLoc?: string;
  insurance: boolean;
  notes: string | null;
  forMember?: string;
}

// ── Factories ──────────────────────────────────────────────────

const emptyMember = (): HouseholdMember => ({
  id: Date.now() + Math.random(),
  name: "",
  role: "ADULT",
  age: "adult",
  afn: false,
  afnFlags: [],
  meds: [],
  mobility: "",
});

const emptyAnimal = (): HouseholdAnimal => ({
  id: Date.now() + Math.random(),
  name: "",
  category: "PET",
  species: "dog",
  count: 1,
  needsTrailer: false,
  trailerAvail: false,
});

// ── Smart Go-Bag Generator ─────────────────────────────────────
function generateChecklist(hh: Household): BagItem[] {
  const items: BagItem[] = [];
  let id = 0;
  const add = (name: string, cat: string, pri: string, opts: { source?: string; reason?: string; notes?: string; qty?: number; unit?: string; expires?: string; location?: string } = {}) =>
    items.push({ id: id++, name, category: cat, priority: pri, packed: false, source: opts.source || "universal", reason: opts.reason || null, notes: opts.notes || null, qty: opts.qty, unit: opts.unit, expires: opts.expires, location: opts.location });

  const n = Math.max(hh.members.length, 1);

  // CRITICAL
  add("House & car keys", "keys", "critical");
  add("Phone + charger + power bank", "power", "critical");
  add("Wallet / ID / debit card", "documents", "critical");
  add("Fireproof documents box", "documents", "critical", { notes: "See Vault for full list. Grab the whole box.", location: "Hall closet" });
  add("Full gas tank", "vehicle", "critical", { notes: "Keep above half on Red Flag days" });

  hh.members.filter(m => m.meds.length > 0 || m.afn).forEach(m => {
    add(`Prescription medications \u2014 ${m.name || "member"}`, "medication", "critical", { source: "auto", reason: `${m.name || "member"}: ${m.meds.join(", ") || "AFN member"}` });
  });
  hh.members.filter(m => m.afnFlags.includes("oxygen")).forEach(m => {
    add(`Portable oxygen supply \u2014 ${m.name || "member"}`, "medical_equipment", "critical", { source: "auto", reason: `${m.name || "member"} \u2014 oxygen dependent`, notes: "Check tank level weekly" });
  });
  hh.members.filter(m => m.afnFlags.includes("mobility") && m.mobility === "wheelchair").forEach(m => {
    add(`Wheelchair batteries / manual backup \u2014 ${m.name || "member"}`, "medical_equipment", "critical", { source: "auto", reason: `${m.name || "member"} \u2014 wheelchair user` });
  });
  hh.members.filter(m => m.age === "infant").forEach(m => {
    add(`Formula / breast milk \u2014 ${m.name || "infant"}`, "infant", "critical", { source: "auto", reason: `Infant: ${m.name || "infant"}`, notes: "3-day supply minimum" });
    add(`Car seat \u2014 ${m.name || "infant"}`, "infant", "critical", { source: "auto", reason: `Infant: ${m.name || "infant"}` });
  });
  hh.animals.filter(a => a.category === "LIVESTOCK" && a.needsTrailer).forEach(a => {
    add(`Trailer pre-hitched \u2014 ${a.count}x ${a.species}`, "livestock", "critical", { source: "auto", reason: `${a.count} ${a.species} need trailer`, notes: a.trailerAvail ? "Keep hitched on Red Flag days" : "\u26a0 NO TRAILER \u2014 arrange in advance" });
  });

  // ESSENTIAL
  add("Water", "water", "essential", { qty: n * 3, unit: "gallons", notes: `${n} people \u00d7 1 gal/day \u00d7 3 days` });
  add("Non-perishable food (3-day supply)", "food", "essential", { qty: n, unit: "per person", expires: "2026-09-01" });
  add("First aid kit", "first_aid", "essential", { expires: "2026-12-01" });
  add("N95 masks", "fire_safety", "essential", { qty: n * 3, unit: "masks", notes: "Smoke/ash \u2014 critical in wildfire" });
  add("Flashlight + extra batteries", "lighting", "essential", { expires: "2027-01-01" });
  add("Battery-powered radio", "communication", "essential");
  add("Whistle", "communication", "essential");
  add("Cash \u2014 small bills", "cash", "essential", { notes: "ATMs and card readers may be down. $200+ recommended." });

  hh.members.filter(m => m.age === "infant").forEach(m => {
    add(`Diapers + wipes \u2014 ${m.name || "infant"}`, "infant", "essential", { source: "auto", reason: `Infant: ${m.name || "infant"}`, qty: 3, unit: "days supply" });
    add("Bottles + pacifiers", "infant", "essential", { source: "auto", reason: "Infant in household" });
  });
  hh.members.filter(m => m.age === "elderly").forEach(m => {
    add(`Extra medication supply (7 days) \u2014 ${m.name || "member"}`, "medication", "essential", { source: "auto", reason: `${m.name || "member"} \u2014 elderly`, notes: "Pharmacies may be closed for days" });
    add(`Written medication list \u2014 ${m.name || "member"}`, "medication", "essential", { source: "auto", reason: `${m.name || "member"}`, notes: "Drug, dose, frequency, doctor, pharmacy" });
  });
  hh.animals.filter(a => a.category === "PET").forEach(a => {
    add(`Pet food (3 days) \u2014 ${a.name || a.species}`, "pet", "essential", { source: "auto", reason: `Pet: ${a.name || a.species} (${a.species})` });
    add(`${a.species === "cat" ? "Carrier" : "Leash"} \u2014 ${a.name || a.species}`, "pet", "essential", { source: "auto", reason: `Pet: ${a.name || a.species}` });
  });
  hh.animals.filter(a => a.category === "LIVESTOCK").forEach(a => {
    add(`Halters + lead ropes \u2014 ${a.count}x ${a.species}`, "livestock", "essential", { source: "auto", reason: `${a.count}x ${a.species}` });
    add(`Feed (3 days) \u2014 ${a.species}`, "livestock", "essential", { source: "auto", reason: `${a.count}x ${a.species}` });
  });

  // IMPORTANT
  add("Change of clothes per person", "clothing", "important", { qty: n, unit: "sets" });
  add("Sturdy closed-toe shoes", "clothing", "important", { notes: "Not sandals. Debris, ash, glass." });
  add("Rain jacket / warm layer", "clothing", "important");
  add("Toiletries / hygiene kit", "hygiene", "important");
  add("Emergency blankets / sleeping bags", "shelter", "important");
  add("Paper map of area", "tools", "important", { notes: "GPS may fail. Know your routes." });

  hh.members.filter(m => m.age === "child").forEach(m => {
    add(`Comfort item \u2014 ${m.name || "child"}`, "child", "important", { source: "auto", reason: `Child: ${m.name || "child"}`, notes: "Favorite toy, blanket, stuffed animal" });
    add(`Snacks \u2014 ${m.name || "child"}`, "child", "important", { source: "auto", reason: `Child: ${m.name || "child"}` });
  });
  hh.animals.filter(a => a.category === "PET").forEach(a => {
    add(`Vaccination records \u2014 ${a.name || a.species}`, "pet", "important", { source: "auto", reason: `${a.name || a.species}`, notes: "Required at shelters" });
  });
  hh.animals.filter(a => a.category === "LIVESTOCK").forEach(a => {
    add(`Vet records + brand inspection \u2014 ${a.species}`, "livestock", "important", { source: "auto", reason: `${a.count}x ${a.species}`, notes: "Proof of ownership required at evac sites" });
  });

  // NICE TO HAVE
  hh.members.filter(m => m.age === "child").forEach(m => {
    add(`Activities / book / tablet \u2014 ${m.name || "child"}`, "comfort", "nice_to_have", { source: "auto", reason: `Child: ${m.name || "child"}`, notes: "Shelter stays can be long" });
  });
  add("Pillow / comfort items", "comfort", "nice_to_have");
  add("Book / entertainment", "comfort", "nice_to_have");

  return items;
}

// ── Smart Vault Generator ──────────────────────────────────────
function generateVault(hh: Household): VaultItem[] {
  const items: VaultItem[] = [];
  let id = 100;
  const add = (name: string, cat: string, pri: string, opts: { grab?: boolean; grabLoc?: string; insurance?: boolean; notes?: string; forMember?: string } = {}) =>
    items.push({ id: id++, name, category: cat, priority: pri, has_copy: false, grab: opts.grab || false, grabLoc: opts.grabLoc, insurance: opts.insurance || false, notes: opts.notes || null, forMember: opts.forMember });

  // CRITICAL -- 48 hours
  hh.members.forEach(m => {
    add(`Driver's License / ID \u2014 ${m.name || "member"}`, "identity", "critical", { grab: true, forMember: m.name });
  });
  add("Passports (all family members)", "identity", "critical", { grab: true, grabLoc: "Fireproof box" });
  add("Social Security Cards", "identity", "critical", { grab: true, grabLoc: "Fireproof box" });
  add("Home Insurance Policy", "insurance", "critical", { grab: true, insurance: true, notes: "Policy #, agent name/phone, coverage limits. THIS IS THE MOST IMPORTANT DOCUMENT FOR RECOVERY." });
  add("Insurance Agent Contact Info", "insurance", "critical", { notes: "Name, phone, email. Save in phone contacts too." });
  add("Auto Insurance Policy + Cards", "insurance", "critical", { insurance: true });
  add("Health Insurance Cards", "insurance", "critical", { grab: true });

  hh.members.filter(m => m.meds.length > 0 || m.afn || m.age === "elderly").forEach(m => {
    add(`Current Medication List \u2014 ${m.name || "member"}`, "medical", "critical", { grab: true, forMember: m.name, notes: "Drug name, dosage, frequency, doctor, pharmacy + phone" });
  });
  add("Doctor / Specialist Contact List", "medical", "critical");
  add("Pharmacy Info (name, phone, Rx numbers)", "medical", "critical");

  hh.members.filter(m => m.role === "CHILD").forEach(m => {
    add(`Birth Certificate \u2014 ${m.name || "child"}`, "identity_child", "critical", { grab: true, forMember: m.name });
    add(`Social Security Card \u2014 ${m.name || "child"}`, "identity_child", "critical", { forMember: m.name });
  });

  // IMPORTANT -- 1-2 weeks
  add("Property Deed / Mortgage Documents", "property", "important", { insurance: true });
  add("Vehicle Title(s)", "property", "important");
  add("Vehicle Registration(s)", "property", "important");
  add("Recent Tax Returns (2 years)", "financial", "important");
  add("Bank Account Information", "financial", "important", { notes: "Institution, account type, last 4. Enough to access funds." });
  add("Credit Card Info + Customer Service #s", "financial", "important", { notes: "For replacement cards" });
  add("Will / Trust Documents", "legal", "important");
  add("Power of Attorney", "legal", "important");

  if (hh.members.some(m => m.role === "CHILD")) {
    add("Custody Agreements / Court Orders", "legal", "important", { notes: "Schools and shelters may require proof" });
    add("School Enrollment Records", "education", "important", { notes: "Needed to re-enroll if school destroyed" });
    add("Immunization Records (children)", "medical", "important", { notes: "Required for school enrollment" });
  }
  if (hh.members.some(m => m.age === "elderly")) {
    add("Advance Directive / DNR", "medical", "important", { grab: true });
    add("Healthcare Power of Attorney", "medical", "important");
  }
  hh.animals.filter(a => a.category === "PET").forEach(a => {
    add(`Vaccination Records \u2014 ${a.name || a.species}`, "pet", "important", { notes: "Required at shelters" });
    add(`Microchip # \u2014 ${a.name || a.species}`, "pet", "important", { notes: "How they get returned if lost" });
  });
  hh.animals.filter(a => a.category === "LIVESTOCK").forEach(a => {
    add(`Brand Inspection Docs \u2014 ${a.species}`, "livestock", "important", { insurance: true, notes: "Proof of ownership at evac sites" });
  });

  // HELPFUL
  add("Home Inventory (video walkthrough)", "home_inventory", "helpful", { insurance: true, notes: "Walk through every room. Open every drawer. 10 minutes saves weeks of claims." });
  add("Photos of Home Exterior + Interior", "home_inventory", "helpful", { insurance: true, notes: "Before disaster. Proves condition." });
  add("Major Purchase Receipts", "receipts", "helpful", { insurance: true });
  add("Home Improvement Records", "receipts", "helpful", { insurance: true, notes: "Contractor invoices, permits. Increases claim value." });
  add("Professional Licenses / Certifications", "education", "helpful", { notes: "Hard to replace if lost" });
  add("Family Photos / Digital Backup", "personal", "helpful", { notes: "Cloud backup or external drive. Irreplaceable." });
  add("Safe Deposit Box Info", "financial", "helpful");

  return items;
}

// ── Shared UI Components ───────────────────────────────────────
function Btn({ onClick, disabled, v = "pri", full, children, s = {} }: { onClick?: () => void; disabled?: boolean; v?: string; full?: boolean; children: React.ReactNode; s?: React.CSSProperties }) {
  const vs: Record<string, React.CSSProperties> = {
    pri: { background: C.pri, color: "#fff", border: "none" },
    out: { background: "transparent", color: C.pri, border: `2px solid ${C.pri}` },
    ghost: { background: "transparent", color: C.txM, border: "none", padding: "8px 14px" },
    grn: { background: C.grn, color: "#fff", border: "none" },
    red: { background: C.red, color: "#fff", border: "none" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ padding: "11px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: F, opacity: disabled ? 0.4 : 1, width: full ? "100%" : "auto", transition: "0.15s", ...vs[v], ...s }}>{children}</button>;
}

function Card({ children, s = {} }: { children: React.ReactNode; s?: React.CSSProperties }) {
  return <div style={{ background: C.card, borderRadius: 12, padding: 18, border: `1px solid ${C.bdr}`, marginBottom: 12, ...s }}>{children}</div>;
}

function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 5, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color, background: bg, textTransform: "uppercase" }}>{children}</span>;
}

function SL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: C.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>{children}</div>;
}

function Input({ label, value, onChange, placeholder, type = "text", req, style }: { label?: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; req?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.tx, marginBottom: 4 }}>{label}{req && <span style={{ color: C.red }}> *</span>}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, outline: "none", boxSizing: "border-box", background: "#FAFAFA" }} onFocus={e => (e.target.style.borderColor = C.bdrF)} onBlur={e => (e.target.style.borderColor = C.bdr)} />
    </div>
  );
}

function Select({ label, value, onChange, options, style }: { label?: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; style?: React.CSSProperties }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.tx, marginBottom: 4 }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, background: "#FAFAFA", boxSizing: "border-box" }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange, desc }: { label: string; checked: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, cursor: "pointer" }} onClick={() => onChange(!checked)}>
      <div style={{ width: 38, minWidth: 38, height: 20, borderRadius: 10, background: checked ? C.pri : C.bdr, position: "relative", transition: ".15s", marginTop: 2 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: checked ? 20 : 2, transition: ".15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </div>
      <div><div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>{label}</div>{desc && <div style={{ fontSize: 11, color: C.txM, marginTop: 1 }}>{desc}</div>}</div>
    </div>
  );
}

const PriorityConfig: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  critical: { label: "CRITICAL", color: C.red, bg: C.redL, icon: "\ud83d\udd34", desc: "Grab first \u2014 life safety" },
  essential: { label: "ESSENTIAL", color: C.org, bg: C.orgL, icon: "\ud83d\udfe0", desc: "Core survival items" },
  important: { label: "IMPORTANT", color: C.warn, bg: C.warnL, icon: "\ud83d\udfe1", desc: "Significantly helps" },
  nice_to_have: { label: "NICE TO HAVE", color: C.txL, bg: "#F3F4F6", icon: "\u26aa", desc: "Comfort items" },
  helpful: { label: "HELPFUL", color: C.warn, bg: C.warnL, icon: "\ud83d\udfe1", desc: "Makes recovery easier" },
};

function ReadinessGauge({ score, label, total, done }: { score: number; label: string; total: number; done: number }) {
  const color = score >= 80 ? C.grn : score >= 50 ? C.warn : C.red;
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 18, border: `1px solid ${C.bdr}`, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{label}</div>
          <div style={{ fontSize: 12, color: C.txM }}>{done} of {total} items ready</div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{score}%</div>
      </div>
      <div style={{ height: 8, background: "#E2E5EA", borderRadius: 4 }}>
        <div style={{ height: 8, background: color, borderRadius: 4, width: `${score}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOUSEHOLD SETUP FORM
// ═══════════════════════════════════════════════════════════════

function HouseholdSetup({ onDone }: { onDone: (hh: Household) => void }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [primaryZone, setPrimaryZone] = useState("");
  const [members, setMembers] = useState<HouseholdMember[]>([emptyMember()]);
  const [animals, setAnimals] = useState<HouseholdAnimal[]>([]);

  const updateMember = (i: number, patch: Partial<HouseholdMember>) => {
    setMembers(prev => prev.map((m, j) => j === i ? { ...m, ...patch } : m));
  };
  const addMember = () => setMembers(prev => [...prev, emptyMember()]);
  const removeMember = (i: number) => setMembers(prev => prev.filter((_, j) => j !== i));

  const updateAnimal = (i: number, patch: Partial<HouseholdAnimal>) => {
    setAnimals(prev => prev.map((a, j) => j === i ? { ...a, ...patch } : a));
  };
  const addAnimal = () => setAnimals(prev => [...prev, emptyAnimal()]);
  const removeAnimal = (i: number) => setAnimals(prev => prev.filter((_, j) => j !== i));

  const ageIcons: Record<string, string> = { adult: "\ud83e\uddd1", child: "\ud83d\udc67", infant: "\ud83d\udc76", elderly: "\ud83d\udc74" };
  const speciesIcons: Record<string, string> = { dog: "\ud83d\udc15", cat: "\ud83d\udc08", bird: "\ud83e\udd9c", horse: "\ud83d\udc34", goat: "\ud83d\udc10", chicken: "\ud83d\udc14", other: "\ud83d\udc3e" };

  const canSubmit = members.length > 0;

  return (
    <div style={{ fontFamily: F, background: C.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#0C1A2E", color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: "linear-gradient(135deg, #1A56DB, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>CEG</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Community Emergency Guide</div>
              <div style={{ fontSize: 10, color: "#7C8DB0", letterSpacing: 0.8 }}>GO-BAG &amp; EMERGENCY VAULT SETUP</div>
            </div>
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", color: C.tx }}>Tell us about your household</h2>
        <p style={{ color: C.txM, fontSize: 13, margin: "0 0 20px" }}>We&apos;ll auto-generate a personalized Go-Bag checklist and Emergency Vault based on who lives in your home.</p>

        {/* ── Household basics ── */}
        <Card>
          <SL>Household Info</SL>
          <Input label="Household Name" value={name} onChange={setName} placeholder="The Garcia Family (optional)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <Input label="Area / Neighborhood" value={area} onChange={setArea} placeholder="Topanga Canyon" />
            <Input label="Primary Safe Zone" value={primaryZone} onChange={setPrimaryZone} placeholder="Calabasas High School" />
          </div>
        </Card>

        {/* ── Members ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{"\ud83d\udc65"} People in Household</div>
          <Btn v="out" onClick={addMember} s={{ padding: "6px 14px", fontSize: 12 }}>+ Add Person</Btn>
        </div>

        {members.map((m, i) => (
          <Card key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 20 }}>{ageIcons[m.age] || "\ud83e\uddd1"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.pri }}>Person {i + 1}</span>
              </div>
              {members.length > 1 && <Btn v="ghost" onClick={() => removeMember(i)} s={{ color: C.red, fontSize: 12, padding: "4px 10px" }}>Remove</Btn>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <Input label="Name" value={m.name} onChange={v => updateMember(i, { name: v })} placeholder="First name" req />
              <Select label="Age Group" value={m.age} onChange={v => updateMember(i, { age: v, role: v === "child" || v === "infant" ? "CHILD" : v === "elderly" ? "DEPENDENT" : "ADULT" })} options={[
                { v: "adult", l: "Adult" },
                { v: "child", l: "Child" },
                { v: "infant", l: "Infant" },
                { v: "elderly", l: "Elderly" },
              ]} />
            </div>

            <Toggle label="Access & Functional Needs (AFN)" checked={m.afn} onChange={v => updateMember(i, { afn: v })} desc="Mobility, oxygen, medication, cognitive, sensory" />

            {m.afn && (
              <div style={{ background: C.warnL, padding: 12, borderRadius: 8, marginBottom: 10 }}>
                <Input label="AFN Details (comma-separated)" value={m.afnFlags.join(", ")} onChange={v => updateMember(i, { afnFlags: v.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="wheelchair, oxygen, mobility" />
                <Select label="Mobility" value={m.mobility} onChange={v => updateMember(i, { mobility: v })} options={[
                  { v: "", l: "No mobility aid" },
                  { v: "wheelchair", l: "Wheelchair" },
                  { v: "walker", l: "Walker" },
                  { v: "cane", l: "Cane" },
                ]} />
              </div>
            )}

            <Input label="Medications (comma-separated)" value={m.meds.join(", ")} onChange={v => updateMember(i, { meds: v.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="insulin, blood pressure, inhaler" />
          </Card>
        ))}

        {/* ── Animals ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tx }}>{"\ud83d\udc3e"} Pets &amp; Livestock</div>
          <Btn v="out" onClick={addAnimal} s={{ padding: "6px 14px", fontSize: 12 }}>+ Add Animal</Btn>
        </div>

        {animals.length === 0 && (
          <Card s={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{"\ud83d\udc3e"}</div>
            <div style={{ fontSize: 13, color: C.txM }}>No animals added. Skip if none.</div>
          </Card>
        )}

        {animals.map((a, i) => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 20 }}>{speciesIcons[a.species] || "\ud83d\udc3e"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: a.category === "LIVESTOCK" ? C.purp : C.pri }}>{a.category === "LIVESTOCK" ? "Livestock" : "Pet"} {i + 1}</span>
              </div>
              <Btn v="ghost" onClick={() => removeAnimal(i)} s={{ color: C.red, fontSize: 12, padding: "4px 10px" }}>Remove</Btn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
              <Input label="Name" value={a.name} onChange={v => updateAnimal(i, { name: v })} placeholder="Max" />
              <Select label="Type" value={a.category} onChange={v => updateAnimal(i, { category: v, needsTrailer: v === "LIVESTOCK", species: v === "LIVESTOCK" ? "horse" : a.species })} options={[
                { v: "PET", l: "Pet" },
                { v: "LIVESTOCK", l: "Livestock" },
              ]} />
              <Select label="Species" value={a.species} onChange={v => updateAnimal(i, { species: v })} options={a.category === "LIVESTOCK"
                ? [{ v: "horse", l: "Horse" }, { v: "goat", l: "Goat" }, { v: "chicken", l: "Chicken" }, { v: "cow", l: "Cow" }, { v: "sheep", l: "Sheep" }, { v: "pig", l: "Pig" }, { v: "other", l: "Other" }]
                : [{ v: "dog", l: "Dog" }, { v: "cat", l: "Cat" }, { v: "bird", l: "Bird" }, { v: "other", l: "Other" }]
              } />
            </div>
            {a.category === "LIVESTOCK" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
                <Input label="Count" value={a.count} onChange={v => updateAnimal(i, { count: parseInt(v) || 1 })} type="number" />
                <div style={{ marginBottom: 12 }}>
                  <Toggle label="Needs trailer" checked={a.needsTrailer} onChange={v => updateAnimal(i, { needsTrailer: v })} />
                </div>
                {a.needsTrailer && (
                  <div style={{ marginBottom: 12 }}>
                    <Toggle label="Trailer available" checked={a.trailerAvail} onChange={v => updateAnimal(i, { trailerAvail: v })} />
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        {/* ── Generate button ── */}
        <div style={{ marginTop: 28, marginBottom: 40 }}>
          <Card s={{ background: C.priL, border: `1px solid ${C.pri}33`, textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.pri, marginBottom: 4 }}>Ready to generate your personalized lists?</div>
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 16 }}>We&apos;ll create a smart Go-Bag checklist and Emergency Vault tailored to your household.</div>
            <Btn onClick={() => onDone({ name: name || "My Household", area: area || "My Area", primaryZone: primaryZone || "Not set", members, animals })} disabled={!canSubmit} s={{ padding: "14px 40px", fontSize: 16 }}>
              Generate My Go-Bag &amp; Vault
            </Btn>
          </Card>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ fontSize: 11, color: C.txL }}>
              {members.length} {members.length === 1 ? "person" : "people"} &middot; {animals.filter(a => a.category === "PET").length} pets &middot; {animals.filter(a => a.category === "LIVESTOCK").reduce((s, a) => s + a.count, 0)} livestock
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN — SUPPLIES + VAULT (after household is entered)
// ═══════════════════════════════════════════════════════════════

export default function CEGSuppliesVault() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [bagItems, setBagItems] = useState<BagItem[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [tab, setTab] = useState("bag");
  const [bagFilter, setBagFilter] = useState("all");
  const [vaultFilter, setVaultFilter] = useState("all");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPriority, setCustomPriority] = useState("important");
  const [addingValuable, setAddingValuable] = useState(false);
  const [valuableName, setValuableName] = useState("");
  const [valuableCat, setValuableCat] = useState("electronics");
  const [valuableValue, setValuableValue] = useState("");
  const [valuableSerial, setValuableSerial] = useState("");

  const handleSetup = useCallback((hh: Household) => {
    setHousehold(hh);
    setBagItems(generateChecklist(hh));
    setVaultItems(generateVault(hh));
    setTab("bag");
  }, []);

  // Show setup form until household is entered
  if (!household) {
    return <HouseholdSetup onDone={handleSetup} />;
  }

  const togglePacked = (id: number) => setBagItems(prev => prev.map(i => i.id === id ? { ...i, packed: !i.packed } : i));
  const toggleCopy = (id: number) => setVaultItems(prev => prev.map(i => i.id === id ? { ...i, has_copy: !i.has_copy } : i));

  const bagPacked = bagItems.filter(i => i.packed).length;
  const bagTotal = bagItems.length;
  const bagScore = bagTotal > 0 ? Math.round((bagPacked / bagTotal) * 100) : 0;
  const bagCritical = bagItems.filter(i => i.priority === "critical");
  const bagCriticalPacked = bagCritical.filter(i => i.packed).length;

  const vaultDone = vaultItems.filter(i => i.has_copy).length;
  const vaultTotal = vaultItems.length;
  const vaultScore = vaultTotal > 0 ? Math.round((vaultDone / vaultTotal) * 100) : 0;
  const vaultCritical = vaultItems.filter(i => i.priority === "critical");
  const vaultCriticalDone = vaultCritical.filter(i => i.has_copy).length;

  const overallScore = Math.round((bagScore + vaultScore) / 2);

  const criticalGaps = [
    ...bagItems.filter(i => i.priority === "critical" && !i.packed).map(i => `Pack: ${i.name}`),
    ...vaultItems.filter(i => i.priority === "critical" && !i.has_copy).map(i => `Vault: ${i.name}`),
  ].slice(0, 5);

  const filteredBag = bagFilter === "all" ? bagItems : bagItems.filter(i => i.priority === bagFilter);
  const filteredVault = vaultFilter === "all" ? vaultItems : vaultItems.filter(i => i.priority === vaultFilter);

  const priorities = ["critical", "essential", "important", "nice_to_have"];
  const vaultPriorities = ["critical", "important", "helpful"];

  const addCustomItem = () => {
    if (!customName.trim()) return;
    setBagItems(prev => [...prev, { id: Date.now(), name: customName, category: "custom", priority: customPriority, packed: false, source: "custom", reason: null, notes: null }]);
    setCustomName("");
    setAddingCustom(false);
  };

  const addValuable = () => {
    if (!valuableName.trim()) return;
    setVaultItems(prev => [...prev, { id: Date.now(), name: valuableName, category: valuableCat, priority: "helpful", has_copy: false, grab: false, insurance: true, notes: `Est. value: ${valuableValue}${valuableSerial ? ` | S/N: ${valuableSerial}` : ""}` }]);
    setValuableName(""); setValuableValue(""); setValuableSerial("");
    setAddingValuable(false);
  };

  return (
    <div style={{ fontFamily: F, background: C.bg, minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#0C1A2E", color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: "linear-gradient(135deg, #1A56DB, #3B82F6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>CEG</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Community Emergency Guide</div>
              <div style={{ fontSize: 10, color: "#7C8DB0", letterSpacing: 0.8 }}>{household.name} &middot; {household.area}</div>
            </div>
          </a>
          <button onClick={() => setHousehold(null)} style={{ background: "transparent", border: "1px solid #334155", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#94A3B8", cursor: "pointer", fontFamily: F, fontWeight: 600 }}>
            Edit Household
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.bdr}`, padding: "0 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 0 }}>
          {([
            { key: "bag", label: "Go-Bag", icon: "\ud83c\udf92" },
            { key: "vault", label: "Vault", icon: "\ud83d\udd10" },
            { key: "ready", label: "Readiness", icon: "\ud83d\udcca" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "14px 8px", background: "transparent", border: "none", borderBottom: tab === t.key ? `3px solid ${C.pri}` : "3px solid transparent", fontSize: 13, fontWeight: tab === t.key ? 700 : 500, color: tab === t.key ? C.pri : C.txM, cursor: "pointer", fontFamily: F, transition: "0.15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>

        {/* ═══ GO-BAG TAB ═══ */}
        {tab === "bag" && (<div>
          <ReadinessGauge score={bagScore} label="Go-Bag Readiness" total={bagTotal} done={bagPacked} />

          {bagCriticalPacked < bagCritical.length && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redL}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>{"\u26a0"} {bagCritical.length - bagCriticalPacked} CRITICAL ITEMS NOT PACKED</div>
              <div style={{ fontSize: 12, color: C.tx, lineHeight: 1.6 }}>
                {bagCritical.filter(i => !i.packed).slice(0, 4).map((i, idx) => (
                  <div key={idx}>&middot; {i.name}</div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {["all", ...priorities].map(f => {
              const cfg = PriorityConfig[f];
              const count = f === "all" ? bagItems.length : bagItems.filter(i => i.priority === f).length;
              return (
                <button key={f} onClick={() => setBagFilter(f)} style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${bagFilter === f ? C.pri : C.bdr}`, background: bagFilter === f ? C.priL : "transparent", color: bagFilter === f ? C.pri : C.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
                  {f === "all" ? "All" : `${cfg?.icon || ""} ${cfg?.label || f}`} ({count})
                </button>
              );
            })}
          </div>

          {/* Items grouped by priority */}
          {(bagFilter === "all" ? priorities : [bagFilter]).map(pri => {
            const cfg = PriorityConfig[pri];
            const groupItems = filteredBag.filter(i => i.priority === pri);
            if (groupItems.length === 0) return null;
            const groupPacked = groupItems.filter(i => i.packed).length;
            return (
              <div key={pri} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.8 }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.txM }}>{groupPacked}/{groupItems.length}</span>
                </div>
                {groupItems.map(item => (
                  <div key={item.id} onClick={() => togglePacked(item.id)} style={{ display: "flex", gap: 12, padding: "12px 14px", background: C.card, borderRadius: 10, border: `1px solid ${item.packed ? C.grn : C.bdr}`, marginBottom: 6, cursor: "pointer", transition: "0.15s", opacity: item.packed ? 0.7 : 1 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.packed ? C.grn : C.bdr}`, background: item.packed ? C.grnL : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.grn, flexShrink: 0, marginTop: 1 }}>
                      {item.packed && "\u2713"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.tx, textDecoration: item.packed ? "line-through" : "none" }}>{item.name}</div>
                      {item.qty && <div style={{ fontSize: 11, color: C.txM }}>Qty: {item.qty} {item.unit}</div>}
                      {item.notes && <div style={{ fontSize: 11, color: C.txM, marginTop: 2 }}>{item.notes}</div>}
                      {item.location && <div style={{ fontSize: 11, color: C.pri, marginTop: 2 }}>{"\ud83d\udccd"} {item.location}</div>}
                      {item.expires && <div style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>{"\u23f0"} Expires: {item.expires}</div>}
                      {item.source === "auto" && (
                        <div style={{ marginTop: 4 }}><Badge color={C.purp} bg={C.purpL}>AUTO: {item.reason}</Badge></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add custom */}
          {!addingCustom ? (
            <Btn v="out" full onClick={() => setAddingCustom(true)}>+ Add Custom Item</Btn>
          ) : (
            <Card>
              <SL>Add Custom Item</SL>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Item name..." style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, boxSizing: "border-box", marginBottom: 10 }} />
              <select value={customPriority} onChange={e => setCustomPriority(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, marginBottom: 12 }}>
                {priorities.map(p => <option key={p} value={p}>{PriorityConfig[p].label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn v="ghost" onClick={() => setAddingCustom(false)}>Cancel</Btn>
                <Btn onClick={addCustomItem} disabled={!customName.trim()}>Add</Btn>
              </div>
            </Card>
          )}
        </div>)}

        {/* ═══ VAULT TAB ═══ */}
        {tab === "vault" && (<div>
          <ReadinessGauge score={vaultScore} label="Emergency Vault" total={vaultTotal} done={vaultDone} />

          {vaultCriticalDone < vaultCritical.length && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redL}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 }}>{"\u26a0"} {vaultCritical.length - vaultCriticalDone} CRITICAL DOCUMENTS MISSING</div>
              <div style={{ fontSize: 12, color: C.tx, lineHeight: 1.6 }}>
                {vaultCritical.filter(i => !i.has_copy).slice(0, 4).map((i, idx) => (
                  <div key={idx}>&middot; {i.name}</div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {["all", ...vaultPriorities].map(f => {
              const cfg = PriorityConfig[f];
              const count = f === "all" ? vaultItems.length : vaultItems.filter(i => i.priority === f).length;
              return (
                <button key={f} onClick={() => setVaultFilter(f)} style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${vaultFilter === f ? C.pri : C.bdr}`, background: vaultFilter === f ? C.priL : "transparent", color: vaultFilter === f ? C.pri : C.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
                  {f === "all" ? "All" : `${cfg?.icon || ""} ${cfg?.label || f}`} ({count})
                </button>
              );
            })}
            <button onClick={() => setVaultFilter("insurance")} style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px solid ${vaultFilter === "insurance" ? C.pri : C.bdr}`, background: vaultFilter === "insurance" ? C.priL : "transparent", color: vaultFilter === "insurance" ? C.pri : C.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
              {"\ud83d\udcb0"} Insurance ({vaultItems.filter(i => i.insurance).length})
            </button>
          </div>

          {/* Vault items grouped by priority */}
          {(vaultFilter === "all" ? vaultPriorities : vaultFilter === "insurance" ? ["insurance"] : [vaultFilter]).map(pri => {
            const cfg = PriorityConfig[pri] || { icon: "\ud83d\udcb0", label: "INSURANCE RELEVANT", color: C.org };
            const groupItems = pri === "insurance" ? vaultItems.filter(i => i.insurance) : filteredVault.filter(i => i.priority === pri);
            if (groupItems.length === 0) return null;
            const groupDone = groupItems.filter(i => i.has_copy).length;
            const timeline = pri === "critical" ? "Need within 48 hours" : pri === "important" ? "Need within 1-2 weeks" : pri === "helpful" ? "Makes recovery easier" : "For insurance claims";
            return (
              <div key={pri} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.8 }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.txM }}>{groupDone}/{groupItems.length}</span>
                </div>
                <div style={{ fontSize: 11, color: C.txM, marginBottom: 10 }}>{timeline}</div>
                {groupItems.map(item => (
                  <div key={item.id} style={{ display: "flex", gap: 12, padding: "12px 14px", background: C.card, borderRadius: 10, border: `1px solid ${item.has_copy ? C.grn : C.bdr}`, marginBottom: 6, transition: "0.15s" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>{item.name}</div>
                      {item.notes && <div style={{ fontSize: 11, color: C.txM, marginTop: 2 }}>{item.notes}</div>}
                      {item.grab && <div style={{ fontSize: 11, color: C.org, marginTop: 2 }}>{"\ud83c\udfc3"} Grab on evac{item.grabLoc ? ` \u2014 ${item.grabLoc}` : ""}</div>}
                      {item.insurance && <Badge color={C.org} bg={C.orgL}>Insurance</Badge>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => toggleCopy(item.id)} style={{ padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${item.has_copy ? C.grn : C.bdr}`, background: item.has_copy ? C.grnL : "transparent", color: item.has_copy ? C.grn : C.txM, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
                        {item.has_copy ? "\u2713 Have it" : "Have it"}
                      </button>
                      <button style={{ padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${C.bdr}`, background: "transparent", color: C.pri, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: F }}>
                        {"\ud83d\udcce"} Upload
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add valuable */}
          <div style={{ marginTop: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>{"\ud83d\udc8e"} Valuables Inventory</div>
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 12 }}>Document valuable items for insurance claims. Photos + serial numbers = faster recovery.</div>
            {!addingValuable ? (
              <Btn v="out" full onClick={() => setAddingValuable(true)}>+ Add Valuable Item</Btn>
            ) : (
              <Card>
                <input value={valuableName} onChange={e => setValuableName(e.target.value)} placeholder='Item name (e.g., MacBook Pro 14")' style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, boxSizing: "border-box", marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={valuableValue} onChange={e => setValuableValue(e.target.value)} placeholder="Est. value ($)" style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F }} />
                  <input value={valuableSerial} onChange={e => setValuableSerial(e.target.value)} placeholder="Serial # (optional)" style={{ padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F }} />
                </div>
                <select value={valuableCat} onChange={e => setValuableCat(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1.5px solid ${C.bdr}`, fontSize: 14, fontFamily: F, marginBottom: 10 }}>
                  <option value="electronics">Electronics</option>
                  <option value="jewelry">Jewelry</option>
                  <option value="art">Art / Collectibles</option>
                  <option value="instruments">Musical Instruments</option>
                  <option value="firearms">Firearms</option>
                  <option value="heirlooms">Heirlooms</option>
                  <option value="other">Other</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="ghost" onClick={() => setAddingValuable(false)}>Cancel</Btn>
                  <Btn onClick={addValuable} disabled={!valuableName.trim()}>Add Valuable</Btn>
                </div>
              </Card>
            )}
          </div>

          {/* Share vault */}
          <Card s={{ background: C.priL, border: `1px solid ${C.pri}22` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, marginBottom: 4 }}>{"\ud83d\udd17"} Share Vault Access</div>
            <div style={{ fontSize: 12, color: C.txM, marginBottom: 10 }}>Give a trusted person (attorney, family outside area) read access to your vault.</div>
            <Btn v="out" s={{ fontSize: 12, padding: "8px 16px" }}>+ Add Trusted Person</Btn>
          </Card>
        </div>)}

        {/* ═══ READINESS TAB ═══ */}
        {tab === "ready" && (<div>
          <Card s={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: overallScore >= 80 ? C.grn : overallScore >= 50 ? C.warn : C.red, marginBottom: 4 }}>{overallScore}%</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.tx }}>Overall Readiness</div>
            <div style={{ fontSize: 13, color: C.txM }}>{household.name} &middot; {household.area}</div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <Card s={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: bagScore >= 80 ? C.grn : bagScore >= 50 ? C.warn : C.red }}>{bagScore}%</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{"\ud83c\udf92"} Go-Bag</div>
              <div style={{ fontSize: 11, color: C.txM }}>{bagPacked}/{bagTotal} packed</div>
            </Card>
            <Card s={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: vaultScore >= 80 ? C.grn : vaultScore >= 50 ? C.warn : C.red }}>{vaultScore}%</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tx }}>{"\ud83d\udd10"} Vault</div>
              <div style={{ fontSize: 11, color: C.txM }}>{vaultDone}/{vaultTotal} documented</div>
            </Card>
          </div>

          {criticalGaps.length > 0 && (
            <Card s={{ border: `1px solid ${C.red}33` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8 }}>{"\ud83d\udd34"} CRITICAL GAPS</div>
              {criticalGaps.map((g, i) => (
                <div key={i} style={{ fontSize: 13, color: C.tx, padding: "4px 0", borderBottom: i < criticalGaps.length - 1 ? `1px solid ${C.bdr}` : "none" }}>&middot; {g}</div>
              ))}
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.pri, marginBottom: 8 }}>{"\ud83d\udccb"} NEXT ACTIONS</div>
            <div style={{ fontSize: 13, color: C.tx, lineHeight: 2 }}>
              {bagItems.filter(i => i.priority === "critical" && !i.packed).length > 0 && <div>1. Pack critical go-bag items ({bagItems.filter(i => i.priority === "critical" && !i.packed).length} remaining)</div>}
              {vaultItems.filter(i => i.priority === "critical" && !i.has_copy && i.category === "insurance").length > 0 && <div>2. Upload your insurance policy to the vault</div>}
              {vaultItems.filter(i => i.category === "home_inventory" && !i.has_copy).length > 0 && <div>3. Do a 10-minute video walkthrough of your home</div>}
              {vaultItems.filter(i => i.priority === "critical" && !i.has_copy && i.category === "medical").length > 0 && <div>4. Write out medication lists for all family members</div>}
              <div>{bagItems.filter(i => i.expires).length > 0 ? `5. Set calendar reminders for ${bagItems.filter(i => i.expires).length} expiring items` : "5. Review your plan before fire season"}</div>
            </div>
          </Card>

          <Card s={{ background: "#0C1A2E", color: "#fff", border: "none" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7C8DB0", marginBottom: 8 }}>{"\ud83c\udfe0"} HOUSEHOLD SUMMARY</div>
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div>{"\ud83d\udc65"} {household.members.length} people ({household.members.filter(m => m.role === "CHILD").length} children, {household.members.filter(m => m.afn).length} AFN)</div>
              <div>{"\ud83d\udc3e"} {household.animals.filter(a => a.category === "PET").length} pets</div>
              <div>{"\ud83d\udc34"} {household.animals.filter(a => a.category === "LIVESTOCK").reduce((s, a) => s + a.count, 0)} livestock</div>
              <div>{"\ud83d\udccd"} Primary: {household.primaryZone}</div>
              <div>{"\ud83c\udf92"} Go-Bag: {bagTotal} items ({bagItems.filter(i => i.source === "auto").length} auto-generated)</div>
              <div>{"\ud83d\udd10"} Vault: {vaultTotal} items</div>
            </div>
          </Card>
        </div>)}
      </div>
    </div>
  );
}
