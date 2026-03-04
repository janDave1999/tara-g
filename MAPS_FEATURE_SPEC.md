# Maps Feature — Detailed Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **Maps** feature enables users to discover trips through an interactive map interface. It serves as an alternative discovery mechanism to the `/trips` feed, allowing users to explore trips geographically.

---

## 1. Current Implementation Summary

### 1.1 Route & Page

| Page | Route | Component |
|------|-------|-----------|
| Maps | `/maps` | `src/components/MapBox.astro` |

The page is accessible at `/maps` with PagePlate wrapper enabled.

### 1.2 Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Province Search | ✅ Working | Searchbox filters PH provinces |
| Trip Markers | ⚠️ Performance Issue | Custom DOM markers - slow with 500+ markers |
| Marker Clustering | ⚠️ Performance Issue | Custom DOM clustering - should use Mapbox native |
| Filters | ✅ Working | UI wired to action call (tags/locationType) |
| Trip Detail Modal | ✅ Working | Popup shows trip info |
| "Search this area" | ✅ Working | Fetches trips in current map bounds |
| Geolocation | ✅ Working | Centers map on user's location |

### 1.3 Data Source

| Function | Purpose |
|----------|---------|
| `getNearbyTrips` action | Fetches trips within radius using `search_trips_optimized` RPC |
| `search_trips_optimized` RPC | PostGIS spatial query for trips by coordinates and radius |

### 1.4 Map Technology

- **Map Provider:** Mapbox GL JS v3.17.0-beta.1
- **Package:** `mapbox-gl` v3.16.0
- **Map Style:** `mapbox://styles/mapbox/standard`
- **Search:** Mapbox Geocoding API (via `@mapbox/search-js-web`)

---

## 2. User Stories

### 2.1 Map Discovery (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-M1 | As a user, I want to see trips on a map | Map displays trip markers at their locations | ✅ Pass |
| US-M2 | As a user, I want to search by province | Province searchbox filters trips by province | ✅ Pass |
| US-M3 | As a user, I want to explore trips in my area | "Search this area" fetches trips in visible region | ✅ Pass |
| US-M4 | As a user, I want to see trip details from map | Clicking marker shows trip detail modal | ✅ Pass |
| US-M5 | As a user, I want to navigate to trip page | "View Details" button links to `/trips/[trip_id]` | ✅ Pass |
| US-M6 | As a user, I want to filter trips by type | Filter by destination/pickup/dropoff location type | ⚠️ Partial - UI works, not wired to query |
| US-M7 | As a user, I want to filter by activities | Filter by tags (hiking, diving, etc.) | ⚠️ Partial - UI exists, not wired to query |
| US-M8 | As a user, I want to see cluster counts | Clusters show number of trips inside | ✅ Pass |
| US-M9 | As a user, I want to zoom into clusters | Clicking cluster zooms to show individual markers | ⚠️ Partial - shows popup instead of zoom |
| US-M10 | As a user, I want to see availability status | Markers colored by available/full status | ✅ Pass |
| US-M11 | As a user, I want to use my location | Geolocate button centers map on user | ✅ Pass |

### 2.2 Future Enhancements (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-M12 | As a user, I want to save favorite locations | Save locations for quick access | ❌ Not started |
| US-M13 | As a user, I want to see trip routes | Draw route lines between itinerary stops | ❌ Not started |
| US-M14 | As a user, I want offline maps | Download map area for offline use | ❌ Not started |

---

## 2.3 Performance Improvements (P0/P1)

### 🔴 Critical - Performance Fixes

| # | Story | Acceptance Criteria | Priority | Status |
|---|-------|---------------------|----------|--------|
| US-MP1 | As a developer, I want to use GPU-accelerated markers | Replace DOM markers with GeoJSON symbol layers for 60 FPS rendering with 500+ markers | P0 | ✅ Complete |
| US-MP2 | As a user, I want faster initial load | Implement parallel data loading to eliminate waterfall | P0 | ✅ Complete |
| US-MP3 | As a developer, I want clean production code | Remove all debug console.log statements from MapApi.ts | P0 | ✅ Complete |

### 🟡 High Impact - UX Improvements

