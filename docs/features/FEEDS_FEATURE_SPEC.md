# Feeds Feature — Detailed Specification

> Track progress: Mark items as `[x]` when completed, `[ ]` when pending.
> Prioritize: P0 = Must have, P1 = Should have, P2 = Nice to have

---

## Overview

The **Feeds** page (`/feeds`) is the primary landing destination after sign-in. It is the social activity hub of Tara G! — showing a personalized mix of travel posts, trip activity, and community content relevant to the authenticated user. It surfaces both social content from friends and public trip discovery, making it the connective tissue between the social and trip features.

---

## 1. Current Implementation Summary

### 1.1 Route & Page

| Page | Route | File |
|------|-------|------|
| Feeds | `/feeds` | `src/pages/feeds/index.astro` |

### 1.2 Current State

| Item | Status |
|------|--------|
| Page renders | ✅ Exists |
| Auth guard | ❌ None — page accessible to anyone |
| Real data | ❌ None — `Feeds.astro` uses hardcoded static array of 3 mock trip cards |
| Post creation | ❌ None |
| Interactions (likes, comments) | ❌ None |
| Infinite scroll | ❌ None |
| Feed filtering | ❌ None |

### 1.3 Existing Database Tables (migration 007)

| Table | Purpose | Status |
|-------|---------|--------|
| `user_posts` | User-authored posts with type, content, hashtags, location, counts | ✅ Exists |
| `post_interactions` | Reactions (like/love/laugh/wow/sad/angry) and saves/bookmarks per post | ✅ Exists |
| `post_comments` | Threaded comments on posts | ✅ Exists |
| `user_photo_albums` | Photo albums linked to users | ✅ Exists |

### 1.4 `user_posts` Schema Summary

| Column | Type | Notes |
|--------|------|-------|
| `post_id` | UUID | PK |
| `user_id` | UUID | FK → `users` |
| `trip_id` | UUID? | Optional FK → `trips` (links post to a trip) |
| `post_type` | VARCHAR | `status_update`, `trip_planning`, `trip_completed`, `photo`, `question`, `tip` |
| `title` | VARCHAR(200) | Optional post heading |
| `content` | TEXT | Required body text |
| `hashtags` | TEXT[] | User-defined hashtags |
| `mentions` | UUID[] | Tagged user IDs |
| `is_public` | BOOLEAN | Default TRUE |
| `allow_comments` | BOOLEAN | Default TRUE |
| `location_name` | VARCHAR(200) | Optional tagged location |
| `latitude/longitude` | DECIMAL | Optional coordinates |
| `like_count` | INTEGER | Denormalized counter |
| `comment_count` | INTEGER | Denormalized counter |
| `share_count` | INTEGER | Denormalized counter |
| `is_pinned` / `is_featured` | BOOLEAN | Moderation/highlight flags |

---

## 2. Content Strategy

### 2.1 Feed Content Types

The feed displays a mixed stream of content cards, ranked by recency and relevance:

| Content Type | Source | Who Sees It |
|--------------|--------|-------------|
| **Trip Activity** | Auto-generated when a friend creates/joins/completes a trip | Friends of the actor |
| **Travel Post** | User-authored (`post_type = 'status_update'` or `'trip_completed'`) | Friends + public followers |
| **Trip Planning Post** | User-authored (`post_type = 'trip_planning'`) — "Looking for travel mates" | Friends + public |
| **Photo Post** | User-authored (`post_type = 'photo'`) — travel photos | Friends + public |
| **Travel Tip** | User-authored (`post_type = 'tip'`) — local knowledge, packing tips | Friends + public |
| **Question** | User-authored (`post_type = 'question'`) — community Q&A | Friends + public |
| **Suggested Trips** | Public active trips matched to user preferences | Authenticated users |

### 2.2 Feed Algorithm (Phase 1 — Simple Chronological)

For the initial implementation, the feed is purely **reverse-chronological** with no ML ranking:

1. Posts from friends (users in `friends` table with `status = 'accepted'`)
2. Public posts from users the viewer follows
3. Interleaved every N cards: suggested public trips from `get_discover_trips` RPC

