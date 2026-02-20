# Trip Feature — Detailed Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **Trip** feature is the core functionality of Tara G!, enabling users to create, manage, and join group trips within the Philippines.

---

## 1. Current Implementation Summary

### 1.1 Database Tables

| Table | Purpose |
|-------|---------|
| `trips` | Core trip entity with title, description, status, slug |
| `trip_details` | Dates, budget, max participants, gender preferences, tags |
| `locations` | Reusable location data with coordinates (PostGIS) |
| `trip_location` | Junction table (destination/pickup/dropoff) |
| `trip_visibility` | Visibility settings (private/public/friends), participant limits |
| `trip_images` | Trip cover images and gallery |
| `trip_members` | Trip participants with roles and status |
| `trip_invitations` | Invitation system |
| `trip_expenses` | Cost tracking and splitting |
| `trip_tags` | Tag system |

### 1.2 Enums

| Enum | Values |
|------|--------|
| `trip_status` | draft, active, completed, archived, cancelled |
| `visibility_type` | private, public, friends |
| `location_type_enum` | destination, activity, meal_break, rest_stop, accommodation, checkpoint, pickup, dropoff, boat, ferry |
| `transport_type` | land, boat, ferry, plane (PH-specific) |
| `user_role` | owner, admin, member |
| `member_status` | joined, pending, left, removed, invited |

### 1.3 API Routes

| Endpoint | Description |
|----------|-------------|
| `/api/trips/owned` | Get trips owned by user |
| `/api/trips/recent` | Get recent public trips |
| `/api/trips/joins` | Get user's joined trips |
| `/api/trips/member` | Handle join requests |
| `/api/trips/suggested` | Get suggested trips |

### 1.4 Frontend Pages

| Page | Route |
|------|-------|
| Trip List | `/trips` |
| Create Trip | `/trips/create` |
| Trip Detail | `/trips/[trip_id]` |
| Trip Expenses | `/trips/[trip_id]/expenses` |

### 1.5 Components

| Component | Purpose |
|-----------|---------|
| `Trip/Hero.astro` | Cover image display |
| `Trip/TripHeader.astro` | Trip title and status |
| `Trip/Summary.astro` | Trip details display |
| `Trip/Itinerary/Itinerary2.astro` | Itinerary viewer/builder (active) |
| `Trip/Member.astro` | Member list and management |
| `Trip/JoinTrip.astro` | Join request flow |
| `Trip/Expenses.astro` | Expense tracking |
| `Trip/Budget.astro` | Budget overview |
| `Trip/UploadImages.astro` | Image upload |

---

## 2. User Stories

### 2.1 Trip Creation (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US1 | As a user, I want to create a new trip with a multi-step wizard | 5-step form: Schedule → Details → Budget → Logistics → Confirm | ✅ Pass |
| US1a | As a user, I want to pick locations on a map for destination, pickup, and dropoff | "Pick on map" button for each location field opens map modal | ✅ Pass |
| US1b | As a user, I want to see all my selected locations on one map before confirming | Step 5 shows map with destination, pickup, and dropoff markers | ✅ Pass |
| US1c | As a user, I want to confirm all trip details before creating | Final review step with all info + map preview | ✅ Pass |
| US2 | As a user, I want to set trip dates and a join deadline | Date pickers with validation (start date ≥ today, end ≥ start) | ✅ Pass |
| US3 | As a user, I want to specify destination with autocomplete | Search destinations, auto-fill coordinates | ✅ Pass |
| US4 | As a user, I want to set pickup and drop-off points | Separate fields with coordinates | ✅ Pass |
| US5 | As a user, I want to add tags to categorize my trip | Tag input with suggestions | ✅ Pass |
| US6 | As a user, I want to set max participants and preferences | Gender preference, cost sharing method | ✅ Pass |
| US7 | As a user, I want to set an estimated budget | Budget input with per-person calculation | ✅ Pass — label changes dynamically per cost sharing method |
| US8 | As a user, I want to generate a shareable trip link | Auto-generated slug, editable share URL | ⚠️ Partial — slug auto-generated from title; no editable share URL on create form (available after creation on trip detail page) |

### 2.1b Trip Detail Page (P0)

