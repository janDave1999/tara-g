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
| Post Detail | `/post/[id]` | `src/pages/post/[id].astro` | ✅ Live |

### 1.2 Phase 1 — Implemented (2026-03-02)

| Item | Status |
|------|--------|
| Post detail page `/post/[id]` (auth + unauth) | ✅ Done |
| OG / Twitter Card meta tags on post detail page | ✅ Done |
| Like toggle on post detail page | ✅ Done |
| Threaded comments on post detail page (2 levels deep) | ✅ Done |
| Comment like/dislike on post detail page | ✅ Done |
| Report comment on post detail page | ✅ Done |
| FeedCard title/content → clickable link to post detail | ✅ Done |
| Reach-based share tracking (`post_shares` + `post_share_visits`) | ✅ Done (migration 071) |
| Share button generates trackable `?sid=` URL | ✅ Done |
| Visit ping records share reach (client-side JS, bot-safe) | ✅ Done |
| DB trigger owns `share_count` increment (same pattern as likes) | ✅ Done |

### 1.2a Phase 1 — Original Feed (2026-03-02)

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

### 1.3 Database Tables

| Table | Migration | Purpose | Status |
|-------|-----------|---------|--------|
| `user_posts` | 007 | User-authored posts with type, content, hashtags, location, counts | ✅ Exists |
| `post_interactions` | 007 | Reactions and saves per post | ✅ Exists |
| `post_comments` | 007 | Threaded comments on posts | ✅ Exists |
| `user_photo_albums` | 007 | Photo albums linked to users | ✅ Exists |
| `comment_interactions` | 062 | Per-user like/dislike on comments (UNIQUE per user per comment) | ✅ Exists |
| `reports` | 063 | User reports on posts and comments | ✅ Exists |
| `post_shares` | 071 | One row per share action; links sharer to a `share_id` | ✅ Exists |
| `post_share_visits` | 071 | One row per unique visitor per share link; UNIQUE(share_id, visitor_token) | ✅ Exists |

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
| US-F13 | Like a post | ✅ Done |
| US-F14 | See reaction counts | ✅ Done (live) |
| US-F15 | Comment on a post | ✅ Done |
| US-F16 | Bookmark/save a post | ❌ Phase 3 |
| US-F17 | Share a post (reach-based count) | ✅ Done |
| US-F18a | Share generates trackable `?sid=` URL | ✅ Done |
| US-F18b | Visiting a share link increments reach count once per unique visitor | ✅ Done |
| US-F18c | Sharer opening their own link does not increment count | ✅ Done |
| US-F18d | OG scrapers (Messenger/Viber preview bots) do not increment count | ✅ Done (client-side ping) |
| US-F18e | Anonymous visitors tracked via localStorage token | ✅ Done |

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
| `feed` | `feed.getPost` | `{ postId }` | ✅ Single post fetch for `/post/[id]` |
| `feed` | `feed.toggleLike` | `{ postId }` | ✅ Like/unlike a post |
| `feed` | `feed.getComments` | `{ postId, limit, offset }` | ✅ Threaded comments (auth + unauth) |
| `feed` | `feed.createComment` | `{ postId, content, parentCommentId? }` | ✅ Post/reply a comment |
| `feed` | `feed.toggleCommentLike` | `{ commentId, type }` | ✅ Like/dislike a comment |
| `feed` | `feed.createReport` | `{ targetType, targetId, reason }` | ✅ Report post or comment |
| `feed` | `feed.createShareLink` | `{ postId }` | ✅ Creates `post_shares` row, returns `shareId` |
| `feed` | `feed.recordShareVisit` | `{ shareId, visitorToken }` | ✅ Records visit; trigger increments share_count |
| `search` | `search.global` | `{ q, limit? }` (default `limit=3`) | ✅ `src/actions/search.ts` |

> `search.global` uses `limit=3` by default (for the GlobalSearchBar dropdown). The `/search` page calls it with `limit=10` for live results.

> `feed.createShareLink` replaces the old `incrementShareCount` action. Share count is no longer incremented on the sharer's side — it increments when recipients visit the shared URL.

### 4.3 RPC Functions

