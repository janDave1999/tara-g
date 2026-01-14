import { PUBLIC_MAPBOX_TOKEN } from "astro:env/client";

type GeocodeOptions = {
  query: string;
  country?: string;       // optional ISO 3166-1 alpha2 codes, comma-separated
  language?: string;      // optional IETF language tag or comma-separated list
  limit?: number;         // optional max number of results (default is 5, max is 10) :contentReference[oaicite:1]{index=1}
  autocomplete?: boolean; // optional autocomplete behaviour (default = true) :contentReference[oaicite:2]{index=2}
  proximity?: [number, number]; // [longitude, latitude] to bias results :contentReference[oaicite:3]{index=3}
  types?: string[];       // optional feature types filter (e.g., ["address","place"]) :contentReference[oaicite:4]{index=4}
};

type GeocodeResult = {
  longitude: number;
  latitude: number;
  placeName: string;
  raw: any; // full response feature for further use
};

export async function forwardGeocode(options: GeocodeOptions): Promise<GeocodeResult[]> {
  const {
    query,
    country,
    language,
    limit,
    autocomplete,
    proximity,
    types,
  } = options;

  const params = new URLSearchParams({
    access_token: PUBLIC_MAPBOX_TOKEN,
    q: query,
    ...(country ? { country } : {}),
    ...(language ? { language } : {}),
    ...(typeof limit === "number" ? { limit: limit.toString() } : {}),
    ...(typeof autocomplete === "boolean" ? { autocomplete: autocomplete.toString() } : {}),
    ...(proximity ? { proximity: `${proximity[0]},${proximity[1]}` } : {}),
    ...(types && types.length ? { types: types.join(",") } : {}),
  });

  const url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  // According to docs, results are in `features` array. :contentReference[oaicite:5]{index=5}
  const features = data.features ?? [];

  return features.map((feat: any) => ({
    longitude: feat.geometry?.coordinates?.[0],
    latitude: feat.geometry?.coordinates?.[1],
    placeName: feat.properties?.name ?? feat.place_name ?? "",
    raw: feat,
  }));
}
