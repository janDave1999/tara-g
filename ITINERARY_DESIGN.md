# Itinerary — Structure & Data Design

> This document defines the UI layout, data shape, and field requirements
> before any implementation begins. Reference this when building components.
>
> Last updated: 2026-02-20

---

## 1. UI Structure (Wireframe)

```
┌─────────────────────────────────────────────────────┐
│  ITINERARY HEADER                                   │
│  🗺️  Itinerary          📍 Palawan, Philippines     │
│                                     [Edit Itinerary]│ ← owner only
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📅 Day 1  ·  Feb 22, 2026        3 stops  [+ Add] ▼│ ← collapsible
├─────────────────────────────────────────────────────┤
│  │                                                  │
│  ●── 🚐 PICKUP          6:00 AM – 7:00 AM           │
│  │   SM Mall of Asia, Pasay                         │
│  │   Notes: Meet at the north parking entrance      │
│  │   [✏️ Edit]  [🗑️ Delete]  ← owner, edit mode    │
│  │                                                  │
│  ●── ✈️ TRANSIT          7:00 AM – 9:30 AM          │
│  │   Manila to Puerto Princesa                      │
│  │                                                  │
│  ●── 📍 DESTINATION     10:30 AM – 12:00 PM         │
│      El Nido, Palawan                               │
│      Notes: Check-in at resort                      │
│      ┌─ Activities ─────────────────────────────┐   │
│      │  🏃 Island Hopping    · 4 hrs            │   │
│      │  📸 Photo Ops         · 30 mins          │   │
│      │  [+ Add Activity]  ← owner, edit mode   │   │
│      └───────────────────────────────────────────┘  │
│      [✏️ Edit]  [🗑️ Delete]                         │
│                                                      │
│                    [+ Add Stop]  ← owner, edit mode  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  📅 Day 2  ·  Feb 23, 2026        2 stops  [+ Add] ▼│
│  ...                                                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  EMPTY STATE (no stops yet)                         │
│                                                     │
│       🗺️                                           │
│   No stops yet                                      │
│   Start building your itinerary                     │
│            [+ Add First Stop]  ← owner only         │
└─────────────────────────────────────────────────────┘
```

---

## 2. Stop Types & Visual Treatment

| `location_type` | Label | Icon | Color |
|-----------------|-------|------|-------|
| `pickup` | Pickup | 🚐 | green |
| `dropoff` | Drop-off | 🏁 | red |
| `destination` | Destination | 📍 | blue |
| `activity` | Activity | 🎯 | purple |
| `meal_break` | Meal Break | 🍽️ | orange |
| `rest_stop` | Rest Stop | 🛖 | amber |
| `accommodation` | Accommodation | 🏨 | indigo |
| `checkpoint` | Checkpoint | 📌 | gray |
| `transit` | Transit | ✈️ | sky |
| `boat` | Boat / Ferry | ⛵ | teal |

> `transit`, `boat`, `ferry` are in the `location_type_enum` but not yet in `StopType`
> — add them when implementing the modal.

---

## 3. Data Shape (What Each Component Receives)

### 3.1 Stop (flat row from `trip_location` + join)

```typescript
// What the page fetches and passes down
interface StopRow {
  // From trip_location
  id: string;                     // UUID — used for edit/delete
  trip_id: string;
  location_id: string | null;     // FK to locations
  location_type: LocationTypeEnum; // THE type column (not stop_type)
  is_primary: boolean;
  is_mandatory: boolean;
  order_index: number;
  scheduled_start: string | null; // ISO timestamptz
  scheduled_end: string | null;
  actual_start: string | null;    // for completed tracking (future)
  actual_end: string | null;
  waiting_time: number | null;    // minutes
  notes: string | null;

  // From JOIN locations (location:locations(*))
  location: {
    location_id: string;
    name: string;                 // THE display name
    address: string | null;
    latitude: number;
    longitude: number;
  } | null;

  // From JOIN stop_activities (activities:stop_activities(*))
  activities: ActivityRow[];
}
```

### 3.2 Activity (flat row from `stop_activities`)

```typescript
interface ActivityRow {
  id: string;
  stop_id: string;
  activity_type: ActivityType;    // see enum below
  description: string;
  planned_duration_minutes: number;
  actual_duration_minutes: number | null;
  order_index: number;
  notes: string | null;
}
```

### 3.3 Grouping by Day

```typescript
// In Itinerary2.astro / page
// Group stops by calendar date of scheduled_start
type DayGroup = {
  date: string;       // "Feb 22, 2026"
  dayIndex: number;   // 0-based
  stops: StopRow[];
}
```

---

## 4. Stop Form Fields

Used in `StopModal.astro` (add and edit modes).

| Field | Input | Required | Source |
|-------|-------|----------|--------|
| Location name | Mapbox Searchbox | Yes | → `locations.name` + `location_id` |
| Coordinates | hidden (auto from Mapbox) | Yes | → `locations.latitude/longitude` |
| Stop type | `<select>` (all enum values) | Yes | → `trip_location.location_type` |
| Start date/time | `datetime-local` | Yes | → `trip_location.scheduled_start` |
| End date/time | `datetime-local` | Yes | → `trip_location.scheduled_end` |
| Notes | `<textarea>` | No | → `trip_location.notes` |

