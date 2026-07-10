/**
 * Geocoding helpers for tech address validation and fuzzed-coordinate generation.
 * Uses the Google Maps Geocoding API via the built-in Manus proxy (no API key needed).
 */
import { makeRequest } from "./_core/map";

export interface GeocodedAddress {
  fullAddress: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
}

/**
 * Geocode a free-text address string using the Google Maps Geocoding API.
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  try {
    const raw = await makeRequest("/maps/api/geocode/json", {
      address,
      components: "country:US",
    });
    const data = raw as any;

    if (!data || data.status !== "OK" || !data.results?.length) return null;

    const result = data.results[0];
    const loc = result.geometry.location;
    const components: any[] = result.address_components ?? [];

    const getComponent = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.long_name ?? "";
    const getShortComponent = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.short_name ?? "";

    const city =
      getComponent("locality") ||
      getComponent("sublocality") ||
      getComponent("neighborhood") ||
      getComponent("administrative_area_level_2");
    const state = getShortComponent("administrative_area_level_1");

    return {
      fullAddress: result.formatted_address,
      lat: loc.lat,
      lng: loc.lng,
      city,
      state,
    };
  } catch (err) {
    console.error("[geocodeAddress] error:", err);
    return null;
  }
}

/**
 * Generate a fuzzed lat/lng by randomly offsetting the real coordinates
 * by 0.5–1.0 miles in a random direction.
 */
export function generateFuzzedCoords(lat: number, lng: number): { fuzzedLat: number; fuzzedLng: number } {
  // 1 degree of latitude ≈ 69 miles; 1 degree of longitude ≈ 69 * cos(lat) miles
  const minMiles = 0.5;
  const maxMiles = 1.0;
  const distanceMiles = minMiles + Math.random() * (maxMiles - minMiles);
  const bearing = Math.random() * 2 * Math.PI; // random direction in radians

  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLng = 69.0 * Math.cos((lat * Math.PI) / 180);

  const deltaLat = (distanceMiles * Math.sin(bearing)) / milesPerDegreeLat;
  const deltaLng = (distanceMiles * Math.cos(bearing)) / milesPerDegreeLng;

  return {
    fuzzedLat: lat + deltaLat,
    fuzzedLng: lng + deltaLng,
  };
}

/**
 * Straight-line distance in miles between two lat/lng points (Haversine formula).
 */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
