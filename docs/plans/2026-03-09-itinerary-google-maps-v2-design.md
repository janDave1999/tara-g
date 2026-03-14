# Itinerary Google Maps v2 - Design Document

**Date:** 2026-03-09  
**Author:** Tara G Development Team  
**Status:** Approved

## Overview

Create a new v2 itinerary page using Google Maps instead of Mapbox, featuring a modern Google Maps-style UI with full-screen map, floating search bar, and bottom sheet panel for stop list.

## Goals

- Provide better map experience using Google Maps (superior coverage in Philippines)
- Modern UI following Google Maps design patterns
- Full feature parity with existing Mapbox v1

## Non-Goals

- Auto-optimize stop order (manual order only)
- Replace existing itinerary - create separate v2 page

## UI/UX Specification

### Page Structure

```
┌─────────────────────────────────────┐
│  [←] Trip Name          [☰] [🔍]   │  <- Header (floating)
├─────────────────────────────────────┤
│                                     │
│                                     │
│         Full-Screen Map             │
│         (Google Maps)               │
│                                     │
│                                     │
│    ┌─────────────────────────┐      │
│    │ ☰  Stops (5)            ▲      │  <- Bottom Sheet
│    ├─────────────────────────┤      │
│    │ 1. Stop Name    9:00 AM │      │
│    │ 2. Stop Name   10:30 AM │      │
│    │ 3. Stop Name    1:00 PM │      │
│    └─────────────────────────┘      │
└─────────────────────────────────────┘
```

### Components

1. **Floating Header**
   - Back button (left)
   - Trip title (center)
   - Menu button (right) - View toggle, settings

2. **Floating Search Bar**
   - Position: Top center, below header
   - Style: Rounded pill shape, white background, shadow
   - Placeholder: "Search places..."
   - Behavior: Google Places Autocomplete

3. **Full-Screen Map**
   - Google Maps with custom styling
   - Numbered markers for stops
   - Route polyline connecting stops

4. **Bottom Sheet Panel**
   - Draggable panel at bottom
   - Handle bar at top
   - Stop count header
   - Scrollable list of stops with:
     - Stop number
     - Stop name
     - Scheduled time
     - Location type badge
   - States: Collapsed (shows count), Expanded (shows list)

5. **Route Selector**
   - Floating button or in bottom sheet
   - Options: Driving, Walking, Cycling

6. **Day Filter**
   - Dropdown to filter stops by day
   - Shows dates from trip_details

### Visual Design

**Colors:**
- Primary: `#4285F4` (Google Blue)
- Background: `#FFFFFF`
- Surface: `#F8F9FA`
- Text Primary: `#202124`
- Text Secondary: `#5F6368`
- Route Line: `#4285F4`
- Stop Number Badge: Use location type colors

**Location Type Colors:**
- destination: `#3b82f6` (blue)
- activity: `#10b981` (green)
- meal_break: `#f59e0b` (amber)
- rest_stop: `#8b5cf6` (purple)
- accommodation: `#ec4899` (pink)
- checkpoint: `#6366f1` (indigo)
- pickup: `#14b8a6` (teal)
- dropoff: `#f97316` (orange)
- boat: `#06b6d4` (cyan)
- ferry: `#0ea5e9` (sky)

**Typography:**
- Font: System default (Roboto on Android, SF on iOS)
- Header Title: 18px, 600 weight
- Stop Name: 16px, 500 weight
- Stop Time: 14px, 400 weight
- Labels: 12px, 500 weight

**Spacing:**
- Header padding: 12px
- Search bar margin: 12px from top
- Bottom sheet handle: 4px height, 32px width
- Stop item padding: 12px vertical, 16px horizontal

### Interactions

1. **Search Flow:**
   - User taps search bar
   - Google Places Autocomplete opens
   - User selects location
   - Map flies to location
   - Add stop modal opens with pre-filled name

2. **Click Map to Add:**
   - User taps empty area on map
   - Add stop modal opens with coordinates

3. **View Stop Details:**
   - User taps marker
   - Info window shows stop details
   - Edit/Delete buttons (if can edit)

4. **Bottom Sheet:**
   - Swipe up to expand
   - Swipe down to collapse
   - Tap handle to toggle

5. **Route Recalculation:**
   - When stops change, recalculate route
   - Use selected travel mode

## Technical Specification

### API Key
- Environment variable: `PUBLIC_GOOGLE_MAPS_KEY`
- User provided key: `AIzaSyCW3iA3j5CFLW1IFH1j0gceOzSqHa_-pnc`
- Required APIs:
  - Maps JavaScript API
  - Places API
  - Directions API

### Dependencies
- `@googlemaps/js-api-loader` - Lazy load Google Maps

### Route
- Page: `/trips/[trip_id]/itinerary-v2`
- SSR page using Astro

### Data Structure
- Same as v1: `trip_location` table with `location` join
- Latitude/longitude from `location.latitude` / `location.longitude`

### File Structure
```
src/pages/trips/[trip_id]/
  └── itinerary-v2.astro         # Main page

src/components/Trip/ItineraryV2/
  ├── ItineraryMapV2.astro       # Map component
  ├── ItineraryBottomSheet.astro # Bottom sheet panel
  ├── ItineraryHeader.astro      # Floating header
  └── StopInfoWindow.astro       # Marker info window

src/scripts/Itinerary/
  └── ItineraryMapV2.ts          # Client-side Google Maps logic
```

## Acceptance Criteria

1. Page loads with full-screen Google Maps
2. Floating search bar works with Google Places Autocomplete
3. Numbered markers display on map for all stops
4. Route lines connect stops using Google Directions
5. Bottom sheet shows stop list and is draggable
6. Clicking marker shows info window with details
7. Clicking map opens add stop modal
8. Day filter filters displayed stops
9. Route mode selector changes travel mode
10. Mobile-responsive design works on all screen sizes

## Related Documentation

- Existing v1 implementation: `src/pages/trips/[trip_id]/itinerary.astro`
- Design doc: `docs/plans/2026-03-08-itinerary-map-view-design.md`
