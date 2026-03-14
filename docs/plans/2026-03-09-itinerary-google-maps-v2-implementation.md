# Itinerary Google Maps v2 - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new v2 itinerary page using Google Maps with full-screen map, floating search bar, and bottom sheet panel.

**Architecture:** Full-screen Google Maps with floating header/search, draggable bottom sheet for stop list, Google Directions API for routing, Google Places Autocomplete for search.

**Tech Stack:** Astro, TypeScript, @googlemaps/js-api-loader, Google Maps JavaScript API, Places API, Directions API

---

## Task 1: Add Google Maps API Key to Environment

**Files:**
- Modify: `.env`
- Modify: `.env.template`

**Step 1: Add Google Maps key to .env**

Add to end of `.env`:
```
PUBLIC_GOOGLE_MAPS_KEY=AIzaSyCW3iA3j5CFLW1IFH1j0gceOzSqHa_-pnc
```

**Step 2: Add template entry to .env.template**

Add to `.env.template`:
```
PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_api_key
```

---

## Task 2: Create Directory Structure

**Files:**
- Create: `src/components/Trip/ItineraryV2/`
- Create: `src/scripts/Itinerary/ItineraryMapV2.ts`

**Step 1: Create ItineraryV2 directory**

Run: `mkdir -p src/components/Trip/ItineraryV2`

---

## Task 3: Create ItineraryMapV2 Client Script

**Files:**
- Create: `src/scripts/Itinerary/ItineraryMapV2.ts`

**Step 1: Create the Google Maps client script**

