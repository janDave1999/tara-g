# Itinerary Map View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated itinerary page with interactive Mapbox map view where users can add, edit, delete, and reorder stops, with routes calculated via Mapbox Directions API.

**Architecture:** New page at `/trips/[trip_id]/itinerary` with Map View (default) and Timeline View toggle. Map displays stop markers with numbered badges and routes connecting them. Editing restricted to trip owner; access control respects `itinerary_public` flag.

**Tech Stack:** Astro, Mapbox GL JS, Mapbox Directions API, existing Supabase actions

---

## Phase 1: Page Setup & Routing

### Task 1: Create Itinerary Page Route

**Files:**
- Create: `src/pages/trips/[trip_id]/itinerary.astro`

**Step 1: Write the page component**

```astro
---
import { getTripFullDetails } from '@/lib/tripDetails';
import ItineraryMap from '@/components/Trip/Itinerary/ItineraryMap.astro';
import ItineraryTimeline from '@/components/Trip/Itinerary/ItineraryTimeline.astro';
import ViewToggle from '@/components/Trip/Itinerary/ViewToggle.astro';
import ItineraryHeader from '@/components/Trip/Itinerary/ItineraryHeader.astro';

const { tripId } = Astro.params;
const { data: user } = await Astro.locals.supabase.auth.getUser();

if (!user) {
  return Astro.redirect('/login');
}

const { data: trip, error } = await getTripFullDetails(tripId, user.id);

if (error || !trip) {
  return Astro.redirect('/404');
}

const isOwner = trip.trip?.owner_id === user.id;
const isMember = trip.trip_members?.some((m: any) => m.user_id === user.id && m.member_status === 'joined');
const canView = trip.trip_visibility?.itinerary_public || isOwner || isMember;

if (!canView) {
  return Astro.redirect('/404');
}

const canEdit = isOwner;
---

<html>
<head>
  <title>{trip.trip?.title} - Itinerary</title>
</head>
<body>
  <ViewToggle client:load />
  <div id="map-view" class="view-section">
    <ItineraryMap trip={trip} canEdit={canEdit} />
  </div>
  <div id="timeline-view" class="view-section hidden">
    <ItineraryTimeline stops={trip.trip_locations} isOwner={canEdit} />
  </div>
</body>
</html>
```

**Step 2: Commit**

```bash
git add src/pages/trips/[trip_id]/itinerary.astro
git commit -m "feat: create itinerary page route"
```

---

## Phase 2: Map Components

### Task 2: Create ItineraryMap Component

**Files:**
- Create: `src/components/Trip/Itinerary/ItineraryMap.astro`

**Step 1: Write the map component**

```astro
---
interface Props {
  trip: any;
  canEdit: boolean;
}

const { trip, canEdit } = Astro.props;
const stops = trip.trip_locations?.filter((l: any) => l.location_type !== 'destination') || [];
---

<div id="itinerary-map" class="h-screen w-full" data-stops={JSON.stringify(stops)} data-can-edit={canEdit}>
  <div id="map-container" class="h-full w-full"></div>
  
  <!-- Floating Controls -->
  <div class="absolute top-4 left-4 right-4 flex gap-2 justify-between items-start z-10">
    <div class="bg-white rounded-lg shadow p-2 flex gap-2">
      <RouteSelector client:load />
      <DayFilter client:load stops={stops} />
    </div>
    <button id="fit-bounds-btn" class="bg-white rounded-lg shadow p-2" title="Zoom to fit">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    </button>
  </div>
  
  {canEdit && (
    <div id="add-stop-hint" class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 rounded-full shadow px-4 py-2 text-sm">
      Click anywhere to add a stop
    </div>
  )}
</div>

<script>
  import mapboxgl from 'mapbox-gl';
  import { getMapboxToken } from '@/scripts/map/MapApi';
  
  // Client-side map logic in separate TS file
</script>
```

**Step 2: Commit**

```bash
git add src/components/Trip/Itinerary/ItineraryMap.astro
git commit -m "feat: create ItineraryMap component"
```

---

### Task 3: Create Map Client-Side Script

**Files:**
- Create: `src/scripts/Itinerary/ItineraryMap.ts`

**Step 1: Write the map script**

