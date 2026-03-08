# Itinerary Map View — Design Document

> Date: 2026-03-08
> Status: Approved

---

## Overview

Create a dedicated itinerary page at `/trips/[trip_id]/itinerary` with interactive Mapbox map and timeline views. Users can add, edit, delete, and reorder stops directly on the map, with routes calculated via Mapbox Directions API.

---

## Page Specification

### URL
`/trips/[trip_id]/itinerary`

### Access Control

| Setting | Behavior |
|---------|----------|
| `itinerary_public = true` | Anyone with link can view (read-only) |
| `itinerary_public = false` | Trip owner and members only |
| Editing | Trip owner only (regardless of public setting) |

---

## Views

### 1. Map View (Default)

**Layout:** Full-width Mapbox map with floating controls

**Components:**
- Mapbox GL JS map (Philippines-focused, bounds to trip region)
- Stop markers with numbered badges (1, 2, 3...) showing order
- Route polyline connecting stops in order
- Floating header with:
  - Trip title and destination breadcrumb
  - View toggle (Map / Timeline)
  - Route type selector (Driving / Walking / Cycling)
  - Day filter dropdown
  - Add Stop button (owner only)
  - Zoom to fit button

**Interactions:**
| Action | Trigger | Result |
|--------|---------|--------|
| Add stop | Click map (owner) | Opens StopModal with clicked coordinates pre-filled |
| View stop details | Click marker | Shows popup with stop name, type, time, mini activities list |
| Edit stop | Click Edit in popup (owner) | Opens StopModal pre-filled |
| Delete stop | Click Delete in popup (owner) | Confirm modal → removes stop |
| Reorder stops | Drag marker | Updates `order_index`, route redraws |
| Switch route type | Toggle Driving/Walk/Cycle | Route recalculates with new profile |
| Filter by day | Select day in dropdown | Shows only stops for that day |
| Zoom to fit | Click fit button | Map bounds to all visible stops |

**Empty State:**
- Show "Click anywhere on the map to add your first stop" prompt
- "Add First Stop" button in center

### 2. Timeline View

Reuses existing vertical timeline layout from current `Itinerary.astro`.

**Enhancements:**
- Each stop card shows mini-map thumbnail
- Clicking a stop centers the map on it (if map available)

---

## Components to Create

| Component | File | Purpose |
|-----------|------|---------|
| Page | `pages/trips/[trip_id]/itinerary.astro` | Route handler, data fetching |
| Map | `components/Trip/Itinerary/ItineraryMap.astro` | Mapbox integration, markers, routes |
| Toggle | `components/Trip/Itinerary/ViewToggle.astro` | Map/Timeline toggle buttons |
| DayFilter | `components/Trip/Itinerary/DayFilter.astro` | Filter stops by day |
| RouteSelector | `components/Trip/Itinerary/RouteSelector.astro` | Driving/Walking/Cycling toggle |

**Existing Components (reuse):**
- `StopModal.astro` — Add/Edit stop form
- `Itinerary.astro` — Timeline view
- `actions/stops.ts` — CRUD operations

---

## Data Flow

### Fetching
```
GET /trips/[trip_id]/itinerary
  → get_trip_full_details RPC
  → Extract trip_locations as stops
  → Pass to ItineraryMap + ItineraryTimeline
```

### Adding Stop
```
User clicks map → StopModal opens with lat/lng pre-filled
User fills form → actions.stops.createStop
  → INSERT locations
  → INSERT trip_location (with location_id)
  → Return new stop
Map refreshes → Markers + route update
```

### Editing Stop
```
Click marker → StopModal opens with existing data
User saves → actions.stops.updateStop
  → UPDATE locations
  → UPDATE trip_location
Map refreshes → Markers + route update
```

### Deleting Stop
```
Click delete → Confirm modal
Confirm → actions.stops.deleteStop
  → DELETE trip_location
  → DELETE locations if orphaned
Map refreshes → Markers + route update
```

### Reordering (Drag-Drop)
```
Drag marker → On dragend:
  → Calculate new order_index for all affected stops
  → Batch UPDATE trip_location SET order_index
Map refreshes → Route redraws in new order
```

### Route Calculation
```
stops = stops.sort((a,b) => a.order_index - b.order_index)
coordinates = stops.map(s => [s.longitude, s.latitude])

POST Mapbox Directions API
  → profile: driving/walking/cycling
  → coordinates: [lng,lat, lng,lat, ...]
  → Response: route geometry, duration, distance

Render: GeoJSON lineString on map
```

---

## Mapbox Integration

### Markers
- Custom HTML markers with numbered badges
- Color-coded by stop type (destination=blue, activity=green, meal_break=orange, etc.)
- Click → Popup with details

### Routes
- **API:** `https://api.mapbox.com/directions/v5/mapbox/{profile}`
- **Profile options:** `driving-traffic`, `walking`, `cycling`
- **Geometry:** `geojson` (for easy rendering)
- **Steps:** `false` (we don't need turn-by-turn)
- **Overview:** `full` (show complete route)

### API Key
- Use existing `getMapboxToken` from `MapApi.ts`
- Cache route responses in sessionStorage to avoid repeated calls

---

## Route Selector UI

```
┌─────────────────────────────────────────┐
│  🚗 Driving  │  🚶 Walking  │  🚴 Cycling  │
└─────────────────────────────────────────┘
```

- Default: Driving
- Persists in localStorage per trip
- Shows estimated travel time next to each segment

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Map fails to load | Show timeline view with toast error |
| Directions API fails | Show markers without route, toast warning |
| No stops | Empty state with prompt |
| Stop has no coordinates | Show in timeline but mark on map as "Location pending" |

---

## Responsive Behavior

| Screen | Layout |
|--------|--------|
| Desktop (>1024px) | Full map view |
| Tablet (768-1024px) | Map with collapsible timeline panel |
| Mobile (<768px) | Toggle between map/timeline views |

---

## Acceptance Criteria

1. ✅ Page loads at `/trips/[trip_id]/itinerary`
2. ✅ Map displays with all stops as numbered markers
3. ✅ Route connects stops in order via Directions API
4. ✅ Clicking map adds new stop (owner only)
5. ✅ Clicking marker shows popup with Edit/Delete
6. ✅ Dragging marker reorders stops and updates route
7. ✅ Route type toggle recalculates routes
8. ✅ Day filter shows/hides stops
9. ✅ Timeline view accessible via toggle
10. ✅ Access control respects `itinerary_public` setting
11. ✅ Empty state shows appropriate prompt
12. ✅ Mobile responsive with view toggle

---

## Related Files

### To Modify
- `src/actions/stops.ts` — Ensure createStop accepts lat/lng from map click

### New Files
- `src/pages/trips/[trip_id]/itinerary.astro`
- `src/components/Trip/Itinerary/ItineraryMap.astro`
- `src/components/Trip/Itinerary/ViewToggle.astro`
- `src/components/Trip/Itinerary/DayFilter.astro`
- `src/components/Trip/Itinerary/RouteSelector.astro`

---

*Approved: 2026-03-08*
