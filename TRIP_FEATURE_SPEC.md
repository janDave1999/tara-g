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
| `trip_visibility` | Visibility settings (private/public/friends), participant limits, `itinerary_public` flag |
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

> **All legacy REST API routes have been removed** (SR-AUTHZ-001 compliance — they accepted `userId` from client input with no auth check, creating IDOR risk). Trip data is fetched entirely through **Astro actions** and **SECURITY DEFINER RPCs** which read `context.locals.user_id` from the verified JWT.

| Endpoint | Status |
|----------|--------|
| `/api/trips/owned` | ❌ Deleted — replaced by `get_user_owned_trips` RPC via action |
| `/api/trips/recent` | ❌ Deleted — replaced by `get_recent_trips` RPC via action |
| `/api/trips/joins` | ❌ Deleted — replaced by `get_user_participating_trips` RPC via action |
| `/api/trips/member` | ❌ Deleted — replaced by member RPCs via action |
| `/api/trips/suggested` | ❌ Deleted — replaced by `get_suggested_trips` RPC via action |

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
| `Trip/TripHeader.astro` | Trip title, visibility button, status button |
| `Trip/TripStatusBadge.astro` | Clickable status badge (owner) → opens StatusModal |
| `Trip/Summary.astro` | Trip details display |
| `Trip/Itinerary/Itinerary2.astro` | Itinerary orchestrator — groups stops by day, renders DaySection per group |
| `Trip/Itinerary/ItineraryHeader.astro` | Itinerary header — destination badge, Edit Itinerary toggle |
| `Trip/Itinerary/DaySection.astro` | One day group — collapsible; renders StopCards |
| `Trip/Itinerary/StopCard.astro` | Individual stop — view/edit modes, shows location name, type badge, time, activities |
| `Trip/Itinerary/ActivityList.astro` | Activities within a stop — rendered with data-* attrs for JS editor |
| `Trip/Member.astro` | Member list and management |
| `Trip/JoinTrip.astro` | Join request flow |
| `Trip/Expenses.astro` | Expense tracking |
| `Trip/Budget.astro` | Budget overview |
| `Trip/UploadImages.astro` | Image upload |
| `Trip/EditModal.astro` | DaisyUI `<dialog>` wrapper used by all edit modals |
| `Trip/modal/VisibilityModal.astro` | Change trip visibility (private/public/friends) |
| `Trip/modal/StatusModal.astro` | Change trip status (draft/active/completed/archived/cancelled) |
| `Trip/modal/DestinationModal.astro` | Edit trip destination with Mapbox Searchbox autocomplete |
| `Trip/modal/DatesModal.astro` | Edit trip dates |
| `Trip/modal/PreferenceModal.astro` | Edit gender preference and max participants |
| `Trip/modal/BudgetModal.astro` | Edit cost sharing and estimated budget |
| `Trip/modal/DescriptionModal.astro` | Edit trip description and tags |
| `TripCard.astro` | Trip card for listings; visibility toggle (owned) cycles private→public→friends |

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
| US-D2 | As a user, I want to see the trip title, tags, and visibility | Header shows title, visibility badge (private/public/friends), trip status badge, and tags; badges are clickable buttons (owner only) | ✅ Pass |
| US-D3 | As a user, I want to see the trip cover image | Hero image at top of page; lazy-loaded via `server:defer` | ✅ Pass |
| US-D4 | As a trip owner, I want to edit trip details inline | Clicking editable cards opens modals for: destination, dates, preferences (gender/max pax), budget/cost sharing, description | ✅ Pass |
| US-D5 | As a user, I want to share a trip link | Share button uses Web Share API; falls back to clipboard copy | ✅ Pass |
| US-D6 | As a visitor, I want to request to join an active trip | "Request to Join" button shown when trip is active and not at capacity | ✅ Pass |
| US-D7 | As a pending member, I want to cancel my join request | "Cancel Request" button shown for `pending` role | ✅ Pass |
| US-D8 | As a member, I want to leave a trip I've joined | "Leave Trip" button shown for `member` role; redirects to `/trips` | ✅ Pass |
| US-D9 | As a member or owner, I want to see the member list | Member list (`Member.astro`) shown only for `owner` and `member` (joined) roles; hidden from visitors, pending, and invited users | ✅ Pass |
| US-D10 | As a trip owner, I want to manage trip status | Clicking the status badge opens `StatusModal` with all 5 status options; calls `update_trip_status` RPC | ✅ Pass |
| US-D11 | As a user, I want to view the trip itinerary | Itinerary gated by role (`owner`/`member`) or `itinerary_public` flag; rendered below trip details with destination in header | ⚠️ Partial — stops render correctly; add/edit/delete with Mapbox search, pickup/dropoff (max 20 each), and time overlap validation all done; drag-drop reorder pending |
| US-D11b | As a trip owner, I want to control who sees the itinerary | `🔒 Members only` / `🌐 Public` toggle in itinerary header; updates `trip_visibility.itinerary_public` via `updateItineraryPublic` action; when public, itinerary is visible to all viewers | ✅ Pass |
| US-D12 | As a visitor, I want to know when a trip is full | "Trip Full" disabled button shown when `currentPax >= maxPax` | ✅ Pass |

