# Project 82 — Feature Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

**Project 82** is a travel tracking feature that allows users to track which of the Philippines' 82 provinces they've visited. It includes an interactive map visualization, progress tracking, and automatic detection from completed trips.

**Target Users:** Filipino travelers who want to explore and document their journey across all 82 provinces.

---

### Problem Statement

Filipino travelers currently have no simple way to track which provinces they've visited. They use scattered methods—photos, notes in phone apps, or just memory—which makes it hard to:
- Know which provinces they've covered vs. remaining
- Show their travel achievements to others
- Automatically capture province visits from trip data

This feature consolidates province tracking into the existing Tara G! platform, leveraging completed trips to reduce manual data entry.

---

## 1. User Stories

### 1.1 Core Tracking (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US1 | As a user, I want to see an interactive map of the Philippines with all 82 provinces | 
- [ ] Map displays all 82 provinces as clickable polygons
- [ ] Each province polygon is individually selectable (hover highlight + click response)
- [ ] Map renders within 3 seconds on 3G connection
- [ ] Map is centered on Philippines bounds on initial load |
| US2 | As a user, I want provinces I've visited to be colored differently based on my visit type | Colors: 🔵 Pass through, 🟡 Short stay, 🟠 Extended stay, 🔴 Thorough exploration |
| US3 | As a user, I want to see my progress as "X/82 provinces visited" | Progress bar shows exact count and percentage |
| US4 | As a user, I want to manually add a province visit with a stage | Click province → modal → select stage → save |
| US5 | As a user, I want to edit or delete my recorded visits | Can modify stage, notes, visit date; can delete entry |
| US6 | As a user, I want the system to automatically detect provinces from my completed trips | 
- [ ] "Sync" button triggers scan of all trips where status = 'completed'
- [ ] Each trip's location coordinates are checked against province boundaries via PostGIS
- [ ] Detected provinces appear in user's visit list with is_auto_detected = TRUE
- [ ] Manual entries are preserved (auto-detect skipped if manual entry exists)
- [ ] Sync completes within 10 seconds for 100 trips |

### 1.2 Privacy Controls (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US7 | As a user, I want my Project 82 progress to be private by default | Default: not visible to other users |
| US8 | As a user, I want to toggle my Project 82 visibility in my profile settings | Toggle switch tied to existing `is_profile_public` setting |
| US9 | As a user, I want to view another user's progress if they have it set to public | Can view `/project82/[username]` if their profile is public |

### 1.3 Integration with Trips (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US10 | As a user, when I mark a trip as "completed", the system should auto-sync provinces | Background job or trigger runs after trip status changes to 'completed' |
| US11 | As a user, I want to see which trip I visited a province from | Visit record shows linked `trip_id`; clickable to view trip |
| US12 | As a user, I want to manually override an auto-detected stage | Can change stage freely after sync |

### 1.4 Profile & Social (P2)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US13 | As a user, I want a badge on my profile showing my progress | e.g., "15/82 provinces" with progress ring |
| US14 | As a user, I want to share my Project 82 map as a public URL | Unique public link like `/project82/[username]` |
| US15 | As a user, I want to add notes about my visit to each province | Free-text notes field in visit record |

---

## 2. Technical Design

### 2.1 Database Schema

```sql
-- =====================================================
-- PROJECT 82 TABLES
-- =====================================================

-- Stage enum
CREATE TYPE visit_stage AS ENUM (
    'pass_through',      -- 0-1 day (transit only)
    'short_stay',        -- ~1 day
    'extended_stay',     -- 2-3 days
    'thorough_exploration'  -- 4+ days / multiple visits
);

-- User province visits
CREATE TABLE user_province_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    province_key TEXT NOT NULL,  -- e.g., "ILO", "CEB", "MVN"
    stage visit_stage NOT NULL,
    visit_date DATE,
    trip_id UUID REFERENCES trips(trip_id) ON DELETE SET NULL,
    notes TEXT,
    is_auto_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, province_key)
);

-- Province boundaries (for spatial queries)
CREATE TABLE province_boundaries (
    province_key TEXT PRIMARY KEY,
    province_name TEXT NOT NULL,
    region TEXT NOT NULL,
    geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);

-- Index for spatial queries
CREATE INDEX idx_province_geometry ON province_boundaries USING GIST(geometry);
CREATE INDEX idx_user_visits_user ON user_province_visits(user_id);

-- Add province_key to trips table for faster lookups
ALTER TABLE trips ADD COLUMN IF NOT EXISTS province_key TEXT;
```

### 2.2 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/project82` | Get current user's visits | Required |
| GET | `/api/project82?user_id={id}` | Get another user's visits (respects privacy) | Optional |
| POST | `/api/project82` | Manually add/update a visit | Required |
| DELETE | `/api/project82/[province_key]` | Remove a visit | Required |
| POST | `/api/project82/sync` | Auto-sync from completed trips | Required |
| GET | `/api/project82/provinces` | Get all 82 provinces with metadata | Public |

### 2.3 Auto-Detection Logic

```
1. Get all completed trips where user is owner or member
2. For each trip:
   a. Get trip location coordinates from trip_location + locations tables
   b. Use PostGIS ST_Contains to find which provinces contain these points
   c. Get trip duration from trip_details (end_date - start_date)
   d. Map duration to stage:
      - 0-1 days  → pass_through
      - 1 day     → short_stay
      - 2-3 days  → extended_stay
      - 4+ days   → thorough_exploration
   e. Insert/Update user_province_visits with is_auto_detected = TRUE
   f. If user already has a manual entry for same province, skip (preserve manual)
```

### 2.4 Privacy Logic

