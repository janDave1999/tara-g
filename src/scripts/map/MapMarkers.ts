import mapboxgl from "mapbox-gl";
import { PUBLIC_R2_URL } from "astro:env/client";

interface TripMarkerData {
  trip_id: string;
  title: string;
  location_name?: string;
  lat?: number;
  lng?: number;
  start_date?: string;
  end_date?: string;
  current_participants?: number;
  max_participants?: number;
  images?: string[];
}

const FALLBACK_IMAGE = '/images/default-trip.jpg';

function getTripImage(images?: string[]): string {
  return images?.[0] ? `${PUBLIC_R2_URL}${images[0]}` : FALLBACK_IMAGE;
}

function hasAvailableSlots(trip: TripMarkerData): boolean {
  return (trip.current_participants ?? 0) < (trip.max_participants ?? 0);
}

export function createTripMarker(
  trip: TripMarkerData,
  map: mapboxgl.Map,
  onClick: (trip: TripMarkerData) => void
): mapboxgl.Marker {
  const img = getTripImage(trip.images);
  const hasSlots = hasAvailableSlots(trip);
  const statusColor = hasSlots ? '#10b981' : '#ef4444';

  const el = document.createElement('div');
  el.className = 'custom-marker';
  el.innerHTML = `
    <div style="position: relative; cursor: pointer;">
      <div style="
        width: 56px;
        height: 56px;
        border-radius: 50%;
        overflow: hidden;
        border: 4px solid ${statusColor};
        box-shadow: 0 6px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: white;
      " class="marker-container">
        <img src="${img}" style="
          width: 100%;
          height: 100%;
          object-fit: cover;
        " alt="${trip.title}" />
      </div>
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 12px solid ${statusColor};
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      "></div>
    </div>
  `;

  const container = el.querySelector('.marker-container') as HTMLElement;
  
  el.addEventListener('mouseenter', () => {
    container.style.transform = 'scale(1.15)';
    container.style.boxShadow = '0 8px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.05)';
  });
  
  el.addEventListener('mouseleave', () => {
    container.style.transform = 'scale(1)';
    container.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)';
  });
  
  el.addEventListener('click', () => onClick(trip));

  const lat = Number(trip.lat);
  const lng = Number(trip.lng);
  
  return new mapboxgl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([lng, lat])
    .addTo(map);
}

export function createClusterMarker(
  tripGroup: TripMarkerData[],
  coordinates: [number, number],
  map: mapboxgl.Map,
  onClick: (trips: TripMarkerData[], coords: [number, number]) => void
): mapboxgl.Marker {
  const el = document.createElement('div');
  el.className = 'cluster-marker';
  el.innerHTML = `
    <div style="
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      border: 4px solid white;
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(0,0,0,0.05);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    " class="cluster-container">
      <div style="font-size: 22px; line-height: 1;">${tripGroup.length}</div>
      <div style="font-size: 9px; opacity: 0.9; font-weight: 600; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">trips</div>
      <div style="
        position: absolute;
        inset: -8px;
        border-radius: 50%;
        border: 2px solid #10b981;
        opacity: 0.3;
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 0.3;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.1;
        }
      }
    </style>
  `;

  const container = el.querySelector('.cluster-container') as HTMLElement;
  
  el.addEventListener('mouseenter', () => {
    container.style.transform = 'scale(1.15)';
    container.style.boxShadow = '0 8px 30px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(0,0,0,0.05)';
  });
  
  el.addEventListener('mouseleave', () => {
    container.style.transform = 'scale(1)';
    container.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(0,0,0,0.05)';
  });
  
  el.addEventListener('click', () => onClick(tripGroup, coordinates));

  return new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat(coordinates)
    .addTo(map);
}

export function groupTripsByLocation(trips: TripMarkerData[]): Map<string, TripMarkerData[]> {
  const groups = new Map<string, TripMarkerData[]>();
  
  trips.forEach(trip => {
    const lat = Number(trip.lat);
    const lng = Number(trip.lng);
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(trip);
  });
  
  return groups;
}

export function clearMarkers(markers: mapboxgl.Marker[]): void {
  markers.forEach(m => m.remove());
}
