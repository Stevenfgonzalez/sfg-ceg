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

export interface HouseholdData {
  members: HouseholdMember[];
  pets: Pet[];
  locations: GrabLocation[];
  checklist: ChecklistItem[];
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

export const STORAGE_KEY = 'ceg-household';

export function loadHousehold(): HouseholdData {
  if (typeof window === 'undefined') return { members: [], pets: [], locations: [], checklist: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt data — start fresh */ }
  return { members: [], pets: [], locations: [], checklist: [] };
}

export function saveHousehold(data: HouseholdData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* storage full — silently fail */ }
}
