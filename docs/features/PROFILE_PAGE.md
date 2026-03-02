# Tara G! — Profile Page PRD

**Version:** v3.1 — Updated
**Date:** March 2026
**Status:** Implemented
**Owner:** Tara G! Product Team
**Scope:** User Profile Page Redesign

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Stories](#2-user-stories)
3. [Feature Specifications](#3-feature-specifications)
4. [Database & API Requirements](#4-database--api-requirements)
5. [Technical Specifications](#5-technical-specifications)
6. [Accessibility](#6-accessibility)
7. [Phased Roadmap](#7-phased-roadmap)
8. [Open Questions](#8-open-questions)
9. [Appendix — File Manifest](#9-appendix--file-manifest)

---

## 1. Overview

### 1.1 Problem Statement

The existing profile page is a basic data display sheet. It lacks visual hierarchy, social engagement hooks, and identity-expression features that drive user retention and community building. Users have no strong sense of "owning" their profile or wanting to share it with others.

### 1.2 Goals

- Redesign the profile page as a first-class social surface — inspired by Instagram's profile UX.
- Enable users to express their travel identity, showcase trips, and build social credibility within the Tara G! community.
- Surface Project 82 progress (Philippine provinces visited) as a core identity metric unique to the app.
- Remove visual clutter (cover photo) in favour of a focused, content-first layout.

### 1.3 Key Design Decisions

> **Cover photo removed** — the profile opens directly into the card layout. No banner overlap, no negative margin hacks. The avatar, name, and stats immediately command attention.

> **"Countries" replaced with "Bucket" (Project 82)** — shows `X/82` provinces visited. This is uniquely Filipino, motivating, and differentiates Tara G! from generic travel apps.

### 1.4 Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Profile completion rate | ≥ 70% reach 80%+ fields | Supabase analytics |
| Avatar upload rate | ≥ 60% of active users | Storage event tracking |
| Bucket stat engagement | ≥ 40% tap through to bucket list | Link click events |
| Bio edit rate | ≥ 35% of users write a bio | API call tracking |
| Return visits to own profile | ≥ 2× per week avg | Session analytics |

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | Traveler | See my profile at a glance | I feel proud to share it |
| US-02 | Traveler | View my trip stats prominently | I can see my travel history quantified |
| US-03 | Traveler | See my Project 82 bucket progress | I stay motivated to explore all 82 provinces |
| US-04 | Traveler | Edit my bio inline without a modal | Editing feels fast and native |
| US-05 | Traveler | See my interests as coloured visual tags | My personality comes through at a glance |
| US-06 | Traveler | See a 3-column grid of my past trips | I can browse my travel portfolio |
| US-07 | Traveler | See a profile completion checklist | I know exactly what to fill in next |
| US-08 | Traveler | Share my profile link | I can invite others to connect with me |
| US-09 | Visitor | Send / accept / decline a friend request | I can connect with like-minded travelers |
| US-10 | Visitor | See a public profile's trip grid | I can browse their travel history before connecting |
| US-11 | Visitor | See a private profile locked with a CTA | I know I need to add them as a friend to see more |

---

## 3. Feature Specifications

### 3.1 Profile Header Card

The profile header card is the primary identity block. It replaces the former cover-photo-plus-card layout with a clean, flat card that sits directly below the sticky navigation header.

#### Avatar

> **v3.1 update:** The SVG completion ring was removed. The avatar is now a clean circle with no progress indicator.

| Property | Value |
|---|---|
| Size | `96px` mobile / `112px` desktop (`w-24` / `w-28`) |
| Border | 4px solid white ring + `shadow-md` |
| Hover state (owner) | Dark overlay + camera icon + "Edit" label |
| Click action (owner) | Opens `AvatarEditor` modal |
| Verified badge | Blue checkmark — bottom-right of avatar |

#### Action Buttons

**Owner view:**

| Button | Behaviour |
|---|---|
| Edit Profile | Links to `/onboarding/profile` |
| Share (icon) | Web Share API; fallback to clipboard + toast |

**Visitor view (logged-in):**

| State | Button(s) | Behaviour |
|---|---|---|
| Not friends, no pending request | Add Friend | Calls `actions.friends.sendFriendRequest` |
| Viewer sent request | Request Sent (disabled) | No action |
| Viewer received request | Accept / Decline | Calls `acceptFriendRequest` / `declineFriendRequest`; page reloads on success |
| Already friends | Friends (disabled, green) | No action |
| Message | Always visible | Links to `/messages?user={user_id}` |
| Share (icon) | Always visible | Web Share API; fallback to clipboard + toast |

**Visitor view (logged-out):**

| Button | Behaviour |
|---|---|
| Sign in to connect | Redirects to `/signin?redirect=/profile/{username}` |
| Share (icon) | Web Share API; fallback to clipboard + toast |

#### Stat Strip

Four inline stats separated by `divide-x` dividers. Each is tappable and links to a filtered view. No card borders or shadows — flat, minimal, Instagram-adjacent.

| Stat | Source field | Link destination | Notes |
|---|---|---|---|
| Created | `userStats.trips_owned` | `/trips?filter=owned` | |
| Joined | `userStats.trips_joined` | `/trips?filter=joined` | |
| Friends | `userStats.friends_count` | `/profile/friends` | |
| Bucket | `userStats.bucket_count` | `/profile/bucket-list` | Shows `X/82` + "Project 82" orange badge |

---

### 3.2 About — Inline Bio Editor

The bio is editable inline — clicking "Edit" transitions the static text into a `<textarea>` in-place. No modal required.

| State | Behaviour |
|---|---|
| Display mode | Plain text, `text-sm`, `text-gray-700`, `whitespace-pre-wrap`. Italic gray placeholder if empty. |
| Edit mode trigger | Click "Edit" in card header, OR "Add →" in completion checklist |
| Edit mode UI | Expanding textarea, `border-blue-400 ring-2 ring-blue-100`, 280 char max |
| Character counter | Shows `X / 280`. Turns orange at 250, red at 280 |
| Save action | `PATCH /api/profile/bio`. Optimistic UI update before response. |
| Cancel action | Reverts to previous text, no API call |
| Error handling | Toast: "Could not save bio." — text reverts to last saved value |

---

### 3.3 Interests

Category-coloured pill tags. Each category maps to a distinct brand-compliant colour pair. Max 8 visible; overflow shows `+N more` chip.

| Category | Background | Text | Border |
|---|---|---|---|
| Adventure | `orange-50` `#FFF7ED` | `orange-600` | `orange-200` |
| Culture | `purple-50` `#F5F3FF` | `purple-600` | `purple-200` |
| Food | `yellow-50` `#FEFCE8` | `yellow-700` | `yellow-200` |
| Nature | `green-50` `#F0FDF4` | `green-600` | `green-200` |
| Beach | `cyan-50` `#ECFEFF` | `cyan-700` | `cyan-200` |
| Photography | `pink-50` `#FDF2F8` | `pink-600` | `pink-200` |
| Default (any other) | `blue-50` `#EFF6FF` | `blue-600` | `blue-200` |

---

### 3.4 Trip Portfolio Grid

Instagram-style 3-column square grid. Two variants exist:

#### Owner / Own Profile (`ProfileTripGrid` — `ProfileGrid.astro`)

Loaded client-side from `GET /api/profile/trips`.

| Property | Spec |
|---|---|
| Layout | CSS Grid, 3 columns, 2px gap, `bg-gray-200` as grid lines |
| Cell | `aspect-ratio: 1/1`, `overflow: hidden`, `position: relative` |
| Image | `object-fit: cover`, lazy loaded, scales `1.05×` on hover |
| Fallback (no cover) | Brand gradient (`135deg`, `#3B82F6` → `#2563EB`) |
| Hover overlay | `gradient-to-top black/60` — reveals trip name + destination |
| Tabs | "All", "Owned", "Joined" — refetches with `?filter=X` |
| Overflow (> 9 trips) | First 8 normal; 9th cell = "+N more" overlay → `/profile/trips` |
| Empty state | Illustrated card with "Create a trip" CTA |
| Skeleton loaders | 9 shimmer cells shown during fetch |
| Cell click | Navigates to `/trips/{trip.id}` |

#### Public Profile (`PublicTripGrid` — `PublicTripGrid.astro`)

Loaded client-side from `GET /api/profile/{username}/trips`. Shown only when `canViewFullProfile` is true (see §3.7).

| Property | Spec |
|---|---|
| Layout | Identical CSS Grid, 3 columns, 2px gap |
| Tabs | None — shows owned trips only |
| Overflow (> 9 trips) | "+N more" overlay → `/profile/{username}/trips` |
| Empty state | "This traveler hasn't created any trips." — no Create CTA |
| Visibility filtering | Friends/owner: all non-draft trips · Non-friends (public profile): `trip_visibility.visibility = 'public'` only |

---

### 3.5 Public Profile Page (`/profile/[username]`)

A server-rendered public profile accessible to anyone, owner or not.

#### Privacy Gate

| Condition | `canViewFullProfile` | What is shown |
|---|---|---|
| Viewer is the owner | ✅ | Full profile + own trip grid |
| Viewer is friends with owner | ✅ | Full profile + all non-draft trips |
| `is_private = false` (public account) | ✅ | Full profile + public trips only |
| `is_private = true` AND not friends | ❌ | Private profile lock card with Add Friend / Sign In CTA |

#### Friend Request Status Detection (SSR)

Two separate queries determine the request direction; `.maybeSingle()` prevents errors when no row exists:

1. `friends` table: `user_id = viewerUserId AND friend_id = profile.user_id` → `friendshipStatus = 'friends'`
2. `friend_requests`: `sender_id = viewerUserId AND receiver_id = profile.user_id AND status = 'pending'` → `friendRequestStatus = 'sent'`
3. `friend_requests`: `sender_id = profile.user_id AND receiver_id = viewerUserId AND status = 'pending'` → `friendRequestStatus = 'received'`

#### Key Implementation Notes

- `trips.owner_id` = `auth.users.id` (not internal `user_id`)
- `notifications.user_id` FK references internal `users.user_id` — always resolve via `users WHERE auth_id = ...` before calling `create_notification`
- Visibility lives in the `trip_visibility` table (not a `trips.visibility` column)
- DB trigger `trigger_create_friendship` auto-inserts bidirectional rows into `friends` on `friend_requests` UPDATE to `'accepted'` — do NOT manually insert into `friends`

---

### 3.7 Travel Preferences Panel

Property-row layout using `divide-y`. Each row: icon well + label + value. Follows brand spec: `w-9 h-9 rounded-xl` icon wells.

| Row | DB Field | Icon Well Colour | Value Type |
|---|---|---|---|
| Budget | `user_preferences.budget_range` | `orange-50 / orange-500` | Single string, capitalised |
| Pace | `user_preferences.pace_preference` | `blue-50 / blue-600` | Single string, capitalised |
| Languages | `user_preferences.languages_spoken` | `blue-50 / blue-600` | Array joined with `", "` |
| Accommodation | `user_preferences.accommodation_type` | `green-50 / green-600` | Array joined with `", "` |
| Travel Style | `user_preferences.travel_style` | `blue-50 / blue-600` | Array rendered as coloured chips |

---

### 3.8 Profile Completion Widget

> **v3.1 update:** The profile completion widget and completion ring have been **removed**. Profile editing is now centralised in the `/profile/edit` hub (see §3.9).

~~Visible only to the profile owner, only when `completion < 100%`. Shows a thin brand-gradient progress bar and a checklist of up to 4 pending items, each with a direct action shortcut.~~

---

### 3.9 Profile Edit Hub (`/profile/edit`)

A dedicated edit hub page replacing all inline edit buttons and the completion widget. Provides a clean list of edit sections, each linking to a dedicated sub-page.

| Section | Route | Purpose |
|---|---|---|
| Basic Info | `/profile/edit/basic` | Name, username, bio, location |
| Interests | `/profile/edit/interests` | Travel interest tags |
| Preferences | `/profile/edit/preferences` | Budget, pace, accommodation, travel style |
| Account & Security | `/profile/security` | Email, password, connected accounts, sessions, delete account |

The profile header, about section, interests, and preferences are all now **read-only** on the profile page — edit buttons have been removed from those components. All editing flows through `/profile/edit`.

---

## 4. Database & API Requirements

### 4.1 New DB Columns Required

> Run these migrations before deploying to production.

```sql
ALTER TABLE user_preferences ADD COLUMN accommodation_type TEXT[];
ALTER TABLE user_stats ADD COLUMN bucket_count INTEGER DEFAULT 0;
```

`bucket_count` tracks the number of Philippine provinces (out of 82) visited. Populated from trip destinations in Phase 2.

### 4.2 API Endpoints

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `PATCH` | `/api/profile/bio` | Inline bio save — body: `{ bio: string }` | Required |
| `GET` | `/api/profile/trips?filter=all\|owned\|joined` | Own trip grid — returns `id`, `title`, `cover_image_url`, `destination` | Required |
| `GET` | `/api/profile/[username]/trips` | Public profile trip grid — visibility-filtered | Optional |

### 4.3 Astro Actions (Friend Requests)

| Action | Input | Description |
|---|---|---|
| `actions.friends.sendFriendRequest` | `{ targetUserId }` | Inserts pending `friend_requests` row; sends `friend_request` notification |
| `actions.friends.cancelFriendRequest` | `{ targetUserId }` | Deletes pending request sent by caller |
| `actions.friends.acceptFriendRequest` | `{ senderUserId }` | Updates status → `'accepted'`; DB trigger creates bidirectional `friends` rows; sends `friend_accepted` notification |
| `actions.friends.declineFriendRequest` | `{ senderUserId }` | Updates status → `'declined'` |

### 4.4 Existing RPCs Used

| RPC | Returns | New fields needed |
|---|---|---|
| `get_user_profile_data(p_user_id)` | `profile`, `information`, `preferences`, `interests` | None |
| `get_user_stats(p_user_id)` | `trips_owned`, `trips_joined`, `friends_count` | `bucket_count` *(new)* |

---

## 5. Technical Specifications

### 5.1 Framework & Stack

| Layer | Technology |
|---|---|
| Framework | Astro with SSR mode |
| Styling | Tailwind CSS v4 utility classes |
| Database | Supabase (PostgreSQL + RPC functions) |
| Storage | Cloudflare R2 (`PUBLIC_R2_URL` env var) |
| Language | TypeScript (strict mode in frontmatter) |
| Interactivity | Vanilla TS in `<script>` blocks — no client framework |

### 5.2 Component Dependencies

- `PagePlate.astro` — layout wrapper (provides `<head>`, nav, footer)
- `EditProfileModal.astro` — modal for editing name, username, bio, location
- `AvatarEditor.astro` — modal for cropping and uploading avatar to R2

### 5.3 Environment Variables

| Variable | Purpose | Where used |
|---|---|---|
| `PUBLIC_R2_URL` | Base URL for Cloudflare R2 bucket | Avatar and trip cover image URLs |

### 5.4 Performance Considerations

| Item | Strategy |
|---|---|
| Trip grid images | `loading="lazy"` — below fold, deferred |
| Avatar image | Eager load — above fold, critical path |
| Bio save | Optimistic UI + `PATCH`; no debounce needed (explicit Save button) |
| Trip grid fetch | Client-side fetch on mount + on tab switch |
| Stats & profile data | Server-rendered in Astro frontmatter — no client fetch |

---

## 6. Accessibility

| Element | Requirement |
|---|---|
| Avatar button | `aria-label="Change profile photo"` |
| Share button | `aria-label="Share profile"` |
| Stat strip | `<dl>` / `<dt>` / `<dd>` semantic markup |
| Bio textarea | Character counter via `aria-live` *(future enhancement)* |
| All interactive elements | Minimum 44px touch target on mobile |
| Focus rings | `focus:ring-2 focus:ring-blue-500` throughout |
| Animations | Respects `prefers-reduced-motion` — all animations disabled |
| Verified badge | `title="Verified Traveler"` for screen reader tooltip |

---

## 7. Phased Roadmap

### ✅ Phase 1 — Completed

| Feature | Status |
|---|---|
| Profile header card (no cover photo) | ✅ Done |
| Avatar with SVG completion ring | ✅ Done |
| Verified badge + chip | ✅ Done |
| Stat strip: Created / Joined / Friends / Bucket | ✅ Done |
| Project 82 — Bucket `X/82` + orange badge | ✅ Done |
| Inline bio editor with character counter | ✅ Done |
| Category-coloured interest tags | ✅ Done |
| Trip grid (3-col, tabs, skeleton, empty state) | ✅ Done |
| Travel preferences (property rows + icon wells) | ✅ Done |
| Profile completion checklist (max 4 pending items) | ✅ Done |
| Share profile button (Web Share API + clipboard fallback) | ✅ Done |
| Staggered entrance animations (`prefers-reduced-motion` aware) | ✅ Done |

### ✅ Phase 2 — Completed

| Feature | Status |
|---|---|
| Public profile page `/profile/[username]` with SSR | ✅ Done |
| Owner vs visitor vs logged-out view differentiation | ✅ Done |
| Privacy gate — `is_private` boolean on `users` table | ✅ Done |
| Friend request system (send / cancel / accept / decline) | ✅ Done |
| Inline Accept / Decline buttons on public profile | ✅ Done |
| Friend request notifications (`friend_request`, `friend_accepted`) | ✅ Done |
| Inline Accept / Decline in `NotificationBell` dropdown | ✅ Done |
| Public trip grid on profile page (visibility-aware) | ✅ Done |
| `GET /api/profile/[username]/trips` endpoint | ✅ Done |
| `acceptTripInvitation` notification FK fix (auth_id → user_id) | ✅ Done |

### ✅ Phase 3 — Completed (v3.1)

| Feature | Status |
|---|---|
| Profile edit hub at `/profile/edit` — centralised editing | ✅ Done |
| Remove inline edit buttons from About, Interests, Preferences | ✅ Done |
| Remove profile completion widget | ✅ Done |
| Remove avatar completion ring SVG | ✅ Done |
| Account & Security page (`/profile/security`) | ✅ Done |
| Change email action (with Supabase confirmation flow) | ✅ Done |
| Change / set password action | ✅ Done |
| Connected accounts display (email, Google, Facebook) | ✅ Done |
| Sign out all devices action | ✅ Done |
| Delete account action + confirmation dialog | ✅ Done |

### ⚪ Phase 4 — Future

| Feature | Status |
|---|---|
| `bucket_count` auto-populated from trip destinations | ⚪ Future |
| Travel map — Philippine provinces heat map | ⚪ Future |
| Mutual friends chip on public profile | ⚪ Future |
| Achievements / badges system | ⚪ Future |
| Pinned / highlighted trips | ⚪ Future |
| Profile view analytics | ⚪ Future |

---

## 8. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should profiles be public by default or opt-in public? | Product | Resolved — `is_private` defaults to false; users opt-in to private |
| 2 | Follow model: mutual (friend request) or one-way? | Product | Resolved — mutual (friend request) model implemented |
| 3 | Should the trip grid show private trips to the owner? | Product | Resolved — owner sees all non-draft trips; friends see all; non-friends see public only |
| 4 | `bucket_count`: derived from trip destinations or manually tracked? | Engineering | Open — future phase |
| 5 | Should the completion widget persist "dismissed" state per user? | Engineering | Open |

---

## 9. Appendix — File Manifest

| File | Type | Purpose |
|---|---|---|
| `src/pages/profile/index.astro` | Astro page | Owner profile (authenticated, read-only) |
| `src/pages/profile/[username].astro` | Astro page | Public profile (SSR) — privacy gate, friend requests, public trip grid |
| `src/pages/profile/edit/index.astro` | Astro page | Profile edit hub — links to all edit sub-pages |
| `src/pages/profile/edit/basic.astro` | Astro page | Edit name, username, bio, location |
| `src/pages/profile/edit/interests.astro` | Astro page | Edit interest tags |
| `src/pages/profile/edit/preferences.astro` | Astro page | Edit travel preferences |
| `src/pages/profile/security.astro` | Astro page | Account & security settings |
| `src/components/Profile/ProfileHeader.astro` | Component | Avatar, name, stats strip (no completion ring) |
| `src/components/Profile/ProfileAbout.astro` | Component | Bio + location display (read-only) |
| `src/components/Profile/ProfileInterest.astro` | Component | Interest pill tags (read-only) |
| `src/components/Profile/ProfilePreference.astro` | Component | Travel preferences panel (read-only) |
| `src/components/Profile/AvatarEditor.astro` | Component | Avatar crop & R2 upload modal |
| `src/components/Profile/ProfileGrid.astro` | Component | Owner trip grid — tabs (All/Owned/Joined) |
| `src/components/Profile/PublicTripGrid.astro` | Component | Public profile trip grid — visibility-filtered |
| `src/actions/auth.ts` | Astro Action | changeEmail, changePassword, signOutAll, deleteAccount |
| `src/actions/friends.ts` | Astro Action | Friend request CRUD (send/cancel/accept/decline) |
| `src/pages/api/profile/bio.ts` | API route | `PATCH` — inline bio save |
| `src/pages/api/profile/trips.ts` | API route | `GET` — own trip grid (`?filter=all\|owned\|joined`) |
| `src/pages/api/profile/[username]/trips.ts` | API route | `GET` — public profile trip grid (visibility-aware) |

---

*Confidential — Internal Use Only · Tara G! Product Team · March 2026*