**Editable fields (owner only, non-completed trips):**

| Field | Modal Component | Data Updated |
|-------|----------------|--------------|
| Visibility | `VisibilityModal.astro` | `trip_visibility.visibility` |
| Itinerary access | `ItineraryHeader.astro` toggle | `trip_visibility.itinerary_public` via `updateItineraryPublic` action |
| Status | `StatusModal.astro` | `trips.status` via `update_trip_status` RPC |
| Destination | `DestinationModal.astro` | `locations` + `trip_location` (primary) via `update_trip_destination` RPC; Mapbox Searchbox autocomplete |
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
| US13b | As a user, I want to see all my trip participation in one place | "Joined" tab on `/trips` shows three participation states in TripCard format: **Joined** (✓ green badge), **Requested** (⏳ amber badge), **Invited** (📧 blue badge) — fetched via `get_user_participating_trips` RPC; owned trips excluded |
| US14 | As a user, I want to accept or reject join requests | Owner sees requests, can approve/reject |
| US15 | As a user, I want to invite others to my trip | Invite by username or email |
| US15b | As an invited user, I want to accept or decline on the trip detail page | Amber invitation banner shown on `/trips/[trip_id]` with Accept/Decline buttons; banner replaces the "Request to Join" button |
| US16 | As a user, I want to manage trip members | Remove members, change roles |
| US17 | As a user, I want to leave a trip I've joined | Leave button for non-owners |

### 2.4 Itinerary Management (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US18 | As a trip owner, I want to build an itinerary | Add stops with dates/times; Mapbox location search on location name field (suggest + retrieve with coordinates) |
| US18a | As a trip owner, I want to add multiple pickup and dropoff stops | Pickup and Dropoff available in stop type selector for "Add Stop" form; max **20 pickup** and **20 dropoff** stops per trip (effectively unlimited for normal use) |
| US18b | As a trip owner, I want stop times to not overlap within a day | On save (create or edit), validate that the new stop's scheduled_start–scheduled_end range does not overlap any existing stop on the same day; if overlap detected, show an inline error and block save; end time is optional — if omitted, only start time collision (same start as another stop) is checked |
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

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US34 | As a user, I want to get notified of join requests | In-app notification | ✅ Pass — `trip_join_request` notification sent to trip owner; payload includes `member_id` for inline Approve/Decline action buttons |
| US35 | As a user, I want to get notified when my request is approved/rejected | Notification + email | ⚠️ Partial — `trip_join_approved` / `trip_join_declined` in-app notifications sent; email pending |
| US35b | As a user, I want to get notified when invited to a trip | In-app notification with Accept/Decline inline actions | ✅ Pass — `trip_invite` notification sent to invitee; payload includes `invitation_id` for Accept/Decline buttons |
| US35c | As a trip owner, I want to get notified when invite is accepted/declined | In-app notification | ✅ Pass — `trip_invite_accepted` / `trip_invite_declined` sent to trip owner |
| US35d | As a removed member, I want to get notified | In-app notification | ✅ Pass — `trip_member_removed` notification sent on `removeTripMember` |
| US36 | As a trip owner, I want to notify members of trip updates | Broadcast to all members | ⬜ Not started |

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
| `get_trip_full_details` | `015`, `034` | Fetch complete trip with all relations as JSONB; visibility gate added (034): visitors on private trips receive NULL → page redirects to /404 |
| `update_trip_status` | `026` | Change trip status with ownership validation |
| `update_trip_destination` | `027` | Update primary destination location + PostGIS geometry |
| `update_trip_dates` | `033` | Update `start_date`, `end_date`, `join_by` — ownership verified server-side |
| `update_trip_preferences` | `033` | Update `gender_pref`, `max_pax` — ownership verified server-side |
| `update_trip_budget` | `033` | Update `cost_sharing`, `estimated_budget` — ownership verified server-side |
| `update_trip_description` | `033` | Update `trips.title`, `trips.description`, `trip_details.tags` — ownership verified server-side |
| `get_nearby_trips` | `002` | Find trips within radius (PostGIS) |
| `search_trips_optimized` | `002` | Full-text + spatial trip search with relevance score |

