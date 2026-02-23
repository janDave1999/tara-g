# Product Requirements Document (PRD) — Tara G!

> **Version:** 1.0  
> **Date:** February 2026  
> **Status:** Active Development  

---

## 1. Product Overview

### 1.1 Vision

**Tara G!** (Let's Go!) is a group travel planning platform designed specifically for Filipino travelers. It enables users to create, discover, and join group trips within the Philippines, with features that address local needs like province tracking (Project 82), offline itinerary access, and emergency information.

### 1.2 Target Audience

- **Primary:** Filipino travelers aged 18-45 who enjoy group travel
- **Secondary:** Travel groups, barkadas, and families planning trips within the Philippines
- **Tertiary:** Solo travelers looking to join group trips

### 1.3 Core Value Proposition

| Value | Description |
|-------|-------------|
| **Discover** | Find trips matching your interests and budget |
| **Plan** | Create detailed itineraries with map integration |
| **Track** | Monitor your travel progress across all 82 provinces |
| **Connect** | Join trips, make friends, share experiences |

---

## 2. Feature Overview

### 2.1 Feature Matrix

| Feature | Category | Priority | Status |
|---------|----------|----------|--------|
| **User Accounts** | Core | P0 | ✅ In Progress |
| **Trip Management** | Core | P0 | ✅ In Progress |
| **Itinerary Builder** | Core | P0 | ✅ In Progress |
| **Trip Discovery** | Core | P0 | ✅ In Progress |
| **Maps Integration** | Discovery | P0 | ✅ In Progress |
| **Project 82** | Engagement | P1 | 🔲 Not Started |
| **Social Features** | Engagement | P1 | 🔲 Not Started |
| **Email Notifications** | Engagement | P1 | 🔲 Not Started |
| **Expense Tracking** | Core | P1 | 🔲 Not Started |
| **Offline Mode** | PH-Specific | P2 | 🔲 Not Started |

### 2.2 Feature Descriptions

#### 2.2.1 User Accounts (P0)

Complete user management system including registration, onboarding, and profile management.

**Components:**
- Email/password registration with confirmation
- Social login (Google, Facebook)
- 3-step onboarding wizard (Profile → Interests → Preferences)
- Profile viewing (own and public)
- Profile editing (name, bio, avatar, location)
- Friend system (send requests, accept/decline, unfriend)
- Block system

**Key Files:**
- `src/pages/register.astro`, `src/pages/signin.astro`
- `src/pages/onboarding/profile.astro`, `interests.astro`, `preferences.astro`
- `src/pages/profile/index.astro`, `[username].astro`

#### 2.2.2 Trip Management (P0)

Create, manage, and participate in group trips.

**Components:**
- Multi-step trip creation wizard (5 steps)
- Trip detail page with all information
- Trip visibility controls (private/public/friends)
- Trip status management (draft/active/completed/archived/cancelled)
- Member management (join requests, invitations, roles)
- Trip sharing

**Key Files:**
- `src/pages/trips/create.astro`
- `src/pages/trips/[trip_id]/index.astro`

#### 2.2.3 Itinerary Builder (P0)

Build detailed day-by-day trip itineraries with stops and activities.

**Components:**
- Day-by-day itinerary view
- Add/edit/delete stops (destination, pickup, dropoff, activities)
- Activity management within stops
- Time overlap validation
- Itinerary visibility toggle (members-only/public)

**Key Files:**
- `src/components/Trip/Itinerary/Itinerary2.astro`
- `src/components/Trip/Itinerary/DaySection.astro`

#### 2.2.4 Trip Discovery (P0)

Browse and find trips to join.

**Components:**
- Trip listing page with tabs (Owned, Joined, Discover)
- Search by destination
- Filter by date, budget, tags
- Personalized recommendations
- Travel preferences matching

**Key Files:**
- `src/pages/trips/index.astro`

#### 2.2.5 Maps Integration (P0)

Geographic trip discovery via interactive map.

**Components:**
- Interactive Mapbox map
- Province search filter
- Trip markers with clustering
- Trip detail popups
- "Search this area" functionality

**Key Files:**
- `src/components/MapBox.astro`

#### 2.2.6 Project 82 (P1)

Track visits across all 82 Philippine provinces.

**Components:**
- Interactive province map with choropleth coloring
- Progress tracking (X/82 provinces)
- Manual visit logging
- Auto-detection from completed trips
- Privacy controls

**Key Files:**
- Not yet implemented

#### 2.2.7 Social Features (P1)

Friend connections and social interactions.

**Components:**
- Friend requests (send/accept/decline)
- Friends list
- Unfriend functionality
- Block/unblock users

#### 2.2.8 Email Notifications (P1)

Notification system for user actions.

**Components:**
- Trip join request notifications
- Trip approval/rejection notifications
- Trip update notifications
- Friend request notifications

#### 2.2.9 Expense Tracking (P1)

Track and split trip expenses.

**Components:**
- Add expenses with categories
- Cost breakdown per person
- Settlement tracking
- Cost sharing methods

---

## 3. Technical Architecture

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

### 3.2 Database Schema Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CORE TABLES                          │
├─────────────────────────────────────────────────────────────┤
│ users                    │ Core user profile               │
│ user_information        │ Extended profile (DOB, phone)   │
│ user_travel_preferences │ Budget, style, pace preferences │
│ user_interests          │ Interest categories             │
│ user_settings           │ App preferences                 │
├─────────────────────────────────────────────────────────────┤
│                         TRIP TABLES                         │
├─────────────────────────────────────────────────────────────┤
│ trips                   │ Trip entity                     │
│ trip_details            │ Dates, budget, tags             │
│ trip_visibility         │ Privacy settings                │
│ trip_members           │ Participants                    │
│ trip_invitations       │ Invitations                     │
│ trip_location          │ Itinerary stops                 │
│ locations              │ Reusable location data          │
│ stop_activities        │ Activities within stops         │
├─────────────────────────────────────────────────────────────┤
│                      SOCIAL TABLES                          │
├─────────────────────────────────────────────────────────────┤
│ friends                 │ Friendship pairs                 │
│ friend_requests        │ Pending requests                │
│ blocks                 │ Blocked users                   │
├─────────────────────────────────────────────────────────────┤
│                      PROJECT 82 TABLES                       │
├─────────────────────────────────────────────────────────────┤
│ user_province_visits   │ Province visit records          │
│ province_boundaries    │ Province geo data               │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 API Pattern

All data access uses **Astro Actions** with **Security DEFINER RPCs**:

- **Frontend → Actions:** `src/actions/*.ts`
- **Actions → RPCs:** Server-side database functions
- **Security:** All RPCs use `SECURITY DEFINER` with `context.locals.user_id` validation

---

## 4. User Flows

### 4.1 Registration Flow

```
1. Visitor lands on /register
2. Fills email, password, accepts terms
3. POST /api/auth/register
4. Supabase creates auth.users row
5. DB trigger auto-creates public.users row
6. User receives confirmation email
7. User clicks confirmation link
8. Redirects to /onboarding/profile
9. Completes 3-step onboarding
10. Redirects to /trips (Discover tab)
```

### 4.2 Trip Creation Flow

```
1. User clicks "Create Trip" on /trips
2. Step 1: Schedule (dates, destination, pickup, dropoff)
3. Step 2: Details (description, tags, preferences)
4. Step 3: Budget (estimated cost, cost sharing method)
5. Step 4: Logistics (max participants, gender preference)
6. Step 5: Confirm (review all + map preview)
7. Trip created with status = 'draft'
8. Owner can publish (set status = 'active')
```

### 4.3 Trip Join Flow

```
1. User browses Discover tab or Map
2. Finds interesting trip
3. Clicks to view trip details
4. Clicks "Request to Join"
5. Request added with status = 'pending'
6. Trip owner receives notification
7. Owner approves/rejects
8. If approved, user becomes member (status = 'joined')
```

### 4.4 Itinerary Building Flow

```
1. Trip owner views trip detail page
2. Scrolls to Itinerary section
3. Clicks "Edit Itinerary" toggle
4. Adds stops via "Add Stop" button
5. For each stop: search location, set type, set time
6. Adds activities within stops
7. Changes saved immediately
8. Owner toggles visibility (members-only/public)
```

---

## 5. UI/UX Guidelines

### 5.1 Design System

Based on `UI_BRAND_GUIDELINES.md`:

| Element | Specification |
|---------|---------------|
| Primary Color | #1DA1F2 (Twitter Blue) |
| Secondary Color | #14171A |
| Accent Color | #17BF63 (Green) |
| Error Color | #E0245E |
| Background | #FFFFFF / #F5F8FA |
| Typography | System fonts |

### 5.2 Component Patterns

| Pattern | Usage |
|---------|-------|
| DaisyUI | Base component library |
| Modals | DaisyUI `<dialog>` via `EditModal.astro` |
| Forms | Server actions with validation |
| Navigation | Header (desktop), BottomNav (mobile) |
| Loading | Skeleton loaders |
| Feedback | Toast notifications |

### 5.3 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, bottom nav |
| Tablet | 768px - 1023px | Two column |
| Desktop | ≥ 1024px | Full layout with sidebar |

---

## 6. Security Requirements

Based on `SECURITY_REQUIREMENTS.md`:

### 6.1 Authentication

- JWT-based session management
- Cookie-based tokens (httpOnly, secure, sameSite: strict)
- Rate limiting on login attempts
- Email confirmation required

### 6.2 Authorization

- All database operations via SECURITY DEFINER RPCs
- User ID extracted from JWT, never from client input
- Row-level security policies on all tables
- IDOR protection on all endpoints

### 6.3 Data Protection

- Input validation via Zod schemas
- SQL injection prevention via parameterized queries
- XSS prevention via framework auto-escaping

---

## 7. Feature Dependencies

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

## 8. Out of Scope (v1)

The following are explicitly deferred to future versions:

- **Messaging** — In-app chat between users
- **Reviews/Ratings** — Trip and user reviews
- **Offline Maps** — Downloadable Mapbox areas
- **Emergency Features** — LGU contacts, weather alerts
- **Boat/Ferry Tracking** — Schedule integration
- **Trip Templates** — Reusable trip configurations
- **Packing Lists** — Shared checklists
- **Calendar Sync** — Export to Google/Apple Calendar

---

## 9. Feature Docs Reference

Individual feature specifications are stored in `docs/features/`:

| File | Description |
|------|-------------|
| `USER_FEATURE_SPEC.md` | User accounts, onboarding, profile, friends |
| `TRIP_FEATURE_SPEC.md` | Trip creation, management, participation |
| `MAPS_FEATURE_SPEC.md` | Map discovery interface |
| `ITINERARY_PLAN.md` | Itinerary implementation plan |
| `ITINERARY_DESIGN.md` | Itinerary data structure |
| `PROJECT_82_SPEC.md` | Province tracking feature |
| `FEATURE_EMAIL_NOTIFICATIONS.md` | Email notification details |
| `FEATURE_JOIN_REQUEST_BADGE.md` | Join request UI badges |

---

## 10. Success Metrics

### 10.1 Key Performance Indicators

| Metric | Target |
|--------|--------|
| Monthly Active Users (MAU) | TBD |
| Trips Created per Month | TBD |
| Average Trip Size | 4-6 members |
| Onboarding Completion Rate | > 70% |
| Trip Completion Rate | > 60% |

### 10.2 Quality Metrics

| Metric | Target |
|--------|--------|
| Page Load Time | < 3 seconds |
| Error Rate | < 1% |
| Crash Rate | < 0.1% |

---

*Last updated: February 2026*
