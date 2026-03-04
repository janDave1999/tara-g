import { actions } from "astro:actions";
import { getRadiusByZoom } from "./MapConfig";

interface TripData {
  trip_id: string;
  title: string;
  description?: string;
  lat?: number;
  lng?: number;
  location_name?: string;
  start_date?: string;
  end_date?: string;
  current_participants?: number;
  max_participants?: number;
  images?: string[];
  distance_km?: number;
  estimated_budget?: number;
  tags?: string[];
  available_spots?: number;
  region?: string;
  duration_days?: number;
  budget_per_person?: number;
}

interface FetchNearbyTripsParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  tags?: string[];
  locationType?: 'destination' | 'pickup' | 'dropoff' | 'all';
  limit?: number;
  offset?: number;
  zoom?: number;
}

export async function fetchNearbyTrips(params: FetchNearbyTripsParams): Promise<TripData[]> {
  const {
    latitude,
    longitude,
    radiusKm,
    tags,
    locationType = 'destination',
    limit = 100,  // Increased for better UX with image markers
    offset = 0,
    zoom = 10,
  } = params;

  const effectiveRadius = radiusKm ?? getRadiusByZoom(zoom);

  const result = await actions.trip.getNearbyTrips({
    latitude,
    longitude,
    radiusKm: effectiveRadius,
    tags: tags && tags.length > 0 ? tags : undefined,
    locationType: locationType as 'destination' | 'pickup' | 'dropoff' | 'all',
    limit,
    offset,
  });

  // Handle both direct array return (RPC) and wrapped format
  let trips: any[] = [];
  if (Array.isArray(result.data)) {
    trips = result.data;
  } else if (result.data?.trips) {
    trips = result.data.trips;
  }

  if (result.error || trips.length === 0) {
    console.error('[MapApi] Failed to fetch nearby trips:', result.error || 'No trips found');
    return [];
  }

  return trips;
}

export async function getMapboxToken(): Promise<string> {
  try {
    const res = await fetch("/api/mapbox-token");
    const data = await res.json() as { token?: string };
    return data.token || "";
  } catch {
    return "";
  }
}