```typescript
// Itinerary Map V2 Client-Side Script
// Handles Google Maps initialization, markers, routes, and interactions

import { Loader } from '@googlemaps/js-api-loader';
import { actions } from 'astro:actions';

let map: google.maps.Map | null = null;
let markers: google.maps.Marker[] = [];
let directionsService: google.maps.DirectionsService | null = null;
let directionsRenderer: google.maps.DirectionsRenderer | null = null;
let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

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

export async function initItineraryMapV2() {
  const container = document.getElementById('itinerary-map-v2');
  if (!container) return;

  const mapContainer = document.getElementById('map-container-v2');
  if (!mapContainer) return;

  const stopsData = container.dataset.stops;
  const canEdit = container.dataset.canEdit === 'true';
  const tripId = container.dataset.tripId;

  if (!stopsData) {
    console.log('[ItineraryMapV2] No stops data found');
    return;
  }

  let rawStops: any[] = [];
  let stops: Stop[] = [];
  try {
    rawStops = JSON.parse(stopsData);
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
  } catch (e) {
    console.error('Failed to parse stops:', e);
    return;
  }

  // Load Google Maps
  const apiKey = (window as any).PUBLIC_GOOGLE_MAPS_KEY || '';
  if (!apiKey) {
    console.error('Google Maps API key not found');
    return;
  }

  const loader = new Loader({
    apiKey: apiKey,
    version: 'weekly',
    libraries: ['places', 'marker'],
  });

  try {
    const google = await loader.load();
    initializeMap(google, stops, canEdit, tripId);
  } catch (e) {
    console.error('Failed to load Google Maps:', e);
  }
}

function initializeMap(google: typeof google, stops: Stop[], canEdit: boolean, tripId?: string) {
  const mapElement = document.getElementById('map-container-v2');
  if (!mapElement) return;

  // Default to Manila, Philippines
  const defaultCenter = { lat: 14.5995, lng: 120.9842 };

  map = new google.maps.Map(mapElement, {
    center: defaultCenter,
    zoom: 6,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [],
  });

  // Initialize services
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    polylineOptions: {
      strokeColor: '#4285F4',
      strokeWeight: 4,
      strokeOpacity: 0.8,
    },
  });

  autocompleteService = new google.maps.places.AutocompleteService();
  placesService = new google.maps.places.PlacesService(map);

  // Render markers
  renderMarkers(stops, canEdit, tripId);

  // Fit bounds if we have stops
  if (stops.length > 0) {
    fitBoundsToMarkers();
  }

  // Initialize search
  initSearchBox();

  // Click on map to add stop
  if (canEdit && tripId) {
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        openAddStopModal(e.latLng.lat(), e.latLng.lng());
      }
    });
  }

  // Setup bottom sheet
  initBottomSheet();
}

function renderMarkers(stops: Stop[], canEdit: boolean, tripId?: string) {
  if (!map) return;

  // Remove existing markers
  markers.forEach(m => m.setMap(null));
  markers = [];

  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);

  sortedStops.forEach((stop, index) => {
    if (!stop.latitude || !stop.longitude) return;

    const color = getStopColor(stop.location_type);

    const marker = new google.maps.Marker({
      position: { lat: stop.latitude, lng: stop.longitude },
      map: map!,
      title: stop.location?.name || stop.location_name || `Stop ${index + 1}`,
      zIndex: index + 1,
    });

    // Create info window content
    const infoWindow = createInfoWindow(stop, index, canEdit);

    marker.addListener('click', () => {
      infoWindow.open(map!, marker);
    });

    markers.push(marker);
  });

  // Update route
  if (sortedStops.length > 1) {
    updateRoute(sortedStops);
  } else {
    clearRoute();
  }
}

function createInfoWindow(stop: Stop, index: number, canEdit: boolean): google.maps.InfoWindow {
  const color = getStopColor(stop.location_type);
  const locationName = stop.location?.name || stop.location_name || `Stop ${index + 1}`;
  const typeLabel = stop.location_type?.replace(/_/g, ' ') || 'stop';

  const formatTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const timeRange = (() => {
    const start = stop.scheduled_start;
    const end = stop.scheduled_end;
    const waiting = stop.waiting_time;

    if (!start && !end) return '';
    
    const primary = start || end;
    if (!primary) return '';

    const startTime = formatTime(start);
    let endTime = '';

    if (end) {
      endTime = formatTime(end);
    } else if (waiting && waiting > 0) {
      const endDate = new Date(new Date(primary).getTime() + waiting * 60000);
      endTime = formatTime(endDate.toISOString());
    }

    if (endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
  })();

  let buttons = '';
  if (canEdit) {
    buttons = `
      <div class="flex gap-2 mt-2 pt-2 border-t">
        <button class="text-xs text-blue-600 hover:underline edit-stop-btn" data-stop-id="${stop.id}">Edit</button>
        <button class="text-xs text-red-600 hover:underline delete-stop-btn" data-stop-id="${stop.id}">Delete</button>
      </div>
    `;
  }

  const content = `
    <div class="min-w-[200px] p-1">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-2 h-2 rounded-full" style="background-color: ${color}"></span>
        <span class="text-xs text-gray-500 uppercase">${typeLabel}</span>
      </div>
      <h3 class="font-semibold text-gray-900">${locationName}</h3>
      ${timeRange ? `<p class="text-sm text-gray-500">${timeRange}</p>` : ''}
      ${stop.notes ? `<p class="text-xs text-gray-400 mt-1 italic">${stop.notes}</p>` : ''}
      ${buttons}
    </div>
  `;

  return new google.maps.InfoWindow({
    content: content,
    maxWidth: 280,
  });
}

function updateRoute(stops: Stop[]) {
  if (!map || !directionsService || !directionsRenderer || stops.length < 2) return;

  const origin = { lat: stops[0].latitude!, lng: stops[0].longitude! };
  const destination = { lat: stops[stops.length - 1].latitude!, lng: stops[stops.length - 1].longitude! };

  const waypoints = stops.slice(1, -1).map(s => ({
    location: { lat: s.latitude!, lng: s.longitude! },
    stopover: true,
  }));

  const profile = getRouteProfile();

  const request: google.maps.DirectionsRequest = {
    origin: origin,
    destination: destination,
    waypoints: waypoints,
    travelMode: profile as google.maps.TravelMode,
    optimizeWaypoints: false,
  };

  directionsService.route(request, (result, status) => {
    if (status === 'OK' && result) {
      directionsRenderer!.setDirections(result);
    }
  });
}

function clearRoute() {
  if (directionsRenderer) {
    directionsRenderer.setDirections({ routes: [] });
  }
}

function getRouteProfile(): string {
  const selector = document.getElementById('route-selector-v2');
  return (selector?.dataset.routeProfile as string) || 'DRIVING';
}

function fitBoundsToMarkers() {
  if (!map || markers.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  markers.forEach(m => bounds.extend(m.getPosition()!));
  map.fitBounds(bounds, 60);
}

function initSearchBox() {
  const searchInput = document.getElementById('location-search-input-v2') as HTMLInputElement | null;
  if (!searchInput || !map) return;

  // Use Places Autocomplete
  const autocomplete = new google.maps.places.Autocomplete(searchInput, {
    types: ['establishment', 'address', 'point_of_interest'],
    fields: ['name', 'geometry', 'formatted_address'],
  });

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Fly to location
      map?.flyTo({ center: { lat, lng }, zoom: 15 });

      // Open add modal
      openAddStopModal(lat, lng);

      // Pre-fill name
      const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement;
      if (modal) {
        const nameInput = modal.querySelector('[name="name"]') as HTMLInputElement;
        if (nameInput && place.name) {
          nameInput.value = place.name;
        }
      }
    }
  });
}

function initBottomSheet() {
  const sheet = document.getElementById('bottom-sheet');
  const handle = document.getElementById('bottom-sheet-handle');
  const content = document.getElementById('bottom-sheet-content');

  if (!sheet || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  const minHeight = 60; // Collapsed height
  const maxHeight = window.innerHeight * 0.7; // Expanded max

  const updateSheetPosition = () => {
    if (!sheet || !content) return;
    const diff = maxHeight - minHeight;
    const percent = currentY / diff;
    content.style.opacity = percent > 0.3 ? '1' : '0';
  };

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startY = e.clientY;
    document.body.style.overflow = 'hidden';
  });

  handle.addEventListener('touchstart', (e) => {
    isDragging = true;
    startY = e.touches[0].clientY;
    document.body.style.overflow = 'hidden';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const diff = startY - e.clientY;
    currentY = Math.max(0, Math.min(maxHeight - minHeight, currentY + diff));
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
    startY = e.clientY;
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const diff = startY - e.touches[0].clientY;
    currentY = Math.max(0, Math.min(maxHeight - minHeight, currentY + diff));
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
    startY = e.touches[0].clientY;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.overflow = '';
    
    // Snap to min or max
    if (currentY > (maxHeight - minHeight) / 2) {
      currentY = maxHeight - minHeight;
    } else {
      currentY = 0;
    }
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
  });

  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.overflow = '';
    
    if (currentY > (maxHeight - minHeight) / 2) {
      currentY = maxHeight - minHeight;
    } else {
      currentY = 0;
    }
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
  });

  // Click handle to toggle
  handle.addEventListener('click', () => {
    if (currentY > (maxHeight - minHeight) / 2) {
      currentY = 0;
    } else {
      currentY = maxHeight - minHeight;
    }
    sheet.style.height = `${minHeight + currentY}px`;
    updateSheetPosition();
  });
}

export function openAddStopAtCenterV2() {
  if (!map) return;
  const center = map.getCenter();
  if (center) {
    openAddStopModal(center.lat(), center.lng());
  }
}

function openAddStopModal(lat: number, lng: number) {
  const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement;
  if (!modal) return;

  // Fly map to location
  if (map) {
    map.panTo({ lat, lng });
    map.setZoom(15);
  }

  // Clear and fill form
  const form = modal.querySelector('form') as HTMLFormElement;
  if (form) form.reset();

  const latInput = modal.querySelector('[name="latitude"]') as HTMLInputElement;
  const lngInput = modal.querySelector('[name="longitude"]') as HTMLInputElement;
  if (latInput) latInput.value = lat.toString();
  if (lngInput) lngInput.value = lng.toString();

  const titleEl = document.getElementById('stop-modal-title-v2');
  if (titleEl) titleEl.textContent = 'Add New Stop';

  // Update stop count badge
  const container = document.getElementById('itinerary-map-v2');
  const stopsData = container?.dataset.stops;
  let stopCount = 0;
  if (stopsData) {
    try {
      const stops = JSON.parse(stopsData);
      stopCount = stops.length;
    } catch (e) {}
  }

  const badgeEl = document.getElementById('stop-order-badge-v2');
  if (badgeEl) badgeEl.textContent = `Stop #${stopCount + 1}`;

  modal.showModal();
}

