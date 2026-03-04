import { describe, it, expect } from 'vitest';
import {
  generateGoBagChecklist,
  generateHouseholdCode,
  type HouseholdData,
  type HouseholdMember,
  type Pet,
} from '@/lib/household-checklist';

const emptyAfn = { medical: false, mobility: false, sensory: false, cognitive: false, medication: false };

function makeData(overrides: Partial<HouseholdData> = {}): HouseholdData {
  return { members: [], pets: [], locations: [], checklist: [], vault: [], householdCode: '', ...overrides };
}

function makeMember(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return { id: 'test', name: 'Test', type: 'adult', age: 30, afn: { ...emptyAfn }, medicalNotes: '', ...overrides };
}

function makePet(overrides: Partial<Pet> = {}): Pet {
  return { id: 'pet1', type: 'dog', name: 'Buddy', count: 1, notes: '', ...overrides };
}

describe('generateGoBagChecklist', () => {
  it('always includes 8 essential items', () => {
    const list = generateGoBagChecklist(makeData());
    expect(list.length).toBeGreaterThanOrEqual(8);
    const labels = list.map(i => i.label);
    expect(labels).toContain('Water (1 gallon per person per day)');
    expect(labels).toContain('Non-perishable food (3-day supply)');
    expect(labels).toContain('Flashlight + extra batteries');
    expect(labels).toContain('First aid kit');
    expect(labels).toContain('Phone charger / power bank');
    expect(labels).toContain('Cash (small bills)');
    expect(labels).toContain('Important documents (copies)');
    expect(labels).toContain('N95 masks');
  });

  it('adds children items when household has a child', () => {
    const data = makeData({ members: [makeMember({ type: 'child', age: 8 })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Comfort items (stuffed animal, blanket)');
    expect(labels).toContain('Snacks kids will eat');
    expect(labels).toContain('Small entertainment (coloring book, cards)');
  });

  it('adds infant items for children under 5', () => {
    const data = makeData({ members: [makeMember({ type: 'child', age: 2 })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Diapers + wipes (3-day supply)');
    expect(labels).toContain('Formula / baby food');
    expect(labels).toContain('Baby carrier');
  });

  it('does not add infant items for children 5 and older', () => {
    const data = makeData({ members: [makeMember({ type: 'child', age: 7 })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).not.toContain('Diapers + wipes (3-day supply)');
  });

  it('adds medical/medication AFN items', () => {
    const data = makeData({ members: [makeMember({ afn: { ...emptyAfn, medical: true } })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Prescriptions (7-day supply)');
    expect(labels).toContain('Medication list with dosages');
    expect(labels).toContain('Doctor/pharmacy contact info');
  });

  it('adds mobility AFN items', () => {
    const data = makeData({ members: [makeMember({ afn: { ...emptyAfn, mobility: true } })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Wheelchair / walker');
    expect(labels).toContain('Mobility device charger');
  });

  it('adds sensory AFN items', () => {
    const data = makeData({ members: [makeMember({ afn: { ...emptyAfn, sensory: true } })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Hearing aids + extra batteries');
    expect(labels).toContain('Spare glasses / contacts');
  });

  it('adds elderly items', () => {
    const data = makeData({ members: [makeMember({ type: 'elderly', age: 75 })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Portable oxygen (if needed)');
    expect(labels).toContain('Medical alert device');
  });

  it('adds pet items when pets exist', () => {
    const data = makeData({ pets: [makePet()] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Pet food (3-day supply)');
    expect(labels).toContain('Pet carrier / leash');
    expect(labels).toContain('Pet medications');
    expect(labels).toContain('Vaccination records');
  });

  it('adds horse-specific items', () => {
    const data = makeData({ pets: [makePet({ type: 'horse', name: 'Spirit' })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).toContain('Horse trailer (pre-hitched if possible)');
    expect(labels).toContain('Hay / feed for transport');
  });

  it('does not add horse items for dogs', () => {
    const data = makeData({ pets: [makePet({ type: 'dog' })] });
    const labels = generateGoBagChecklist(data).map(i => i.label);
    expect(labels).not.toContain('Horse trailer (pre-hitched if possible)');
  });

  it('preserves packed state from existing checklist', () => {
    const first = generateGoBagChecklist(makeData());
    const withPacked = first.map((item, i) => i === 0 ? { ...item, packed: true } : item);
    const data = makeData({ checklist: withPacked });
    const second = generateGoBagChecklist(data);
    expect(second[0].packed).toBe(true);
    expect(second[1].packed).toBe(false);
  });
});

describe('generateHouseholdCode', () => {
  it('returns a 7-char string in XXX-XXX format', () => {
    const code = generateHouseholdCode();
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateHouseholdCode()));
    expect(codes.size).toBe(50);
  });

  it('excludes ambiguous characters (0, 1, I, L, O)', () => {
    const codes = Array.from({ length: 100 }, () => generateHouseholdCode()).join('');
    expect(codes).not.toMatch(/[01ILO]/);
  });
});