> Page: `/trips/[trip_id]` — renders via `[trip_id]/index.astro`
> Data source: `get_trip_full_details` RPC — returns trip, trip_details, trip_locations, trip_members, trip_visibility, trip_images in a single call.

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-D1 | As a user, I want to view full trip details | Shows destination, dates, member count/capacity, preferences, cost sharing, description | ✅ Pass |
| US-D2 | As a user, I want to see the trip title, tags, and visibility | Header shows title, visibility badge (private/public), trip status badge, and tags | ✅ Pass |
| US-D3 | As a user, I want to see the trip cover image | Hero image at top of page; lazy-loaded via `server:defer` | ✅ Pass |
| US-D4 | As a trip owner, I want to edit trip details inline | Clicking editable cards opens modals for: destination, dates, preferences (gender/max pax), budget/cost sharing, description | ✅ Pass |
| US-D5 | As a user, I want to share a trip link | Share button uses Web Share API; falls back to clipboard copy | ✅ Pass |
| US-D6 | As a visitor, I want to request to join an active trip | "Request to Join" button shown when trip is active and not at capacity | ✅ Pass |
| US-D7 | As a pending member, I want to cancel my join request | "Cancel Request" button shown for `pending` role | ✅ Pass |
| US-D8 | As a member, I want to leave a trip I've joined | "Leave Trip" button shown for `member` role; redirects to `/trips` | ✅ Pass |
| US-D9 | As a member or owner, I want to see the member list | Member list (`Member.astro`) shown for owners and joined members | ✅ Pass |
| US-D10 | As a trip owner, I want to manage trip status | Status actions (activate, complete, archive, cancel) via `TripStatusActions` component | ⚠️ Partial — component exists; transitions not fully verified |
| US-D11 | As a user, I want to view the trip itinerary | Itinerary rendered below trip details with destination shown in header | ⚠️ Partial — `Itinerary2.astro` renders stops grouped by day; add-stop builder in progress |
| US-D12 | As a visitor, I want to know when a trip is full | "Trip Full" disabled button shown when `currentPax >= maxPax` | ✅ Pass |

**Editable fields (owner only, non-completed trips):**

| Field | Modal Component | Data Updated |
|-------|----------------|--------------|
| Destination | `DestinationModal.astro` | `trip_locations` (primary) |
| Trip Dates | `DatesModal.astro` | `trip_details.start_date`, `end_date`, `join_by` |
| Preferences | `PreferenceModal.astro` | `trip_details.gender_pref`, `max_pax` |
| Cost Sharing / Budget | `BudgetModal.astro` | `trip_details.cost_sharing`, `estimated_budget` |
| Description / Tags | `DescriptionModal.astro` | `trips.description`, `trip_details.tags` |

### 2.2 Trip Discovery (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US9 | As a user, I want to browse public trips | Feed of public trips with pagination |
| US10 | As a user, I want to search trips by destination | Search by location/province |
| US11 | As a user, I want to filter trips by date, budget, tags | Multi-filter support |
| US12 | As a user, I want to view trip details before joining | Full trip info page accessible without login for public trips |
| US9b | As a user, I want personalized trip recommendations | "Discover" tab filters by my travel preferences |
| US9c | As a user, I want to set travel preferences | Modal prompts for budget, style, pace preferences |
| US9d | As a user, I want to skip preference setup | "Skip" shows generic trips; can re-prompt later |
| US9e | As a user, I don't want to be prompted too often | "Don't show for 7 days" option defers prompt |

### 2.3 Trip Participation (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US13 | As a user, I want to request to join a trip | Join button, pending status |
| US14 | As a user, I want to accept or reject join requests | Owner sees requests, can approve/reject |
| US15 | As a user, I want to invite others to my trip | Invite by username or email |
| US16 | As a user, I want to manage trip members | Remove members, change roles |
| US17 | As a user, I want to leave a trip I've joined | Leave button for non-owners |

### 2.4 Itinerary Management (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US18 | As a trip owner, I want to build an itinerary | Add stops with dates/times |
| US19 | As a trip owner, I want to add activities to stops | Activity types: hiking, diving, etc. |
| US20 | As a trip owner, I want to mark actual arrival/departure | Actual times vs scheduled |
| US21 | As a participant, I want to view the itinerary | Read-only for non-owners |
| US22 | As a trip owner, I want to reorder stops | Drag-and-drop reordering |