| # | Story | Acceptance Criteria | Priority | Status |
|---|-------|---------------------|----------|--------|
| US-MP4 | As a user, I want to zoom into clusters | Clicking cluster zooms to show individual markers (not popup) | P1 | ✅ Complete |
| US-MP5 | As a user, I want responsive search | Add debounce to search this area and filter buttons | P1 | ✅ Complete |
| US-MP6 | As a user, I want smooth map interactions | Add throttling to move events | P1 | ✅ Complete |

### 🟢 Optimization - Polish

| # | Story | Acceptance Criteria | Priority | Status |
|---|-------|---------------------|----------|--------|
| US-MP7 | As a user, I want no memory leaks | Reuse popup instances instead of creating new ones | P2 | ✅ Complete |
| US-MP8 | As a developer, I want proper cleanup | Add map.remove() on component unmount | P2 | ✅ Complete |
| US-MP9 | As a user on mobile, I want better performance | Add mobile-specific optimizations (reduced tile quality, limited pitch) | P2 | ✅ Complete |

---

## 3. Technical Details

### 3.1 Action Handler

```typescript
// src/actions/trips.ts:777
getNearbyTrips: defineAction({
  input: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusKm: z.number().min(0.1).max(1000).default(50),
    tags: z.array(z.string()).optional(),
    minBudget: z.number().min(0).optional(),
    maxBudget: z.number().min(0).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    locationType: z.enum(['destination', 'pickup', 'all']).default('destination'),
    limit: z.number().min(1).max(100).default(50),
    offset: z.number().min(0).default(0),
  }),
  // ... calls search_trips_optimized RPC
})
```

### 3.2 Radius by Zoom Level

| Zoom Level | Radius (km) |
|------------|-------------|
| ≤6 | 200,000 |
| 7 | 100,000 |
| 8 | 50,000 |
| 9 | 25,000 |
| ≥10 | 10,000 |

### 3.3 Marker Types

| Type | Condition | Visual |
|------|-----------|--------|
| Single Trip | Only 1 trip at location | Custom marker with trip image, border color indicates availability |
| Cluster | 2+ trips at location | Circle with count, gradient green |

### 3.4 Filter Options

**Location Type:**
- Destination (default)
- Pickup
- Drop-off

**Activity Tags:**
- Hiking 🥾
- Diving 🤿
- Surfing 🏄
- Camping ⛺
- Beach 🏖️
- Mountain ⛰️
- Island 🏝️

---

## 4. Known Issues

### 4.1 🔴 Critical - Performance Issues (FIXED)

| Issue | Location | Description | User Story | Status |
|-------|----------|-------------|-------------|--------|
| DOM Markers Performance | MapMarkers.ts:27-91, MapBox.astro:306-316 | Using DOM-based markers instead of symbol layers causes 15-20 FPS with 500+ markers | US-MP1 | ✅ Fixed |
| Data Loading Waterfall | MapBox.astro:420-434 | Map waits to load until after map initializes, adding ~1s delay | US-MP2 | ✅ Fixed |
| Debug console.log | MapApi.ts:4,52,72,82,85 | Debug statements left in production code | US-MP3 | ✅ Fixed |

### 4.2 🟡 High Impact - UX Issues (FIXED)

| Issue | Location | Description | User Story | Status |
|-------|----------|-------------|-------------|--------|
| Cluster click shows popup | MapBox.astro:312-315 | Should zoom into cluster instead of showing popup list | US-MP4 | ✅ Fixed |
| No debounce on search | MapBox.astro:456-461 | Search triggers immediately without debounce, causing multiple API calls | US-MP5 | ✅ Fixed |
| No event throttling | MapBox.astro:437-439 | moveend event fires without throttling | US-MP6 | ✅ Fixed |

### 4.3 🟢 Optimization - Memory & Mobile (FIXED)

| Issue | Location | Description | User Story | Status |
|-------|----------|-------------|-------------|--------|
| Popup memory leak | MapBox.astro:353-359 | Creates new popup on every click instead of reusing | US-MP7 | ✅ Fixed |
| No map cleanup | MapBox.astro (missing) | No map.remove() called on unmount causes memory growth | US-MP8 | ✅ Fixed |
| No mobile optimizations | MapBox.astro:420-425 | No mobile-specific settings for performance | US-MP9 | ✅ Fixed |

