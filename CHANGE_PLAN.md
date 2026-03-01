# Tara G! — Change Plan

> Track progress here. Strike out items as they are completed using `~~text~~`.
> Updated as we go — one item at a time.
> 
> **Trip Feature Spec:** See `TRIP_FEATURE_SPEC.md` for detailed requirements

---

## REVISE

### Critical (Security / Correctness)

- [x] ~~Remove `console.log` statements in `src/pages/api/auth/signin.ts` and `src/pages/api/auth/register.ts`~~
- [x] ~~Move `SALT` out of public env vars — it must not be exposed to the client~~
- [x] ~~Verify auth cookies have `secure` and `sameSite` flags properly set in `src/middleware/index.ts`~~
- [x] ~~Fix i18n language mismatch — config uses `(en, ph)` but translation files use `(en, th)` in `src/i18n/lang.ts` and `src/i18n/translation/mainTranslation.ts`~~
- [x] ~~Fix inconsistent API error response formats across `src/pages/api/trips/*`~~

### Code Health

- [x] ~~Clean up duplicate and conflicting type definitions in `src/types/trip.ts`~~
- [x] ~~Extract token refresh logic into a reusable utility function from `src/middleware/index.ts`~~
- [x] ~~Fix incomplete migration script — references non-existent RPC functions in `scripts/migrate.js`~~
- [x] ~~Consolidate multiple redundant SEO head-tag components in `src/seo/component/`~~
- [x] ~~Expand translation keys in `src/i18n/translation/mainTranslation.ts` — currently only 1 key (`home.title`) is defined~~

---

## REMOVE

- [x] ~~Remove commented-out dead code blocks in `src/types/trip.ts`~~
- [x] ~~Remove the inactive CMS client(s) — deleted Strapi (`src/lib/strapi_client.js`, `src/lib/strapi.ts`); Cosmic is the active CMS~~
- [x] ~~Remove unused imports across source files (audit pass)~~
- [x] ~~Remove stale `_readme.md` files that duplicate documented info elsewhere~~

---

## ADD

### Critical

- [x] ~~Add rate limiting on auth endpoints (`src/pages/api/auth/signin.ts`, `src/pages/api/auth/register.ts`)~~
- [ ] Add a proper logging utility to replace all `console.log` calls (e.g. structured logger scoped to server-side only)
- [ ] Add input validation on API routes that are missing request body checks
- [ ] Add a global error boundary / fallback UI component for unhandled Astro page errors

### Code Health

- [x] ~~Rename `src/scripts/LaodingSpinner.ts` → `LoadingSpinner.ts` and update all imports~~
- [ ] Add database schema documentation (ERD or Supabase schema export) to the repo
- [ ] Add API route documentation for all `src/pages/api/*` endpoints
- [ ] Add inline comments for complex logic — onboarding middleware flow, token refresh, RPC calls
- [ ] Add CI/CD step to run `vitest` on every push (GitHub Actions or Cloudflare Pages build hook)
- [ ] Expand test coverage — add component tests and API route tests for critical paths

### Features (Current)

#### Project 82 — Province Tracking

**Phase 1: Core Infrastructure**
- [x] ~~Create database migration (`database-migrations/024_project82_tables.sql`) — user_province_visits table~~
- [ ] Load province geojson data into province_boundaries table (deferred — using local /geojson/ files)
- [ ] Add province_key field to trips table
- [x] ~~Create API: GET /api/project82 (fetch user visits)~~
- [x] ~~Create API: POST /api/project82 (add/update visit)~~
- [x] ~~Create API: DELETE /api/project82/[province_key] (remove visit)~~
- [x] ~~Create frontend: /project82 page with choropleth map, stage selection modal, progress bar~~

**Phase 2: Auto-Detection**
- [ ] Create API: POST /api/project82/sync (auto-detect from completed trips)
- [ ] Implement PostGIS spatial query for point-in-polygon province detection
- [ ] Implement auto-stage calculation based on trip duration
- [ ] Add sync button + status indicator on frontend

**Phase 3: Privacy & Profile**
- [ ] Add privacy check in API (respects is_profile_public)
- [ ] Create public profile page: /project82/[username]
- [ ] Create Profile badge component showing progress

**Phase 4: Trip Integration**
- [ ] Add trigger to auto-sync when trip status changes to "completed"
- [ ] Link visits to source trips (trip_id foreign key)
- [ ] Show trip info in visit details

**Phase 5: Polish**
- [ ] Add notes field for visits
- [ ] Create shareable public link
- [ ] Add list view toggle
- [ ] Add achievements/badges UI

---

#### Trip — Core Platform

**Phase 1: Core Stability & Discovery (P0)**
- [x] ~~Create database migration for preferences_prompt_until (`database-migrations/009_add_preferences_prompt.sql`)~~
- [x] ~~Create get_discover_trips RPC function (`database-migrations/010_create_discover_trips_function.sql`)~~
- [x] ~~Rename "Recent" tab to "Discover" in /trips page~~
- [x] ~~Implement preference-based filtering for Discover tab (budget, style, pace)~~
- [x] ~~Add toggleable preference filters in Discover tab~~
- [x] ~~Create PreferencesPrompt modal component~~
- [x] ~~Add user settings and travel preferences actions (settings.update, travelPreferences.update)~~
- [x] ~~Complete trip search and filtering — Discover tab with province/region destination dropdown (all 82 PH provinces), budget filter, multi-select tag pills (migrations 044 & 045), select-then-apply pattern~~
- [ ] Fix bugs in trip creation flow
- [ ] Verify trip status transitions work correctly
- [ ] Verify member management (join/leave/remove)
- [ ] Add organizer information section to trip detail page

**Phase 2: Itinerary Enhancement (P1)**
- [ ] Full drag-drop itinerary builder component
- [ ] Activity management per stop
- [ ] Actual vs scheduled time tracking
- [ ] Itinerary export/sharing

**Phase 3: Expense System (P1)**
- [ ] Complete expense tracking UI
- [ ] Cost splitting calculations and visualization
- [ ] Settlement tracking between members
- [ ] Export expense reports

**Phase 4: Notifications & Social (P1)**
- [x] ~~In-app notification bell with badge, dropdown, mark-as-read~~
- [x] ~~/notifications page — full notification center with filter tabs (All/Unread/Trip Invites/Join Requests), pagination, mark-all-read~~
- [x] ~~Inline action buttons for trip_invite (Accept/Decline) and trip_join_request (Approve/Reject) in bell dropdown and notifications page~~
- [x] ~~Real-time badge polling (30s interval, paused when tab hidden, resumes on visibility)~~
- [x] ~~Fixed missing public.users row bug that broke notification lookup (PGRST116)~~
- [ ] Email notification system for trip updates
- [ ] Push notifications
- [ ] Trip sharing to social media
- [ ] Social feed integration

**Phase 5: Advanced Features (P2)**
- [ ] Trip templates (reusable trip configs)
- [ ] Weather integration for destinations
- [ ] Trip packing list
- [ ] Analytics dashboard

---

### Features (Future)

- [ ] Add real-time collaboration using Supabase Realtime (live trip editing for group members)
- [ ] Add PDF export for itineraries
- [ ] Add trip chat / discussion board per trip
- [ ] Add analytics dashboard for trip insights (member activity, spending trends)

---

## Legend

| Status | Marker |
|--------|--------|
| Not started | `- [ ]` |
| Done | `- [x] ~~item~~` |
