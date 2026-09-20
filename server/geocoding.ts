/**
 * Geocoding helpers for verified Valisse locations.
 * Uses the Google Maps Geocoding API through the built-in Manus proxy.
 */
import { makeRequest } from "./_core/map";

export interface GeocodedAddress {
  fullAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  locationType: string;
}

function componentReader(components: any[]) {
  const long = (type: string) => components.find((component) => component.types?.includes(type))?.long_name ?? "";
  const short = (type: string) => components.find((component) => component.types?.includes(type))?.short_name ?? "";
  return { long, short };
}

function normalizeResult(result: any): GeocodedAddress | null {
  const location = result?.geometry?.location;
  if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") return null;

  const { long, short } = componentReader(result.address_components ?? []);
  const streetNumber = long("street_number");
  const route = long("route");
  const city = long("locality") || long("postal_town") || long("sublocality") || long("administrative_area_level_2");
  const state = short("administrative_area_level_1");
  const postalCode = long("postal_code");
  const country = short("country") || long("country");

  if (!city || !state || !country) return null;

  return {
    fullAddress: result.formatted_address,
    addressLine1: [streetNumber, route].filter(Boolean).join(" "),
    city,
    state,
    postalCode,
    country,
    lat: location.lat,
    lng: location.lng,
    locationType: result.geometry.location_type ?? "UNKNOWN",
  };
}

export async function geocodeAddress(address: string): Promise<GeocodedAddress | null> {
  try {
    const data = await makeRequest("/maps/api/geocode/json", {
      address,
      components: "country:US",
    }) as any;
    if (!data || data.status !== "OK" || !data.results?.length) return null;
    return normalizeResult(data.results[0]);
  } catch (error) {
    console.error("[geocodeAddress] error:", error);
    return null;
  }
}

export async function geocodePlaceId(placeId: string): Promise<GeocodedAddress | null> {
  try {
    const data = await makeRequest("/maps/api/geocode/json", { place_id: placeId }) as any;
    if (!data || data.status !== "OK" || !data.results?.length) return null;
    return normalizeResult(data.results[0]);
  } catch (error) {
    console.error("[geocodePlaceId] error:", error);
    return null;
  }
}

export function isVerifiedStreetAddress(address: GeocodedAddress) {
  return Boolean(address.addressLine1 && address.postalCode && ["ROOFTOP", "RANGE_INTERPOLATED"].includes(address.locationType));
}

export function generateFuzzedCoords(lat: number, lng: number): { fuzzedLat: number; fuzzedLng: number } {
  const minMiles = 0.5;
  const maxMiles = 1.0;
  const distanceMiles = minMiles + Math.random() * (maxMiles - minMiles);
  const bearing = Math.random() * 2 * Math.PI;
  const milesPerDegreeLat = 69.0;
  const milesPerDegreeLng = 69.0 * Math.cos((lat * Math.PI) / 180);
  return {
    fuzzedLat: lat + (distanceMiles * Math.sin(bearing)) / milesPerDegreeLat,
    fuzzedLng: lng + (distanceMiles * Math.cos(bearing)) / milesPerDegreeLng,
  };
}

export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
