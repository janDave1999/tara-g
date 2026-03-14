# Journey — Itinerary Builder
## Product Requirements & Technical Documentation
**Version 1.0 · March 2026 · Confidential — Internal Use Only**

| Attribute | Detail |
|---|---|
| Product | Journey — Itinerary Builder |
| Platform | Web (HTML/JS + Google Maps API) |
| Document Type | PRD + User Stories + Tech Spec |
| Status | Draft — Ready for Development |
| Prepared By | Product Team |
| Date | March 10, 2026 |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [User Personas](#3-user-personas)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Technical Specification](#7-technical-specification)
8. [UI / UX Specification](#8-ui--ux-specification)
9. [Google Maps API Integration Details](#9-google-maps-api-integration-details)
10. [AI Seeding Configuration](#10-ai-seeding-configuration)
11. [Deployment Guide](#11-deployment-guide)
12. [Testing Checklist](#12-testing-checklist)
13. [Future Roadmap](#13-future-roadmap)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

Journey is a web-based itinerary builder that allows travelers to plan and fill in their trip activities within a pre-structured framework. The trip's pickup location, drop-off location, destination, and travel dates are set in advance — the user's primary task is to discover and schedule activities between these fixed points.

The product integrates Google Maps JavaScript API, Google Places API, and Google Directions API to provide real-time place search, map visualization, and travel time estimation. An AI-powered suggestion engine pre-populates a draft itinerary on first load, which users can accept, modify, or replace.

| Metric | Target |
|---|---|
| Time to first activity added | < 60 seconds |
| Itinerary completion rate | > 70% |
| Day limit | Unlimited |
| Supported activity categories | 7 (Landmarks, Food, Shopping, Nature, Nightlife, Stay, Other) |
| Platform | Web (desktop-first, mobile-responsive) |

---

## 2. Product Overview

### 2.1 Problem Statement

Travelers who book package trips or guided tours often receive itineraries with only fixed endpoints — pickup, drop-off, and destination — but are left to fill the in-between time themselves. Existing tools like Google Trips or TripAdvisor require users to build from scratch, which creates friction and often results in under-planned trips.

### 2.2 Solution

Journey solves this by providing a structured canvas where the framework already exists. Users arrive to a partially-filled itinerary (AI-generated) and simply refine it — adding, removing, or reordering activities. The Google Maps integration makes every action spatial and immediate.

### 2.3 Scope — What's In (v1.0)

- Pre-set trip parameters: pickup, drop-off, destination, dates
- AI-generated draft itinerary on first open
- Google Maps live map with custom dark theme and markers
- Google Places search with autocomplete, scoped to destination
- Category filter pills (7 categories)
- Day-by-day timeline with vertical connector UI
- Add / remove activities with time assignment
- Real-time route rendering between stops (Directions API)
- Travel time estimates between consecutive stops
- Activity card highlighting linked to map pin focus
- Toast notification feedback system

### 2.4 Scope — Out of Scope (v1.0)

- User authentication and account persistence
- Backend storage (client-side state only in v1.0)
- Mobile native app (iOS / Android)
- Multi-user collaborative editing
- Booking / reservation integration
- Offline mode
- Export to PDF / Google Calendar

---

## 3. User Personas

### Persona 1 — The Package Traveler (Primary)

| Attribute | Detail |
|---|---|
| Name | Maya, 32 |
| Situation | Booked a 3-day tour package to Kyoto. Pickup and hotel are fixed, but daytime is free. |
| Goal | Fill free hours with meaningful activities without spending hours researching. |
| Pain Point | Overwhelmed by choice; wants curated suggestions she can accept quickly. |
| Tech Comfort | High — uses Google Maps daily, comfortable with web apps. |

### Persona 2 — The Detail Planner (Secondary)

| Attribute | Detail |
|---|---|
| Name | James, 45 |
| Situation | Plans a 7-day family trip and wants to schedule every hour precisely. |
| Goal | Full control over each day's schedule; wants to search manually and set exact times. |
| Pain Point | AI suggestions may not match his niche preferences; wants override capability. |
| Tech Comfort | Medium — prefers explicit controls over magic/auto-fill. |

---

## 4. User Stories

All stories follow the format: **As a [user], I want to [action], so that [benefit].**

Priority uses MoSCoW: **M** = Must Have, **S** = Should Have, **C** = Could Have, **W** = Won't Have.

### 4.1 Trip Setup & First Load

| ID | User Story | Acceptance Criteria | Priority |
|---|---|---|---|
| US-001 | As a traveler, I want to see my fixed trip details (pickup, drop-off, dates, destination) when I open the app, so that I know my constraints immediately. | Header shows destination and date range. Timeline anchors show pickup/drop-off as locked items. | M |
| US-002 | As a traveler, I want the app to show me a draft itinerary when I first open it, so that I have a starting point instead of a blank screen. | AI-generated activities appear in timeline and as map pins on first load. Activities grouped by day. | M |
| US-003 | As a traveler, I want to switch between days using tabs, so that I can manage each day independently. | Day tabs render for every trip day. Switching updates map and timeline. Active tab is highlighted in gold. | M |

### 4.2 Activity Discovery

| ID | User Story | Acceptance Criteria | Priority |
|---|---|---|---|
| US-004 | As a traveler, I want to search for places in my destination, so that I can find activities I'm interested in. | Search bar uses Google Places Autocomplete. Results scoped to destination area. Results show name and address. | M |
| US-005 | As a traveler, I want to filter search results by category, so that I can find relevant places faster. | Category pills filter autocomplete results by Google Places type. "All" shows unfiltered results. Active pill is highlighted. | M |
| US-006 | As a traveler, I want to see activity suggestions from AI without searching, so that I don't have to know what to look for. | AI suggestions load automatically per day using real Google Place IDs. Each has name, category, and preset time. | M |

### 4.3 Adding & Managing Activities

| ID | User Story | Acceptance Criteria | Priority |
|---|---|---|---|
| US-007 | As a traveler, I want to add a place to a specific day with a chosen time, so that I can schedule it precisely. | Selecting a place opens the add panel. User sets time via time input. Confirming inserts into timeline sorted by time. | M |
| US-008 | As a traveler, I want to remove an activity from my itinerary, so that I can replace it with something else. | Each activity card shows a remove button on hover. Clicking removes from timeline and map. Toast confirms removal. | M |
| US-009 | As a traveler, I want to see how long it takes to travel between consecutive stops, so that I can avoid scheduling conflicts. | Directions API called between each pair of consecutive activities. Travel time shown between cards in timeline. | S |
| US-010 | As a traveler, I want to click an activity and have the map zoom to it, so that I can understand its location in context. | Clicking an activity card pans the map to the place. Zoom set to 15. Card is highlighted with a gold border. | S |

### 4.4 Map Interaction

| ID | User Story | Acceptance Criteria | Priority |
|---|---|---|---|
| US-011 | As a traveler, I want to see all my day's activities on the map as numbered pins, so that I understand the spatial layout. | Each activity in current day renders as a custom colored pin numbered 1–N in time order. Pickup/drop-off not pinned. | M |
| US-012 | As a traveler, I want to see a route drawn between my stops on the map, so that I understand the travel flow. | Directions API draws a dashed route line between all stops in time order. Route re-renders on add/remove. | M |
| US-013 | As a traveler, I want to click a map pin to see activity details, so that I can recall what I've planned. | Clicking a pin opens a Google Maps InfoWindow showing name, formatted time, duration, and rating. | S |

---

## 5. Functional Requirements

### 5.1 Trip Configuration

- **FR-01** Trip destination, pickup location (name + coordinates), drop-off location, and dates must be configurable as constants or injected via a data object.
- **FR-02** Pickup and drop-off must appear as locked anchors at the top and bottom of every day's timeline.
- **FR-03** The number of days is unlimited and determined by the length of the dates array.

### 5.2 AI Suggestion Engine

- **FR-04** On first opening a day tab, the system must attempt to fetch place details for each AI seed using `PlacesService.getDetails()`.
- **FR-05** Seeds are defined as an array of `{ placeId, name, time, duration, category }` per day index.
- **FR-06** If a place detail lookup fails, a fallback stub with the seed's name and category must still appear in the timeline.
- **FR-07** AI suggestions must not reload if the user has already modified that day's itinerary.

### 5.3 Search & Autocomplete

- **FR-08** The search input must use `AutocompleteService.getPlacePredictions()` with location bias set to destination coordinates and a country restriction applied.
- **FR-09** Debounce search input by 300ms to avoid excessive API calls.
- **FR-10** Selecting a prediction must trigger a `PlacesService.getDetails()` call to retrieve coordinates and metadata.
- **FR-11** Category pill selection must filter autocomplete predictions by Google Places type.

### 5.4 Timeline

- **FR-12** The timeline must re-render after every add or remove action.
- **FR-13** Activities must be sorted by time (ascending) on render.
- **FR-14** Travel time between consecutive stops must be calculated using `DirectionsService` with `DRIVING` mode and displayed as a hint row between cards.
- **FR-15** An "Add another activity" slot must appear between the last activity and the drop-off anchor.

### 5.5 Map

- **FR-16** The map must use a custom dark style theme matching the application's color scheme.
- **FR-17** Markers must use a custom teardrop SVG icon with the activity's category color and a white number label.
- **FR-18** A Directions polyline must be drawn through all activity coordinates in time order.
- **FR-19** All existing markers must be removed and re-rendered on every timeline change.

---

## 6. Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| Performance | Initial AI draft load time | < 3 seconds on standard broadband |
| Performance | Search autocomplete response | < 500ms after debounce fires |
| Performance | Route re-render after add/remove | < 1 second |
| Reliability | Graceful degradation if Places API fails | Show stub card; no crash |
| Usability | Mobile responsiveness | Usable on viewport widths ≥ 768px |
| Accessibility | Color contrast ratio | WCAG AA minimum on all text |
| Security | API key restriction | Key must be HTTP referrer-restricted in Google Cloud Console |
| Browser Support | Target browsers | Chrome 100+, Firefox 100+, Safari 15+, Edge 100+ |

---

## 7. Technical Specification

### 7.1 Architecture

The application is a single-page application (SPA) delivered as a single HTML file. All state is managed in JavaScript memory. No build step, bundler, or framework is required for v1.0, making deployment trivial.

| Layer | Technology | Notes |
|---|---|---|
| UI / View | HTML5 + CSS3 (inline styles) | No framework; DOM manipulation via vanilla JS |
| State | JavaScript in-memory object | `itinerary` object keyed by day index |
| Map | Google Maps JS API v3 | Loaded via async script tag with callback |
| Place Search | Google Places API | `AutocompleteService` + `PlacesService` |
| Routing | Google Directions API | `DirectionsService` + `DirectionsRenderer` |
| Fonts | Google Fonts CDN | DM Sans + Cormorant Garamond |
| Hosting | Any static host or local file | No server required |

### 7.2 Google Maps API Setup

**Required APIs to enable in Google Cloud Console:**
- Maps JavaScript API
- Places API
- Directions API

**Script loading pattern:**
```html
<script async defer
  src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places&callback=initMap">
</script>
```

The `callback=initMap` parameter means the global `initMap()` function is called automatically once the API is loaded. All map-dependent code must be called inside or after `initMap()`.

### 7.3 State Model

The core state is an `itinerary` object:

```js
const itinerary = {
  0: [ ...activities ],   // Day 1
  1: [ ...activities ],   // Day 2
  2: [ ...activities ],   // Day 3
  // ...unlimited days
};
```

**Activity object shape:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique ID: `"act_" + Date.now() + random` |
| `placeId` | `string` | Google Place ID |
| `name` | `string` | Display name from Places API |
| `desc` | `string` | Formatted address from Places API |
| `category` | `string` | Google Places type (e.g. `"restaurant"`) |
| `time` | `string` | HH:MM 24-hour format (e.g. `"09:00"`) |
| `duration` | `number` | Duration in minutes |
| `rating` | `number \| null` | Google rating (1–5) or null |
| `latLng` | `{ lat, lng } \| null` | Coordinates from Places geometry |
| `color` | `string` | Hex color derived from category |

### 7.4 TRIP Configuration Object

```js
const TRIP = {
  destination: 'Kyoto, Japan',
  destinationLatLng: { lat: 35.0116, lng: 135.7681 },
  dates: [
    { label: 'Day 1', date: 'Mon, Jul 14' },
    { label: 'Day 2', date: 'Tue, Jul 15' },
    // ...add more days freely
  ],
  pickup:  { time: '08:00', label: 'Osaka Airport (KIX)', latLng: { lat: 34.4347, lng: 135.2440 } },
  dropoff: { time: '20:00', label: 'Osaka Airport (KIX)', latLng: { lat: 34.4347, lng: 135.2440 } },
};
```

### 7.5 Category System

```js
const CATEGORIES = [
  { id: 'all',               label: 'All',       icon: '✦' },
  { id: 'tourist_attraction',label: 'Landmarks', icon: '🏯' },
  { id: 'restaurant',        label: 'Food',      icon: '🍜' },
  { id: 'shopping_mall',     label: 'Shopping',  icon: '🛍' },
  { id: 'park',              label: 'Nature',    icon: '🌿' },
  { id: 'night_club',        label: 'Nightlife', icon: '🌙' },
  { id: 'lodging',           label: 'Stay',      icon: '🏨' },
];

const CAT_COLORS = {
  tourist_attraction: '#FF6B6B',
  restaurant:         '#FFB347',
  shopping_mall:      '#C77DFF',
  park:               '#6BCB77',
  night_club:         '#4CC9F0',
  lodging:            '#FFD166',
  default:            '#aaaaaa',
};
```

### 7.6 Key Functions Reference

| Function | Description | Dependencies |
|---|---|---|
| `initMap()` | Called by Google Maps SDK on load. Initializes map, services, renders Day 1. | Google Maps SDK |
| `loadAISuggestions(dayIndex)` | Fetches Place details for AI seeds if day has no activities. Async/await. | `PlacesService` |
| `renderAll()` | Calls `renderTimeline()`, `renderMapMarkers()`, `renderRoute()`, `updateStats()`. | All render fns |
| `renderTimeline()` | Clears and rebuilds timeline DOM. Triggers travel time calcs per segment. | DOM, itinerary state |
| `renderMapMarkers()` | Clears old markers, adds new ones with custom SVG icon per activity. | Google Maps Markers |
| `renderRoute()` | Calls DirectionsService for multi-stop route, renders via DirectionsRenderer. | Directions API |
| `doSearch(query)` | Triggers autocomplete. Uses active category as type filter. Debounced 300ms. | `AutocompleteService` |
| `selectPrediction(prediction)` | Gets full Place details from `prediction.place_id`. | `PlacesService` |
| `openAddPanel(place)` | Shows the add panel. Sets `pendingPlace` for `confirmAdd()`. | DOM |
| `confirmAdd()` | Creates activity from `pendingPlace` + time input. Inserts into `itinerary[activeDay]`. | itinerary state |
| `removeActivity(e, id)` | Filters activity out of `itinerary[activeDay]`. Calls `renderAll()`. | itinerary state |
| `calcTravelTime(from, to, hintId)` | Gets driving time between two LatLng points and updates hint DOM element. | Directions API |
| `focusActivity(act)` | Pans/zooms map to activity. Highlights its card in gold. | map, DOM |
| `switchDay(i)` | Sets `activeDay`. Loads AI suggestions if needed. Calls `renderAll()`. | itinerary state |
| `showToast(msg)` | Shows a temporary notification at the bottom of the screen for 2.5s. | DOM |
| `placeToActivity(place)` | Converts a Places API result object into an activity object. | — |

---

## 8. UI / UX Specification

### 8.1 Layout

The application uses a two-panel side-by-side layout at a **55% / 45% split**:

- **Left panel (55%)** — Google Map — fills entire height, always live and reactive
- **Right panel (45%)** — Search area (top, fixed) + Add panel (conditional, animated) + Scrollable timeline (flex fill)

The header (brand + destination + finalize button) and day tabs sit above both panels and span full width.

### 8.2 Color System

| CSS Variable | Hex Value | Usage |
|---|---|---|
| `--bg` | `#0F0F14` | Page background |
| `--surface` | `#16161F` | Panel / card backgrounds |
| `--surface2` | `#1E1E2A` | Elevated surfaces, info windows |
| `--border` | `rgba(255,255,255,0.08)` | All dividers and card borders |
| `--text` | `#E8E4DC` | Primary text |
| `--muted` | `#888888` | Secondary / supporting text |
| `--dim` | `#555555` | Placeholder, disabled states |
| `--gold` | `#FFD166` | Active states, CTAs, highlights |
| `--gold2` | `#FF9F1C` | Gold gradient end (buttons) |
| `--blue` | `#4CC9F0` | Pickup anchor color |
| `--red` | `#FF6B6B` | Drop-off anchor, remove actions |
| `--green` | `#6BCB77` | Nature category |
| `--purple` | `#C77DFF` | Shopping category |

### 8.3 Typography

| Usage | Font | Size / Weight |
|---|---|---|
| Brand / Destination name | Cormorant Garamond | 20px / 600 — serif display |
| Body text, labels, cards | DM Sans | 13px / 400–600 |
| Category badges, small labels | DM Sans | 11px / 400 |
| Pickup / drop-off labels | DM Sans | 11px / 600, letter-spacing 0.1em |
| Code snippets | Courier New | 13px / 400 |

Both fonts loaded from Google Fonts CDN:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
```

### 8.4 Map Style

The map uses a custom dark style array passed to the `Map` constructor. Key style rules:

```js
[
  { elementType: 'geometry',            stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', elementType: 'geometry',   stylers: [{ color: '#1e1e30' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2d1a' }] },
  // ...full array in source code
]
```

Map controls: `mapTypeControl: false`, `streetViewControl: false`, `fullscreenControl: false`. Zoom control at `RIGHT_CENTER`.

### 8.5 Custom Map Marker

```js
icon: {
  path: 'M 0,-20 C -10,-20 -15,-10 -15,0 C -15,10 0,20 0,28 C 0,20 15,10 15,0 C 15,-10 10,-20 0,-20 Z',
  fillColor: act.color,       // category color
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 1.5,
  scale: 1,
  labelOrigin: new google.maps.Point(0, 0),
  anchor: new google.maps.Point(0, 28),
}
```

Label: `{ text: String(i + 1), color: '#fff', fontWeight: 'bold', fontSize: '11px' }`

### 8.6 Component Behaviors

**Activity Card**
- Default: `rgba(255,255,255,0.03)` background, subtle border
- Hover: lighter background, border brightens, remove `✕` button fades in (`opacity: 0 → 1`)
- Highlighted: gold border + gold-tinted background (triggered by clicking card or map pin)
- Transition: `all 0.2s ease`

**Add Panel**
- Hidden by default (`display: none`)
- Slides in with `fadeSlide` animation (opacity 0→1, translateY 8px→0)
- Shows selected place name, address, time picker, and confirm button
- Closes on confirm or `✕` click; resets `pendingPlace`

**Day Tabs**
- Active tab: `color: #FFD166`, `border-bottom: 2px solid #FFD166`
- Inactive: `color: #666`, `border-bottom: 2px solid transparent`
- Hover: `color: #888`

**Toast**
- Positioned `fixed`, `bottom: 24px`, `left: 50%`, `translateX(-50%)`
- Appears with `translateY(20px) → 0` + opacity fade
- Auto-dismisses after 2500ms

### 8.7 Timeline Structure

```
[🔵 PICKUP ANCHOR]         ← locked, no remove
  │
  ● Activity 1 Card        ← colored dot + card
  │  ~15 min travel
  ● Activity 2 Card
  │  ~22 min travel
  ● Activity 3 Card
  │
  + Add another activity…  ← dashed slot, opens add panel
  │
[🔴 DROP-OFF ANCHOR]       ← locked, no remove
```

---

## 9. Google Maps API Integration Details

### 9.1 PlacesService — `getDetails()`

Used for: AI seed enrichment on day load, resolving autocomplete selection.

```js
placesService.getDetails({
  placeId: prediction.place_id,
  fields: ['place_id', 'name', 'geometry', 'rating', 'formatted_address', 'types', 'photos', 'opening_hours'],
}, (place, status) => {
  if (status === google.maps.places.PlacesServiceStatus.OK) {
    const activity = placeToActivity(place);
    openAddPanel(activity);
  }
});
```

### 9.2 AutocompleteService — `getPlacePredictions()`

Used for: real-time search as user types (debounced 300ms).

```js
autocompleteService.getPlacePredictions({
  input: query,
  location: new google.maps.LatLng(TRIP.destinationLatLng),
  radius: 20000,
  types: activeCategory === 'all' ? [] : [activeCategory],
  componentRestrictions: { country: 'jp' },   // change per destination
}, (predictions, status) => {
  if (status === google.maps.places.PlacesServiceStatus.OK) {
    showAutocomplete(predictions.slice(0, 5));
  }
});
```

### 9.3 DirectionsService — `route()`

Used for: route polyline across all stops, and per-segment travel time hints.

```js
directionsService.route({
  origin: acts[0].latLng,
  destination: acts[acts.length - 1].latLng,
  waypoints: acts.slice(1, -1).map(a => ({ location: a.latLng, stopover: false })),
  travelMode: google.maps.TravelMode.DRIVING,
  optimizeWaypoints: false,   // preserve user's ordering
}, (result, status) => {
  if (status === 'OK') directionsRenderer.setDirections(result);
});
```

**DirectionsRenderer config:**
```js
directionsRenderer = new google.maps.DirectionsRenderer({
  suppressMarkers: true,   // use custom markers, not default A/B pins
  polylineOptions: {
    strokeColor: '#FFD166',
    strokeOpacity: 0.5,
    strokeWeight: 3,
  },
});
directionsRenderer.setMap(map);
```

---

## 10. AI Seeding Configuration

The AI suggestion system uses a static `AI_SEEDS` object keyed by day index. To customize for a different destination, replace the `placeId` values with valid Google Place IDs.

### 10.1 Seed Structure

```js
const AI_SEEDS = {
  0: [  // Day 1
    { placeId: 'ChIJa0WpNZIIAWARs_FpWTMBFRs', name: 'Fushimi Inari Taisha', time: '09:00', duration: 90,  category: 'tourist_attraction' },
    { placeId: 'ChIJsUzUFpEIAWARc8TnHK5rMxw', name: 'Nishiki Market',       time: '12:00', duration: 60,  category: 'restaurant' },
    { placeId: 'ChIJEzrRH5gIAWARCr0v5EyRBeg', name: 'Gion District',        time: '15:00', duration: 90,  category: 'tourist_attraction' },
  ],
  1: [  // Day 2
    { placeId: 'ChIJpytIufcFAWARVMEXfDuuFMI', name: 'Arashiyama Bamboo Grove', time: '08:30', duration: 60, category: 'park' },
    { placeId: 'ChIJA5kBQ_YFAWAR9a5CuqkEoUc', name: 'Tenryu-ji Temple',        time: '10:00', duration: 75, category: 'tourist_attraction' },
    { placeId: 'ChIJW9oVApcIAWARn7xomI28FJo', name: 'Kyoto Tower',             time: '16:00', duration: 60, category: 'tourist_attraction' },
  ],
  2: [  // Day 3
    { placeId: 'ChIJb7SC8JQIAWARNHV5nX_BHHI', name: 'Kinkaku-ji',  time: '09:00', duration: 60, category: 'tourist_attraction' },
    { placeId: 'ChIJW2LJDqwIAWAR3GkNMMlZlpY', name: 'Ryoan-ji',    time: '11:00', duration: 45, category: 'tourist_attraction' },
    { placeId: 'ChIJH3LHwqYIAWARFSvXD9WRvBs', name: 'Nijo Castle', time: '13:30', duration: 90, category: 'tourist_attraction' },
  ],
};
```

### 10.2 Fallback Stub

If `PlacesService.getDetails()` fails for a seed, a stub is created:

```js
{
  id: 'ai_' + seed.placeId,
  placeId: seed.placeId,
  name: seed.name,
  desc: '',
  category: seed.category,
  time: seed.time,
  duration: seed.duration,
  rating: null,
  latLng: null,           // no map pin rendered
  color: catColor(seed.category),
}
```

### 10.3 Finding Place IDs

1. Go to https://developers.google.com/maps/documentation/places/web-service/place-id
2. Use the Place ID Finder tool on that page
3. Search for the place and copy the Place ID from the result
4. Paste into `AI_SEEDS` with an appropriate default `time` and `duration`

---

## 11. Deployment Guide

### 11.1 Local Development

1. Download the `itinerary-builder.html` file
2. Open directly in Chrome, Firefox, or Edge (drag into browser or double-click)
3. No server, no build step, no `npm install` required
4. Ensure your machine has internet access (Google Maps CDN required)

> **Note:** The app cannot run inside sandboxed iframes (e.g. CodePen, Claude artifacts) due to Content Security Policy restrictions on external scripts. Always open as a standalone file or hosted URL.

### 11.2 Production Hosting

The file can be deployed to any static hosting provider with zero configuration:

| Provider | Deploy Method | Notes |
|---|---|---|
| Netlify | Drag & drop the HTML file to netlify.com/drop | Free tier, instant HTTPS |
| Vercel | GUI upload or `vercel deploy` | Free tier |
| GitHub Pages | Push to `/docs` or root, enable Pages in repo settings | Free, requires GitHub account |
| AWS S3 | Upload to S3 bucket with static website hosting enabled | Requires AWS account |
| Any web server | Copy file to `/var/www/html` or equivalent | Apache, Nginx, etc. |

### 11.3 API Key Security

> ⚠️ **Never commit an unrestricted API key to a public repository.**

Before going to production:

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Click your API key → Application restrictions
3. Select **"HTTP referrers (websites)"**
4. Add your domain: e.g. `https://yourdomain.com/*`
5. Save — the key will now only work from your domain

### 11.4 Changing the Destination

To adapt the app to a different destination:

1. Update `TRIP.destination`, `TRIP.destinationLatLng`, `TRIP.dates`, `TRIP.pickup`, and `TRIP.dropoff`
2. Replace `AI_SEEDS` with Place IDs relevant to the new destination (see Section 10.3)
3. Update `componentRestrictions: { country: 'jp' }` in `doSearch()` to the appropriate country code
4. Adjust map initial center and zoom in `initMap()` if needed

---

## 12. Testing Checklist

### 12.1 Functional Tests

| Test ID | Test Case | Expected Result | Pass? |
|---|---|---|---|
| T-001 | Open app on Day 1 | AI activities load, pins appear on map, timeline shows pickup/drop-off anchors | ☐ |
| T-002 | Switch to Day 2 tab | Day 2 AI activities load, map updates, timeline re-renders | ☐ |
| T-003 | Type in search bar | Autocomplete dropdown appears within 300ms of typing stop | ☐ |
| T-004 | Select a category pill then search | Autocomplete filters to that Google Places type | ☐ |
| T-005 | Select autocomplete result | Add panel opens with place name and address populated | ☐ |
| T-006 | Set time and confirm add | Activity appears in timeline sorted by time, pin added to map, route re-renders | ☐ |
| T-007 | Remove an activity | Activity removed from timeline and map, route re-renders, toast shown | ☐ |
| T-008 | Click activity card | Map pans and zooms to place, card highlights with gold border | ☐ |
| T-009 | Click map pin | InfoWindow opens with activity name, time, and rating | ☐ |
| T-010 | Add 5+ activities on one day | Timeline remains scrollable, all pins numbered correctly, route includes all stops | ☐ |
| T-011 | Open Day 2, then switch back to Day 1 | Day 1 does not reload AI seeds (already populated) | ☐ |
| T-012 | Simulate Places API failure (disable network) | Fallback stub appears in timeline, no JS error thrown | ☐ |
| T-013 | Click Finalize Trip button | Toast confirms with total activity count | ☐ |

---

## 13. Future Roadmap

| Version | Feature | Notes |
|---|---|---|
| v1.1 | Backend persistence (save itinerary to DB) | Requires auth system (Firebase or Supabase) |
| v1.1 | Share itinerary via link | Read-only shareable URL with encoded state |
| v1.2 | Export to PDF | Print-friendly itinerary summary page |
| v1.2 | Sync to Google Calendar | One-click per activity using Calendar API |
| v1.3 | Drag & drop reordering within day | HTML5 drag API or SortableJS |
| v1.3 | Move activity between days | Cross-day drag & drop |
| v2.0 | User accounts & saved trips | Firebase Auth or Supabase Auth |
| v2.0 | Collaborative editing (multi-user) | WebSockets or CRDTs |
| v2.0 | Mobile native app (React Native) | iOS + Android |
| v2.1 | Booking integration | Viator, GetYourGuide, OpenTable APIs |
| v2.1 | AI natural language input | "Add dinner near Gion around 7pm" → auto-search and schedule |
| v2.2 | Offline mode | Service Worker + IndexedDB caching |
| v2.2 | Multi-language support | i18n for destination-local languages |

---

## 14. Glossary

| Term | Definition |
|---|---|
| Activity | A single place or event added to the itinerary with a time, duration, and category. |
| AI Seed | A pre-defined `{ placeId, time, duration, category }` object used to auto-populate a day's itinerary on first load. |
| Anchor | Fixed, non-editable timeline entries: Pickup and Drop-off. Rendered in blue and red respectively. |
| Category | A Google Places type used to classify and filter activities (e.g. `restaurant`, `park`, `tourist_attraction`). |
| `DirectionsRenderer` | Google Maps object that draws a route polyline on the map based on a Directions API result. |
| `DirectionsService` | Google Maps service that computes routes between locations using the Directions API. |
| InfoWindow | Google Maps popup that appears anchored to a map marker when clicked. |
| `itinerary` | The core JS state object storing all activities per day, keyed by zero-based day index. |
| Place ID | Google's unique stable identifier for a specific real-world location (e.g. `ChIJa0WpNZIIAWARs_FpWTMBFRs`). |
| `PlacesService` | Google Maps service for place detail lookups by Place ID and nearby/text searches. |
| `AutocompleteService` | Google Maps service for text-based place prediction as the user types. |
| Stub | A fallback activity object used when a Places API `getDetails()` call fails. Has `null` for `latLng` and `rating`. |
| Toast | A transient notification shown briefly at the bottom of the screen (2.5s) to confirm user actions. |
| `pendingPlace` | A module-level variable holding the place selected from search, waiting to be confirmed and added. |

---

*Journey Itinerary Builder — PRD v1.0 · March 2026*
*For questions, contact the Product Team.*
