# Tara G! — Profile Page PRD

**Version:** v2.0 — Final
**Date:** February 2026
**Status:** Approved for Development
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
| US-09 | Visitor | Follow or friend another traveler | I can connect with like-minded people *(Phase 2)* |
| US-10 | Visitor | See mutual friends count | I can gauge trust and familiarity *(Phase 2)* |

---

## 3. Feature Specifications

### 3.1 Profile Header Card

The profile header card is the primary identity block. It replaces the former cover-photo-plus-card layout with a clean, flat card that sits directly below the sticky navigation header.

#### Avatar with Completion Ring

| Property | Value |
|---|---|
| Size | `96px` mobile / `112px` desktop (`w-24` / `w-28`) |
| Border | 4px solid white ring + `shadow-md` |
| Ring type | SVG circle progress, rotated `-90deg` |
| Ring radius | `52px`, circumference `326.7px` |
| Ring colour — < 50% | `#F97316` orange — incomplete |
| Ring colour — 50–79% | `#3B82F6` blue — in progress |
| Ring colour — 80–100% | `#10B981` green — nearly done |
| Hover state (owner) | Dark overlay + camera icon + "Edit" label |
| Click action (owner) | Opens `AvatarEditor` modal |
| Verified badge | Blue checkmark — bottom-right of avatar |

#### Action Buttons

| Button | Owner | Visitor (Phase 2) | Behaviour |
|---|---|---|---|
| Edit Profile | Visible | Hidden | Opens `EditProfileModal` dialog |
| Share | Visible | Visible | Web Share API, fallback to clipboard + toast |
| Follow / Following | Hidden | Visible | Toggle follow state *(Phase 2)* |
| Message | Hidden | Visible | Opens DM composer *(Phase 2)* |

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

Instagram-style 3-column square grid, loaded asynchronously from `/api/profile/trips`. Skeleton loaders shown during fetch.

| Property | Spec |
|---|---|
| Layout | CSS Grid, 3 columns, `gap-0.5` (2px), `bg-gray-200` shows as grid lines |
| Cell | `aspect-ratio: 1/1`, `overflow: hidden`, `position: relative` |
| Image | `object-fit: cover`, lazy loaded, scales `1.05×` on hover (transition 0.3s) |
| Fallback (no cover) | Brand gradient div (`135deg`, `#3B82F6` → `#2563EB`) |
| Hover overlay | `gradient-to-top black/55` — reveals trip name + destination pin icon |
| Tabs | "All", "Owned", "Joined" — refetches `/api/profile/trips?filter=X` |
| Empty state | Illustrated card with "Create a trip" CTA |
| Skeleton loaders | 6 animated `animate-pulse` cells shown while fetching |
| Cell click | Navigates to `/trips/{trip.id}` |

---

### 3.5 Travel Preferences Panel

Property-row layout using `divide-y`. Each row: icon well + label + value. Follows brand spec: `w-9 h-9 rounded-xl` icon wells.

| Row | DB Field | Icon Well Colour | Value Type |
|---|---|---|---|
| Budget | `user_preferences.budget_range` | `orange-50 / orange-500` | Single string, capitalised |
| Pace | `user_preferences.pace_preference` | `blue-50 / blue-600` | Single string, capitalised |
| Languages | `user_preferences.languages_spoken` | `blue-50 / blue-600` | Array joined with `", "` |
| Accommodation | `user_preferences.accommodation_type` | `green-50 / green-600` | Array joined with `", "` |
| Travel Style | `user_preferences.travel_style` | `blue-50 / blue-600` | Array rendered as coloured chips |

---

### 3.6 Profile Completion Widget

Visible only to the profile owner, only when `completion < 100%`. Shows a thin brand-gradient progress bar and a checklist of up to 4 pending items, each with a direct action shortcut.

| Checklist Item | Done Condition | Action Type | Action Target |
|---|---|---|---|
| Add a profile photo | `userData.avatar_url` is truthy | Modal | `avatar-editor-modal` |
| Write a bio | `bio.length >= 20` chars | Inline trigger | `bio-edit-trigger` (scrolls to bio) |
| Set your location | `location_city` OR `location_country` set | Modal | `edit-profile-modal` |
| Add 3+ interests | `interests.length >= 3` | Link | `/onboarding/interests` |
| Set travel preferences | `budget_range` is truthy | Link | `/onboarding/preferences` |
| Create your first trip | `trips_owned > 0` | Link | `/trips/create` |

#### Completion Ring Colour Thresholds

| Completion % | Ring Colour | Hex | Meaning |
|---|---|---|---|
| 0 – 49% | Orange | `#F97316` | Incomplete — needs attention |
| 50 – 79% | Blue | `#3B82F6` | In progress — good momentum |
| 80 – 100% | Green | `#10B981` | Nearly / fully complete |

---

## 4. Database & API Requirements

### 4.1 New DB Columns Required

> Run these migrations before deploying to production.

```sql
ALTER TABLE user_preferences ADD COLUMN accommodation_type TEXT[];
ALTER TABLE user_stats ADD COLUMN bucket_count INTEGER DEFAULT 0;
```

`bucket_count` tracks the number of Philippine provinces (out of 82) visited. Populated from trip destinations in Phase 2.

### 4.2 New API Endpoints

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| `PATCH` | `/api/profile/bio` | Inline bio save — body: `{ bio: string }` | Required (session) |
| `GET` | `/api/profile/trips?filter=all\|owned\|joined` | Trip grid data — returns `id`, `title`, `cover_image_url`, `destination` | Required (session) |

### 4.3 Existing RPCs Used

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

### ✅ Phase 1 — Current Sprint (This Delivery)

All items are implemented in `profile.astro`.

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

### 🔵 Phase 2 — Next Sprint

| Feature | Status |
|---|---|
| Social graph: Follow / Unfollow | 🔵 Planned |
| Visitor vs owner view differentiation | 🔵 Planned |
| Mutual friends chip on visitor view | 🔵 Planned |
| `bucket_count` auto-populated from trip destinations | 🔵 Planned |
| `GET /api/profile/trips` endpoint (real data) | 🔵 Planned |
| Accommodation type preference field | 🔵 Planned |

### ⚪ Phase 3 — Future

| Feature | Status |
|---|---|
| Public profile URL — `tara-g.com/u/username` | ⚪ Future |
| Travel map — Philippine provinces heat map | ⚪ Future |
| Achievements / badges system | ⚪ Future |
| Pinned / highlighted trips | ⚪ Future |
| Profile view analytics | ⚪ Future |

---

## 8. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should profiles be public by default or opt-in public? | Product | Open |
| 2 | Follow model: mutual (friend request) or one-way? | Product | Open |
| 3 | Should the trip grid show private trips to the owner? | Product | Open |
| 4 | `bucket_count`: derived from trip destinations or manually tracked? | Engineering | Open |
| 5 | Should the completion widget persist "dismissed" state per user? | Engineering | Open |

---

## 9. Appendix — File Manifest

| File | Type | Purpose |
|---|---|---|
| `profile.astro` | Astro page | Main profile page — all Phase 1 features |
| `profile-mockup-v2.html` | HTML mockup | Interactive visual reference (no cover, Project 82) |
| `EditProfileModal.astro` | Astro component | Edit name, username, bio, location *(existing)* |
| `AvatarEditor.astro` | Astro component | Avatar crop & R2 upload *(existing)* |
| `/api/profile/bio` | API route *(needed)* | `PATCH` endpoint — inline bio save |
| `/api/profile/trips` | API route *(needed)* | `GET` endpoint — trip grid data |

---

*Confidential — Internal Use Only · Tara G! Product Team · February 2026*