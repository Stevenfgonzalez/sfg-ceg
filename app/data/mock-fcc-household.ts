/**
 * Field Care Card — Mock Household Data
 *
 * Types and sample data for the FCC feature.
 * Supabase wiring comes later; this file provides the shape
 * and a realistic demo household (Delgado family).
 */

export type FccFlagType = 'allergy' | 'med' | 'equipment' | 'safety';

export interface FccCriticalFlag {
  flag: string;
  type: FccFlagType;
}

export interface FccMedication {
  name: string;
  dose: string;
  freq: string;
  lastDose: string;
}

export interface FccMobility {
  status: string;
  liftMethod: string;
  precautions: string;
  pain: string;
  stairChair: string;
}

export interface FccEquipment {
  item: string;
  location: string;
}

export interface FccMember {
  id: number;
  name: string;
  dob: string;
  baseline: string;
  language: string;
  codeStatus: string;
  directiveLocation: string;
  criticalFlags: FccCriticalFlag[];
  medications: FccMedication[];
  history: string[];
  mobility: FccMobility;
  equipment: FccEquipment[];
  lifeNeeds: string[];
}

export interface FccHouseholdAccess {
  bestDoor: string;
  gateCode: string;
  dogs: string;
  stairInfo: string;
  hazards: string;
  aed: string;
  backupPower: string;
}

export interface FccEmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface FccHousehold {
  address: string;
  householdId: string;
  members: FccMember[];
  access: FccHouseholdAccess;
  emergencyContacts: FccEmergencyContact[];
}

export const MOCK_HOUSEHOLD: FccHousehold = {
  address: '28100 Pacific Coast Hwy, Malibu, CA 90265',
  householdId: 'FCC-4827',
  members: [
    {
      id: 1,
      name: 'Robert Delgado',
      dob: '04/12/1946',
      baseline: 'A&O x4, mild hearing loss R ear',
      language: 'English',
      codeStatus: 'DNR/POLST',
      directiveLocation: 'Filed with Dr. Patel, copy in kitchen drawer',
      criticalFlags: [
        { flag: 'Eliquis (anticoagulant)', type: 'med' },
        { flag: 'Sulfa allergy — anaphylaxis', type: 'allergy' },
        { flag: 'O2 dependent — 2L NC continuous', type: 'equipment' },
        { flag: 'Fall risk', type: 'safety' },
      ],
      medications: [
        { name: 'Eliquis', dose: '5mg', freq: 'BID', lastDose: '2200 last night' },
        { name: 'Metoprolol', dose: '25mg', freq: 'BID', lastDose: '0600 today' },
        { name: 'Furosemide', dose: '40mg', freq: 'Daily AM', lastDose: '0600 today' },
        { name: 'Insulin glargine', dose: '20 units', freq: 'Nightly', lastDose: '2200 last night' },
      ],
      history: ['CHF', 'COPD', 'T2DM', 'A-fib', 'L hip replacement 2021'],
      mobility: {
        status: 'Ambulatory w/ rolling walker',
        liftMethod: '1-person standby assist, can bear weight',
        precautions: 'L hip — no internal rotation past 90°',
        pain: 'Chronic low back, managed',
        stairChair: 'Yes — bedroom is upstairs',
      },
      equipment: [
        { item: 'O2 concentrator', location: 'Bedroom, beside bed' },
        { item: 'Portable O2 tank', location: 'Front closet' },
        { item: 'Glucometer', location: 'Kitchen counter' },
        { item: 'Rolling walker', location: 'Bedside' },
      ],
      lifeNeeds: [
        'Hard of hearing R side — speak to L',
        "Prefers to be called 'Bobby'",
        'Anxious with strangers — wife presence calms him',
        'Diabetic diet',
      ],
    },
    {
      id: 2,
      name: 'Maria Delgado',
      dob: '09/22/1948',
      baseline: 'A&O x4, fully independent',
      language: 'English / Spanish',
      codeStatus: 'Full Code',
      directiveLocation: 'None on file',
      criticalFlags: [
        { flag: 'Penicillin allergy — rash only', type: 'allergy' },
      ],
      medications: [
        { name: 'Lisinopril', dose: '10mg', freq: 'Daily', lastDose: '0700 today' },
        { name: 'Atorvastatin', dose: '20mg', freq: 'Nightly', lastDose: '2200 last night' },
      ],
      history: ['HTN', 'Hyperlipidemia', 'Osteoporosis'],
      mobility: {
        status: 'Fully ambulatory, no assist needed',
        liftMethod: 'Independent',
        precautions: 'Osteoporosis — gentle handling',
        pain: 'None',
        stairChair: 'No',
      },
      equipment: [],
      lifeNeeds: [
        'Primary caregiver for Robert',
        'Bilingual — may revert to Spanish under stress',
      ],
    },
  ],
  access: {
    bestDoor: 'Front door — faces PCH, blue awning',
    gateCode: '4491',
    dogs: '1 small dog (friendly), usually in back yard',
    stairInfo: 'Straight staircase to 2nd floor, 14 steps, 36" wide',
    hazards: 'Oxygen in use — no open flame',
    aed: 'No',
    backupPower: 'No generator',
  },
  emergencyContacts: [
    { name: 'Lisa Delgado-Park', relation: 'Daughter', phone: '(310) 555-0142' },
    { name: 'Dr. Anish Patel', relation: 'PCP', phone: '(310) 555-0388' },
  ],
};
