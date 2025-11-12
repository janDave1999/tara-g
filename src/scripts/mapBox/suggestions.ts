import { PUBLIC_MAPBOX_TOKEN } from "astro:env/client";
export async function mapboxSuggest({
  query,
  sessionToken,
  country = "PH",
  language = "en",
  limit = 5,
}: {
  query: string;
  sessionToken: string; // unique per search session (important!)
  country?: string;
  language?: string;
  limit?: number;
}) {
  const params = new URLSearchParams({
    q: query,
    country,
    language,
    limit: String(limit),
    session_token: sessionToken,
    access_token: PUBLIC_MAPBOX_TOKEN,
  });

  const url = `https://api.mapbox.com/search/searchbox/v1/suggest?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error("Mapbox Suggest API failed");
  const data = await response.json();

  // Each suggestion includes a unique id for the next step
  return data.suggestions ?? [];
}
