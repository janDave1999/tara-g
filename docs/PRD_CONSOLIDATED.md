# Product Requirements Document (PRD) — Tara G!

> **Version:** 2.0 (Consolidated)  
> **Date:** March 2026  
> **Status:** Active Development  

---

## 1. Executive Summary

### 1.1 Problem Statement

Filipino travelers struggle to coordinate group trips effectively—managing itineraries, splitting expenses, tracking province visits, and finding trips to join within the Philippines is fragmented across multiple tools and platforms.

### 1.2 Proposed Solution

**Tara G!** (Let's Go!) is a collaborative travel management web app that helps Filipino travelers plan, organize, and share their trips. Users can create detailed itineraries with map integration, track expenses and shared budgets, upload trip media, discover and join group trips, and track their progress across all 82 Philippine provinces (Project 82).

### 1.3 Success Criteria

| KPI | Target |
|-----|--------|
| Monthly Active Users (MAU) | TBD |
| Trips Created per Month | TBD |
| Average Trip Size | 4-6 members |
| Onboarding Completion Rate | > 70% |
| Trip Completion Rate | > 60% |
| Page Load Time | < 3 seconds |
| Error Rate | < 1% |

---

## 2. User Experience & Functionality

### 2.1 User Personas

| Persona | Description |
|---------|-------------|
| **Primary** | Filipino travelers aged 18-45 who enjoy group travel |
| **Secondary** | Travel groups, barkadas, and families planning trips within the Philippines |
| **Tertiary** | Solo travelers looking to join group trips |

### 2.2 User Stories

#### User Accounts (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US1 | As a visitor, I want to register with email/password | Email/password registration with confirmation |
| US2 | As a user, I want to complete onboarding | 3-step wizard: Profile → Interests → Preferences |
| US3 | As a user, I want to view my profile | Profile page with personal info |
| US4 | As a user, I want to view public profiles | Privacy-aware public profile viewing |

#### Trip Management (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US5 | As a user, I want to create a trip with a wizard | 5-step form: Schedule → Details → Budget → Logistics → Confirm |
| US6 | As a user, I want to set trip destination with map | Mapbox location search with coordinates |
| US7 | As a user, I want to set pickup and dropoff points | Separate location fields with map picker |
| US8 | As a user, I want to set trip dates with validation | Start date ≥ today, end ≥ start |
| US9 | As a user, I want to set max participants and preferences | Gender preference, capacity limits |
| US10 | As a user, I want to set estimated budget | Budget input with per-person calculation |
| US11 | As a user, I want to control trip visibility | Private/Friends/Public toggle |
| US12 | As a user, I want to change trip status | Draft → Active → Completed/Archived/Cancelled |
| US13 | As a user, I want to share a trip link | Web Share API + clipboard copy |

#### Trip Discovery (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US14 | As a user, I want to browse public trips | Feed with pagination |
| US15 | As a user, I want to search by destination | Location/province search |
| US16 | As a user, I want to filter by tags | Multi-filter support |
| US17 | As a user, I want personalized recommendations | Discover tab filters by travel preferences |
| US18 | As a user, I want to see trip organizer details | Avatar, name, location, completed trips count |

#### Trip Participation (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US19 | As a user, I want to request to join a trip | Join button with pending status |
| US20 | As an owner, I want to approve/reject requests | Owner sees requests, can approve/reject |
| US21 | As a user, I want to accept/decline invitations | Invitation banner with Accept/Decline |
| US22 | As a member, I want to leave a trip | Leave button for non-owners |
| US23 | As an owner, I want to remove members | Remove members from trip |

#### Itinerary Builder (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US24 | As an owner, I want to add stops | Add stops with Mapbox location search |
| US25 | As an owner, I want to add pickup/dropoff stops | Max 20 each, separate from destination |
| US26 | As an owner, I want to add activities to stops | Activity type and description |
| US27 | As an owner, I want time overlap validation | Block save if times overlap within a day |
| US28 | As an owner, I want to control itinerary visibility | Members-only/Public toggle |
| US29 | As a member, I want to view the itinerary | Read-only access for members |

#### Maps Integration (P0)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US30 | As a user, I want to browse trips on a map | Interactive Mapbox map |
| US31 | As a user, I want to filter by province | Province search filter |
| US32 | As a user, I want to see trip markers with clustering | Map markers with popups |

#### Project 82 (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US33 | As a user, I want to track provinces visited | Interactive province map with progress |
| US34 | As a user, I want to log visits manually | Manual visit logging |
| US35 | As a system, I want to auto-detect from completed trips | Auto-update from trip data |

#### Notifications (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US36 | As a user, I want in-app notifications | Notification bell with dropdown |
| US37 | As a user, I want email notifications | Action notifications via email (Phase 2) |

#### Expense Tracking (P1)

| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US38 | As an owner, I want to track expenses | Add expenses with categories |
| US39 | As a user, I want to see cost breakdown | Automatic split per person |
| US40 | As a user, I want to settle expenses | Settlement tracking |

### 2.3 Non-Goals (v1)

The following are explicitly deferred to future versions:

- **Messaging** — In-app chat between users
- **Reviews/Ratings** — Trip and user reviews
- **Offline Maps** — Downloadable Mapbox areas
- **Emergency Features** — LGU contacts, weather alerts
- **Boat/Ferry Tracking** — Schedule integration
- **Trip Templates** — Reusable trip configurations
- **Packing Lists** — Shared checklists
- **Calendar Sync** — Export to Google/Apple Calendar
- **Social Login** — Google/Facebook (configured but not tested in MVP)
- **Profile Editing** — Edit profile, completion UI

---

## 3. Technical Specifications

### 3.1 Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Astro 5.0 |
| Backend | Cloudflare Workers |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Maps | Mapbox GL JS |
| Storage | Cloudflare R2 |
| Spatial | PostGIS |

### 3.2 Architecture Overview

All data access uses **Astro Actions** with **Security DEFINER RPCs**:

```
Frontend → Astro Actions → SECURITY DEFINER RPCs → Database
                                    ↓
                            context.locals.user_id
                            (from verified JWT)
```

### 3.3 Database Schema

#### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Core user profile |
| `user_information` | Extended profile (DOB, phone) |
| `user_travel_preferences` | Budget, style, pace preferences |
| `user_interests` | Interest categories |
| `user_settings` | App preferences |

#### Trip Tables

| Table | Purpose |
|-------|---------|
| `trips` | Trip entity |
| `trip_details` | Dates, budget, tags |
| `trip_visibility` | Privacy settings |
| `trip_members` | Participants |
| `trip_invitations` | Invitations |
| `trip_location` | Itinerary stops |
| `locations` | Reusable location data |
| `stop_activities` | Activities within stops |

#### Enums

| Enum | Values |
|------|--------|
| `trip_status` | draft, active, completed, archived, cancelled |
| `visibility_type` | private, public, friends |
| `location_type_enum` | destination, activity, meal_break, rest_stop, accommodation, checkpoint, pickup, dropoff, boat, ferry |
| `user_role` | owner, admin, member |
| `member_status` | joined, pending, left, removed, invited |

### 3.4 Key API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/register` | POST | User registration |
| `/api/auth/signin` | POST | User login |
| Actions: `trips.create` | - | Create trip |
| Actions: `trips.update` | - | Update trip |
| RPC: `get_trip_full_details` | - | Fetch complete trip |
| RPC: `get_discover_trips` | - | Trip discovery |
| RPC: `get_user_owned_trips` | - | User's trips |
| RPC: `get_user_participating_trips` | - | Joined/pending/invited trips |

### 3.5 Pages Required

```
/                     → Landing page
/register             → Sign up
/signin               → Sign in
/forgot-password      → Reset request
/reset-password       → New password
/onboarding/profile   → Step 1
/onboarding/interests → Step 2
/onboarding/preferences → Step 3
/profile              → Own profile
/profile/[username]   → Public profile
/trips                → Trip listing
/trips/create          → Create wizard
/trips/[trip_id]      → Trip detail
/maps                 → Map discovery
```

### 3.6 Security Requirements

- JWT-based session management with httpOnly, secure, sameSite: strict cookies
- All database operations via SECURITY DEFINER RPCs
- User ID extracted from JWT, never from client input
- Rate limiting on login attempts
- Email confirmation required
- Input validation via Zod schemas

---

## 4. Feature Dependencies

```
USER ACCOUNTS (P0)
    │
    ├──► ONBOARDING (P0)
    │       │
    │       └──► PROFILE (P1)
    │               │
    │               └──► FRIENDS (P1)
    │
    └──► TRIPS (P0)
            │
            ├──► TRIP DISCOVERY (P0)
            │       │
            │       └──► MAPS (P0)
            │
            ├──► ITINERARY (P0)
            │
            ├──► MEMBERSHIP (P0)
            │
            ├──► EXPENSES (P1)
            │
            └──► PROJECT 82 (P1)
                    │
                    └──► NOTIFICATIONS (P1)
```

---

## 5. MVP Scope (Beta Release)

### Included Features

| Feature | Priority | Status |
|---------|----------|--------|
| Email/password registration | P0 | ✅ Included |
| Email confirmation with auto sign-in | P0 | ✅ Included |
| 3-step onboarding | P0 | ✅ Included |
| Profile viewing | P0 | ✅ Included |
| Trip creation wizard (5 steps) | P0 | ✅ Included |
| Trip detail page | P0 | ✅ Included |
| Trip visibility controls | P0 | ✅ Included |
| Trip status management | P0 | ✅ Included |
| Trip sharing | P0 | ✅ Included |
| Trip listing (Owned/Joined/Discover) | P0 | ✅ Included |
| Search by destination | P0 | ✅ Included |
| Filter by tags | P0 | ✅ Included |
| Request to join | P0 | ✅ Included |
| Accept/decline requests | P0 | ✅ Included |
| Accept/decline invitations | P0 | ✅ Included |
| Member list management | P0 | ✅ Included |
| Leave/remove members | P0 | ✅ Included |
| View/Add/Edit/Delete stops | P0 | ✅ Included |
| Add activities to stops | P0 | ✅ Included |
| Time overlap validation | P0 | ✅ Included |
| Itinerary visibility toggle | P0 | ✅ Included |
| Interactive Mapbox map | P0 | ✅ Included |
| Province search filter | P0 | ✅ Included |
| Trip markers with clustering | P0 | ✅ Included |

### Excluded from MVP

| Feature | Priority | Reason |
|---------|----------|--------|
| Social Login (Google/Facebook) | P1 | Configured but not tested |
| Profile Editing | P1 | Add after core is stable |
| Friend System | P1 | Core trips work without |
| Email Notifications | P1 | In-app notifications sufficient |
| Push Notifications | P2 | Phase 2 |
| Expense Tracking | P1 | Add after core is stable |
| Project 82 | P1 | Can be added later |
| Offline Mode | P2 | PH-specific, lower priority |
| Emergency Contacts | P2 | Requires data sourcing |
| Weather Alerts | P2 | Requires API integration |

---

## 6. Phased Rollout

### Phase 1: MVP (Q1 2026)

- Core user registration and onboarding
- Trip creation and management
- Trip discovery and membership
- Itinerary builder
- Maps integration

### Phase 2: Engagement (Q2 2026)

- Project 82 — Province tracking
- Push Notifications
- Email Notifications
- Profile Enhancement
- Friend System

### Phase 3: Financials (Q3 2026)

- Expense Tracking
- Trip Templates
- Offline Mode

### Phase 4: Safety (Q4 2026)

- Emergency Features
- Weather Alerts
- Messaging

---

## 7. Risks & Technical Risks

| Risk | Mitigation |
|------|------------|
| Mapbox API rate limits | Implement caching, limit requests |
| Image storage costs | Use Cloudflare R2 with lifecycle policies |
| Database performance | PostGIS indexes, query optimization |
| Offline functionality | Progressive Web App (PWA) |
| Email delivery | Use reliable email service (Resend) |

---

## 8. Related Documentation

| Document | Location |
|----------|----------|
| Database Schema | `docs/schema.md` |
| MVP Specification | `docs/MVP_SPEC.md` |
| Trip Feature Spec | `docs/features/TRIP_FEATURE_SPEC.md` |
| User Feature Spec | `docs/features/USER_FEATURE_SPEC.md` |
| Maps Feature Spec | `docs/features/MAPS_FEATURE_SPEC.md` |
| Itinerary Plan | `docs/features/ITINERARY_PLAN.md` |
| Itinerary Design | `docs/features/ITINERARY_DESIGN.md` |
| Project 82 Spec | `docs/features/PROJECT_82_SPEC.md` |
| UI Brand Guidelines | `UI_BRAND_GUIDELINES.md` |
| Security Requirements | `SECURITY_REQUIREMENTS.md` |
| Testing Strategy | `TESTING_STRATEGY.md` |

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 2026 | Initial PRD |
| 2.0 | March 2026 | Consolidated from all .md docs |

---

*Last updated: March 2026*