```
GET /api/project82?user_id={target_user_id}
  → Get target user's profile
  → If target_user.is_profile_public == false:
      → If requester != target_user → Return 403
  → Return visits data
```

---

## 3. Frontend Components

### 3.1 Pages

| Page | Route | Description |
|------|-------|-------------|
| Project 82 Dashboard | `/project82` | Main map + progress view |
| Public Profile View | `/project82/[username]` | Public view of user's progress |
| Sync Modal | (component) | Trigger manual sync |

### 3.2 Components

| Component | Description |
|-----------|-------------|
| `ProvinceMap.astro` | Choropleth map using MapBox + geojson |
| `ProvinceLayer.astro` | Province polygons with stage-based coloring |
| `ProgressBar.astro` | X/82 progress indicator |
| `VisitModal.astro` | Add/edit province visit form |
| `VisitList.astro` | List view of all visited provinces |
| `SyncStatus.astro` | Shows last sync time + manual sync button |
| `PrivacyToggle.astro` | Toggle visibility in settings |

---

## 4. Stage Color Mapping

| Stage | Color | Hex | Description |
|-------|-------|-----|-------------|
| Not visited | Gray | `#E5E7EB` | Default state |
| Pass through | Blue | `#3B82F6` | Transit only, less than a day |
| Short stay | Yellow | `#FBBF24` | ~1 day |
| Extended stay | Orange | `#F97316` | 2-3 days |
| Thorough exploration | Red | `#EF4444` | 4+ days or multiple visits |

---

## 5. Implementation Phases

### Phase 1: Core Infrastructure (P0)
- [ ] Database migration (user_province_visits, province_boundaries)
- [ ] Load province geojson into province_boundaries table
- [ ] API: GET /api/project82
- [ ] API: POST /api/project82
- [ ] API: DELETE /api/project82/[province_key]
- [ ] Frontend: /project82 page with basic map

### Phase 2: Auto-Detection (P0)
- [ ] API: POST /api/project82/sync
- [ ] PostGIS spatial query for point-in-polygon
- [ ] Auto-stage calculation from trip dates
- [ ] Frontend: Sync button + status indicator

### Phase 3: Privacy & Profile (P0)
- [ ] Privacy check in API (respects is_profile_public)
- [ ] Public profile page /project82/[username]
- [ ] Profile badge component

### Phase 4: Trip Integration (P1)
- [ ] Trigger auto-sync when trip status → completed
- [ ] Link visits to source trips
- [ ] Show trip info in visit details

### Phase 5: Polish (P2)
- [ ] Notes field for visits
- [ ] Shareable public link
- [ ] List view toggle
- [ ] Achievements/badges UI

---

## 6. File Changes Checklist

| File Path | Change Type | Phase |
|-----------|-------------|-------|
| `database-migrations/XXX_project82.sql` | New | 1 |
| `src/pages/api/project82/index.ts` | New | 1 |
| `src/pages/api/project82/sync.ts` | New | 2 |
| `src/pages/project82.astro` | New | 1 |
| `src/pages/project82/[username].astro` | New | 3 |
| `src/components/Project82/ProvinceMap.astro` | New | 1 |
| `src/components/Project82/VisitModal.astro` | New | 1 |
| `src/components/Project82/ProgressBar.astro` | New | 1 |
| `src/components/Project82/SyncStatus.astro` | New | 2 |
| `src/components/Project82/ProvinceBadge.astro` | New | 3 |
| `src/lib/project82.ts` | New | 1-2 |
| `src/data/phProvinces.ts` | Modify (add key mapping) | 1 |

---

## 7. Notes

- Uses existing PostGIS extension (already enabled in DB)
- Privacy tied to existing `user_profiles.is_profile_public` field
- Province geojson files exist in `/public/geojson/`
- MapBox already integrated (reuse MapBox.astro patterns)
- PH_PROVINCES data already exists in `src/data/phProvinces.ts`

---

## 8. Technical Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Province detection: Database (PostGIS) vs JavaScript? | **PostGIS** - More efficient, scalable, proper indexing |
| Q2 | Sync trigger: Manual button, automatic on trip complete, or both? | **Both** - User can manually check; auto-sync runs on trip completion |
| Q3 | Can users override auto-detected stage? | **Yes** - Manual edits always take precedence |

---

## 9. Constraints & Assumptions

### Constraints (Confirmed)
- PostGIS extension enabled in Supabase
- MapBox already integrated in existing codebase
- Province geojson files available at `/public/geojson/`
- PH_PROVINCES data structure exists in `src/data/phProvinces.ts`

### Assumptions (Unvalidated)
- [ ] Province boundaries in geojson are accurate and complete
- [ ] User trips have location data (coordinates) populated
- [ ] Trip completion status is reliably set by users
- [ ] 82 provinces is the correct count (no new provinces created)

### Time Estimate
- Phase 1: ~4 hours
- Phase 2: ~3 hours  
- Phase 3: ~2 hours
- **Total V1: ~9 hours**

---

## 10. V1 Minimum Viable Scope

### MUST Have (Launch Blockers)
1. Database tables created and accessible
2. Map displays all 82 provinces
3. User can manually add a province visit
4. User can view their own progress (X/82)
5. Privacy controls work (defaults to private)

### SHOULD Have (Launch Quality)
1. Auto-sync from completed trips
2. Edit/delete visits
3. Stage-based coloring on map
4. Progress bar shows percentage

### COULD Have (Post-Launch)
1. Public profile page
2. Trip linkage in visits
3. Notes field

### WON'T Have (Explicitly Deferred)
1. Achievements/badges UI
2. Shareable public link
3. List view toggle

---

*Last updated: 2026-02-21*