```typescript
import mapboxgl from 'mapbox-gl';
import { getMapboxToken } from '../map/MapApi';

let map: mapboxgl.Map;
let markers: mapboxgl.Marker[] = [];
let routeSource: mapboxgl.MapboxGeoJSONSource;

export async function initItineraryMap(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const stops = JSON.parse(container.dataset.stops || '[]');
  const canEdit = container.dataset.canEdit === 'true';
  
  const token = await getMapboxToken();
  mapboxgl.accessToken = token;
  
  map = new mapboxgl.Map({
    container: 'map-container',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [120.9842, 14.5995], // Manila default
    zoom: 6,
  });
  
  map.on('load', () => {
    addRouteSource();
    renderMarkers(stops);
    if (stops.length > 0) fitBounds();
  });
  
  if (canEdit) {
    map.on('click', handleMapClick);
  }
}

function addRouteSource() {
  map.addSource('route', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#3b82f6',
      'line-width': 4,
      'line-opacity': 0.8
    }
  });
}

function renderMarkers(stops: any[]) {
  markers.forEach(m => m.remove());
  markers = [];
  
  stops.forEach((stop, index) => {
    if (!stop.latitude || !stop.longitude) return;
    
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = `<div class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow">${index + 1}</div>`;
    
    const marker = new mapboxgl.Marker(el)
      .setLngLat([stop.longitude, stop.latitude])
      .setPopup(createPopup(stop, index))
      .addTo(map);
    
    markers.push(marker);
  });
  
  if (stops.length > 1) {
    updateRoute(stops);
  }
}

function createPopup(stop: any, index: number) {
  const canEdit = document.getElementById('itinerary-map')?.dataset.canEdit === 'true';
  const editBtn = canEdit ? `<button class="edit-stop-btn text-blue-600 hover:underline" data-stop-id="${stop.id}">Edit</button>` : '';
  const deleteBtn = canEdit ? `<button class="delete-stop-btn text-red-600 hover:underline ml-2" data-stop-id="${stop.id}">Delete</button>` : '';
  
  return new mapboxgl.Popup().setHTML(`
    <div class="p-2">
      <h3 class="font-bold">${stop.location_name || 'Stop ' + (index + 1)}</h3>
      <p class="text-sm text-gray-500">${stop.location_type?.replace(/_/g, ' ')}</p>
      <div class="mt-2">${editBtn}${deleteBtn}</div>
    </div>
  `);
}

export async function updateRoute(stops: any[]) {
  if (stops.length < 2) return;
  
  const coords = stops
    .sort((a, b) => a.order_index - b.order_index)
    .filter(s => s.latitude && s.longitude)
    .map(s => [s.longitude, s.latitude]);
  
  const profile = document.querySelector('[data-route-profile]')?.dataset.routeProfile || 'driving';
  
  try {
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords.map(c => c.join(',')).join(';')}?geometries=geojson&access_token=${mapboxgl.accessToken}`
    );
    const data = await response.json();
    
    if (data.routes?.[0]) {
      const geojson: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: data.routes[0].geometry
      };
      
      map.getSource('route')?.setData({
        type: 'FeatureCollection',
        features: [geojson]
      });
    }
  } catch (err) {
    console.error('Route calculation failed:', err);
  }
}

function handleMapClick(e: mapboxgl.MapMouseEvent) {
  const modal = document.getElementById('stop-modal') as any;
  if (modal) {
    modal.showModal();
    // Pre-fill coordinates from click
    const latInput = modal.querySelector('[name="latitude"]');
    const lngInput = modal.querySelector('[name="longitude"]');
    if (latInput) latInput.value = e.lngLat.lat;
    if (lngInput) lngInput.value = e.lngLat.lng;
  }
}

function fitBounds() {
  const bounds = new mapboxgl.LngLatBounds();
  markers.forEach(m => bounds.extend(m.getLngLat()));
  map.fitBounds(bounds, { padding: 50 });
}

// Export for external use
window.initItineraryMap = initItineraryMap;
```

**Step 2: Commit**

```bash
git add src/scripts/Itinerary/ItineraryMap.ts
git commit -m "feat: add itinerary map client script"
```

---

### Task 4: Create ViewToggle Component

**Files:**
- Create: `src/components/Trip/Itinerary/ViewToggle.astro`

**Step 1: Write the toggle**

```astro
---
---

<div class="flex gap-1 bg-gray-100 p-1 rounded-lg">
  <button id="view-map-btn" class="view-btn px-4 py-2 rounded-md bg-white shadow text-sm font-medium" data-view="map">
    🗺️ Map
  </button>
  <button id="view-timeline-btn" class="view-btn px-4 py-2 rounded-md text-gray-600 hover:bg-gray-50 text-sm font-medium" data-view="timeline">
    📋 Timeline
  </button>
</div>

<script>
  const mapBtn = document.getElementById('view-map-btn');
  const timelineBtn = document.getElementById('view-timeline-btn');
  const mapView = document.getElementById('map-view');
  const timelineView = document.getElementById('timeline-view');
  
  function switchView(view: 'map' | 'timeline') {
    if (view === 'map') {
      mapView?.classList.remove('hidden');
      timelineView?.classList.add('hidden');
      mapBtn?.classList.add('bg-white', 'shadow');
      mapBtn?.classList.remove('text-gray-600');
      timelineBtn?.classList.remove('bg-white', 'shadow');
    } else {
      mapView?.classList.add('hidden');
      timelineView?.classList.remove('hidden');
      timelineBtn?.classList.add('bg-white', 'shadow');
      timelineBtn?.classList.remove('text-gray-600');
      mapBtn?.classList.remove('bg-white', 'shadow');
    }
  }
  
  mapBtn?.addEventListener('click', () => switchView('map'));
  timelineBtn?.addEventListener('click', () => switchView('timeline'));
</script>
```

**Step 2: Commit**

```bash
git add src/components/Trip/Itinerary/ViewToggle.astro
git commit -m "feat: add view toggle component"
```

---

### Task 5: Create RouteSelector Component

**Files:**
- Create: `src/components/Trip/Itinerary/RouteSelector.astro`

**Step 1: Write the selector**

```astro
---
const profiles = [
  { id: 'driving', label: '🚗 Driving' },
  { id: 'walking', label: '🚶 Walking' },
  { id: 'cycling', label: '🚴 Cycling' },
];
const defaultProfile = 'driving';
---

<div class="flex gap-1" id="route-selector" data-route-profile={defaultProfile}>
  {profiles.map(p => (
    <button
      class={`route-profile-btn px-3 py-1.5 rounded text-xs font-medium transition-colors ${p.id === defaultProfile ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
      data-profile={p.id}
    >
      {p.label}
    </button>
  ))}
