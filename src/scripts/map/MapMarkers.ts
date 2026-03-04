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

interface MarkerConfig {
  singleMarkerRadius: number;    // Size of single trip marker
  clusterRadius: number;          // Grouping distance in map units (lat/lng degrees)
}

const DEFAULT_CONFIG: MarkerConfig = {
  singleMarkerRadius: 16,          // Smaller: was 24
  clusterRadius: 0.001             // ~111 meters at equator
};

// Store event handlers per sourceId to enable cleanup
const eventHandlers = new Map<string, (e: mapboxgl.MapStyleImageMissingEvent) => void>();

const FALLBACK_IMAGE = '/images/default-trip.jpg';

function getTripImage(images?: string[]): string {
  const url = images?.[0] ? `${PUBLIC_R2_URL}${images[0]}` : FALLBACK_IMAGE;
  return url;
}

function hasAvailableSlots(trip: TripMarkerData): boolean {
  return (trip.current_participants ?? 0) < (trip.max_participants ?? 0);
}

/**
 * Group trips by location proximity.
 * Trips within clusterRadius are grouped together.
 */
function groupTripsByLocation(
  trips: TripMarkerData[],
  clusterRadius: number
): Array<{ location: [number, number]; trips: TripMarkerData[] }> {
  const groups: Array<{ location: [number, number]; trips: TripMarkerData[] }> = [];
  const processed = new Set<string>();

  trips.forEach(trip => {
    if (!trip.lat || !trip.lng) return;

    const tripKey = `${trip.trip_id}`;
    if (processed.has(tripKey)) return;

    const cluster = {
      location: [Number(trip.lng), Number(trip.lat)] as [number, number],
      trips: [trip]
    };

    // Find nearby trips
    trips.forEach(otherTrip => {
      if (!otherTrip.lat || !otherTrip.lng) return;
      if (otherTrip.trip_id === trip.trip_id) return;

      const distance = Math.sqrt(
        Math.pow(otherTrip.lng - trip.lng, 2) +
        Math.pow(otherTrip.lat - trip.lat, 2)
      );

      if (distance <= clusterRadius) {
        cluster.trips.push(otherTrip);
        processed.add(`${otherTrip.trip_id}`);
      }
    });

    groups.push(cluster);
    processed.add(tripKey);
  });

  return groups;
}

/**
 * Convert grouped trips to GeoJSON FeatureCollection.
 * Single trips and cluster centers are rendered as points.
 */
export function tripsToGeoJSON(trips: TripMarkerData[], config = DEFAULT_CONFIG) {
  const groups = groupTripsByLocation(trips, config.clusterRadius);

  const features = groups.map(group => {
    const imageUrl = getTripImage(group.trips[0].images);
    const imageId = `marker-${group.trips[0].trip_id}`;
    
    console.log(`Trip ${group.trips[0].trip_id}:`, {
      images: group.trips[0].images,
      imageUrl,
      imageId,
    });

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: group.location
      },
      properties: {
        trip_id: group.trips[0].trip_id,
        title: group.trips[0].title,
        image: imageUrl,
        images: JSON.stringify(group.trips[0].images || []),
        image_id: imageId,
        has_slots: group.trips.some(t => hasAvailableSlots(t)),
        is_cluster: group.trips.length > 1,
        cluster_count: group.trips.length,
        trips: JSON.stringify(group.trips), // Store full trip data for modal
        location_name: group.trips[0].location_name,
        region: group.trips[0].location_name,
        start_date: group.trips[0].start_date,
        end_date: group.trips[0].end_date,
        current_participants: group.trips[0].current_participants,
        max_participants: group.trips[0].max_participants,
        duration_days: group.trips[0].duration_days,
        estimated_budget: group.trips[0].estimated_budget,
        tags: JSON.stringify(group.trips[0].tags || []),
      }
    };
  });

  return {
    type: 'FeatureCollection' as const,
    features
  };
}

