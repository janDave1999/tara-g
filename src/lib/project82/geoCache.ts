/**
 * Server-side province geometry cache + point-in-polygon.
 *
 * Loads all 82 province GeoJSON files as subrequests (Cloudflare Workers
 * serves them from static assets at the same edge location — very fast).
 * Module-level cache persists across warm Worker instances so the 82 fetches
 * only happen on the first sync call per instance.
 */

import { PH_PROVINCES } from "@/data/phProvinces";

type Ring = [number, number][];
interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: any[];
}

// ── Slug helpers ─────────────────────────────────────────────────────────────

const SLUG_OVERRIDES: Record<string, string> = {
  NCO: "north-cotabato",
};

function getSlug(key: string, name: string): string {
  if (SLUG_OVERRIDES[key]) return SLUG_OVERRIDES[key];
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

// ── Module-level cache ────────────────────────────────────────────────────────

const _cache = new Map<string, Geometry>(); // province_key → geometry
let _loaded = false;

export async function loadProvinceCache(origin: string): Promise<Map<string, Geometry>> {
  if (_loaded) return _cache;

  await Promise.allSettled(
    PH_PROVINCES.map(async (province) => {
      const slug = getSlug(province.key, province.name);
      try {
        const res = await fetch(`${origin}/geojson/${slug}.geojson`);
        if (!res.ok) return;
        const data: any = await res.json();
        if (data?.geometry) _cache.set(province.key, data.geometry);
      } catch {
        // file missing or malformed — skip province
      }
    })
  );

  _loaded = true;
  return _cache;
}

// ── Ray-casting point-in-polygon ─────────────────────────────────────────────

function pointInRing(px: number, py: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  const polygons =
    geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  for (const polygon of polygons) {
    // Only check the outer ring (index 0); holes are uncommon for province boundaries
    if (pointInRing(lng, lat, polygon[0] as Ring)) return true;
  }
  return false;
}

/**
 * Returns the province_key for the given coordinates, or null if none matches.
 * `cache` must be pre-loaded via `loadProvinceCache`.
 */
export function findProvince(
  lng: number,
  lat: number,
  cache: Map<string, Geometry>
): string | null {
  for (const [key, geometry] of cache) {
    if (pointInGeometry(lng, lat, geometry)) return key;
  }
  return null;
}
