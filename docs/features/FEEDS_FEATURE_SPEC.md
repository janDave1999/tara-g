# Feeds & Search Feature — Specification

> Track progress: `[x]` = completed, `[ ]` = pending.
> Priority: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **Feeds** page (`/feeds`) is the primary landing destination after sign-in. It is the social activity hub of Tara G! — showing a personalized mix of travel posts and interleaved trip discovery cards. The **Search** page (`/search`) provides discovery by default (People You May Know, Suggested Trips) and live as-you-type search across Users, Trips, and Posts.

---

## 1. Implementation Status

### 1.1 Routes & Pages

| Page | Route | File | Status |
|------|-------|------|--------|
| Feeds | `/feeds` | `src/pages/feeds/index.astro` | ✅ Live |
| Search | `/search` | `src/pages/search/index.astro` | ✅ Live |

### 1.2 Phase 1 — Implemented (2026-03-02)

| Item | Status |
|------|--------|
| Auth guard on `/feeds` | ✅ Done |
| Auth guard on `/search` | ✅ Done |
| Real feed data via `get_feed_posts` RPC | ✅ Done |
| `FeedCard.astro` component | ✅ Done |
| Post type filter tabs (All / Trips / Photos / Tips / Questions) | ✅ Done |
| Discover trips interleaved every 5th feed card | ✅ Done |
| `GlobalSearchBar.astro` with as-you-type dropdown | ✅ Done |
| `search.global` action (users + trips + posts in parallel) | ✅ Done |
| `search_posts` RPC (migration 054) | ✅ Done |
| `/search` live search — results render as user types | ✅ Done |
| `/search` tab filtering (All / Users / Trips / Posts) — client-side | ✅ Done |
| `/search` URL updates via `history.replaceState` | ✅ Done |
| `/search` default discovery: Recent Searches (localStorage) | ✅ Done |
| `/search` default discovery: People You May Know | ✅ Done |
| `/search` default discovery: Suggested Trips | ✅ Done |
| `get_people_you_may_know` RPC (migration 055) | ✅ Done |
| People cards: horizontal scroll, box-style profile image | ✅ Done |
| People cards: relation context badge (trip mate / mutual) | ✅ Done |
| Suggested trips: horizontal scroll, uniform card heights | ✅ Done |
| `TripCard.astro`: `class` prop + `flex flex-col` + footer `mt-auto` | ✅ Done |
| Search icon added to Header (beside notification bell) | ✅ Done |
| BottomNav: Feed tab replaced with Search tab | ✅ Done |

### 1.3 Existing Database Tables (migration 007)

| Table | Purpose | Status |
|-------|---------|--------|
| `user_posts` | User-authored posts with type, content, hashtags, location, counts | ✅ Exists |
| `post_interactions` | Reactions and saves per post | ✅ Exists |
| `post_comments` | Threaded comments on posts | ✅ Exists |
| `user_photo_albums` | Photo albums linked to users | ✅ Exists |

---

## 2. Content Strategy

### 2.1 Feed Content Types

| Content Type | Source | Who Sees It |
|--------------|--------|-------------|
| **Travel Post** | User-authored (`post_type` any) | Public `is_public = true` |
| **Trip Planning Post** | `post_type = 'trip_planning'` | Public |
| **Photo Post** | `post_type = 'photo'` | Public |
| **Travel Tip** | `post_type = 'tip'` | Public |
| **Question** | `post_type = 'question'` | Public |
| **Suggested Trips** | `get_recent_trips` RPC | Interleaved every 5th card |

### 2.2 Feed Algorithm (Phase 1 — Chronological)

All public posts ordered by `created_at DESC`. Phase 2 will filter to friends only using the `friends` table (placeholder `p_user_id` param already in `get_feed_posts`).

### 2.3 Post Card Fields

- Author avatar + full name + `@username` + time ago
- Post type badge
- Optional trip link badge → `/trips/[trip_id]`
- Optional location tag
- Post title (if present)
- Post content (truncated with "See more" toggle)
- Hashtag chips
- Like / Comment / Share counts (static display — Phase 1)

---

## 3. User Stories

### 3.1 Feed Viewing (P0)

| # | Story | Status |
|---|-------|--------|
| US-F1 | Feed loads on `/feeds` with real posts | ✅ Done |
| US-F2 | Infinite scroll loads next page | ❌ Phase 4 |
| US-F3 | Author avatar, name, relative time on every card | ✅ Done |
| US-F4 | Trip badge on post links to trip detail page | ✅ Done |
| US-F5 | Tabs: All / Trips / Photos / Tips / Questions | ✅ Done |
| US-F6 | Unauthenticated → redirects to `/signin` | ✅ Done |

