// Itinerary Map Client-Side Script
// Handles map initialization, markers, routes, and interactions

import mapboxgl from 'mapbox-gl';
import { getMapboxToken } from '../map/MapApi';
import { actions, ActionError } from 'astro:actions';
import { createMapboxSearchBox } from '../mapBoxSearch';

let map: mapboxgl.Map | null = null;
let markers: mapboxgl.Marker[] = [];
let routeLayerId = 'itinerary-route';
let routeSourceId = 'itinerary-route-source';

interface Stop {
  id: string;
  location_type: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  waiting_time: number | null;
  order_index: number;
  notes: string | null;
  location?: {
    name: string;
  };
}

const stopTypeColors: Record<string, string> = {
  destination: '#3b82f6',
  activity: '#10b981',
  meal_break: '#f59e0b',
  rest_stop: '#8b5cf6',
  accommodation: '#ec4899',
  checkpoint: '#6366f1',
  pickup: '#14b8a6',
  dropoff: '#f97316',
  boat: '#06b6d4',
  ferry: '#0ea5e9',
};

function getStopColor(locationType: string): string {
  return stopTypeColors[locationType] || '#6b7280';
}

export async function initItineraryMap() {
  const container = document.getElementById('itinerary-map');
  if (!container) return;
  
  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) return;
  
  const stopsData = container.dataset.stops;
  const canEdit = container.dataset.canEdit === 'true';
  const tripId = container.dataset.tripId;
  
  console.log('[ItineraryMap] Initializing with stopsData:', stopsData?.slice(0, 200));
  
  if (!stopsData) {
    console.log('[ItineraryMap] No stops data found');
    return;
  }
  
  let rawStops: any[] = [];
  let stops: Stop[] = [];
  try {
    rawStops = JSON.parse(stopsData);
    console.log('[ItineraryMap] Raw stops count:', rawStops.length);
    console.log('[ItineraryMap] Sample stop:', JSON.stringify(rawStops[0]));
    
    // Map the raw stops to our Stop interface
    // Latitude/longitude might be in location.latitude/location.longitude or directly on stop
    stops = rawStops.map((s: any) => {
      const loc = s.location;
      const lat = s.latitude ?? loc?.latitude ?? null;
      const lng = s.longitude ?? loc?.longitude ?? null;
      
      return {
        id: s.id,
        location_type: s.location_type,
        location_name: s.location_name || loc?.name || null,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        scheduled_start: s.scheduled_start,
        scheduled_end: s.scheduled_end,
        waiting_time: s.waiting_time ?? null,
        order_index: s.order_index ?? 0,
        notes: s.notes,
        location: loc,
      };
    });
    
    console.log('[ItineraryMap] Mapped stops:', stops);
  } catch (e) {
    console.error('Failed to parse stops:', e);
    return;
  }
  
  if (stops.length === 0) {
    console.log('[ItineraryMap] No stops to display');
  } else {
    console.log('[ItineraryMap] Stops with coords:', stops.filter(s => s.latitude && s.longitude).length);
  }
  
  const token = await getMapboxToken();
  if (!token) {
    console.error('Failed to get Mapbox token');
    return;
  }
  
  mapboxgl.accessToken = token;
  
  map = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [120.9842, 14.5995], // Manila default
    zoom: 6,
  });
  
  map.on('load', () => {
    setupRouteSource();
    renderMarkers(stops, canEdit, tripId);
    
    if (stops.length > 0) {
      fitBoundsToMarkers();
    }
  });
  
  // Fit bounds button
  document.getElementById('fit-bounds-btn')?.addEventListener('click', () => {
    fitBoundsToMarkers();
  });
  
  // Click on map to add stop
  if (canEdit && tripId) {
    map.on('click', (e) => {
      const target = e.originalEvent.target as HTMLElement;
      // Don't trigger if clicking on any marker (mapboxgl or our custom stop-marker)
      if (target.classList.contains('mapboxgl-marker') || 
          target.classList.contains('stop-marker') ||
          target.closest('.mapboxgl-marker') ||
          target.closest('.stop-marker')) {
        return;
      }
      
      openAddStopModal(e.lngLat.lat, e.lngLat.lng);
    });
  }
  
  // Initialize search box (outside of map load to ensure DOM is ready)
  initSearchBox();
}