### 2.5 Expense Management (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US23 | As a trip owner, I want to track trip expenses | Add expenses with category |
| US24 | As a participant, I want to add my expenses | Any member can add |
| US25 | As a user, I want to see cost breakdown per person | Automatic split based on method |
| US26 | As a user, I want to mark expenses as settled | Payment tracking |
| US27 | As a trip owner, I want to set cost sharing rules | Split evenly, custom, etc. |

### 2.6 Trip Images (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US28 | As a trip owner, I want to upload cover image | Single hero image |
| US29 | As a trip owner, I want to add gallery images | Multiple images |
| US30 | As a user, I want to view trip photos | Gallery view |

### 2.7 Trip Status & Lifecycle (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US31 | As a trip owner, I want to change trip status | Draft → Active → Completed/Archived |
| US32 | As a trip owner, I want to cancel a trip | Cancel with notification to members |
| US33 | As a system, I want to auto-complete trips past end date | Background job or trigger |

### 2.8 Notifications (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US34 | As a user, I want to get notified of join requests | In-app notification |
| US35 | As a user, I want to get notified when my request is approved/rejected | Notification + email |
| US36 | As a trip owner, I want to notify members of trip updates | Broadcast to all members |

### 2.9 Trip Analytics (P2)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US37 | As a trip owner, I want to see trip views and interest | View count, join count |
| US38 | As a user, I want to see popular trips | Trending/popular section |

### 2.10 Offline & Connectivity (P1) — PH-Specific

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US39 | As a user, I want to download itinerary for offline access | PDF or bundled HTML for offline viewing |
| US40 | As a user, I want to see areas with no signal | Connectivity indicator on map |
| US41 | As a user, I want offline maps for trip area | Download MapBox area for offline use |

### 2.11 Emergency & Safety (P1) — PH-Specific

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US42 | As a user, I want emergency contacts by destination | Show LGU numbers, nearest hospital, police |
| US43 | As a user, I want weather alerts for my trip dates | Typhoon/rain warnings for destination |
| US44 | As a user, I want to share my trip location with emergency contact | Share live location feature |

### 2.12 Transport Types (P1) — PH-Specific

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US45 | As a user, I want to specify boat/ferry transport | Add boat as transport type for island trips |
| US46 | As a user, I want ferry/schedule info in itinerary | Link to ferry operator schedules |

---

## 3. Technical Details

### 3.1 RPC Functions

#### Trip Creation & Detail

| Function | Migration | Purpose |
|----------|-----------|---------|
| `create_trip_with_details` | `008` | Create trip with all related records in one call |
| `get_trip_full_details` | `015` | Fetch complete trip with all relations as JSONB |
| `update_trip_status` | — | Change trip status with validation |
| `get_nearby_trips` | `002` | Find trips within radius (PostGIS) |
| `search_trips_optimized` | `002` | Full-text + spatial trip search with relevance score |

#### Trip Listing (used by `/trips` page tabs)

| Function | Migration | Parameters | Returns |
|----------|-----------|------------|---------|
| `get_user_owned_trips` | `011` | `p_user_id, p_search, p_status, p_limit, p_offset` | Trips owned by user + `member_count`, `total_count` |
| `get_user_member_trips` | `011` | `p_user_id, p_search, p_member_status, p_limit, p_offset` | Trips user joined + `role`, `owner_name`, `owner_avatar`, `total_count` |
| `get_recent_trips` | `011` | `p_user_id, p_search, p_tags, p_region, p_limit, p_offset` | Public active trips, block-filtered + `total_count` |
| `get_suggested_trips` | `011` | `p_user_id, p_limit` | Preference-scored trip suggestions + `match_score` |

#### Discovery & Recommendations

| Function | Migration | Parameters | Returns |
|----------|-----------|------------|---------|
| `get_discover_trips` | `010` | `p_user_id, p_search, p_region, p_budget, p_travel_style, p_pace, p_limit, p_offset` | Preference-filtered public trips + `total_count` |

#### Itinerary Management

| Function | Migration | Purpose |
|----------|-----------|---------|
| `get_complete_itinerary` | `004` | Fetch all stops + nested activities as JSONB |
| `create_stop_with_activities` | `004` | Atomically create a stop with its activities |
| `update_itinerary_stop` | `004` | Update stop details with validation |
| `delete_itinerary_stop` | `004` | Delete stop and auto-reorder remaining |
| `reorder_itinerary_stops` | `004` | Batch reorder operation |
| `get_itinerary_with_metrics` | `005` | Stops with completion/time-accuracy metrics |
| `get_itinerary_performance_analytics` | `005` | Trip-level analytics (completion rates, time accuracy) |

