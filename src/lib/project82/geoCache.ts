/**
 * Server-side province detection via nearest-centroid matching.
 *
 * Replaces the previous GeoJSON self-fetch + point-in-polygon approach which
 * failed on Cloudflare Workers (self-fetch subrequests are blocked/limited).
 *
 * Nearest centroid is accurate enough for the Philippines — provinces are
 * geographically distinct and trip locations are typically in major cities.
 */

import { PH_PROVINCES } from "@/data/phProvinces";

// Max squared distance (~1.5°, roughly 165 km) — filters out locations
// that are far off the Philippine map (sea, abroad, etc.)
const MAX_DIST_SQ = 2.25;

/**
 * Returns the province_key closest to (lng, lat), or null if no province
 * centroid is within ~165 km.
 */
export function findProvince(lng: number, lat: number): string | null {
  let bestKey: string | null = null;
  let bestDist = Infinity;

  for (const province of PH_PROVINCES) {
    const d = (lng - province.lng) ** 2 + (lat - province.lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestKey = province.key;
    }
  }

  return bestDist <= MAX_DIST_SQ ? bestKey : null;
}

// Kept for call-site compatibility — returns a non-empty sentinel so callers
// that check `cache.size === 0` don't bail out.
export async function loadProvinceCache(
  _origin: string
): Promise<Map<string, true>> {
  return new Map([["__ready", true as const]]);
}