### 3.2 Post Creation (P0)

| # | Story | Status |
|---|-------|--------|
| US-F7 | Post composer at top of feed | ❌ Phase 2 |
| US-F8 | Post type selector | ❌ Phase 2 |
| US-F9 | Link post to a trip | ❌ Phase 2 |
| US-F10 | Add hashtags | ❌ Phase 2 |
| US-F11 | Tag a location | ❌ Phase 3 |
| US-F12 | Control post visibility | ❌ Phase 2 |

### 3.3 Reactions & Engagement (P1)

| # | Story | Status |
|---|-------|--------|
| US-F13 | Like a post | ❌ Phase 2 |
| US-F14 | See reaction counts | ✅ Displayed (static) |
| US-F15 | Comment on a post | ❌ Phase 2 |
| US-F16 | Bookmark/save a post | ❌ Phase 3 |
| US-F17 | Share a post | ❌ Phase 3 |

### 3.4 Discovery in Feed (P1)

| # | Story | Status |
|---|-------|--------|
| US-F18 | Suggested trips interleaved every 5th card | ✅ Done |
| US-F19 | Location-based nearby trips | ❌ Phase 4 |

### 3.5 Global Search (P0)

| # | Story | Status |
|---|-------|--------|
| US-F23 | Search bar on Feeds page | ✅ Done — `GlobalSearchBar.astro` |
| US-F24 | Instant dropdown after 2+ chars (300ms debounce) | ✅ Done |
| US-F25 | User result → `/profile/[username]` | ✅ Done |
| US-F26 | Trip result → `/trips/[trip_id]` | ✅ Done |
| US-F27 | Full results page `/search?q=...` with tabs | ✅ Done — live search, no form submit |
| US-F28 | Hashtag search mode | ❌ Phase 3 |

### 3.6 Post Management (P1)

| # | Story | Status |
|---|-------|--------|
| US-F20 | Edit own post | ❌ Phase 3 |
| US-F21 | Delete own post | ❌ Phase 3 |
| US-F22 | Report a post | ❌ Phase 4 |

---

## 4. Technical Details

### 4.1 Page Auth Guard

Both `/feeds` and `/search` use:

```astro
const { user_id } = Astro.locals;
if (!user_id) return Astro.redirect("/signin");
```

### 4.2 Actions

| Namespace | Action | Input | Status |
|-----------|--------|-------|--------|
| `feed` | `feed.getPosts` | `{ page, limit, postType? }` | ✅ `src/actions/feed.ts` |
| `search` | `search.global` | `{ q, limit? }` (default `limit=3`) | ✅ `src/actions/search.ts` |

> `search.global` uses `limit=3` by default (for the GlobalSearchBar dropdown). The `/search` page calls it with `limit=10` for live results.

### 4.3 RPC Functions

| Function | Migration | Purpose | Status |
|----------|-----------|---------|--------|
| `get_feed_posts` | 050 | Chronological public posts joined with user data; paginated | ✅ Run |
| `search_posts` | 054 | ILIKE search on `user_posts.title + content`; returns JSONB array | ✅ Run |
| `get_people_you_may_know` | 055 | Ranked user suggestions: trip mates → mutuals → random fill | ✅ Run |
| `get_suggested_trips` | (existing) | Reused for `/search` default Suggested Trips section | ✅ Existing |
| `get_recent_trips` | (existing) | Reused for feed discovery cards + search trips | ✅ Existing |
| `search_users_for_invitation` | (existing) | Reused for user search (`p_trip_id = null`) | ✅ Existing |

### 4.4 `get_people_you_may_know` RPC (migration 055)

Ranks suggestions by social proximity:

| Priority | Source | Condition | Returns |
|----------|--------|-----------|---------|
| 1 | `trip_members` | Shared active/completed trip | `relation_reason = 'trip_mate'`, `shared_count = N trips` |
| 2 | `friends` | Friends of friends | `relation_reason = 'mutual'`, `shared_count = N mutuals` |
| 3 | `users` | Any active user | `relation_reason = NULL` (no badge shown) |

Excludes: the viewer, existing friends, inactive users (`is_active = false`).
`DISTINCT ON (u.auth_id)` ensures a user can only appear once (at their highest priority).

### 4.5 Components