export async function openEditStopModalV2(stopId: string) {
  const container = document.getElementById('itinerary-map-v2');
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

  const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement;
  if (!modal) return;

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

  const titleEl = document.getElementById('stop-modal-title-v2');
  if (titleEl) titleEl.textContent = 'Edit Stop';

  const badgeEl = document.getElementById('stop-order-badge-v2');
  const sortedStops = [...stops].sort((a, b) => a.order_index - b.order_index);
  const stopIndex = sortedStops.findIndex(s => s.id === stopId);
  if (badgeEl && stopIndex >= 0) {
    badgeEl.textContent = `Stop #${stopIndex + 1}`;
  }

  modal.showModal();
}

export async function deleteStopByIdV2(stopId: string) {
  if (!confirm('Are you sure you want to delete this stop?')) return;

  try {
    const { error } = await actions.stops.deleteStop({ stopId });

    if (error) {
      console.error('Failed to delete stop:', error);
      alert('Failed to delete stop: ' + error.message);
      return;
    }

    refreshMapV2();
  } catch (err) {
    console.error('Error deleting stop:', err);
    alert('Failed to delete stop');
  }
}

export async function refreshMapV2() {
  window.location.reload();
}

// Event delegation
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  if (target.classList.contains('edit-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) openEditStopModalV2(stopId);
  }

  if (target.classList.contains('delete-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (stopId) deleteStopByIdV2(stopId);
  }

  // Route profile buttons
  const routeBtn = target.closest('.route-profile-btn-v2');
  if (routeBtn) {
    const profile = (routeBtn as HTMLElement).dataset.profile;
    if (profile) {
      const selector = document.getElementById('route-selector-v2');
      if (selector) selector.dataset.routeProfile = profile;

      selector?.querySelectorAll('.route-profile-btn-v2').forEach((btn: Element) => {
        btn.classList.remove('bg-blue-100', 'text-blue-700');
        btn.classList.add('hover:bg-gray-100');
      });
      routeBtn.classList.add('bg-blue-100', 'text-blue-700');
      routeBtn.classList.remove('hover:bg-gray-100');

      handleRouteProfileChangeV2();
    }
  }
});