function initSearchBox() {
  const searchInput = document.getElementById('location-search-input') as HTMLInputElement | null;
  if (!searchInput || !map) {
    console.log('[ItineraryMap] initSearchBox: searchInput or map not found');
    return;
  }
  
  console.log('[ItineraryMap] initSearchBox called');
  
  // Initialize with search box
  const sessionToken = 'itinerary-' + Math.random().toString(36).substring(2, 15);
  initSearchBoxWithTypes(searchInput, sessionToken, 'poi');
}

function initSearchBoxWithTypes(searchInput: HTMLInputElement, sessionToken: string, types: string) {
  createMapboxSearchBox({
    sessionTokenID: sessionToken,
    targetSelector: '#location-search-input',
    placeholder: 'Search location to add...',
    country: 'PH',
    types: types,
    onSelect: (result) => {
      const [lng, lat] = result.coordinates;
      openAddStopModal(lat, lng);
      
      // Pre-fill the name in the modal
      const modal = document.getElementById('stop-modal') as HTMLDialogElement;
      if (modal) {
        const nameInput = modal.querySelector('[name="name"]') as HTMLInputElement;
        if (nameInput) {
          nameInput.value = result.name;
        }
      }
    },
  });
}

function setupRouteSource() {
  if (!map) return;
  
  // Add source for route line
  map.addSource(routeSourceId, {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });
  
  // Add route line layer
  map.addLayer({
    id: routeLayerId,
    type: 'line',
    source: routeSourceId,
    paint: {
      'line-color': '#3b82f6',
      'line-width': 4,
      'line-opacity': 0.8,
      'line-dasharray': [2, 1]
    }
  });
}

function renderMarkers(stops: Stop[], canEdit: boolean, tripId?: string) {
  if (!map) return;
  
  // Remove existing markers
  markers.forEach(m => m.remove());
  markers = [];
  
  // Sort stops by order_index
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  
  sortedStops.forEach((stop, index) => {
    if (!stop.latitude || !stop.longitude) return;
    
    const color = getStopColor(stop.location_type);
    const el = document.createElement('div');
    el.className = 'stop-marker';
    el.innerHTML = `
      <div class="stop-marker-number" style="background-color: ${color}">
        ${index + 1}
      </div>
    `;
    
    const popup = createPopup(stop, index, canEdit, sortedStops);
    
    const marker = new mapboxgl.Marker({ 
      element: el,
      draggable: canEdit 
    })
      .setLngLat([stop.longitude, stop.latitude])
      .setPopup(popup)
      .addTo(map!);
    
    if (canEdit) {
      marker.on('dragend', () => handleMarkerDrag(stop, marker));
    }
    
    markers.push(marker);
  });
  
  // Update route
  if (sortedStops.length > 1) {
    updateRoute(sortedStops);
  } else {
    clearRoute();
  }
}

// Find stops within threshold distance (in degrees, roughly ~100m)
function findNearbyStops(targetStop: Stop, allStops: Stop[], threshold: number = 0.002): Stop[] {
  const targetLat = targetStop.latitude;
  const targetLng = targetStop.longitude;
  if (!targetLat || !targetLng) return [targetStop];
  
  return allStops.filter(s => {
    if (!s.latitude || !s.longitude) return false;
    const latDiff = Math.abs(s.latitude - targetLat);
    const lngDiff = Math.abs(s.longitude - targetLng);
    return latDiff < threshold && lngDiff < threshold;
  });
}