### 2.3 What Appears on a Feed Card

**Travel Post Card:**
- Author avatar + name + username + time ago
- Post type badge (Tip, Question, Planning, etc.)
- Optional trip link badge (links to `/trips/[trip_id]`)
- Optional location tag
- Post title (if present)
- Post content (truncated at ~280 chars, "See more" expands)
- Optional media (first image)
- Hashtags
- Reaction counts + Comment count
- Like / Comment / Share / Save actions

**Trip Discovery Card (interleaved):**
- "Suggested Trip" label
- Cover image
- Trip title, destination, dates, budget/head
- Spots open badge
- Owner avatar + name
- "View Trip" CTA → `/trips/[trip_id]`

---

## 3. User Stories

### 3.1 Feed Viewing (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F1 | As an authenticated user, I want to see a personalized feed after signing in | Feed loads on `/feeds` with posts from my network | ❌ Not built |
| US-F2 | As a user, I want to scroll through posts without pagination clicks | Infinite scroll loads next page as user approaches bottom | ❌ Not built |
| US-F3 | As a user, I want to see who posted and when | Author avatar, name, and relative time ("2h ago") on every card | ❌ Not built |
| US-F4 | As a user, I want to see posts linked to specific trips | Trip badge on post links to the trip detail page | ❌ Not built |
| US-F5 | As a user, I want to filter the feed by content type | Tabs: All / Trips / Photos / Tips / Questions | ❌ Not built |
| US-F6 | As a guest (unauthenticated), visiting `/feeds` redirects to `/signin` | Auth guard on page | ❌ Not built |

### 3.2 Post Creation (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F7 | As a user, I want to create a post from the feed | "What's on your travel mind?" composer at top of feed | ❌ Not built |
| US-F8 | As a user, I want to choose a post type | Type selector: Status Update, Travel Tip, Question, Planning, Photo | ❌ Not built |
| US-F9 | As a user, I want to link a post to one of my trips | "Add trip" picker shows owned trips dropdown | ❌ Not built |
| US-F10 | As a user, I want to add hashtags to my post | `#tag` auto-parsed from content or separate tag input | ❌ Not built |
| US-F11 | As a user, I want to tag a location on my post | Location search (Mapbox Geocoding) attached to post | ❌ Not built |
| US-F12 | As a user, I want to control post visibility | Toggle: Public / Friends only | ❌ Not built |

### 3.3 Reactions & Engagement (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F13 | As a user, I want to like a post | Single tap = ❤️ like; long press = reaction picker | ❌ Not built |
| US-F14 | As a user, I want to see reaction counts | Like count shown on card; breakdown on hover/expand | ❌ Not built |
| US-F15 | As a user, I want to comment on a post | Comment sheet opens below post; supports threaded replies | ❌ Not built |
| US-F16 | As a user, I want to save a post for later | Bookmark icon saves post to profile's saved list | ❌ Not built |
| US-F17 | As a user, I want to share a post | Web Share API with fallback to clipboard copy | ❌ Not built |

### 3.4 Discovery in Feed (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F18 | As a user, I want to discover suggested trips in my feed | Every 5th card is a suggested trip from `get_discover_trips` | ❌ Not built |
| US-F19 | As a user, I want to see trips near me interleaved in the feed | Location-based nearby trips if geolocation permitted | ❌ Not built |

### 3.5 Global Search (P0)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F23 | As a user, I want to search across users, trips, and posts from the feed | Search bar visible at the top of the Feeds page | ❌ Not built |
| US-F24 | As a user, I want to see instant results as I type | Dropdown appears after 2+ chars with grouped results: Users / Trips / Posts | ❌ Not built |
| US-F25 | As a user, I want to navigate to a profile from search | Clicking a user result goes to `/profile/[username]` | ❌ Not built |
| US-F26 | As a user, I want to navigate to a trip from search | Clicking a trip result goes to `/trips/[trip_id]` | ❌ Not built |
| US-F27 | As a user, I want to see full search results | "See all results" link → `/search?q=...` with tabs for All / Users / Trips / Posts | ❌ Not built |
| US-F28 | As a user, I want to search by hashtag | Typing `#siargao` shows posts with that hashtag | ❌ Not built |

