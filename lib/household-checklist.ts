// Household pre-planning types and go-bag checklist generator.
// All data is localStorage-only — zero login, zero cloud.

export interface HouseholdMember {
  id: string;
  name: string;
  type: 'adult' | 'child' | 'elderly';
  age: number | null;
  afn: {
    medical: boolean;
    mobility: boolean;
    sensory: boolean;
    cognitive: boolean;
    medication: boolean;
  };
  medicalNotes: string;
}

export interface Pet {
  id: string;
  type: 'dog' | 'cat' | 'horse' | 'bird' | 'other';
  name: string;
  count: number;
  notes: string;
}

export interface GrabLocation {
  id: string;
  label: string;
  description: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  reason: string;
  packed: boolean;
}

export interface VaultItem {
  id: string;
  label: string;
  category: string;
  priority: 'critical' | 'important' | 'helpful';
  reason: string;
  grab: boolean;
  grabLoc: string;
  has_copy: boolean;
  notes: string;
}

export interface HouseholdData {
  members: HouseholdMember[];
  pets: Pet[];
  locations: GrabLocation[];
  checklist: ChecklistItem[];
  vault: VaultItem[];
  householdCode: string;
}

const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateHouseholdCode(): string {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_ALPHA[Math.floor(Math.random() * CODE_ALPHA.length)];
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

function item(label: string, reason: string): ChecklistItem {
  return { id: `${label}-${reason}`, label, reason, packed: false };
}

export function generateGoBagChecklist(data: HouseholdData): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Always include essentials
  items.push(item('Water (1 gallon per person per day)', 'Essential'));
  items.push(item('Non-perishable food (3-day supply)', 'Essential'));
  items.push(item('Flashlight + extra batteries', 'Essential'));
  items.push(item('First aid kit', 'Essential'));
  items.push(item('Phone charger / power bank', 'Essential'));
  items.push(item('Cash (small bills)', 'Essential'));
  items.push(item('Important documents (copies)', 'Essential'));
  items.push(item('N95 masks', 'Essential'));

  const hasChildren = data.members.some(m => m.type === 'child');
  const hasInfants = data.members.some(m => m.type === 'child' && m.age !== null && m.age < 5);
  const hasElderly = data.members.some(m => m.type === 'elderly');
  const hasMedicalAFN = data.members.some(m => m.afn.medical || m.afn.medication);
  const hasMobilityAFN = data.members.some(m => m.afn.mobility);
  const hasSensoryAFN = data.members.some(m => m.afn.sensory);

  if (hasChildren) {
    items.push(item('Comfort items (stuffed animal, blanket)', 'Children in household'));
    items.push(item('Snacks kids will eat', 'Children in household'));
    items.push(item('Small entertainment (coloring book, cards)', 'Children in household'));
  }

  if (hasInfants) {
    items.push(item('Diapers + wipes (3-day supply)', 'Infant in household'));
    items.push(item('Formula / baby food', 'Infant in household'));
    items.push(item('Baby carrier', 'Infant in household'));
  }

  if (hasMedicalAFN) {
    items.push(item('Prescriptions (7-day supply)', 'Medical/medication needs'));
    items.push(item('Medication list with dosages', 'Medical/medication needs'));
    items.push(item('Doctor/pharmacy contact info', 'Medical/medication needs'));
  }

  if (hasMobilityAFN) {
    items.push(item('Wheelchair / walker', 'Mobility needs'));
    items.push(item('Mobility device charger', 'Mobility needs'));
  }

  if (hasSensoryAFN) {
    items.push(item('Hearing aids + extra batteries', 'Sensory needs'));
    items.push(item('Spare glasses / contacts', 'Sensory needs'));
  }

  if (hasElderly) {
    items.push(item('Portable oxygen (if needed)', 'Elderly member'));
    items.push(item('Medical alert device', 'Elderly member'));
  }

  const hasPets = data.pets.length > 0;
  const hasHorses = data.pets.some(p => p.type === 'horse');

  if (hasPets) {
    items.push(item('Pet food (3-day supply)', 'Pets in household'));
    items.push(item('Pet carrier / leash', 'Pets in household'));
    items.push(item('Pet medications', 'Pets in household'));
    items.push(item('Vaccination records', 'Pets in household'));
  }

  if (hasHorses) {
    items.push(item('Horse trailer (pre-hitched if possible)', 'Horses'));
    items.push(item('Hay / feed for transport', 'Horses'));
  }

  // Restore packed state from existing checklist
  const packedMap = new Map(data.checklist.map(c => [c.id, c.packed]));
  return items.map(i => ({ ...i, packed: packedMap.get(i.id) ?? false }));
}

// ── Vault generator ──

function vaultItem(label: string, category: string, priority: VaultItem['priority'], reason: string, opts: { grab?: boolean; grabLoc?: string; notes?: string } = {}): VaultItem {
  return {
    id: `vault-${label}-${reason}`,
    label,
    category,
    priority,
    reason,
    grab: opts.grab ?? false,
    grabLoc: opts.grabLoc ?? '',
    has_copy: false,
    notes: opts.notes ?? '',
  };
}