function createPopup(stop: Stop, index: number, canEdit: boolean, allStops?: Stop[]): mapboxgl.Popup {
  const color = getStopColor(stop.location_type);
  
  // Find nearby stops to show as a list if there are multiple
  const nearbyStops = allStops ? findNearbyStops(stop, allStops) : [stop];
  
  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  
  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  // Format time range with waiting time calculation
  const formatTimeRange = (s: Stop): string => {
    const start = s.scheduled_start;
    const end = s.scheduled_end;
    const waiting = s.waiting_time;
    
    // If both start and end are null, return empty
    if (!start && !end) return '';
    
    // Use end as fallback if start is null
    const primary = start || end;
    const secondary = start ? end : null;
    
    if (!primary) return '';
    
    const primaryDate = new Date(primary);
    const dateStr = formatDate(primary);
    
    // If we have start time
    if (start) {
      const startTime = formatTime(start);
      
      let endTime = '';
      if (secondary) {
        endTime = formatTime(secondary);
      } else if (waiting && waiting > 0) {
        const endDate = new Date(primaryDate.getTime() + waiting * 60000);
        endTime = formatTime(endDate.toISOString());
      }
      
      if (endTime) {
        return `${dateStr}, ${startTime} - ${endTime}`;
      }
      return `${dateStr}, ${startTime}`;
    }
    
    // If only end time (no start)
    if (end) {
      const endTime = formatTime(end);
      return `${dateStr}, ${endTime}`;
    }
    
    return '';
  };
  
  // If multiple stops nearby, show a list
  if (nearbyStops.length > 1) {
    const listItems = nearbyStops.map((s, i) => {
      const sColor = getStopColor(s.location_type);
      const sName = s.location?.name || s.location_name || `Stop ${i + 1}`;
      const sType = s.location_type?.replace(/_/g, ' ') || 'stop';
      const sTimeRange = formatTimeRange(s);
      const editBtn = canEdit ? `
        <div class="flex gap-2 mt-2 pt-2 border-t">
          <button class="text-xs text-blue-600 hover:underline edit-stop-btn" data-stop-id="${s.id}">Edit</button>
          <button class="text-xs text-red-600 hover:underline delete-stop-btn" data-stop-id="${s.id}">Delete</button>
        </div>
      ` : '';
      
      return `
        <div class="py-2 ${i > 0 ? 'border-t' : ''}">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full" style="background-color: ${sColor}"></span>
            <span class="text-xs text-gray-500 uppercase">${sType}</span>
          </div>
          <h3 class="font-semibold text-gray-900">${sName}</h3>
          ${sTimeRange ? `<p class="text-sm text-gray-500">${sTimeRange}</p>` : ''}
          ${editBtn}
        </div>
      `;
    }).join('');
    
    return new mapboxgl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(`
      <div class="min-w-[200px]">
        <h3 class="font-bold text-gray-900 mb-2 pb-2 border-b">
          ${nearbyStops.length} Stops Nearby
        </h3>
        ${listItems}
      </div>
    `);
  }
  
  // Single stop popup
  const locationName = stop.location?.name || stop.location_name || `Stop ${index + 1}`;
  const typeLabel = stop.location_type?.replace(/_/g, ' ') || 'stop';
  const timeRange = formatTimeRange(stop);
  
  let buttons = '';
  if (canEdit) {
    buttons = `
      <div class="flex gap-2 mt-2 pt-2 border-t">
        <button 
          class="text-xs text-blue-600 hover:underline edit-stop-btn" 
          data-stop-id="${stop.id}"
        >
          Edit
        </button>
        <button 
          class="text-xs text-red-600 hover:underline delete-stop-btn" 
          data-stop-id="${stop.id}"
        >
          Delete
        </button>
      </div>
    `;
  }
  
  return new mapboxgl.Popup({ offset: 25, maxWidth: '300px' }).setHTML(`
    <div class="min-w-[220px]">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
        <span class="text-xs text-gray-500 uppercase">${typeLabel}</span>
      </div>
      <h3 class="font-semibold text-gray-900">${locationName}</h3>
      ${timeRange ? `<p class="text-sm text-gray-500">${timeRange}</p>` : ''}
      ${stop.notes ? `<p class="text-xs text-gray-400 mt-1 italic">${stop.notes}</p>` : ''}
      ${buttons}
    </div>
  `);
}

async function handleMarkerDrag(stop: Stop, marker: mapboxgl.Marker) {
  const newLngLat = marker.getLngLat();
  
  // Get container to access tripId
  const container = document.getElementById('itinerary-map');
  const tripId = container?.dataset.tripId;
  
  if (!tripId) return;
  
    try {
    // First create/update the location
    const { error } = await actions.stops.updateStop({
      stop_id: stop.id,
      latitude: newLngLat.lat,
      longitude: newLngLat.lng,
    });
    
    if (error) {
      console.error('Failed to update stop position:', error);
      // Revert marker position
      marker.setLngLat([stop.longitude!, stop.latitude!]);
      return;
    }
    
    // Refresh route
    refreshMap();
  } catch (err) {
    console.error('Error updating marker position:', err);
    marker.setLngLat([stop.longitude!, stop.latitude!]);
  }
}