#### Trip Listing (used by `/trips` page tabs)

| Function | Migration | Parameters | Returns |
|----------|-----------|------------|---------|
| `get_user_owned_trips` | `011`, `025` | `p_user_id, p_search, p_status, p_limit, p_offset` | Trips owned by user + `member_count`, `visibility`, `total_count` |
| `get_user_member_trips` | `011` | `p_user_id, p_search, p_member_status, p_limit, p_offset` | Trips user joined (status = 'joined') + `role`, `owner_name`, `owner_avatar`, `total_count` — kept for legacy API use |
| `get_user_participating_trips` | `028` | `p_user_id, p_search, p_status, p_limit, p_offset` | All trips the user participates in (joined + pending request + invited) — excludes owned trips; adds `participation_status` ('joined'/'pending'/'invited'), `invitation_id` for invited rows + `total_count` |
| `get_recent_trips` | `011` | `p_user_id, p_search, p_tags, p_region, p_limit, p_offset` | Public active trips, block-filtered + `total_count` |
| `get_suggested_trips` | `011` | `p_user_id, p_limit` | Preference-scored trip suggestions + `match_score` |

#### Discovery & Recommendations

| Function | Migration | Parameters | Returns |
|----------|-----------|------------|---------|
| `get_discover_trips` | `010`, `031`, `032` | `p_user_id, p_search, p_region, p_budget, p_travel_style, p_pace, p_limit, p_offset` | Preference-filtered public trips + `owner_name`, `owner_avatar`, `total_count`; excludes caller's own trips |

#### Itinerary Management

