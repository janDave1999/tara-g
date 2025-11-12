import { PUBLIC_MAPBOX_TOKEN } from "astro:env/client";
export async function mapboxRetrieve({
  suggestionId,
  sessionToken,
}: {
  suggestionId: string;
  sessionToken: string;
}) {
  const params = new URLSearchParams({
    session_token: sessionToken,
    access_token: PUBLIC_MAPBOX_TOKEN,
  });

  const url = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestionId}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) throw new Error("Mapbox Retrieve API failed");
  const data = await response.json();

  return data;
}