### 4.4 Previously Reported Issues

| Issue | Location | Description | Status |
|-------|----------|-------------|--------|
| Filters not applied | MapBox.astro:995-1001 | Filters UI updates badge but doesn't filter trips | ✅ Fixed |
| PagePlate commented | MapBox.astro:475 | Layout wrapper disabled | ✅ Fixed |

---

## 5. Best Practices Comparison

### 5.1 Mapbox Official Recommendations

Based on Mapbox best practices:

| Practice | Current Implementation | Recommendation |
|----------|----------------------|----------------|
| **Clustering** | Custom DOM markers | Use Mapbox's built-in GeoJSON clustering for better performance with large datasets |
| **Data Loading** | Fetch on every search (after map loads) | Load data in parallel with map initialization |
| **Marker Performance** | DOM markers for all points | Use `symbol` layer with `circle` layer for 100+ points |
| **Filters** | Now wired to server ✅ | Push filters to server-side RPC when possible |
| **Event Handling** | No debounce/throttle | Add debounce to search, throttle to move events |
| **Memory Management** | Creates new popups | Reuse popup instances, cleanup on unmount |

### 5.2 Implementation Status

| Recommendation | Status | User Story |
|---------------|--------|------------|
| Use Mapbox Native Clustering | ✅ Implemented | US-MP1 |
| Parallel Data Loading | ✅ Implemented | US-MP2 |
| Remove console.log statements | ✅ Implemented | US-MP3 |
| Cluster click → zoom | ✅ Implemented | US-MP4 |
| Add debounce to search | ✅ Implemented | US-MP5 |
| Reuse popup instances | ✅ Implemented | US-MP7 |
| Add map cleanup | ✅ Implemented | US-MP8 |
| Mobile optimizations | ✅ Implemented | US-MP9 |

---

## 6. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `mapbox-gl` | ^3.16.0 | Map rendering |
| `@mapbox/search-js-web` | ^1.5.0 | Geocoding/autocomplete |
| `supercluster` | (bundled with mapbox-gl) | Clustering (built-in) |

---

## 7. File Structure

```
src/
├── pages/
│   └── maps/
│       └── index.astro           # Route wrapper
├── components/
│   ├── MapBox.astro             # Main map component (refactored)
│   ├── MapSearchBox.astro       # Search input component
│   ├── MapFilterModal.astro     # Filter modal component
│   └── MapTripDetail.astro      # Trip detail modal component
└── scripts/
    └── map/
        ├── MapConfig.ts          # Configuration constants
        ├── MapApi.ts            # API calls
        └── MapMarkers.ts        # Marker creation logic
```

---

## 8. Related Features

| Feature | Relationship |
|---------|--------------|
| Trip Discovery | Maps is an alternative discovery UI to `/trips` |
| Trip Detail | Map links to `/trips/[trip_id]` |
| Itinerary | Future: could show itinerary stops on map |
| Project 82 | Province boundaries from geojson files |

---

## 9. Implementation Plan

### Phase 1: 🔴 Critical Performance Fixes (P0)

- [x] **US-MP3**: Remove debug console.log statements from MapApi.ts
- [x] **US-MP2**: Fix data loading waterfall - start data fetch in parallel with map init
- [x] **US-MP1**: Replace DOM markers with GeoJSON symbol layers + native clustering

### Phase 2: 🟡 High Impact UX (P1)

- [x] **US-MP4**: Change cluster click behavior from popup to zoom
- [x] **US-MP5**: Add debounce to search this area and filter buttons
- [x] **US-MP6**: Add throttling to map move events

### Phase 3: 🟢 Optimization (P2)

- [x] **US-MP7**: Reuse popup instance instead of creating new ones
- [x] **US-MP8**: Add map cleanup on component unmount
- [x] **US-MP9**: Add mobile-specific optimizations

### Phase 4: Previously Planned

- [ ] Add loading states
- [ ] Add error handling with user feedback
- [ ] Implement pagination (load more on scroll)
- [ ] Add date range filter
- [ ] Add budget range filter

---

*Last updated: 2026-03-04*
*Last updated: 2026-02-21*
*Created: Maps feature analysis and specification*
