import { PUBLIC_MAPBOX_TOKEN } from "astro:env/client";

export async function searchNearbyPOIs({
  longitude,
  latitude,
  types,
  limit = 20,
}: {
  longitude: number;
  latitude: number;
  types?: string;
  limit?: number;
}) {
  let poiCategory = '';
  
  if (types) {
    if (types.includes('poi_category=')) {
      const match = types.match(/poi_category=([^&]+)/);
      if (match) {
        poiCategory = match[1];
      }
    }
  }
  
  let query = 'restaurant';
  switch (poiCategory) {
    case 'food':
      query = 'restaurant cafe';
      break;
    case 'attraction':
      query = 'tourist attraction museum park';
      break;
    case 'transit':
      query = 'bus station train station';
      break;
    case 'accommodation':
      query = 'hotel hostel';
      break;
    default:
      query = 'place';
  }
  
  // Use Mapbox Geocoding API - search without types=poi restriction
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${PUBLIC_MAPBOX_TOKEN}&limit=${limit}&proximity=${longitude},${latitude}`;
  
  console.log('[nearbySearch] Searching for:', query, 'near', latitude, longitude);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      console.error('[nearbySearch] API failed:', errText);
      return [];
    }
    const data = await response.json() as any;
    console.log('[nearbySearch] Raw response:', JSON.stringify(data).slice(0, 500));
    const results = data.features || [];
    console.log('[nearbySearch] Found:', results.length, 'places');
    
    // Return all results (not just POIs)
    return results;
  } catch (err) {
    console.error('[nearbySearch] Error:', err);
    return [];
  }
}