**Create flow:**
1. INSERT into `locations` (name, lat, lng) → get `location_id`
2. INSERT into `trip_location` (trip_id, location_id, location_type, scheduled_start, scheduled_end, notes, order_index)

**Edit flow:**
1. UPDATE `locations` (name, lat, lng) WHERE `location_id`
2. UPDATE `trip_location` (location_type, scheduled_start, scheduled_end, notes) WHERE `id`

---

## 5. Activity Form Fields

Used inline within each stop card (keep inline — activities are sub-items).

| Field | Input | Required | Source |
|-------|-------|----------|--------|
| Activity type | `<select>` (enum below) | Yes | → `stop_activities.activity_type` |
| Description | `<input type="text">` | Yes | → `stop_activities.description` |
| Duration | `<input type="number">` (minutes) | Yes | → `stop_activities.planned_duration_minutes` |
| Notes | `<input type="text">` | No | → `stop_activities.notes` |

---

## 6. Activity Types (PH-Specific)

```typescript
type ActivityType =
  | 'sightseeing'
  | 'swimming'
  | 'hiking'
  | 'island_hopping'
  | 'diving'
  | 'snorkeling'
  | 'photo_op'
  | 'meal'
  | 'shopping'
  | 'cultural_visit'
  | 'water_sports'
  | 'trekking'
  | 'beach'
  | 'boating'
  | 'camping'
  | 'other';
```

---

## 7. DB Columns vs Current Types — Mismatch Tracker

| Thing | Current type says | Actual DB column | Fix needed |
|-------|------------------|-----------------|------------|
| Stop type field | `stop_type` | `location_type` | Rename in types + actions |
| Stop name | `name` on `trip_location` | ❌ doesn't exist | Use `locations.name` via join |
| Location name | `location_name` on `trip_location` | ❌ doesn't exist | Use `locations.name` via join |
| Lat/lng on stop | `latitude/longitude` on `trip_location` | ❌ doesn't exist | Use `locations.latitude/longitude` |
| `CompleteStop` | `{ stop: ItineraryStop }` | flat `trip_location` row | Fix `CompleteStop` type |
| `transit` type | not in `StopType` | in `location_type_enum` | Add to `StopType` |

---

## 8. Initial Trip Location Rows

When a trip is created via `create_trip_with_details`, exactly **3 rows** are inserted into `trip_location`:

| Row | `location_type` | `is_primary` | `order_index` | `scheduled_start` | `scheduled_end` | Shown in |
|-----|-----------------|-------------|---------------|------------------|----------------|---------|
| 1 | `destination` | `TRUE` | 1 | null | null | Itinerary header |
| 2 | `pickup` | `FALSE` | 2 | pickup datetime | null | Itinerary timeline (Day 1 anchor) |
| 3 | `dropoff` | `FALSE` | 3 | dropoff datetime | null | Itinerary timeline (last stop anchor) |

**Decision: pickup and dropoff ARE included in the itinerary timeline.**
- `destination` — excluded (shown in header)
- `pickup` — included; anchors Day 1 with the pickup time; `scheduled_end` is null (only start time shown)
- `dropoff` — included; caps the timeline with the dropoff time; `scheduled_end` is null

The pickup and dropoff datetimes are captured at trip creation. No "departure time" is needed — we show only the start time for these stops, and the design handles null `scheduled_end` gracefully.

**Itinerary query — exclude only `destination`:**

```typescript
// In [trip_id]/index.astro
const { data: itineraryStops } = await supabaseAdmin
  .from('trip_location')
  .select(`
    *,
    location:locations(*),
    activities:stop_activities(*)
  `)
  .eq('trip_id', trip_id)
  .not('location_type', 'in', `(destination)`)
  .order('scheduled_start', { ascending: true });
```

> `destination` is shown in the Itinerary header (via `destination` prop) — exclude it from the query.
> `pickup` and `dropoff` are shown in `Summary.astro` **and** in the itinerary timeline as anchor stops.
> Owner-added stops (activity, meal_break, accommodation, etc.) fill in the timeline between pickup and dropoff.

---

## 9. Component Tree (Target)

```
Itinerary2.astro          ← orchestrator; receives StopRow[]
├── ItineraryHeader.astro ← title, destination badge, Edit button
├── StopModal.astro       ← DaisyUI dialog; add/edit stops; Mapbox search
└── days-container
    └── DaySection.astro  ← one per calendar date
        ├── day header    ← date, stop count, + Add Stop (edit mode)
        └── StopCard.astro (× N stops per day)
            ├── view mode ← type badge, location name, time, notes
            ├── edit controls ← ✏️ Edit / 🗑️ Delete (edit mode, owner)
            └── ActivityList.astro
                ├── activity items (× N)
                └── add-activity inline form (edit mode)
```

---

## 10. Open Decisions

| # | Question | Options | Status |
|---|----------|---------|--------|
| A | Include destination/pickup/dropoff in itinerary timeline? | No — exclude; shown in header/summary | ✅ Decided |
| B | Stops without `scheduled_start` — how to handle? | Group under "Unscheduled" day / require start time | ❓ |
| C | Show `actual_start`/`actual_end` times? | Yes (for ongoing/completed trips) / No (future) | ❓ |
| D | `waiting_time` display | Show between stops / hide for now | ❓ |
| E | Stop modal location field | Mapbox Searchbox (same as destination edit) | ✅ Decided |
| F | Activity type | `<select>` with PH-specific preset list (Section 6) | ✅ Decided |
