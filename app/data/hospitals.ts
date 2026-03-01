/**
 * CEG Hospital Registry — LA County Trauma Centers & ERs
 *
 * Ported from BRASS brass-system/client/src/data/hospitals.ts
 * Source: LA County EMS Agency approved receiving facilities
 *
 * Civilians use this to find the nearest ER with directions.
 * No live status (OPEN/DIVERT/CLOSED) or bed counts — those are
 * IC-level operational data requiring ReddiNet API.
 */

export interface Hospital {
  id: string;
  name: string;
  shortName: string;
  address: string;
  city: string;
  lat: number;
  lon: number;
  phone: string;
  traumaLevel: 1 | 2 | 3 | null;
  helipad: boolean;
  pediatric: boolean;
  burn: boolean;
  stroke: boolean;
  stemi: boolean;
  laborDelivery: boolean;
  capabilities: string[];
  distance?: number;
}

export const HOSPITALS: Hospital[] = [
  // ── LEVEL 1 TRAUMA CENTERS ──
  {
    id: 'ucla-ronald-reagan',
    name: 'UCLA Ronald Reagan Medical Center',
    shortName: 'UCLA Reagan',
    address: '757 Westwood Plaza',
    city: 'Los Angeles',
    lat: 34.0665,
    lon: -118.4469,
    phone: '(310) 825-9111',
    traumaLevel: 1,
    capabilities: ['burn', 'peds', 'stroke', 'stemi', 'cardiac'],
    helipad: true,
    pediatric: true,
    burn: true,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'cedars-sinai',
    name: 'Cedars-Sinai Medical Center',
    shortName: 'Cedars-Sinai',
    address: '8700 Beverly Blvd',
    city: 'Los Angeles',
    lat: 34.0762,
    lon: -118.3802,
    phone: '(310) 423-3277',
    traumaLevel: 1,
    capabilities: ['cardiac', 'stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'lac-usc',
    name: 'LAC+USC Medical Center',
    shortName: 'LAC+USC',
    address: '2051 Marengo St',
    city: 'Los Angeles',
    lat: 34.0583,
    lon: -118.2076,
    phone: '(323) 226-2622',
    traumaLevel: 1,
    capabilities: ['burn', 'peds', 'stroke', 'stemi'],
    helipad: true,
    pediatric: true,
    burn: true,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'harbor-ucla',
    name: 'Harbor-UCLA Medical Center',
    shortName: 'Harbor-UCLA',
    address: '1000 W Carson St',
    city: 'Torrance',
    lat: 33.8306,
    lon: -118.2961,
    phone: '(310) 222-2345',
    traumaLevel: 1,
    capabilities: ['burn', 'peds', 'stroke', 'stemi'],
    helipad: true,
    pediatric: true,
    burn: true,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'childrens-la',
    name: "Children's Hospital Los Angeles",
    shortName: 'CHLA',
    address: '4650 Sunset Blvd',
    city: 'Los Angeles',
    lat: 34.0977,
    lon: -118.2892,
    phone: '(323) 660-2450',
    traumaLevel: 1,
    capabilities: ['peds', 'burn', 'cardiac'],
    helipad: true,
    pediatric: true,
    burn: true,
    stroke: false,
    stemi: false,
    laborDelivery: false,
  },

  // ── LEVEL 2 TRAUMA CENTERS ──
  {
    id: 'santa-monica-ucla',
    name: 'UCLA Medical Center Santa Monica',
    shortName: 'UCLA Santa Monica',
    address: '1250 16th St',
    city: 'Santa Monica',
    lat: 34.0259,
    lon: -118.4939,
    phone: '(310) 319-4000',
    traumaLevel: 2,
    capabilities: ['stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'northridge',
    name: 'Northridge Hospital Medical Center',
    shortName: 'Northridge Hospital',
    address: '18300 Roscoe Blvd',
    city: 'Northridge',
    lat: 34.2217,
    lon: -118.5367,
    phone: '(818) 885-8500',
    traumaLevel: 2,
    capabilities: ['stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'providence-st-johns',
    name: "Providence Saint John's Health Center",
    shortName: "St. John's",
    address: '2121 Santa Monica Blvd',
    city: 'Santa Monica',
    lat: 34.0291,
    lon: -118.4818,
    phone: '(310) 829-5511',
    traumaLevel: 2,
    capabilities: ['cardiac', 'stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'los-robles',
    name: 'Los Robles Regional Medical Center',
    shortName: 'Los Robles',
    address: '215 W Janss Rd',
    city: 'Thousand Oaks',
    lat: 34.1808,
    lon: -118.8756,
    phone: '(805) 497-2727',
    traumaLevel: 2,
    capabilities: ['stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'ventura-county-mc',
    name: 'Ventura County Medical Center',
    shortName: 'Ventura County MC',
    address: '3291 Loma Vista Rd',
    city: 'Ventura',
    lat: 34.2992,
    lon: -119.2656,
    phone: '(805) 652-6000',
    traumaLevel: 2,
    capabilities: ['peds', 'stroke'],
    helipad: true,
    pediatric: true,
    burn: false,
    stroke: true,
    stemi: false,
    laborDelivery: true,
  },

  // ── OTHER MAJOR ERs ──
  {
    id: 'community-memorial',
    name: 'Community Memorial Hospital',
    shortName: 'Community Memorial',
    address: '147 N Brent St',
    city: 'Ventura',
    lat: 34.2797,
    lon: -119.2936,
    phone: '(805) 652-5011',
    traumaLevel: null,
    capabilities: ['stroke', 'stemi'],
    helipad: false,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'providence-smmc',
    name: 'Providence Saint Monica Medical Center',
    shortName: 'Providence SM',
    address: '1225 Wilshire Blvd',
    city: 'Santa Monica',
    lat: 34.0266,
    lon: -118.4796,
    phone: '(310) 829-8431',
    traumaLevel: null,
    capabilities: ['stroke', 'stemi'],
    helipad: false,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: false,
  },
  {
    id: 'torrance-memorial',
    name: 'Torrance Memorial Medical Center',
    shortName: 'Torrance Memorial',
    address: '3330 Lomita Blvd',
    city: 'Torrance',
    lat: 33.8031,
    lon: -118.3244,
    phone: '(310) 325-9110',
    traumaLevel: null,
    capabilities: ['cardiac', 'stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: true,
  },
  {
    id: 'west-hills',
    name: 'West Hills Hospital & Medical Center',
    shortName: 'West Hills Hospital',
    address: '7300 Medical Center Dr',
    city: 'West Hills',
    lat: 34.2044,
    lon: -118.6494,
    phone: '(818) 676-4000',
    traumaLevel: null,
    capabilities: ['stroke', 'stemi'],
    helipad: true,
    pediatric: false,
    burn: false,
    stroke: true,
    stemi: true,
    laborDelivery: false,
  },
];

export const TRAUMA_LEVEL_LABELS: Record<string, string> = {
  '1': 'Level I Trauma',
  '2': 'Level II Trauma',
  '3': 'Level III Trauma',
  null: 'Emergency Room',
};

export const TRAUMA_LEVEL_COLORS: Record<string, string> = {
  '1': 'bg-red-600 text-white',
  '2': 'bg-amber-500 text-black',
  '3': 'bg-yellow-400 text-black',
  null: 'bg-neutral-600 text-white',
};

export const CAPABILITY_LABELS: Record<string, string> = {
  burn: 'Burn Center',
  peds: 'Pediatric',
  stroke: 'Stroke',
  stemi: 'STEMI',
  cardiac: 'Cardiac',
  helipad: 'Helipad',
  laborDelivery: 'Labor & Delivery',
};

/**
 * Haversine distance in miles between two coordinates
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Return all hospitals sorted by distance from the given coordinates.
 * Each hospital gets an additional `distance` field (miles).
 */
export function findNearestHospitals(
  lat: number,
  lon: number
): Array<Hospital & { distance: number }> {
  return HOSPITALS.map((h) => ({
    ...h,
    distance: haversineDistance(lat, lon, h.lat, h.lon),
  })).sort((a, b) => a.distance - b.distance);
}
