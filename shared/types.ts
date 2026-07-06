export type UserRole = 'fan' | 'staff' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  preferredLanguage: string;
  createdAt: Date;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  capacity: number;
  createdAt: Date;
}

export type ZoneType = 'gate' | 'concourse' | 'transit' | 'restroom' | 'concession' | 'exit';

export interface GeoCoordinates {
  lat: number;
  lng: number;
  [key: string]: any; // Allow polygon format or additional map attributes
}

export interface Zone {
  id: string;
  venueId: string;
  name: string;
  zoneType: ZoneType;
  maxCapacity: number;
  geoCoordinates: GeoCoordinates;
}

export interface DensityReading {
  id: string;
  zoneId: string;
  estimatedCount: number;
  densityPct: number;
  recordedAt: Date;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  zoneId: string;
  severity: AlertSeverity;
  aiRecommendation: string;
  acknowledgedBy: string | null; // User ID or null
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface ChatQuery {
  id: string;
  userId: string | null;
  venueId: string;
  queryText: string;
  detectedLanguage: string;
  responseText: string;
  wasCached: boolean;
  createdAt: Date;
}

export interface TranslationCache {
  id: string;
  queryHash: string;
  language: string;
  responseText: string;
  hitCount: number;
  updatedAt: Date;
}
