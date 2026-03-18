# Project 82 Province List Design

**Date**: 2026-03-18  
**Feature**: Province Grid List View with Zoom Toggle

---

## Overview

Add a province list view to Project 82 that displays all 82 Philippine provinces in an alphabetical grid. The view is accessible via zoom-out interaction, showing visited status and connecting to trips/posts.

---

## UI/UX Specification

### Layout Structure

- **Split view with adjustable height**:
  - Top section (40%): Map display
  - Bottom section (60%): Province grid list
- **Zoom controls**: +/- buttons positioned in top-right corner of map area
- **Zoom threshold**:
  - Zoom level 1-2 (default, zoomed in): Map only visible
  - Zoom level 3+ (zoomed out): Province grid appears below map

### Province Grid

- **Columns**: 4 columns on desktop, 2 columns on mobile
- **Sorting**: Alphabetical by province name (A-Z)
- **Bucket design**:
  - Province name (bold)
  - Stage color indicator (left border or dot)
  - Checkmark icon if visited
  - Grayed out if not visited

### Stage Color Coding

| Stage | Color |
|-------|-------|
| Pass Through | Blue (#3B82F6) |
| Short Stay | Yellow (#FBBF24) |
| Extended Stay | Orange (#F97316) |
| Thorough Exploration | Red (#EF4444) |
| Not Visited | Gray (#E5E7EB) |

### Interactions

- **Click province bucket**: Opens existing VisitModal for that province
- **Zoom controls**: +/- buttons to toggle between map-only and map+grid views
- **Live updates**: Grid reflects changes immediately when visits are saved/deleted

### Logo

- Use BucketIcon (`src/features/navbar/BucketIcon.astro`) as the feature logo/icon

---

## Data Flow

### Client-Side

1. Load visits from localStorage cache or API on page load
2. Build visit lookup map by province_key
3. Render grid with all 82 provinces from PH_PROVINCES data
4. Apply visited styling based on visitMap
5. Listen for `province-visit-saved` and `province-visit-deleted` events for live updates

### API (Existing)

- GET `/api/project82` - Returns user's province visits
- POST `/api/project82` - Save/update visit
- DELETE `/api/project82/[province_key]` - Remove visit

---

## Components to Create/Modify

1. **ProvinceGrid.astro** - New component for the grid list view
2. **ZoomControls.astro** - New component for zoom +/- buttons
3. **project82.astro** - Modify layout to support split view with zoom state

---

## Acceptance Criteria

1. Province grid displays all 82 provinces in alphabetical order
2. Visited provinces show checkmark and stage color
3. Unvisited provinces appear grayed out
4. Clicking a province bucket opens the VisitModal
5. Zoom out (level 3+) reveals the grid below the map
6. Zoom in (level 1-2) hides the grid, map takes full height
7. Changes to visits reflect immediately in the grid (live updates)
8. Responsive: 4 columns on desktop, 2 columns on mobile
9. BucketIcon is used as feature branding

---

## Future Considerations (Out of Scope)

- Linking activities from trips to province visits
- Connecting social posts to province visits
- Province detail page with full activity/post list

These can be implemented as follow-up features.
