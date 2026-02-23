# Itinerary Feature — Implementation Plan

> Status: `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked
> Last updated: 2026-02-20

---

## Phase 1: Critical Bug Fixes

### 1.1 DaySection date crash
- [ ] **`DaySection.astro:16`** — Fix `stops[0].stop` → `stops[0]`
  - Root cause: data is flat from `trip_location`, not wrapped in `{ stop: ... }`
  - Also fix the `formatDate(firstStop.scheduled_start)` call

### 1.2 Stop data fetching — missing locations join + wrong rows included
- [ ] **`[trip_id]/index.astro`** — Fix the itinerary query:
  - Add `location:locations(*)` join — without this `completeStop.location?.name` is always `undefined`
  - Exclude only `destination` — pickup and dropoff ARE shown in the itinerary timeline as anchor stops (they have `scheduled_start` from trip creation)
  - Current: `.select('*, activities:stop_activities(*)')`
  - Fix: `.select('*, activities:stop_activities(*), location:locations(*)')` + `.not('location_type', 'in', '(destination)')`

### 1.3 `createStop` action — wrong columns
- [ ] **`src/actions/stops.ts` → `createStop`** — Fix column names
  - `stop_type` → `location_type` (correct enum column)
  - Remove: `name`, `location_name`, `latitude`, `longitude` (don't exist in `trip_location`)
  - Proper flow: INSERT into `locations` first → get `location_id` → INSERT into `trip_location` with `location_id`
  - Notes: `location_type` is a `location_type_enum` (destination, activity, meal_break, rest_stop, accommodation, checkpoint, pickup, dropoff)

### 1.4 `updateStop` action — wrong columns
- [ ] **`src/actions/stops.ts` → `updateStop`** — Fix column names
  - Same issue: `stop_type` → `location_type`, remove non-existent fields
  - For location name/coords: UPDATE `locations` row linked via `location_id`

### 1.5 Activity editor — hardcoded activity_type
- [ ] **`activityEditor.ts:148`** — `activity_type` hardcoded to `'photo_op'` on edit
  - Fix: read from `data-activity-type` attr on `.activity-item`
- [ ] **`ActivityList.astro`** — Add `data-*` attrs to `.activity-item`
  - Add: `data-activity-type`, `data-activity-description`, `data-duration`

---

## Phase 2: Cleanup — Remove Dead Files

### 2.1 CompleteItinerary.astro
- [ ] Delete `src/components/Trip/Itinerary/CompleteItinerary.astro` (520 lines)
  - Reason: legacy component, not imported or used anywhere; replaced by `Itinerary2.astro`
  - Verify no imports before deleting

### 2.2 FormTemplates.astro
- [ ] Delete `src/components/Trip/Itinerary/FormTemplates.astro` (309 lines)
  - Reason: orphaned — `stopEditor.ts` builds its own inline HTML, this file is not imported
  - Verify no imports before deleting

---

## Phase 3: UX Improvements — Replace Native Dialogs

### 3.1 Replace `alert()` with `showToast`
- [ ] **`stopEditor.ts`** — Replace all `alert('...')` with `showToast({ message, type: 'error' })`
- [ ] **`activityEditor.ts`** — Same

### 3.2 Replace `confirm()` with `createConfirmModal`
- [ ] **`stopEditor.ts`** — Delete stop `confirm()` → `createConfirmModal`
- [ ] **`activityEditor.ts`** — Delete activity `confirm()` → `createConfirmModal`

### 3.3 Fix edit mode toggle `hidden`/`flex` conflict
- [ ] **`Itinerary.ts`** — Toggle adds both `hidden` and `flex` on same element
  - Fix: use `style.display` instead of toggling both classes

---

## Phase 4: Add StopModal (Replace Inline Forms)

### 4.1 Create `StopModal.astro`
- [ ] Create `src/components/Trip/Itinerary/StopModal.astro`
  - DaisyUI `<dialog>` (reuse `EditModal.astro` wrapper)
  - Fields: Stop Name, Type (select with all `location_type_enum` values), Location (Mapbox search → coords), Start Time, End Time, Notes
  - Modes: add (empty) and edit (pre-filled from `data-*` attrs)
  - Calls `actions.stops.createStop` or `actions.stops.updateStop`
  - Uses `showToast` for feedback

### 4.2 Wire StopModal into ItineraryHeader
- [ ] **`ItineraryHeader.astro`** — "Add Stop" button opens `#stop-modal` in add mode
- [ ] **`Itinerary2.astro`** — Render `<StopModal tripId={tripId} />` for owners

### 4.3 Wire StopModal into StopCard edit button
- [ ] **`stopEditor.ts`** — `edit-stop-btn` click → populate modal with `data-*` attrs + open it
  - Remove `createStopEditor` inline form injection
  - Remove `createAddStopForm` inline form injection

### 4.4 Keep per-day "Add Stop" via modal
- [ ] **`DaySection.astro`** — "Add Stop" button opens modal with day pre-selected
  - Store current `dayIndex` in modal hidden field so stop gets correct `order_index`

---

## Phase 5: Activity Editor Polish

### 5.1 Keep inline activity forms (intentional pattern)
- [ ] Inline add/activity forms are fine for sub-items — keep the pattern
- [ ] Fix: read `data-*` attrs properly (Phase 1.5)
- [ ] Fix: replace alerts/confirms (Phase 3)
- [ ] Add: `activity_type` as a select (not free-text) with common PH travel activity types

---

## Notes

### DB Schema Reference
```
trip_location columns (actual):
  id, trip_id, location_id, location_type (enum), is_primary, is_mandatory,
  order_index, scheduled_start, scheduled_end, actual_start, actual_end,
  waiting_time, notes, distance_km, created_at, updated_at

locations columns:
  location_id, name, address, city, country,
  latitude, longitude, geometry (PostGIS), created_at, updated_at

stop_activities columns:
  id, stop_id, activity_type, description,
  planned_duration_minutes, actual_duration_minutes,
  order_index, notes, created_at, updated_at
```

### location_type_enum values
`destination`, `activity`, `meal_break`, `rest_stop`, `accommodation`,
`checkpoint`, `pickup`, `dropoff`, `boat`, `ferry`

### Actions namespace
- `actions.stops.createStop` / `updateStop` / `deleteStop`
- `actions.activities.createActivity` / `updateActivity` / `deleteActivity`

### Known PostGIS gotcha
`SET search_path = public, extensions` required, and cast to `::float8` for `ST_MakePoint`
(see migrations 013, 027)