| Function | Migration | Purpose | Status |
|----------|-----------|---------|--------|
| `get_feed_posts` | 050 | Chronological public posts joined with user data; paginated | ✅ Run |
| `search_posts` | 054 | ILIKE search on `user_posts.title + content`; returns JSONB array | ✅ Run |
| `get_people_you_may_know` | 055 | Ranked user suggestions: trip mates → mutuals → random fill | ✅ Run |
| `get_suggested_trips` | (existing) | Reused for `/search` default Suggested Trips section | ✅ Existing |
| `get_recent_trips` | (existing) | Reused for feed discovery cards + search trips | ✅ Existing |
| `search_users_for_invitation` | (existing) | Reused for user search (`p_trip_id = null`) | ✅ Existing |
| `toggle_post_like` | 061 | Like/unlike a post; DB trigger owns `like_count` | ✅ Run |
| `create_post_comment` | 061 | Create comment or reply; DB trigger owns `comment_count` | ✅ Run |
| `get_post_comments` | 062 | Threaded comments with viewer interaction state | ✅ Run |
| `toggle_comment_interaction` | 062 | Like/dislike a comment with manual count updates | ✅ Run |
| `create_report` | 063 | Report a post or comment; deduped per user per target | ✅ Run |
| `get_single_post` | 070 | Single post JSONB for `/post/[id]`; returns NULL if not found/not public | ✅ Run |
| `create_share_link` | 071 | Inserts into `post_shares`; returns `share_id` UUID | ✅ Run |
| `record_share_visit` | 071 | Inserts into `post_share_visits` ON CONFLICT DO NOTHING; trigger fires | ✅ Run |

### 4.3a Share Count — Reach Model

`share_count` on `user_posts` represents **unique people who opened a shared link**, not the number of times the share button was pressed.

```
Sharer clicks Share
  → createShareLink action → INSERT post_shares → returns share_id
  → URL = /post/{id}?sid={share_id}
  → native share sheet or clipboard

Recipient opens URL in browser
  → SSR renders page + OG tags (no count yet — bots also do this)
  → Client JS reads ?sid from URL
  → getVisitorToken(): auth user_id OR localStorage UUID
  → recordShareVisit action → INSERT post_share_visits ON CONFLICT DO NOTHING
  → DB trigger → share_count + 1 (only if new row inserted)

Rules:
  - Same visitor, same share link → counted once (UNIQUE constraint)
  - Sharer opens their own link → skipped (self-visit guard in RPC)
  - OG scraper bot → not counted (no JS execution)
  - Group chat: 50 people open same link → share_count + 50
```

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
| `FeedCard.astro` | `src/features/feed/FeedCard.astro` | ✅ Built — title links to `/post/[id]`, share generates trackable URL |
| `CommentSheet.astro` | `src/features/feed/CommentSheet.astro` | ✅ Built — threaded 2-level, like/dislike, reply, report |
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
│   ├── post/
│   │   └── [id].astro                    ✅ Post detail — auth + unauth, OG tags, likes, comments, share
│   └── search/
│       └── index.astro                   ✅ Live search + discovery default + People/Trips sections
├── features/
│   ├── feed/
│   │   ├── FeedCard.astro                ✅ Post card — title links to /post/[id], reach-based share
│   │   └── CommentSheet.astro            ✅ Threaded comments (2 levels), like/dislike, reply, report
│   └── search/
│       └── GlobalSearchBar.astro         ✅ Feeds page search dropdown (3 grouped sections)
├── components/
│   └── TripCard.astro                    ✅ Enhanced: class prop, flex-col, mt-auto footer
└── actions/
    ├── feed.ts                           ✅ getPosts, getPost, toggleLike, getComments, createComment,
    │                                        toggleCommentLike, createReport, createShareLink, recordShareVisit
    ├── search.ts                         ✅ search.global({ q, limit })
    └── index.ts                          ✅ feed + search exported in server object

database-migrations/
├── 050_get_feed_posts.sql                ✅ Paginated public posts joined with user data
├── 054_search_posts.sql                  ✅ ILIKE search on user_posts title + content
├── 055_get_people_you_may_know.sql       ✅ Ranked suggestions: trip mates → mutuals → random
├── 061_fix_double_count.sql              ✅ toggle_post_like + create_post_comment (trigger owns counts)
├── 062_comment_threads.sql               ✅ comment_interactions, get_post_comments, toggle_comment_interaction
├── 063_reports.sql                       ✅ reports table + create_report RPC
├── 070_get_single_post.sql               ✅ get_single_post RPC (auth + anon)
└── 071_share_reach.sql                   ✅ post_shares, post_share_visits, trigger, create_share_link, record_share_visit
```

---

*Created: 2026-03-02 · Last updated: 2026-03-04*
*Phase 1 complete including post detail page, threaded comments, like/dislike, reports, and reach-based share tracking.*