| Component | Path | Status |
|-----------|------|--------|
| `FeedCard.astro` | `src/features/feed/FeedCard.astro` | ✅ Built |
| `GlobalSearchBar.astro` | `src/features/search/GlobalSearchBar.astro` | ✅ Built |
| `TripCard.astro` | `src/components/TripCard.astro` | ✅ Enhanced (class prop, uniform height) |

**TripCard enhancements (Phase 1):**
- Added optional `class` prop applied to the outer div
- Outer div is now `flex flex-col` — enables height distribution
- Content area has `flex-1` so it fills available space
- Footer has `mt-auto` so it always pins to the bottom
- In horizontal scroll contexts: wrapper passes `class="h-full"` so all cards stretch to the tallest card's height

### 4.6 `/search` Page — Live Search Architecture

```
User types → input event (debounced 300ms)
  → actions.search.global({ q, limit: 10 })
  → renderUsers() / renderTrips() / renderPosts() → innerHTML
  → history.replaceState(/search?q=...)
  → discoverySection.hidden = true / resultsSection.hidden = false

Tab click → setTab(id) → toggle section visibility → replaceState(tab=id)
Input cleared → discoverySection shown, URL reset to /search
```

**Default discovery state (no query):**
- Recent Searches — localStorage key `tg-recent-searches`, max 5, clickable (fills input + fires `input` event)
- People You May Know — horizontal scroll, box cards with full-width avatar image, relation label
- Suggested Trips — horizontal scroll, uniform card heights via `items-stretch` + TripCard `h-full`

**Security:** All user-controlled strings rendered into `innerHTML` are passed through an `esc()` helper that escapes `&`, `<`, `>`, `"`, `'`.

### 4.7 Global Search Dropdown (`GlobalSearchBar.astro`)

Appears on the `/feeds` page. 300ms debounce after 2+ chars, calls `actions.search.global({ q })` (limit 3 per category). Groups: USERS → TRIPS → POSTS → "See all results →".

Close triggers: Escape key, click outside wrapper.

### 4.8 Post Type Labels

| `post_type` | Display Label |
|-------------|---------------|
| `status_update` | Status Update |
| `trip_planning` | Planning a Trip |
| `trip_completed` | Trip Completed |
| `photo` | Photo |
| `question` | Question |
| `tip` | Travel Tip |

---

## 5. Remaining Gaps

### 5.1 Phase 2 — Compose & Engage (P1)
- [ ] `FeedComposer.astro` — post creation UI
- [ ] `feed.createPost` action + `create_user_post` RPC (migration 051)
- [ ] Like/reaction toggle — `feed.toggleReaction` + `toggle_post_reaction` RPC (migration 052)
- [ ] Inline comment count + comment sheet — `CommentSheet.astro`, RPCs (migration 053)

### 5.2 Phase 3 — Social & Management (P1)
- [ ] Bookmark/save toggle (`feed.toggleBookmark`)
- [ ] Post edit/delete for own posts
- [ ] Hashtag feed page (`/feeds/tag/[hashtag]`)
- [ ] Hashtag search mode on search page (leading `#`)

### 5.3 Phase 4 — Discovery & UX (P2)
- [ ] Infinite scroll via IntersectionObserver (replace URL param pagination)
- [ ] Photo uploads on posts (R2 storage)
- [ ] Location-based nearby trips
- [ ] Report post flow

---

## 6. File Manifest

```
src/
├── pages/
│   ├── feeds/
│   │   └── index.astro                   ✅ Auth guard + real data + GlobalSearchBar + FeedCard
│   └── search/
│       └── index.astro                   ✅ Live search + discovery default + People/Trips sections
├── features/
│   ├── feed/
│   │   └── FeedCard.astro                ✅ Post card with author, content, hashtags, counts
│   └── search/
│       └── GlobalSearchBar.astro         ✅ Feeds page search dropdown (3 grouped sections)
├── components/
│   └── TripCard.astro                    ✅ Enhanced: class prop, flex-col, mt-auto footer
└── actions/
    ├── feed.ts                           ✅ feed.getPosts
    ├── search.ts                         ✅ search.global({ q, limit })
    └── index.ts                          ✅ feed + search exported in server object

database-migrations/
├── 050_get_feed_posts.sql                ✅ Paginated public posts joined with user data
├── 054_search_posts.sql                  ✅ ILIKE search on user_posts title + content
└── 055_get_people_you_may_know.sql       ✅ Ranked suggestions: trip mates → mutuals → random
```

---

*Created: 2026-03-02 · Last updated: 2026-03-02*
*Phase 1 complete. Phase 2 (post creation + reactions) is next.*
