export const CONFIG = {
  DEFAULT_CENTER: [120.9842, 14.5995] as [number, number],
  DEFAULT_ZOOM: 14,
  PROVINCE_ZOOM: 10,
  FALLBACK_IMAGE: "fallback.png",
};

export function getRadiusByZoom(zoom: number): number {
  if (zoom <= 6) return 300;
  if (zoom <= 7) return 200;
  if (zoom <= 8) return 100;
  if (zoom <= 9) return 50;
  return 10;
}

/**
 * Get cluster radius in map degrees based on zoom level.
 * Higher zoom = tighter clusters (smaller radius)
 * Lower zoom = looser clusters (larger radius)
 * 
 * Approximate distances at equator:
 * - 0.05° = ~5.5km
 * - 0.02° = ~2.2km
 * - 0.01° = ~1.1km
 * - 0.005° = ~0.55km
 * - 0.002° = ~0.22km
 */
export function getClusterRadiusByZoom(zoom: number): number {
  if (zoom <= 8) return 0.05;    // Very zoomed out: loose clusters
  if (zoom <= 10) return 0.02;   // Zoomed out: medium clusters
  if (zoom <= 12) return 0.01;   // Medium zoom: balanced clusters
  if (zoom <= 14) return 0.005;  // Zoomed in: tight clusters
  return 0.002;                  // Very zoomed in: very tight clusters
}
