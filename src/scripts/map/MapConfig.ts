export const CONFIG = {
  DEFAULT_CENTER: [120.9842, 14.5995] as [number, number],
  DEFAULT_ZOOM: 14,
  PROVINCE_ZOOM: 10,
  FALLBACK_IMAGE: "fallback.png",
};

export function getRadiusByZoom(zoom: number): number {
  if (zoom <= 6) return 5000;
  if (zoom <= 7) return 3000;
  if (zoom <= 8) return 1500;
  if (zoom <= 9) return 750;
  return 300;
}