async function updateRoute(stops: Stop[]) {
  if (!map || stops.length < 2) return;
  
  const coords = stops
    .filter(s => s.latitude && s.longitude)
    .map(s => `${s.longitude},${s.latitude}`)
    .join(';');
  
  // Get selected profile from route selector
  const profile = getRouteProfile();
  
  const token = mapboxgl.accessToken;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json() as { routes?: Array<{ geometry: GeoJSON.Geometry }> };
    
    if (data.routes && data.routes.length > 0) {
      const routeGeoJSON: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: data.routes[0].geometry
      };
      
      const source = map.getSource(routeSourceId) as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [routeGeoJSON]
        });
      }
    }
  } catch (err) {
    console.error('Failed to calculate route:', err);
  }
}

function clearRoute() {
  if (!map) return;
  
  const source = map.getSource(routeSourceId) as mapboxgl.GeoJSONSource;
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features: []
    });
  }
}

function getRouteProfile(): string {
  const selector = document.getElementById('route-selector');
  return (selector?.dataset.routeProfile as string) || 'driving';
}

function fitBoundsToMarkers() {
  if (!map || markers.length === 0) return;
  
  const bounds = new mapboxgl.LngLatBounds();
  markers.forEach(m => bounds.extend(m.getLngLat()));
  map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
}

export function openAddStopAtCenter() {
  if (!map) return;
  const center = map.getCenter();
  openAddStopModal(center.lat, center.lng);
}

function openAddStopModal(lat: number, lng: number) {
  const modal = document.getElementById('stop-modal') as HTMLDialogElement;
  if (!modal) return;
  
  // Fly map to show the selected location
  if (map) {
    map.flyTo({
      center: [lng, lat],
      zoom: 15,
      duration: 1500,
    });
  }
  
  // Clear form
  const form = modal.querySelector('form') as HTMLFormElement;
  if (form) form.reset();
  
  // Set hidden fields for coordinates
  const latInput = modal.querySelector('[name="latitude"]') as HTMLInputElement;
  const lngInput = modal.querySelector('[name="longitude"]') as HTMLInputElement;
  if (latInput) latInput.value = lat.toString();
  if (lngInput) lngInput.value = lng.toString();
  
  // Set title
  const titleEl = document.getElementById('stop-modal-title');
  if (titleEl) titleEl.textContent = 'Add New Stop';
  
  // Reset badge to show next stop number
  const badgeEl = document.getElementById('stop-order-badge');
  const container = document.getElementById('itinerary-map');
  const stopsData = container?.dataset.stops;
  let stopCount = 0;
  if (stopsData) {
    try {
      const stops = JSON.parse(stopsData);
      stopCount = stops.length;
    } catch (e) {}
  }
  if (badgeEl) {
    badgeEl.textContent = `Stop #${stopCount + 1}`;
  }
  
  // Show modal
  modal.showModal();
}

export async function openEditStopModal(stopId: string) {
  const container = document.getElementById('itinerary-map');
  const stopsData = container?.dataset.stops;
  if (!stopsData) return;
  
  let stops: Stop[] = [];
  try {
    stops = JSON.parse(stopsData);
  } catch (e) {
    return;
  }
  
  const stop = stops.find(s => s.id === stopId);
  if (!stop) return;
  
  const modal = document.getElementById('stop-modal') as HTMLDialogElement;
  if (!modal) return;
  
  // Fill form
  const form = modal.querySelector('form') as HTMLFormElement;
  if (form) {
    const stopIdInput = form.querySelector('[name="stop_id"]') as HTMLInputElement | null;
    const nameInput = form.querySelector('[name="name"]') as HTMLInputElement | null;
    const locationTypeSelect = form.querySelector('[name="location_type"]') as HTMLSelectElement | null;
    const latInput = form.querySelector('[name="latitude"]') as HTMLInputElement | null;
    const lngInput = form.querySelector('[name="longitude"]') as HTMLInputElement | null;
    const startInput = form.querySelector('[name="scheduled_start"]') as HTMLInputElement | null;
    const endInput = form.querySelector('[name="scheduled_end"]') as HTMLInputElement | null;
    const notesInput = form.querySelector('[name="notes"]') as HTMLTextAreaElement | null;
    
    if (stopIdInput) stopIdInput.value = stopId;
    if (nameInput) nameInput.value = stop.location?.name || stop.location_name || '';
    if (locationTypeSelect) locationTypeSelect.value = stop.location_type || 'activity';
    if (latInput) latInput.value = stop.latitude?.toString() || '';
    if (lngInput) lngInput.value = stop.longitude?.toString() || '';
    if (startInput) startInput.value = stop.scheduled_start ? stop.scheduled_start.slice(0, 16) : '';
    if (endInput) endInput.value = stop.scheduled_end ? stop.scheduled_end.slice(0, 16) : '';
    if (notesInput) notesInput.value = stop.notes || '';
  }
  
  // Set title
  const titleEl = document.getElementById('stop-modal-title');
  if (titleEl) titleEl.textContent = 'Edit Stop';
  
  // Update badge to show current order
  const badgeEl = document.getElementById('stop-order-badge');
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  const stopIndex = sortedStops.findIndex(s => s.id === stopId);
  if (badgeEl && stopIndex >= 0) {
    badgeEl.textContent = `Stop #${stopIndex + 1}`;
  }
  
  // Show modal
  modal.showModal();
}