> **Note:** The old itinerary RPCs (`create_stop_with_activities`, `update_itinerary_stop`, `delete_itinerary_stop`, `reorder_itinerary_stops`) were removed from `stops.ts` — they used wrong column names (`stop_type`, `name`, `location_name` which don't exist on `trip_location`). Actions now use **direct table operations** against `locations` + `trip_location`.

| Function | Migration | Purpose |
|----------|-----------|---------|
| `get_complete_itinerary` | `004` | Fetch all stops + nested activities as JSONB |
| `get_itinerary_with_metrics` | `005` | Stops with completion/time-accuracy metrics |
| `get_itinerary_performance_analytics` | `005` | Trip-level analytics (completion rates, time accuracy) |

**Direct table ops used by `stops` actions (no RPC):**

| Action | Operation | Tables |
|--------|-----------|--------|
| `stops.createStop` | INSERT locations → INSERT trip_location | `locations`, `trip_location` |
| `stops.updateStop` | UPDATE locations + UPDATE trip_location | `locations`, `trip_location` |
| `stops.deleteStop` | DELETE trip_location; DELETE locations if orphaned | `trip_location`, `locations` |

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
- [ ] Email notifications — In-app notifications done; email delivery still pending
- [ ] Trip update broadcast — `trip_update` notification to all members on trip detail changes
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
- [x] ~~Ensure trip status transitions work correctly — `StatusModal` + `update_trip_status` RPC (migration 026)~~
- [x] ~~Fix `get_discover_trips`: add `owner_name`/`owner_avatar` (JOIN users), remove 30-day cap, exclude caller's own trips (031); fix `SMALLINT`→`INTEGER` type cast error (032)~~
- [x] ~~Fix `get_user_owned_trips`: return `visibility` field from `trip_visibility` (030)~~
- [x] ~~Fix `TripCard` avatar URL: handle both full HTTP URLs (OAuth) and relative R2 paths~~
- [x] ~~SR-AUTHZ-001: Delete 5 legacy `/api/trips/*` REST routes (accepted `userId` from client input, IDOR risk)~~
- [x] ~~SR-AUTHZ-001: Create `update_trip_dates`, `update_trip_preferences`, `update_trip_budget`, `update_trip_description` RPCs with server-side ownership checks (migration 033)~~
- [x] ~~SR-AUTHZ-001: Add visibility gate to `get_trip_full_details` — visitors on private trips receive NULL, page redirects to /404 (migration 034)~~
- [x] ~~Verify member management works (join/leave/remove)~~
- [x] ~~Complete trip search and filtering — fixed pagination losing budget/style params across pages; removed Pace filter (no trip attribute); added style tag filter to `get_discover_trips` via `td.tags @> ARRAY[p_travel_style]` (migration 044)~~

### Phase 2: Itinerary Enhancement (P1)
- [x] ~~Fix DaySection crash (`stops[0].stop` → `stops[0]`)~~
- [x] ~~Fix itinerary query: add `location:locations(*)` join; exclude only `destination` (pickup/dropoff are shown in timeline)~~
- [x] ~~Rewrite `createStop`/`updateStop` actions: correct DB columns (`location_type`, `location_id`); two-step INSERT into `locations` then `trip_location`~~
- [x] ~~Fix `deleteStop`: cleans up orphaned `locations` rows~~
- [x] ~~Fix `activityEditor.ts`: read `data-activity-type`/`data-activity-description`/`data-duration` from DOM instead of hardcoded `'photo_op'`~~
- [x] ~~Add `data-activity-type`, `data-activity-description`, `data-duration` to `ActivityList.astro` items~~
- [x] ~~Replace all `alert()`/`confirm()` in `stopEditor.ts` and `activityEditor.ts` with `showToast`/`createConfirmModal`~~
- [x] ~~Fix `hidden`+`flex` edit mode toggle conflict in `Itinerary.ts` — use `style.display` instead~~
- [x] ~~Fix `stopEditor.ts` field names: `name`→`location_name`, `stop_type`→`location_type` to match DB~~
- [x] ~~Delete dead files: `CompleteItinerary.astro` (520 lines, unused), `FormTemplates.astro` (309 lines, orphaned)~~
- [x] ~~Integrate Mapbox Search Box (suggest + retrieve) into inline add/edit stop forms; coordinates saved to `locations` table~~
- [x] ~~Fix DaySection.astro type mismatch: `CompleteStop[]` → `ItineraryStop[]`; `firstStop.stop?.scheduled_start` → `firstStop?.scheduled_start`~~
- [x] ~~Pickup/Dropoff stop type in Add Stop form; limits raised to 20 each (US18a)~~
- [x] ~~Time overlap validation on stop create/edit within a day — full interval + exact start-time collision; inline form error displayed, save blocked (US18b); new stop default time set to after last stop + 15 min~~
- [x] ~~Consolidated "Joined" tab: `get_user_participating_trips` RPC (028) unifies joined + pending + invited into single TripCard grid; "Invited" tab removed (US13b)~~
- [x] ~~Invitation banner on trip detail page: Accept/Decline buttons for invited users; hides Request to Join button (US15b)~~
- [x] ~~Member count (`currentPax`) now filters to `member_status = 'joined'` only — excludes pending and left members~~
- [x] ~~Member list (`Member.astro`) gated to owner/member roles only — visitors, pending, invited cannot see it (US-D9)~~
- [x] ~~Itinerary gated to owner/member by default; owner can toggle `itinerary_public` via `🔒/🌐` button in `ItineraryHeader` — `trip_visibility.itinerary_public` column (migration 029), `updateItineraryPublic` action (US-D11b)~~
- [ ] Full drag-drop itinerary builder
- [ ] Activity type as `<select>` (PH-specific presets) instead of free-text input
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
- [x] ~~In-app notification system — DB table (`notifications`), 7 RPC functions (migration 007 + 041 + 042), full Astro Actions API (`getNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `createNotification`)~~
- [x] ~~NotificationBell component — badge with 30s polling (pauses on tab hidden), dropdown with real-time count refresh, inline Accept/Decline buttons for `trip_invite`, inline Approve/Decline buttons for `trip_join_request`~~
- [x] ~~/notifications page — full notification center with filter tabs (All / Unread / Trip Invites / Join Requests), paginated load-more, same inline action buttons~~
- [x] ~~Notification triggers: `trip_join_request` (to owner), `trip_join_approved`/`declined` (to requester), `trip_invite` (to invitee), `trip_invite_accepted`/`declined` (to owner), `trip_member_removed` (to removed member)~~
- [x] ~~Fixed auth_id → internal user_id resolution in `approveJoinRequest`, `rejectJoinRequest`, `removeTripMember` (FK constraint bug 23503)~~
- [ ] Email notification system
- [ ] Push notifications
- [ ] Trip update broadcast (`trip_update` type) — notify all members when owner changes trip details
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
├── 015_create_get_trip_full_details.sql    # get_trip_full_details RPC (RETURNS JSONB)
├── 025_add_visibility_to_owned_trips.sql   # get_user_owned_trips: add visibility from trip_visibility JOIN
├── 026_create_update_trip_status_rpc.sql   # update_trip_status RPC with ownership validation
├── 027_create_update_trip_destination_rpc.sql  # update_trip_destination RPC; updates locations + PostGIS geometry
├── 028_get_user_participating_trips.sql    # get_user_participating_trips RPC; UNION of trip_members (joined/pending) + trip_invitations (invited); returns participation_status
├── 029_add_itinerary_public.sql            # ALTER trip_visibility ADD itinerary_public BOOLEAN DEFAULT FALSE; owner-controlled itinerary visibility
├── 030_fix_get_user_owned_trips_visibility.sql  # Fix get_user_owned_trips: LEFT JOIN trip_visibility + COALESCE visibility (was missing from 025 apply)
├── 031_fix_get_discover_trips.sql          # Fix get_discover_trips: add owner_name/owner_avatar (JOIN users), remove 30-day cap, exclude caller's own trips
├── 032_fix_discover_trips_type_cast.sql    # Fix 031: add ::INTEGER casts for max_pax/current_participants/estimated_budget (SMALLINT→INTEGER mismatch, code 42804)
├── 033_create_trip_edit_rpcs.sql           # SR-AUTHZ-001: update_trip_dates, update_trip_preferences, update_trip_budget, update_trip_description — all with server-side ownership validation
├── 034_visibility_gate_get_trip_full_details.sql  # SR-AUTHZ-001: add visibility gate to get_trip_full_details; visitors on private trips receive NULL → /404 redirect
└── 035_get_nearby_trips.sql                 # Maps: new get_nearby_trips RPC function with lat/lng coordinates for map markers

src/
├── pages/
│   ├── trips/
│   │   ├── index.astro          # Trip list/feed with Discover tab
│   │   ├── create.astro         # Create trip wizard (5 steps)
│   │   └── [trip_id]/
│   │       ├── index.astro      # Trip detail
│   │       └── expenses.astro   # Expense management
│   └── api/trips/          # (all 5 legacy routes deleted — SR-AUTHZ-001)
├── components/
│   ├── MapPickerModal.astro    # NEW: Map picker for locations
│   ├── PreferencesPrompt.astro  # NEW: Travel preferences modal
│   └── Trip/
│       ├── Hero.astro
│       ├── TripHeader.astro
│       ├── Summary.astro
│       ├── Member.astro
│       ├── JoinTrip.astro
│       ├── Expenses.astro
│       ├── Budget.astro
│       ├── Tags.astro
│       ├── UploadImages.astro
│   ├── EditModal.astro          # DaisyUI <dialog> wrapper for all edit modals
│   └── modal/
│       ├── VisibilityModal.astro   # private/public/friends selector
│       ├── StatusModal.astro       # draft/active/completed/archived/cancelled selector
│       ├── DestinationModal.astro
│       ├── DatesModal.astro
│       ├── PreferenceModal.astro
│       ├── BudgetModal.astro
│       └── DescriptionModal.astro
├── types/
│   ├── trip.ts
│   ├── trip-enhanced.ts        # Advanced types
│   └── itinerary.ts
├── actions/
│   ├── index.ts
│   ├── stops.ts                # createStop/updateStop/deleteStop — direct table ops (locations + trip_location)
│   ├── activities.ts           # createActivity/updateActivity/deleteActivity
│   └── trips.ts
├── scripts/
│   └── Itinerary/
│       ├── Itinerary.ts        # Edit mode toggle, day collapse, coordinates stop+activity editors
│       ├── stopEditor.ts       # Add/edit/delete stop inline forms; uses showToast + createConfirmModal
│       └── activityEditor.ts   # Add/edit/delete activity inline forms; reads data-* attrs
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

*Last updated: 2026-03-01 (session 5)*
*Updated with PH-specific features: Offline itinerary, Emergency contacts, Boat/Ferry transport*
*Updated: Visibility and Status modals on trip detail page; `update_trip_status` RPC (026); `get_user_owned_trips` now returns visibility (025); `TripStatusActions` removed in favour of `StatusModal`*
*Updated: `DestinationModal` uses Mapbox Searchbox autocomplete (country=PH); `update_trip_destination` RPC (027) updates `locations` row + PostGIS geometry with `ST_MakePoint(lng::float8, lat::float8)`*
*Updated: Itinerary Phase 1–3 complete — crash fixes, query fix (location join + correct filter), `stops.ts` rewritten with correct DB columns (direct table ops), `activityEditor.ts` data-\* reading fixed, alert/confirm replaced with showToast/createConfirmModal, hidden+flex toggle fixed, dead files removed (CompleteItinerary.astro, FormTemplates.astro). Design decision: pickup/dropoff included in itinerary timeline; only destination excluded.*
*Updated: Mapbox Search Box (suggest+retrieve) integrated into inline add/edit stop forms (US18); DaySection type mismatch fixed (CompleteStop → ItineraryStop). New requirements added: US18a (pickup/dropoff in Add Stop, max 3 each per trip), US18b (time overlap validation within a day).*
*Updated: US18a — MAX_PICKUP/MAX_DROPOFF raised to 20 (was 3). US18b — `validateTimeOverlap()` checks full interval overlap or exact start-time collision; new stop form now defaults to after last stop + 15 min instead of current clock time.*
*Updated: "Joined" tab consolidated — new `get_user_participating_trips` RPC (028) returns joined + pending + invited in one call with `participation_status` field; "Invited" tab removed; TripCard extended with `participation_status` badge. Invitation banner on trip detail page shows Accept/Decline for invited users and hides Request to Join button.*
*Updated: Member section and itinerary gated by role. `currentPax` now counts only `joined` members. `Member.astro` hidden from non-members. Itinerary defaults to members-only; owner can expose it via `🔒/🌐` toggle in `ItineraryHeader` (`trip_visibility.itinerary_public`, migration 029, `updateItineraryPublic` action). Avatar rendering in `renderers.ts` fixed to show `<img>` when URL present, initials fallback otherwise.*
*Updated (session 3): Discover tab fixed — `get_discover_trips` rebuilt (031) with `owner_name`/`owner_avatar`, no 30-day cap, caller's own trips excluded; `SMALLINT`→`INTEGER` cast fix (032). `get_user_owned_trips` visibility fix (030). `TripCard` avatar URL handling unified for both R2 paths and full OAuth URLs.*
*Updated (session 4): SR-AUTHZ-001 compliance — deleted 5 legacy `/api/trips/*` REST routes (IDOR risk). Created `update_trip_dates`, `update_trip_preferences`, `update_trip_budget`, `update_trip_description` RPCs with server-side ownership checks (033). Added visibility gate to `get_trip_full_details`: visitors on private trips receive NULL → page redirects /404 (034).*
*Updated (session 5): Notification system fully implemented for trip events. Built `NotificationBell.astro` (30s polling, dropdown, inline action buttons), `/notifications` page (filter tabs, load-more, same actions). Fixed notification triggers in `trips.ts`: `getInternalUserId` helper extracted; `sendNotification` helper added with full logging; `trip_join_request` payload includes `member_id`; `trip_invite` payload includes `invitation_id`; `approveJoinRequest`/`rejectJoinRequest`/`removeTripMember` now resolve auth_id → internal user_id before calling `sendNotification` (fixed FK constraint error code 23503). Fixed invitee lookup bug: `.select('id')` → `.select('user_id')` (code 42703). Removed duplicate username from all message strings (UI prepends username via `notification.data.username`). US34, US35, US35b–d now ✅ Pass.*