/**
 * Add trip markers as image-based symbol layers (GPU-rendered, no drift).
 * Single markers show trip images, clusters show counts.
 */
export function addImageMarkerLayers(
  map: mapboxgl.Map,
  sourceId = 'trips',
  onClick?: (trip: any) => void,
  config = DEFAULT_CONFIG
) {
  const loadedImages = new Set<string>();

  // Background circle layer for single trips (green/red based on availability)
  map.addLayer({
    id: `${sourceId}-single-bg-circles`,
    type: 'circle',
    source: sourceId,
    filter: ['!', ['get', 'is_cluster']],
    paint: {
      'circle-color': [
        'case',
        ['get', 'has_slots'],
        '#10b981',  // green: available
        '#ef4444'   // red: full
      ],
      'circle-radius': config.singleMarkerRadius,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1
    }
  });

  // Symbol layer for trip images
  map.addLayer({
    id: `${sourceId}-single-images`,
    type: 'symbol',
    source: sourceId,
    filter: ['!', ['get', 'is_cluster']],
    layout: {
      'icon-image': ['get', 'image_id'],
      'icon-size': 0.95,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    },
    paint: {
      'icon-opacity': 1
    }
  });

  // Cluster background circles (gradient green)
  map.addLayer({
    id: `${sourceId}-cluster-bg-circles`,
    type: 'circle',
    source: sourceId,
    filter: ['get', 'is_cluster'],
    paint: {
      'circle-color': '#10b981',
      'circle-radius': [
        'step',
        ['get', 'cluster_count'],
        32,   // 2-5 trips
        6,
        38,   // 6+ trips
        15,
        44    // 15+ trips
      ],
      'circle-stroke-width': 4,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 1
    }
  });

  // Cluster count labels
  map.addLayer({
    id: `${sourceId}-cluster-labels`,
    type: 'symbol',
    source: sourceId,
    filter: ['get', 'is_cluster'],
    layout: {
      'text-field': ['get', 'cluster_count'],
      'text-font': ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 16,
      'text-allow-overlap': true,
      'text-ignore-placement': true
    },
    paint: {
      'text-color': '#ffffff'
    }
  });

  // Add placeholder image for fallback
  if (!map.hasImage('marker-placeholder')) {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#e5e7eb';
    ctx.beginPath();
    ctx.arc(25, 25, 23, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(25, 25, 20, 0, Math.PI * 2);
    ctx.fill();

    map.addImage('marker-placeholder', ctx.getImageData(0, 0, 50, 50));
  }

  // Don't pre-load images - rely on styleimagemissing event handler instead
  // This avoids timing issues and lets images load on-demand as they're rendered

  // Interactive hover state - single markers
  if (map.getLayer(`${sourceId}-single-bg-circles`)) {
    map.on('mouseenter', `${sourceId}-single-bg-circles`, () => {
      map.getCanvas().style.cursor = 'pointer';
      map.setPaintProperty(`${sourceId}-single-bg-circles`, 'circle-radius', config.singleMarkerRadius + 6);
      map.setPaintProperty(`${sourceId}-single-bg-circles`, 'circle-stroke-width', 4);
    });

    map.on('mouseleave', `${sourceId}-single-bg-circles`, () => {
      map.getCanvas().style.cursor = '';
      map.setPaintProperty(`${sourceId}-single-bg-circles`, 'circle-radius', config.singleMarkerRadius);
      map.setPaintProperty(`${sourceId}-single-bg-circles`, 'circle-stroke-width', 3);
    });

    if (onClick) {
      map.on('click', `${sourceId}-single-bg-circles`, (e) => {
        const feature = e.features?.[0];
        if (feature?.properties) {
          onClick(feature.properties);
        }
      });
    }
  }

  // Interactive hover state - cluster markers
  if (map.getLayer(`${sourceId}-cluster-bg-circles`)) {
    map.on('mouseenter', `${sourceId}-cluster-bg-circles`, () => {
      map.getCanvas().style.cursor = 'pointer';
      map.setPaintProperty(`${sourceId}-cluster-bg-circles`, 'circle-radius', [
        'step',
        ['get', 'cluster_count'],
        38,   // 2-5 trips
        6,
        44,   // 6+ trips
        15,
        50    // 15+ trips
      ]);
      map.setPaintProperty(`${sourceId}-cluster-bg-circles`, 'circle-stroke-width', 5);
    });

    map.on('mouseleave', `${sourceId}-cluster-bg-circles`, () => {
      map.getCanvas().style.cursor = '';
      map.setPaintProperty(`${sourceId}-cluster-bg-circles`, 'circle-radius', [
        'step',
        ['get', 'cluster_count'],
        32,   // 2-5 trips
        6,
        38,   // 6+ trips
        15,
        44    // 15+ trips
      ]);
      map.setPaintProperty(`${sourceId}-cluster-bg-circles`, 'circle-stroke-width', 4);
    });

    if (onClick) {
      map.on('click', `${sourceId}-cluster-bg-circles`, (e) => {
        const feature = e.features?.[0];
        if (feature?.properties) {
          // For clusters, parse and show the first trip for now
          // In the future, could show a list of all trips
          onClick(feature.properties);
        }
      });
    }
  }

  // Handle missing images on demand - loads images when Mapbox requests them
  const imageLoadHandler = (e: mapboxgl.MapStyleImageMissingEvent) => {
    const imageId = e.id;
    
    // Skip non-marker images
    if (!imageId.startsWith('marker-')) return;

    // Find the source data for this trip
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
    if (!source) return;

    const data = source.serialize().data as any;
    if (!data?.features) return;

    // Find the feature with this image ID
    for (const feature of data.features) {
      if (feature.properties?.image_id === imageId && !loadedImages.has(imageId)) {
        const imageUrl = feature.properties?.image;
        if (!imageUrl) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 50;
            canvas.height = 50;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(25, 25, 23, 0, Math.PI * 2);
            ctx.fill();

            ctx.save();
            ctx.beginPath();
            ctx.arc(25, 25, 20, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, 5, 5, 40, 40);
            ctx.restore();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(25, 25, 23, 0, Math.PI * 2);
            ctx.stroke();

            const imageData = ctx.getImageData(0, 0, 50, 50);
            
            if (map.hasImage(imageId)) {
              map.removeImage(imageId);
            }
            map.addImage(imageId, imageData);
            
            loadedImages.add(imageId);
            console.log(`Loaded missing image: ${imageId}`);
          } catch (err) {
            console.error(`Error processing image ${imageId}:`, err);
          }
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${imageUrl}`);
          loadedImages.add(imageId);
        };
        img.src = imageUrl;
        break;
      }
    }
  };

  map.on('styleimagemissing', imageLoadHandler);
  
  // Store handler for later cleanup
  eventHandlers.set(sourceId, imageLoadHandler);
}

/**
 * Remove trip marker layers from map.
 */
export function removeTripMarkerLayers(map: mapboxgl.Map, sourceId = 'trips') {
  // Remove event handler
  const handler = eventHandlers.get(sourceId);
  if (handler) {
    map.off('styleimagemissing', handler);
    eventHandlers.delete(sourceId);
  }

  [
    `${sourceId}-single-bg-circles`,
    `${sourceId}-single-images`,
    `${sourceId}-cluster-bg-circles`,
    `${sourceId}-cluster-labels`
  ].forEach(layer => {
    if (map.getLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

/**
 * Update the GeoJSON source with new trips.
 */
export function updateTripMarkers(
  map: mapboxgl.Map,
  trips: TripMarkerData[],
  sourceId = 'trips',
  config = DEFAULT_CONFIG
) {
  const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
  if (!source) return;

  source.setData(tripsToGeoJSON(trips, config));
  map.triggerRepaint();
}

// Keep clearMarkers for backward compatibility
export function clearMarkers(_markers: any[]): void {
  // No-op: GeoJSON layers handle cleanup
}