export async function deleteStopById(stopId: string) {
  if (!confirm('Are you sure you want to delete this stop?')) return;
  
  try {
    const { error } = await actions.stops.deleteStop({ stopId });
    
    if (error) {
      console.error('Failed to delete stop:', error);
      alert('Failed to delete stop: ' + error.message);
      return;
    }
    
    refreshMap();
  } catch (err) {
    console.error('Error deleting stop:', err);
    alert('Failed to delete stop');
  }
}

export async function refreshMap() {
  const container = document.getElementById('itinerary-map');
  const tripId = container?.dataset.tripId;
  
  if (!tripId) return;
  
  // Reload the page to get fresh data
  window.location.reload();
}

// Export for external use
(window as any).openEditStopModal = openEditStopModal;
(window as any).deleteStopById = deleteStopById;
(window as any).refreshItineraryMap = refreshMap;

// Initialize view toggle functionality
export function initViewToggle() {
  const mapBtn = document.getElementById('view-map-btn');
  const timelineBtn = document.getElementById('view-timeline-btn');
  const mapView = document.getElementById('map-view');
  const timelineView = document.getElementById('timeline-view');
  
  function switchView(view: 'map' | 'timeline') {
    if (view === 'map') {
      mapView?.classList.remove('hidden');
      timelineView?.classList.add('hidden');
      mapBtn?.classList.add('bg-white', 'shadow', 'text-gray-900');
      mapBtn?.classList.remove('text-gray-500');
      timelineBtn?.classList.remove('bg-white', 'shadow', 'text-gray-900');
      timelineBtn?.classList.add('text-gray-500');
      
      // Trigger map resize
      setTimeout(() => map?.resize(), 100);
    } else {
      mapView?.classList.add('hidden');
      timelineView?.classList.remove('hidden');
      timelineBtn?.classList.add('bg-white', 'shadow', 'text-gray-900');
      timelineBtn?.classList.remove('text-gray-500');
      mapBtn?.classList.remove('bg-white', 'shadow', 'text-gray-900');
      mapBtn?.classList.add('text-gray-500');
    }
  }
  
  mapBtn?.addEventListener('click', () => switchView('map'));
  timelineBtn?.addEventListener('click', () => switchView('timeline'));
}

// Event delegation for popup buttons
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  
  if (target.classList.contains('edit-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) openEditStopModal(stopId);
  }
  
  if (target.classList.contains('delete-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) deleteStopById(stopId);
  }
  
  // Route profile buttons
  const routeBtn = target.closest('.route-profile-btn');
  if (routeBtn) {
    const profile = (routeBtn as HTMLElement).dataset.profile;
    if (profile) {
      const selector = document.getElementById('route-selector');
      if (selector) selector.dataset.routeProfile = profile;
      
      // Update button styles
      selector?.querySelectorAll('.route-profile-btn').forEach((btn: Element) => {
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        btn.classList.add('hover:bg-gray-100');
      });
      routeBtn.classList.add('bg-blue-100', 'text-blue-700');
      routeBtn.classList.remove('hover:bg-gray-100');
      
      // Trigger route recalculation
      handleRouteProfileChange();
    }
  }
});

// Route profile change handler
export function handleRouteProfileChange() {
  const container = document.getElementById('itinerary-map');
  const stopsData = container?.dataset.stops;
  
  if (!stopsData) return;
  
  let stops: Stop[] = [];
  try {
    stops = JSON.parse(stopsData);
  } catch (e) {
    return;
  }
  
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  updateRoute(sortedStops);
}
