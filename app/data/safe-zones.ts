/**
 * CEG Safe Zones — Evacuation Assembly Points
 *
 * Ported from BRASS brass-system/shared/muster-safe-zones.ts
 * Source: LA County Office of Emergency Management,
 *         Topanga Emergency Management Task Force,
 *         LACoFD Division 7 Pre-Plans,
 *         Topanga Evacuation Guide 2026
 *
 * BRASS owns the canonical copy. This is the CEG public-facing subset.
 */

export interface SafeZone {
  id: string;
  name: string;
  type:
    | "SCHOOL"
    | "COMMUNITY_CENTER"
    | "BEACH"
    | "PARK"
    | "PARKING"
    | "CHURCH"
    | "UNIVERSITY"
    | "FIRE_STATION"
    | "WATER_FACILITY";
  lat: number;
  lon: number;
  address: string;
  city: string;
  capacity: number;
  amenities: string[];
  petFriendly: boolean;
  adaAccessible: boolean;
  servesZones: string[];
  phone?: string;
  defaultStatus: "OPEN" | "STANDBY";
  topangaGuideDesignation?: "PSR" | "PRIMARY_SHELTER";
}

export const SAFE_ZONES: SafeZone[] = [
  // ── TOPANGA GUIDE DESIGNATED SITES ──
  {
    id: "MSZ-TOPANGA-CC",
    name: "Topanga Community House (Baseball Field PSR)",
    type: "COMMUNITY_CENTER",
    lat: 34.1116,
    lon: -118.5903,
    address: "1440 N Topanga Canyon Blvd",
    city: "Topanga",
    capacity: 150,
    amenities: ["Restrooms", "Water", "First Aid", "Open Air"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["TOP-U001", "TOP-U002", "TOP-U003"],
    phone: "310-455-1980",
    defaultStatus: "STANDBY",
    topangaGuideDesignation: "PSR",
  },
  {
    id: "MSZ-TRIPPET",
    name: "Trippet Ranch Parking Lot (PSR)",
    type: "PARK",
    lat: 34.0933,
    lon: -118.5885,
    address: "20825 Entrada Road",
    city: "Topanga",
    capacity: 200,
    amenities: ["Restrooms", "Water", "Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: false,
    servesZones: ["TOP-U006", "TOP-U007"],
    phone: "310-455-2465",
    defaultStatus: "STANDBY",
    topangaGuideDesignation: "PSR",
  },
  {
    id: "MSZ-WATER-TANK",
    name: "LA County Water Tank Facility (PSR)",
    type: "WATER_FACILITY",
    lat: 34.098,
    lon: -118.603,
    address: "Topanga Canyon Blvd (LA County Waterworks District 29)",
    city: "Topanga",
    capacity: 75,
    amenities: ["Open Air", "Parking"],
    petFriendly: true,
    adaAccessible: false,
    servesZones: ["TOP-U004", "TOP-U005", "TOP-U006"],
    phone: "877-637-3661",
    defaultStatus: "STANDBY",
    topangaGuideDesignation: "PSR",
  },
  {
    id: "MSZ-CALABASAS-HS",
    name: "Calabasas High School",
    type: "SCHOOL",
    lat: 34.1267,
    lon: -118.6833,
    address: "22855 W Mulholland Highway",
    city: "Calabasas",
    capacity: 800,
    amenities: ["Restrooms", "Water", "First Aid", "Gym", "Parking"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["CAL-*", "TOP-U001", "TOP-U002"],
    phone: "818-222-7177",
    defaultStatus: "STANDBY",
    topangaGuideDesignation: "PRIMARY_SHELTER",
  },

  // ── PRIMARY SHELTERS — Schools & Universities ──
  {
    id: "MSZ-PEPPERDINE",
    name: "Pepperdine University",
    type: "UNIVERSITY",
    lat: 34.0366,
    lon: -118.7045,
    address: "24255 Pacific Coast Highway",
    city: "Malibu",
    capacity: 3000,
    amenities: ["Restrooms", "Water", "Food", "First Aid", "Medical Staff", "Charging", "Showers"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["MAL-*", "PCH-*"],
    phone: "310-506-4000",
    defaultStatus: "STANDBY",
  },
  {
    id: "MSZ-AEWMS",
    name: "A.E. Wright Middle School",
    type: "SCHOOL",
    lat: 34.1343,
    lon: -118.7047,
    address: "4029 Las Virgenes Road",
    city: "Calabasas",
    capacity: 500,
    amenities: ["Restrooms", "Water", "First Aid", "Parking"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["CAL-C407", "CAL-C413", "TOP-U002"],
    phone: "818-880-4614",
    defaultStatus: "STANDBY",
  },
  {
    id: "MSZ-MALIBU-HS",
    name: "Malibu High School",
    type: "SCHOOL",
    lat: 34.0239,
    lon: -118.827,
    address: "30215 Morning View Drive",
    city: "Malibu",
    capacity: 600,
    amenities: ["Restrooms", "Water", "First Aid", "Gym", "Parking"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["MAL-*", "PCH-*"],
    phone: "310-457-6801",
    defaultStatus: "STANDBY",
  },
  {
    id: "MSZ-TOPANGA-ELEM",
    name: "Topanga Elementary Charter School",
    type: "SCHOOL",
    lat: 34.1057,
    lon: -118.6104,
    address: "22075 Topanga School Road",
    city: "Topanga",
    capacity: 400,
    amenities: ["Restrooms", "Water", "First Aid", "Parking"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["TOP-U001", "TOP-U002", "TOP-U003", "TOP-U004"],
    phone: "310-455-3711",
    defaultStatus: "STANDBY",
  },

  // ── COMMUNITY CENTERS ──
  {
    id: "MSZ-CALABASAS-CC",
    name: "Agoura Hills/Calabasas Community Center",
    type: "COMMUNITY_CENTER",
    lat: 34.1362,
    lon: -118.713,
    address: "27040 Malibu Hills Road",
    city: "Calabasas",
    capacity: 300,
    amenities: ["Restrooms", "Water", "First Aid", "Charging", "Parking"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["CAL-*"],
    phone: "818-479-8180",
    defaultStatus: "STANDBY",
  },
  {
    id: "MSZ-MALIBU-CITY-HALL",
    name: "Malibu City Hall",
    type: "COMMUNITY_CENTER",
    lat: 34.039,
    lon: -118.693,
    address: "23825 Stuart Ranch Road",
    city: "Malibu",
    capacity: 200,
    amenities: ["Restrooms", "Water", "Charging", "Parking"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["MAL-*"],
    phone: "310-456-2489",
    defaultStatus: "STANDBY",
  },

  // ── BEACH PARKING — Large Capacity Open-Air ──
  {
    id: "MSZ-ZUMA-MAIN",
    name: "Zuma Beach Main Lot",
    type: "BEACH",
    lat: 34.0218,
    lon: -118.8316,
    address: "30000 Pacific Coast Highway",
    city: "Malibu",
    capacity: 2000,
    amenities: ["Restrooms", "Water", "Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["ZUM-*", "PCH-WEST"],
    phone: "424-526-7777",
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-ZUMA-LOT12",
    name: "Zuma Beach Lot 12",
    type: "BEACH",
    lat: 34.0283,
    lon: -118.8405,
    address: "30050 Pacific Coast Highway",
    city: "Malibu",
    capacity: 500,
    amenities: ["Restrooms", "Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: false,
    servesZones: ["ZUM-*"],
    phone: "424-526-7777",
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-POINT-DUME",
    name: "Point Dume State Beach",
    type: "BEACH",
    lat: 34.0111,
    lon: -118.8166,
    address: "6800 Westward Beach Road",
    city: "Malibu",
    capacity: 500,
    amenities: ["Restrooms", "Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: false,
    servesZones: ["PDU-*", "ZUM-*"],
    phone: "310-457-8144",
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-LEGACY-PARK",
    name: "Legacy Park",
    type: "PARK",
    lat: 34.0354,
    lon: -118.6886,
    address: "23500 Civic Center Way",
    city: "Malibu",
    capacity: 1000,
    amenities: ["Restrooms", "Water", "Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["MAL-*", "PCH-*"],
    phone: "310-317-1364",
    defaultStatus: "OPEN",
  },

  // ── FIRE STATIONS ──
  {
    id: "MSZ-FS69",
    name: "Fire Station 69 (Topanga)",
    type: "FIRE_STATION",
    lat: 34.0839,
    lon: -118.6001,
    address: "401 S Topanga Canyon Blvd",
    city: "Topanga",
    capacity: 50,
    amenities: ["Restrooms", "Water", "First Aid", "Medical Staff"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["TOP-U005", "TOP-U006", "TOP-U007"],
    phone: "310-455-1766",
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-FS70",
    name: "Fire Station 70 — Battalion 23 HQ (Malibu)",
    type: "FIRE_STATION",
    lat: 34.0385,
    lon: -118.6497,
    address: "3970 Carbon Canyon Road",
    city: "Malibu",
    capacity: 50,
    amenities: ["Restrooms", "Water", "First Aid", "Medical Staff"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["MAL-*"],
    phone: "310-456-2513",
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-FS125",
    name: "Fire Station 125 (Calabasas)",
    type: "FIRE_STATION",
    lat: 34.1512,
    lon: -118.6978,
    address: "5215 N Las Virgenes Road",
    city: "Calabasas",
    capacity: 50,
    amenities: ["Restrooms", "Water", "First Aid", "Medical Staff"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["CAL-*"],
    phone: "818-880-4411",
    defaultStatus: "OPEN",
  },

  // ── PARKING / PARK & RIDE ──
  {
    id: "MSZ-CALABASAS-PR",
    name: "Calabasas Park & Ride",
    type: "PARKING",
    lat: 34.1573,
    lon: -118.6412,
    address: "23577 Calabasas Road",
    city: "Calabasas",
    capacity: 300,
    amenities: ["Parking", "Bus Access"],
    petFriendly: true,
    adaAccessible: true,
    servesZones: ["CAL-*", "WLK-*"],
    defaultStatus: "OPEN",
  },
  {
    id: "MSZ-CORRAL-TH",
    name: "Sara Wan Trailhead (Corral Canyon)",
    type: "PARK",
    lat: 34.0343,
    lon: -118.7344,
    address: "25623 Pacific Coast Highway",
    city: "Malibu",
    capacity: 100,
    amenities: ["Parking", "Open Air"],
    petFriendly: true,
    adaAccessible: false,
    servesZones: ["COR-*", "PCH-*"],
    defaultStatus: "OPEN",
  },

  // ── CHURCHES / RELIGIOUS FACILITIES ──
  {
    id: "MSZ-OLM-CHURCH",
    name: "Our Lady of Malibu Church",
    type: "CHURCH",
    lat: 34.0389,
    lon: -118.7003,
    address: "3625 Winter Canyon Road",
    city: "Malibu",
    capacity: 200,
    amenities: ["Restrooms", "Water", "Parking"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["MAL-*"],
    phone: "310-456-2361",
    defaultStatus: "STANDBY",
  },
  {
    id: "MSZ-HINDU-TEMPLE",
    name: "Malibu Hindu Temple",
    type: "CHURCH",
    lat: 34.095,
    lon: -118.7097,
    address: "1600 Las Virgenes Canyon Road",
    city: "Calabasas",
    capacity: 150,
    amenities: ["Restrooms", "Water", "Food", "Parking"],
    petFriendly: false,
    adaAccessible: true,
    servesZones: ["CAL-*", "MAL-*"],
    phone: "818-880-5552",
    defaultStatus: "STANDBY",
  },
];

/** Emoji icons for zone type badges */
export const ZONE_TYPE_ICONS: Record<SafeZone["type"], string> = {
  SCHOOL: "\u{1F3EB}",
  COMMUNITY_CENTER: "\u{1F3DB}\uFE0F",
  BEACH: "\u{1F3D6}\uFE0F",
  PARK: "\u{1F333}",
  PARKING: "\u{1F17F}\uFE0F",
  CHURCH: "\u26EA",
  UNIVERSITY: "\u{1F393}",
  FIRE_STATION: "\u{1F692}",
  WATER_FACILITY: "\u{1F4A7}",
};

/** Tailwind badge color classes for zone types */
export const ZONE_TYPE_COLORS: Record<SafeZone["type"], string> = {
  SCHOOL: "bg-blue-600",
  COMMUNITY_CENTER: "bg-violet-600",
  BEACH: "bg-cyan-600",
  PARK: "bg-green-600",
  PARKING: "bg-gray-500",
  CHURCH: "bg-purple-600",
  UNIVERSITY: "bg-red-600",
  FIRE_STATION: "bg-orange-600",
  WATER_FACILITY: "bg-sky-600",
};

/** Human-readable type labels */
export const ZONE_TYPE_LABELS: Record<SafeZone["type"], string> = {
  SCHOOL: "School",
  COMMUNITY_CENTER: "Community Center",
  BEACH: "Beach",
  PARK: "Park",
  PARKING: "Parking",
  CHURCH: "Church",
  UNIVERSITY: "University",
  FIRE_STATION: "Fire Station",
  WATER_FACILITY: "Water Facility",
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
 * Return all zones sorted by distance from the given coordinates.
 * Each zone gets an additional `distance` field (miles).
 */
export function findNearestZones(
  lat: number,
  lon: number
): Array<SafeZone & { distance: number }> {
  return SAFE_ZONES.map((zone) => ({
    ...zone,
    distance: haversineDistance(lat, lon, zone.lat, zone.lon),
  })).sort((a, b) => a.distance - b.distance);
}