### 3.2 Key Validation Rules

| Field | Rule |
|-------|------|
| title | Min 3 characters |
| description | Min 10 characters |
| start_date | ≥ today |
| end_date | ≥ start_date |
| join_by | ≥ now() |
| max_pax | 2-50 |
| coordinates | Valid lat/lng range |

### 3.3 Auto-Calculated Fields

| Field | Calculation |
|-------|-------------|
| duration_days | (end_date - start_date) + 1 |
| budget_per_person | estimated_budget / max_pax |
| available_spots | max_participants - current_participants |

---

## 4. Current Gaps & Improvement Opportunities

### 4.1 High Priority (P0)

- [ ] Trip draft auto-save — Save in-progress trips
- [ ] Complete itinerary builder — Full drag-drop itinerary management
- [ ] Expense splitting UI — Better cost sharing visualization
- [ ] Email notifications — Currently notifications are in-app only
- [ ] Trip calendar view — See trips on calendar

### 4.2 Medium Priority (P1) — PH-Focused

- [ ] Trip templates — Reuse common trip configurations (weekend getaway, island hopping, road trip)
- [ ] Offline itinerary — Downloadable PDF/HTML for areas with no signal
- [ ] Emergency contacts — LGU numbers, hospitals, police by destination
- [ ] Weather alerts — Typhoon/rain warnings for trip dates
- [ ] Boat/ferry transport type — Support for island hopping trips
- [ ] Connectivity indicator — Show areas with no signal on map

### 4.3 Low Priority (P2)

- [ ] Trip photos gallery — Full gallery experience
- [ ] Trip packing list — Shared checklist
- [ ] Trip documents — Store booking confirmations
- [ ] Trip chat — In-trip messaging (also in features future)
- [ ] Calendar sync — Export to Google/Apple Calendar

---

## 5. Implementation Phases

### Phase 1: Core Stability & Creation (P0)
- [x] ~~Create database migration for preferences_prompt_until~~
- [x] ~~Create get_discover_trips RPC function~~
- [x] ~~Rename "Recent" tab to "Discover" in /trips page~~
- [x] ~~Implement preference-based filtering for Discover tab~~
- [x] ~~Add PreferencesPrompt modal component~~
- [x] ~~Add Map Picker Modal component for location selection~~
- [x] ~~Add "Pick on map" buttons to Destination, Pickup, Dropoff fields~~
- [x] ~~Add Step 5 - Confirmation with map preview showing all locations~~
- [x] ~~Fix trip creation bugs (auth session, coordinate order, PostGIS trigger, trip_id ambiguity)~~
- [x] ~~Add Mapbox markers (destination/pickup/dropoff) to Step 5 confirmation map~~
- [x] ~~Remove legacy Itinerary.astro; use Itinerary2 with destination in header~~
- [ ] Ensure trip status transitions work correctly
- [ ] Verify member management works (join/leave/remove)
- [ ] Complete trip search and filtering

### Phase 2: Itinerary Enhancement (P1)
- [ ] Full drag-drop itinerary builder
- [ ] Activity management per stop
- [ ] Actual vs scheduled time tracking
- [ ] Itinerary sharing/export (PDF)
- [ ] Add boat/ferry transport type

### Phase 3: Expense System (P1)
- [ ] Complete expense tracking UI
- [ ] Cost splitting calculations
- [ ] Settlement tracking
- [ ] Export expense reports

### Phase 4: Offline & Safety (P1) — PH-Specific
- [ ] Offline itinerary download (PDF/HTML)
- [ ] Emergency contacts by destination
- [ ] Weather alerts for trip dates
- [ ] Connectivity indicator on map

### Phase 5: Notifications & Social (P1)
- [ ] Email notification system
- [ ] Push notifications
- [ ] Trip sharing features
- [ ] Social feed integration

### Phase 6: Advanced Features (P2)
- [ ] Trip templates (island hopping, road trip, etc.)
- [ ] Packing lists
- [ ] Analytics dashboard
- [ ] Trip reviews/ratings

---