### 3.6 Post Management (P1)

| # | Story | Acceptance Criteria | Status |
|---|-------|---------------------|--------|
| US-F20 | As a user, I want to edit my own post | 3-dot menu → Edit; opens composer prefilled | ❌ Not built |
| US-F21 | As a user, I want to delete my own post | 3-dot menu → Delete with confirmation | ❌ Not built |
| US-F22 | As a user, I want to report a post | 3-dot menu → Report (sends to moderation queue) | ❌ Not built |

---

## 4. Technical Details

### 4.1 Page Auth Guard

The `/feeds` page must redirect unauthenticated users to `/signin`. Use the `PagePlate.astro` pattern:

```astro
---
import PagePlate from "@/layouts/PagePlate.astro";
const { locals } = Astro;
if (!locals.user_id) return Astro.redirect("/signin");
---
<PagePlate title="Feed">
  <!-- feed content -->
</PagePlate>
```

### 4.2 Actions Required (new namespace: `actions.feed.*`)

| Action | Input | Output |
|--------|-------|--------|
| `feed.getPosts` | `{ page, limit, type? }` | Paginated `user_posts` with author details |
| `feed.createPost` | `{ post_type, content, title?, trip_id?, hashtags?, location_name?, latitude?, longitude?, is_public }` | Created post |
| `feed.deletePost` | `{ post_id }` | Success/error |
| `feed.updatePost` | `{ post_id, content, title?, hashtags? }` | Updated post |
| `feed.toggleReaction` | `{ post_id, interaction_type }` | Updated like count |
| `feed.getComments` | `{ post_id, page }` | Paginated comment thread |
| `feed.createComment` | `{ post_id, content, parent_comment_id? }` | Created comment |
| `feed.toggleBookmark` | `{ post_id }` | Save/unsave state |

### 4.3 RPC Functions Required (new migrations)

| Function | Migration | Purpose |
|----------|-----------|---------|
| `get_feed_posts` | TBD | Personalized post feed — friends' posts + public; paginated; joined with user data |
| `create_user_post` | TBD | Insert into `user_posts`; caller's `user_id` resolved server-side via `getInternalUserId` |
| `toggle_post_reaction` | TBD | Upsert/delete in `post_interactions`; update `like_count` on `user_posts` |
| `get_post_comments` | TBD | Fetch threaded comments for a post with author info |

### 4.4 Components Required

| Component | Path | Purpose |
|-----------|------|---------|
| `FeedComposer.astro` | `src/features/feed/FeedComposer.astro` | Post creation box at top of feed |
| `FeedCard.astro` | `src/features/feed/FeedCard.astro` | Single post card with reactions and actions |
| `FeedTripCard.astro` | `src/features/feed/FeedTripCard.astro` | Suggested trip card (uses existing TripCard layout) |
| `FeedFilterTabs.astro` | `src/features/feed/FeedFilterTabs.astro` | All / Trips / Photos / Tips / Questions tabs |
| `CommentSheet.astro` | `src/features/feed/CommentSheet.astro` | Bottom sheet for comments on a post |
| `ReactionPicker.astro` | `src/features/feed/ReactionPicker.astro` | Emoji reaction picker popup |
| `PostTypeSelect.astro` | `src/features/feed/PostTypeSelect.astro` | Dropdown for selecting post type in composer |

### 4.5 Global Search

#### Search Bar Placement
- Sticky bar just below the page header on the Feeds page (mobile: full-width; desktop: max-w-xl centered)
- Also reachable from the Header nav on all pages (future scope — search icon in Header)
- Dedicated results page at `/search?q=[query]`

#### As-You-Type Dropdown

Triggers after 2+ characters with a 300ms debounce. Groups results into three sections:

