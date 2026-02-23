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

The page is currently accessible at `/maps` but has a commented-out `PagePlate` wrapper (line 475 in MapBox.astro).

### 1.2 Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Province Search | ✅ Working | Searchbox filters PH provinces |
| Trip Markers | ✅ Working | Custom markers with trip cover images |
| Marker Clustering | ✅ Working | Groups nearby trips into cluster markers |
| Filters | ⚠️ Partial | UI exists but filters aren't applied to query |
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
| US-M9 | As a user, I want to zoom into clusters | Clicking cluster zooms to show individual markers | ✅ Pass |
| US-M10 | As a user, I want to see availability status | Markers colored by available/full status | ✅ Pass |
| US-M11 | As a user, I want to use my location | Geolocate button centers map on user | ✅ Pass |

### 2.2 Future Enhancements (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-M12 | As a user, I want to save favorite locations | Save locations for quick access | ❌ Not started |
| US-M13 | As a user, I want to see trip routes | Draw route lines between itinerary stops | ❌ Not started |
| US-M14 | As a user, I want offline maps | Download map area for offline use | ❌ Not started |

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

### 4.1 High Priority

| Issue | Location | Description |
|-------|----------|-------------|
| Debug console.log | MapBox.astro:683, 861 | Debug statements left in production code |
| Filters not applied | MapBox.astro:995-1001 | Filters UI updates badge but doesn't filter trips |
| PagePlate commented | MapBox.astro:475 | Layout wrapper disabled |

### 4.2 Medium Priority

| Issue | Location | Description |
|-------|----------|-------------|
| No loading state | fetchNearbyTrips | No indicator while fetching trips |
| Pagination not implemented | fetchNearbyTrips | Uses offset pagination but only fetches first page |
| Cluster click shows popup | MapBox.astro:859-863 | Cluster click shows list but could zoom instead |
| No error handling | fetchNearbyTrips | Silent failure on API errors |

### 4.3 Low Priority

| Issue | Location | Description |
|-------|----------|-------------|
| Hardcoded tags | MapBox.astro:512-526 | Tags not synced with database |
| No date filters | UI exists | Start/end date filters not wired |
| No budget filters | UI exists | Budget min/max not wired |
| Accessibility | Overall | Missing ARIA labels on interactive elements |

---

## 5. Best Practices Comparison

### 5.1 Mapbox Official Recommendations

Based on Mapbox best practices:

| Practice | Current Implementation | Recommendation |
|----------|----------------------|----------------|
| **Clustering** | Custom DOM markers | Use Mapbox's built-in GeoJSON clustering for better performance with large datasets |
| **Data Loading** | Fetch on every search | Use tilesets for server-side clustering (MTS) |
| **Marker Performance** | DOM markers for <100 points | Use `symbol` layer with `circle` layer for 100+ points |
| **Filters** | Client-side after fetch | Push filters to server-side RPC when possible |

### 5.2 Recommended Improvements

1. **Use Mapbox Native Clustering** - Replace custom cluster markers with Mapbox GeoJSON source clustering for better performance at scale

2. **Server-Side Filtering** - The filter UI exists but doesn't call the action with filter params. Connect filters to `getNearbyTrips`:
   ```typescript
   // Current (broken)
   const trips = await fetchNearbyTrips(center.lng, center.lat);
   
   // Should be
   const trips = await fetchNearbyTrips({
     latitude: center.lat,
     longitude: center.lng,
     radiusKm: getRadiusByZoom(map.getZoom()),
     tags: activeTags,           // Not passed!
     locationType: activeLocationType,  // Not passed!
   });
   ```

3. **Add Loading States** - Show spinner/skeleton while fetching trips

4. **Error Handling** - Display user-friendly error messages on failure

5. **Lazy Load Mapbox** - Load mapbox-gl only when component enters viewport

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

### Phase 1: Fix Critical Issues (P0)
- [x] Remove debug console.log statements (refactored to components)
- [x] Wire up filters to action call (now passes tags/locationType)
- [x] Enable PagePlate wrapper (now included in MapBox.astro)
- [x] Create new RPC function `get_nearby_trips` (migration 035)
- [x] Update Astro action to use new RPC function
- [x] Sync MapApi.ts with new location types (dropoff, all)
- [ ] Add loading states

### Phase 2: Improve UX (P1)
- [ ] Add error handling with user feedback
- [ ] Implement pagination (load more on scroll)
- [ ] Add date range filter
- [ ] Add budget range filter

### Phase 3: Performance (P2)
- [ ] Consider Mapbox native clustering for large datasets
- [ ] Lazy load map on scroll into view
- [ ] Add tile-based loading for very large datasets

---

*Last updated: 2026-02-21*
*Created: Maps feature analysis and specification*