</div>

<script>
  import { updateRoute } from '@/scripts/Itinerary/ItineraryMap';
  
  const container = document.getElementById('route-selector');
  const btns = container?.querySelectorAll('.route-profile-btn');
  
  btns?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const profile = btn.dataset.profile!;
      container.dataset.routeProfile = profile;
      
      btns.forEach(b => {
        b.classList.remove('bg-blue-100', 'text-blue-700');
        b.classList.add('hover:bg-gray-100');
      });
      btn.classList.add('bg-blue-100', 'text-blue-700');
      btn.classList.remove('hover:bg-gray-100');
      
      // Trigger route recalculation
      const mapContainer = document.getElementById('itinerary-map');
      const stops = JSON.parse(mapContainer?.dataset.stops || '[]');
      await updateRoute(stops);
    });
  });
</script>
```

**Step 2: Commit**

```bash
git add src/components/Trip/Itinerary/RouteSelector.astro
git commit -m "feat: add route selector component"
```

---

### Task 6: Create DayFilter Component

**Files:**
- Create: `src/components/Trip/Itinerary/DayFilter.astro`

**Step 1: Write the filter**

```astro
---
interface Props {
  stops: any[];
}

const { stops } = Astro.props;

// Extract unique days from stops
const days = [...new Set(stops.map(s => {
  if (!s.scheduled_start) return null;
  return new Date(s.scheduled_start).toDateString();
}))].filter(Boolean);
---

<select id="day-filter" class="select select-sm border-gray-200">
  <option value="all">All Days</option>
  {days.map((day, i) => (
    <option value={day}>Day {i + 1}</option>
  ))}
</select>

<script>
  const filter = document.getElementById('day-filter');
  const mapContainer = document.getElementById('itinerary-map');
  
  filter?.addEventListener('change', () => {
    const allStops = JSON.parse(mapContainer?.dataset.stops || '[]');
    const selectedDay = filter.value;
    
    const filtered = selectedDay === 'all' 
      ? allStops 
      : allStops.filter((s: any) => new Date(s.scheduled_start).toDateString() === selectedDay);
    
    // Re-render markers with filtered stops
    window.rerenderMarkers?.(filtered);
  });