```
┌────────────────────────────────────────┐
│ 🔍 Search for "siargao"               │
├────────────────────────────────────────┤
│ USERS                                  │
│ 👤 @siargao_surfer  · Jana Cruz        │
│ 👤 @siargao_local   · Marco Reyes      │
├────────────────────────────────────────┤
│ TRIPS                                  │
│ 🗺️ Surfing Trip in Siargao  · Nov 20  │
│ 🗺️ Siargao Island Hopping  · Dec 5   │
├────────────────────────────────────────┤
│ POSTS                                  │
│ 📝 "Best surf spots in Siargao..."    │
│ 📝 "#siargao vibes last weekend 🌊"  │
├────────────────────────────────────────┤
│           See all results →            │
└────────────────────────────────────────┘
```

#### Actions Required (new namespace: `actions.search.*`)

| Action | Input | Existing RPC | Notes |
|--------|-------|-------------|-------|
| `search.users` | `{ q, limit? }` | `search_users_for_invitation` | Remove trip filter; reuse same RPC |
| `search.trips` | `{ q, limit? }` | `get_recent_trips` (p_search param) | Pass `p_search = q`; returns public active trips |
| `search.posts` | `{ q, limit? }` | None — new migration needed | Full-text on `user_posts.title + content` |
| `search.global` | `{ q }` | Calls all three in parallel | Returns `{ users[], trips[], posts[] }` — max 3 each for dropdown |

#### New RPC Required

| Function | Migration | Purpose |
|----------|-----------|---------|
| `search_posts` | TBD (`054`) | Full-text search on `user_posts` (title + content); filters `is_public = true`; returns author info; ordered by recency |

> **Reuse note:** `search_users_for_invitation` (migration 016) already searches `username`, `full_name`, `email` with ILIKE. The `p_trip_id` param can be passed as `NULL` to skip trip-membership filtering, making it usable for global user search without a new RPC.

#### `/search` Results Page

| Route | File | Purpose |
|-------|------|---------|
| `/search` | `src/pages/search/index.astro` | Full search results page with tab navigation |

Tabs: **All** (top 5 per category) · **Users** · **Trips** · **Posts**

Query param: `?q=siargao&tab=trips`

#### Hashtag Search

- Typing `#tagname` (leading `#`) switches search mode to hashtag search
- Queries `user_posts WHERE hashtags @> ARRAY['tagname']`
- Dropdown shows matching posts only, no users/trips section
- "See all" → `/feeds/tag/[tagname]`

### 4.6 Post Type Labels & Icons

| `post_type` | Display Label | Icon |
|-------------|---------------|------|
| `status_update` | Update | MessageSquare |
| `trip_planning` | Planning a Trip | MapPin |
| `trip_completed` | Trip Completed | CheckCircle |
| `photo` | Photo | Camera |
| `question` | Question | HelpCircle |
| `tip` | Travel Tip | Lightbulb |

### 4.6 Feed Pagination Strategy

- **Page size:** 10 posts per load
- **Trigger:** Load next page when user scrolls within 300px of bottom (IntersectionObserver)
- **State:** Client-side JS tracks `page` counter; appends new cards to DOM
- **Interleave:** After every 5 posts, inject 1 `FeedTripCard` from `get_discover_trips`

---

## 5. Current Gaps & Improvement Opportunities

### 5.1 High Priority (P0)

- [ ] Add auth guard — redirect unauthenticated users to `/signin`
- [ ] Replace `Feeds.astro` static data with real `get_feed_posts` RPC
- [ ] Create `get_feed_posts` RPC (migration) joining `user_posts` + `users`
- [ ] Create `feed.getPosts` Astro action
- [ ] Build `FeedCard.astro` component for real post data
- [ ] Wire up "View Trip" link on discovery cards to `/trips/[trip_id]`
- [ ] Build `GlobalSearchBar.astro` with debounced dropdown (Users / Trips / Posts)
- [ ] Create `search.global` action reusing `search_users_for_invitation` + `get_recent_trips`
- [ ] Write `search_posts` RPC (migration 054) for post full-text search
- [ ] Build `/search` results page with tab navigation

### 5.2 Medium Priority (P1)