export function generateVault(data: HouseholdData): VaultItem[] {
  const items: VaultItem[] = [];

  // CRITICAL — need within 48 hours
  data.members.forEach(m => {
    const name = m.name || 'member';
    items.push(vaultItem(`Driver's License / ID — ${name}`, 'identity', 'critical', name, { grab: true }));
  });
  items.push(vaultItem('Passports (all family members)', 'identity', 'critical', 'Universal', { grab: true, grabLoc: 'Fireproof box' }));
  items.push(vaultItem('Social Security Cards', 'identity', 'critical', 'Universal', { grab: true, grabLoc: 'Fireproof box' }));
  items.push(vaultItem('Home Insurance Policy', 'insurance', 'critical', 'Recovery', { grab: true, notes: 'Policy #, agent name/phone, coverage limits. MOST IMPORTANT DOCUMENT FOR RECOVERY.' }));
  items.push(vaultItem('Insurance Agent Contact Info', 'insurance', 'critical', 'Recovery', { notes: 'Name, phone, email. Save in phone contacts too.' }));
  items.push(vaultItem('Auto Insurance Policy + Cards', 'insurance', 'critical', 'Recovery'));
  items.push(vaultItem('Health Insurance Cards', 'insurance', 'critical', 'Medical', { grab: true }));

  const medicalMembers = data.members.filter(m => m.afn.medical || m.afn.medication || m.type === 'elderly');
  medicalMembers.forEach(m => {
    const name = m.name || 'member';
    items.push(vaultItem(`Current Medication List — ${name}`, 'medical', 'critical', name, { grab: true, notes: 'Drug name, dosage, frequency, doctor, pharmacy + phone' }));
  });
  items.push(vaultItem('Doctor / Specialist Contact List', 'medical', 'critical', 'Medical'));
  items.push(vaultItem('Pharmacy Info (name, phone, Rx numbers)', 'medical', 'critical', 'Medical'));

  const children = data.members.filter(m => m.type === 'child');
  children.forEach(m => {
    const name = m.name || 'child';
    items.push(vaultItem(`Birth Certificate — ${name}`, 'identity', 'critical', name, { grab: true }));
  });

  // IMPORTANT — need within 1-2 weeks
  items.push(vaultItem('Property Deed / Mortgage Documents', 'property', 'important', 'Recovery'));
  items.push(vaultItem('Vehicle Title(s)', 'property', 'important', 'Recovery'));
  items.push(vaultItem('Vehicle Registration(s)', 'property', 'important', 'Recovery'));
  items.push(vaultItem('Recent Tax Returns (2 years)', 'financial', 'important', 'Financial'));
  items.push(vaultItem('Bank Account Information', 'financial', 'important', 'Financial', { notes: 'Institution, account type, last 4. Enough to access funds.' }));
  items.push(vaultItem('Credit Card Info + Customer Service #s', 'financial', 'important', 'Financial', { notes: 'For replacement cards' }));
  items.push(vaultItem('Will / Trust Documents', 'legal', 'important', 'Legal'));
  items.push(vaultItem('Power of Attorney', 'legal', 'important', 'Legal'));

  if (children.length > 0) {
    items.push(vaultItem('Custody Agreements / Court Orders', 'legal', 'important', 'Children', { notes: 'Schools and shelters may require proof' }));
    items.push(vaultItem('School Enrollment Records', 'education', 'important', 'Children', { notes: 'Needed to re-enroll if school destroyed' }));
    items.push(vaultItem('Immunization Records (children)', 'medical', 'important', 'Children', { notes: 'Required for school enrollment' }));
  }

  if (data.members.some(m => m.type === 'elderly')) {
    items.push(vaultItem('Advance Directive / DNR', 'medical', 'important', 'Elderly', { grab: true }));
    items.push(vaultItem('Healthcare Power of Attorney', 'medical', 'important', 'Elderly'));
  }

  data.pets.forEach(p => {
    const name = p.name || p.type;
    items.push(vaultItem(`Vaccination Records — ${name}`, 'pet', 'important', name, { notes: 'Required at shelters' }));
    items.push(vaultItem(`Microchip # — ${name}`, 'pet', 'important', name, { notes: 'How they get returned if lost' }));
  });

  // HELPFUL — makes recovery easier
  items.push(vaultItem('Home Inventory (video walkthrough)', 'inventory', 'helpful', 'Insurance', { notes: 'Walk through every room. Open every drawer. 10 minutes saves weeks of claims.' }));
  items.push(vaultItem('Photos of Home Exterior + Interior', 'inventory', 'helpful', 'Insurance', { notes: 'Before disaster. Proves condition.' }));
  items.push(vaultItem('Major Purchase Receipts', 'inventory', 'helpful', 'Insurance'));
  items.push(vaultItem('Home Improvement Records', 'inventory', 'helpful', 'Insurance', { notes: 'Contractor invoices, permits. Increases claim value.' }));
  items.push(vaultItem('Professional Licenses / Certifications', 'education', 'helpful', 'Personal', { notes: 'Hard to replace if lost' }));
  items.push(vaultItem('Family Photos / Digital Backup', 'personal', 'helpful', 'Personal', { notes: 'Cloud backup or external drive. Irreplaceable.' }));

  // Restore has_copy state from existing vault
  const copyMap = new Map(data.vault.map(v => [v.id, v.has_copy]));
  return items.map(i => ({ ...i, has_copy: copyMap.get(i.id) ?? false }));
}

export const STORAGE_KEY = 'ceg-household';

export function loadHousehold(): HouseholdData {
  if (typeof window === 'undefined') return { members: [], pets: [], locations: [], checklist: [], vault: [], householdCode: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old data missing new fields
      if (!parsed.householdCode) parsed.householdCode = '';
      if (!parsed.vault) parsed.vault = [];
      return parsed;
    }
  } catch { /* corrupt data — start fresh */ }
  return { members: [], pets: [], locations: [], checklist: [], vault: [], householdCode: '' };
}

export function saveHousehold(data: HouseholdData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full — silently fail */ }
}