</script>
```

**Step 2: Commit**

```bash
git add src/components/Trip/Itinerary/DayFilter.astro
git commit -m "feat: add day filter component"
```

---

## Phase 3: Stop Editing Integration

### Task 7: Wire StopModal to Map

**Files:**
- Modify: `src/components/Trip/Itinerary/ItineraryMap.astro:40-50`

**Step 1: Add stop modal to page**

Add to the itinerary page after the map:

```astro
{canEdit && (
  <dialog id="stop-modal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg" id="stop-modal-title">Add Stop</h3>
      <form method="POST" action={Astro.locals.actions.stops.createStop}>
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="latitude" />
        <input type="hidden" name="longitude" />
        <!-- Stop form fields -->
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
)}
```

**Step 2: Commit**

```bash
git add src/pages/trips/\[trip_id\]/itinerary.astro
git commit -m "feat: integrate stop modal with map"
```

---

### Task 8: Handle Edit/Delete from Map Markers

**Files:**
- Modify: `src/scripts/Itinerary/ItineraryMap.ts:60-75`

**Step 1: Add click handlers**

```typescript
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  
  if (target.classList.contains('edit-stop-btn')) {
    const stopId = target.dataset.stopId;
    // Fetch stop data and open modal in edit mode
    openEditModal(stopId);
  }
  
  if (target.classList.contains('delete-stop-btn')) {
    const stopId = target.dataset.stopId;
    if (confirm('Delete this stop?')) {
      await deleteStop(stopId);
      refreshMap();
    }
  }
});

async function deleteStop(stopId: string) {
  const { error } = await Astro.locals.actions.stops.deleteStop({ stop_id: stopId });
  if (error) console.error('Delete failed:', error);
}

function refreshMap() {
  // Reload page or fetch updated stops
  window.location.reload();
}
```

**Step 2: Commit**

```bash
git add src/scripts/Itinerary/ItineraryMap.ts
git commit -m "feat: add edit/delete handlers for markers"
```

---

## Phase 4: Drag to Reorder

### Task 9: Implement Marker Dragging

**Files:**
- Modify: `src/scripts/Itinerary/ItineraryMap.ts:35-45`

**Step 1: Enable marker dragging**

```typescript
function renderMarkers(stops: any[]) {
  markers.forEach(m => m.remove());
  markers = [];
  
  const canEdit = document.getElementById('itinerary-map')?.dataset.canEdit === 'true';
  
  stops.forEach((stop, index) => {
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = `<div class="bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">${index + 1}</div>`;
    
    const marker = new mapboxgl.Marker({ draggable: canEdit })
      .setLngLat([stop.longitude, stop.latitude])
      .setPopup(createPopup(stop, index))
      .addTo(map);
    
    if (canEdit) {
      marker.on('dragend', () => handleMarkerDrag(stop, marker, stops));
    }
    
    markers.push(marker);
  });
}

async function handleMarkerDrag(stop: any, marker: mapboxgl.Marker, allStops: any[]) {
  const newLngLat = marker.getLngLat();
  
  // Update stop position in database
  await Astro.locals.actions.stops.updateStop({
    stop_id: stop.id,
    latitude: newLngLat.lat,
    longitude: newLngLat.lng
  });
  
  // Update route
  await updateRoute(allStops);
}
```

**Step 2: Commit**

```bash
git add src/scripts/Itinerary/ItineraryMap.ts
git commit -m "feat: enable marker dragging for reordering"
```

---

## Phase 5: Testing & Polish

### Task 10: Test the Implementation

**Step 1: Test page loads**

```bash
# Navigate to /trips/[trip_id]/itinerary
# Verify map loads without errors
```

**Step 2: Test adding stop via map click**

```bash
# Click on map
# Verify StopModal opens with coordinates pre-filled
# Fill form and submit
# Verify marker appears on map
```

**Step 3: Test route calculation**

```bash
# Add 2+ stops
# Verify route line appears
# Change route type
# Verify route recalculates
```

**Step 4: Test edit/delete**

```bash
# Click marker
# Click Edit
# Verify modal opens with data
# Test Delete
# Verify marker removed
```

**Step 5: Commit**

```bash
git commit -m "test: verify itinerary map functionality"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create itinerary page route |
| 2 | Create ItineraryMap component |
| 3 | Add client-side map script |
| 4 | Create ViewToggle component |
| 5 | Create RouteSelector component |
| 6 | Create DayFilter component |
| 7 | Wire StopModal to map |
| 8 | Add edit/delete handlers |
| 9 | Enable marker dragging |
| 10 | Test implementation |

---

**Plan complete.** Ready for execution.