export function handleRouteProfileChangeV2() {
  const container = document.getElementById('itinerary-map-v2');
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

// Expose for global use
(window as any).openEditStopModalV2 = openEditStopModalV2;
(window as any).deleteStopByIdV2 = deleteStopByIdV2;
(window as any).refreshItineraryMapV2 = refreshMapV2;
```

---

## Task 4: Create StopModalV2 Component

**Files:**
- Create: `src/components/Trip/ItineraryV2/StopModalV2.astro`

**Step 1: Create the stop modal component**

```astro
---
interface Props {
  tripId: string;
  stopCount: number;
}

const { tripId, stopCount } = Astro.props;
---

<dialog id="stop-modal-v2" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg mb-4">
      <span id="stop-modal-title-v2">Add Stop</span>
      <span id="stop-order-badge-v2" class="badge badge-neutral ml-2">Stop #{stopCount + 1}</span>
    </h3>
    
    <form method="post" id="stop-form-v2">
      <input type="hidden" name="trip_id" value={tripId} />
      <input type="hidden" name="stop_id" value="" />
      <input type="hidden" name="latitude" value="" />
      <input type="hidden" name="longitude" value="" />
      
      <div class="form-control mb-3">
        <label class="label">
          <span class="label-text">Location Name</span>
        </label>
        <input 
          type="text" 
          name="name" 
          placeholder="e.g., Manila Cathedral" 
          class="input input-bordered w-full" 
          required 
        />
      </div>
      
      <div class="form-control mb-3">
        <label class="label">
          <span class="label-text">Type</span>
        </label>
        <select name="location_type" class="select select-bordered w-full">
          <option value="activity">Activity</option>
          <option value="meal_break">Meal Break</option>
          <option value="rest_stop">Rest Stop</option>
          <option value="accommodation">Accommodation</option>
          <option value="checkpoint">Checkpoint</option>
          <option value="pickup">Pickup</option>
          <option value="dropoff">Dropoff</option>
          <option value="boat">Boat</option>
          <option value="ferry">Ferry</option>
        </select>
      </div>
      
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Start Time</span>
          </label>
          <input 
            type="datetime-local" 
            name="scheduled_start" 
            class="input input-bordered w-full" 
          />
        </div>
        <div class="form-control">
          <label class="label">
            <span class="label-text">End Time</span>
          </label>
          <input 
            type="datetime-local" 
            name="scheduled_end" 
            class="input input-bordered w-full" 
          />
        </div>
      </div>
      
      <div class="form-control mb-3">
        <label class="label">
          <span class="label-text">Notes</span>
        </label>
        <textarea 
          name="notes" 
          placeholder="Optional notes..." 
          class="textarea textarea-bordered"
        ></textarea>
      </div>
      
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('stop-modal-v2').close()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>

<script>
  import { actions } from 'astro:actions';
  
  const modal = document.getElementById('stop-modal-v2') as HTMLDialogElement;
  const form = document.getElementById('stop-form-v2') as HTMLFormElement;
  
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const stopId = formData.get('stop_id') as string;
    
    const data = {
      trip_id: formData.get('trip_id'),
      name: formData.get('name'),
      location_type: formData.get('location_type'),
      latitude: parseFloat(formData.get('latitude') as string),
      longitude: parseFloat(formData.get('longitude') as string),
      scheduled_start: formData.get('scheduled_start') || null,
      scheduled_end: formData.get('scheduled_end') || null,
      notes: formData.get('notes') || null,
    };
    
    try {
      if (stopId) {
        await actions.stops.updateStop({ stop_id: stopId, ...data });
      } else {
        await actions.stops.createStop(data);
      }
      
      modal.close();
      window.location.reload();
    } catch (err) {
      console.error('Failed to save stop:', err);
      alert('Failed to save stop');
    }
  });