- [ ] `FeedComposer.astro` — post creation UI
- [ ] `feed.createPost` action + `create_user_post` RPC
- [ ] Like/reaction toggle (`feed.toggleReaction`)
- [ ] Comment sheet (`CommentSheet.astro` + `feed.getComments`, `feed.createComment`)
- [ ] Bookmark/save toggle (`feed.toggleBookmark`)
- [ ] Filter tabs for post type
- [ ] Interleave suggested trips every 5th card

### 5.3 Low Priority (P2)

- [ ] Infinite scroll (replace paginated load-more button)
- [ ] Hashtag linking → feed filtered by hashtag
- [ ] Mention linking → profile page
- [ ] "Who liked this" list popup
- [ ] Photo upload on posts (R2 storage)
- [ ] Post sharing (Web Share API)
- [ ] Report post flow

---

## 6. Implementation Phases

### Phase 1: Real Data + Search (P0)
- [ ] Add auth guard to `/feeds` page
- [ ] Write `get_feed_posts` RPC (chronological, friends + public posts, joined with user avatar/name)
- [ ] Create `feed.getPosts` action in `src/actions/index.ts` (or `src/actions/feed.ts`)
- [ ] Replace `Feeds.astro` static mock with `FeedCard.astro` consuming real action data
- [ ] Replace hardcoded trip cards with real `get_discover_trips` data
- [ ] Build `GlobalSearchBar.astro` with as-you-type dropdown (debounced, 3 grouped sections)
- [ ] Create `search.*` actions: `search.users` (reuse existing RPC), `search.trips`, `search.posts`
- [ ] Write `search_posts` RPC (migration 054) — full-text on `user_posts.title + content`
- [ ] Create `/search` results page with All / Users / Trips / Posts tabs

### Phase 2: Compose & Engage (P1)
- [ ] Build `FeedComposer.astro` with post type selector and submit
- [ ] `feed.createPost` action + `create_user_post` RPC
- [ ] Like reaction toggle
- [ ] Inline comment count + "View comments" → `CommentSheet.astro`

### Phase 3: Social Features (P1)
- [ ] Filter tabs by post type
- [ ] Bookmark (save) toggle
- [ ] Post edit/delete (own posts)
- [ ] Mention + hashtag display (non-functional links initially)

### Phase 4: Discovery & UX (P2)
- [ ] Infinite scroll via IntersectionObserver
- [ ] Photo uploads on posts
- [ ] Suggested trips interleaved in feed
- [ ] Hashtag feed page (`/feeds/tag/[hashtag]`)

---

## 7. File Manifest

```
src/
├── pages/
│   ├── feeds/
│   │   └── index.astro                   ← Current (needs rewrite)
│   └── search/
│       └── index.astro                   ← New: /search results page
├── components/
│   └── Feeds.astro                       ← Replace with feature-based components
├── features/
│   ├── feed/                             ← Feed feature folder
│   │   ├── FeedComposer.astro
│   │   ├── FeedCard.astro
│   │   ├── FeedTripCard.astro
│   │   ├── FeedFilterTabs.astro
│   │   ├── CommentSheet.astro
│   │   ├── ReactionPicker.astro
│   │   └── PostTypeSelect.astro
│   └── search/                           ← Search feature folder
│       ├── GlobalSearchBar.astro         ← Search input + as-you-type dropdown
│       ├── SearchDropdown.astro          ← Grouped results (Users/Trips/Posts)
│       └── SearchResultsTabs.astro       ← Tabs for /search results page
└── actions/
    ├── feed.ts                           ← New action namespace (feed.*)
    └── search.ts                         ← New action namespace (search.*)

database-migrations/
├── 050_get_feed_posts.sql                ← get_feed_posts RPC
├── 051_create_user_post.sql              ← create_user_post RPC
├── 052_post_reactions.sql                ← toggle_post_reaction RPC
├── 053_post_comments_rpc.sql             ← get_post_comments + create_comment RPCs
└── 054_search_posts.sql                  ← search_posts RPC (full-text on user_posts)
```

---

*Created: 2026-03-02*
*Status: Planning — Phase 1 not started. Current `/feeds` page uses static placeholder data only.*