## 6. Related Features

| Feature | Relationship |
|---------|--------------|
| **Project 82** | Trips feed into province visit detection when completed |
| **User Profiles** | Profile shows user's trips (owned/joined) |
| **Feeds** | Public trips appear in social feeds |
| **Search** | Trips are searchable content |

---

## 10. File Structure

```
database-migrations/
├── 001_trip_schema.sql                     # Core tables + enums + triggers
├── 002_optimized_search_function.sql       # search_trips_optimized RPC
├── 004_critical_itinerary_fixes.sql        # Itinerary tables + RPC functions
├── 005_performance_optimization.sql        # Indexes + analytics functions
├── 006_critical_user_social_fixes.sql      # users, social, financial tables
├── 007_enhanced_social_features.sql        # notifications, messages, reviews
├── 008_create_trip_with_details.sql        # create_trip_with_details RPC (original)
├── 009_add_preferences_prompt.sql          # Preferences prompt settings
├── 010_create_discover_trips_function.sql  # get_discover_trips RPC
├── 011_create_trip_listing_functions.sql   # get_user_owned_trips, get_user_member_trips,
│                                           # get_recent_trips, get_suggested_trips
├── 012_fix_create_trip_with_details.sql    # Fix: removed invalid columns/constraints, DEFAULT param order
├── 013_fix_location_geometry_trigger.sql   # Fix: PostGIS search_path + float8 cast for ST_MakePoint
├── 014_fix_trip_id_ambiguity.sql           # Fix: qualify RETURNING trip_id with table name
└── 015_create_get_trip_full_details.sql    # get_trip_full_details RPC (RETURNS JSONB)

src/
├── pages/
│   ├── trips/
│   │   ├── index.astro          # Trip list/feed with Discover tab
│   │   ├── create.astro         # Create trip wizard (5 steps)
│   │   └── [trip_id]/
│   │       ├── index.astro      # Trip detail
│   │       └── expenses.astro   # Expense management
│   └── api/trips/
│       ├── owned.ts
│       ├── recent.ts
│       ├── joins.ts
│       ├── member.ts
│       └── suggested.ts
├── components/
│   ├── MapPickerModal.astro    # NEW: Map picker for locations
│   ├── PreferencesPrompt.astro  # NEW: Travel preferences modal
│   └── Trip/
│       ├── Hero.astro
│       ├── TripHeader.astro
│       ├── Summary.astro
│       ├── Itinerary.astro
│       ├── Member.astro
│       ├── JoinTrip.astro
│       ├── Expenses.astro
│       ├── Budget.astro
│       ├── Tags.astro
│       ├── UploadImages.astro
│   ├── EditModal.astro
│   └── modal/                  # Various edit modals
├── types/
│   ├── trip.ts
│   ├── trip-enhanced.ts        # Advanced types
│   └── itinerary.ts
└── data/
    └── phProvinces.ts           # Used for destination autocomplete
```

---

## 8. Philippines-Specific Considerations

### 8.1 Geography & Transportation

| Feature | Description |
|---------|-------------|
| **82 Provinces** | All provinces mapped with geojson for Project 82 integration |
| **Island Hopping** | Boat/ferry as transport type for Palawan, Visayas, Mindanao trips |
| **Remote Areas** | Connectivity indicator for areas with no signal (Siargao, Batanes, etc.) |

### 8.2 Safety & Emergency

| Feature | Description |
|---------|-------------|
| **Emergency Contacts** | LGU hotlines, nearest hospitals, police stations by municipality |
| **Weather Alerts** | PAGASA integration for typhoon/rain warnings during trip dates |
| **Location Sharing** | Share live location with emergency contact |

### 8.3 Data Sources

| Data | Source |
|------|--------|
| Province boundaries | `/public/geojson/*.geojson` (already exists) |
| Province metadata | `src/data/phProvinces.ts` (already exists) |
| Emergency contacts | To be sourced from LGU directories or DILG |
| Weather data | PAGASA or weather API |

---

## 9. Dependencies

- **Supabase** — Database and auth
- **PostGIS** — Spatial queries for location matching
- **MapBox** — Map display (existing)
- **R2/Cloudflare** — Image storage (existing)

---

*Last updated: 2026-02-19*
*Updated with PH-specific features: Offline itinerary, Emergency contacts, Boat/Ferry transport*