</script>
```

---

## Task 5: Create ItineraryMapV2 Component

**Files:**
- Create: `src/components/Trip/ItineraryV2/ItineraryMapV2.astro`

**Step 1: Create the map component**

```astro
---
import StopModalV2 from './StopModalV2.astro';

interface Props {
  tripId: string;
  stops: any[];
  canEdit: boolean;
  destination?: string;
  tripDetails?: any;
}

const { tripId, stops, canEdit, destination, tripDetails } = Astro.props;

const stopsJson = JSON.stringify(stops);
const tripDetailsJson = JSON.stringify(tripDetails || {});
---

<div 
  id="itinerary-map-v2" 
  class="relative h-screen w-full"
  data-trip-id={tripId}
  data-stops={stopsJson}
  data-trip-details={tripDetailsJson}
  data-can-edit={canEdit.toString()}
>
  <div id="map-container-v2" class="h-full w-full"></div>
  
  <!-- Floating Header -->
  <div class="absolute top-0 left-0 right-0 z-10 p-4">
    <div class="flex items-center gap-3">
      <a href={`/trips/${tripId}`} class="btn btn-circle btn-sm bg-white shadow-lg">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
      <div class="flex-1">
        <input 
          type="text" 
          id="location-search-input-v2"
          placeholder="🔍 Search places..." 
          class="input input-sm w-full bg-white shadow-lg rounded-full text-sm"
          autocomplete="off"
        />
      </div>
      <a href={`/trips/${tripId}/itinerary`} class="btn btn-circle btn-sm bg-white shadow-lg" title="Switch to Mapbox">
        <span class="text-xs font-bold">M</span>
      </a>
    </div>
  </div>
  
  <!-- Route Selector -->
  <div class="absolute top-20 left-4 z-10">
    <div class="flex bg-white rounded-lg shadow-lg p-1" id="route-selector-v2" data-route-profile="DRIVING">
      <button class="route-profile-btn-v2 btn btn-xs bg-blue-100 text-blue-700" data-profile="DRIVING">🚗</button>
      <button class="route-profile-btn-v2 btn btn-xs hover:bg-gray-100" data-profile="WALKING">🚶</button>
      <button class="route-profile-btn-v2 btn btn-xs hover:bg-gray-100" data-profile="BICYCLING">🚴</button>
    </div>
  </div>
  
  <!-- Day Filter -->
  <div class="absolute top-20 right-4 z-10">
    <select id="day-filter-v2" class="select select-sm bg-white shadow-lg rounded-lg text-sm">
      <option value="all">All Days</option>
    </select>
  </div>
  
  <!-- Empty State -->
  {stops.length === 0 && (
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="text-center bg-white/90 p-6 rounded-2xl shadow-lg">
        <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-700 mb-1">No stops yet</h3>
        <p class="text-sm text-gray-500">
          {canEdit ? 'Search or tap map to add stops' : 'No stops added yet'}
        </p>
      </div>
    </div>
  )}
  
  <!-- Bottom Sheet -->
  <div 
    id="bottom-sheet" 
    class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 transition-transform duration-300"
    style="height: 60px; overflow: hidden;"
  >
    <div id="bottom-sheet-handle" class="w-full h-4 flex items-center justify-center cursor-pointer pt-2">
      <div class="w-12 h-1 bg-gray-300 rounded-full"></div>
    </div>
    <div class="px-4 pb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-900">🗺️ {stops.length} Stops</h3>
        <button class="btn btn-xs btn-circle">⬇</button>
      </div>
      <div 
        id="bottom-sheet-content" 
        class="space-y-2 overflow-y-auto max-h-[50vh] transition-opacity duration-200"
        style="opacity: 0;"
      >
        {stops.length === 0 ? (
          <p class="text-sm text-gray-500 text-center py-4">No stops to display</p>
        ) : (
          stops
            .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            .map((stop: any, index: number) => {
              const loc = stop.location;
              const name = stop.location_name || loc?.name || `Stop ${index + 1}`;
              const type = stop.location_type?.replace(/_/g, ' ') || 'stop';
              const startTime = stop.scheduled_start ? new Date(stop.scheduled_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
              
              return (
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer" data-stop-id={stop.id}>
                  <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">{name}</p>
                    <p class="text-xs text-gray-500">{type} {startTime && `• ${startTime}`}</p>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  </div>
  
  <!-- Stop Modal -->
  {canEdit && (
    <StopModalV2 tripId={tripId} stopCount={stops.length} />
  )}
</div>

<script define:vars={{ PUBLIC_GOOGLE_MAPS_KEY: import.meta.env.PUBLIC_GOOGLE_MAPS_KEY }}>
  (window as any).PUBLIC_GOOGLE_MAPS_KEY = PUBLIC_GOOGLE_MAPS_KEY;
</script>

<script>
  import { initItineraryMapV2 } from '@/scripts/Itinerary/ItineraryMapV2';
  
  document.addEventListener('DOMContentLoaded', () => {
    initItineraryMapV2();
  });
  
  document.addEventListener('astro:page-load', () => {
    initItineraryMapV2();
  });
</script>
```

---

## Task 6: Create ItineraryV2 Page

**Files:**
- Create: `src/pages/trips/[trip_id]/itinerary-v2.astro`

**Step 1: Create the main page**

```astro
---
import Layout from '@/layouts/PagePlate.astro';
import { supabaseAdmin } from '@/lib/supabase';
import ItineraryMapV2 from '@/components/Trip/ItineraryV2/ItineraryMapV2.astro';

const slug = Astro.params.trip_id || '';
const user = Astro.locals.user_id;

const shareCode = Astro.url.searchParams.get('invite');

const rpcArgs: Record<string, unknown> = {
  p_trip_id: slug,
  p_current_user_id: user ?? null,
};
if (shareCode) rpcArgs.p_share_code = shareCode;

const { data: tripData, error } = await supabaseAdmin.rpc('get_trip_full_details', rpcArgs as any);

if (error || !tripData) {
  return Astro.redirect('/404');
}

const trip = tripData;

const {
  trip_id,
  title,
  description,
  status,
  user_role,
  trip_details,
  trip_locations,
  trip_members,
  trip_visibility,
} = trip;

const isOwner = user_role === 'owner';
const canEdit = isOwner;

const { data: itineraryStops } = await supabaseAdmin
  .from('trip_location')
  .select('*, location:locations(*), activities:stop_activities(*)')
  .eq('trip_id', trip_id)
  .not('location_type', 'in', '(destination)')
  .order('scheduled_start', { ascending: true, nullsFirst: false });

const stops = itineraryStops || [];
---

<Layout
  title={`${title} - Itinerary v2 | Tara G`}
  noHeader={true}
  noFooter={true}
>
  <ItineraryMapV2 
    tripId={trip_id} 
    stops={stops} 
    canEdit={canEdit}
    destination={title}
    tripDetails={trip_details}
  />
</Layout>
```

---

## Task 7: Add Google Maps Script to Layout (for API loading)

**Files:**
- Modify: `src/layouts/PagePlate.astro`

**Step 1: Check if we need to add any global styles**

The Google Maps API will be loaded via the js-api-loader in the component, so no global script needed.

---

## Task 8: Test the Implementation

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to v2 itinerary page**

Open: `http://localhost:3001/trips/[trip_id]/itinerary-v2`

**Step 3: Verify**

- [ ] Google Maps loads
- [ ] Floating search bar works
- [ ] Markers display on map
- [ ] Route lines connect stops
- [ ] Bottom sheet is draggable
- [ ] Click map to add stop works
- [ ] Search to add stop works

---

## Plan Complete

**Plan saved to:** `docs/plans/2026-03-09-itinerary-google-maps-v2-implementation.md`

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
