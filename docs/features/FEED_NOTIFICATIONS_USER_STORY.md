# User Story: Feed Social Notifications

## Epic
As a user of Tara-G, I want to be notified when other people interact with my posts and comments, so I stay engaged with the community without having to manually check my feed.

---

## User Stories

### US-01 — Post Like Notification
**As a** post author,
**I want to** receive a notification when someone likes my post,
**So that** I know my content is being appreciated.

**Acceptance Criteria:**
- When User A likes User B's post, User B receives a `post_like` notification
- The notification shows User A's avatar, name, and a preview of the post title or content
- If User A likes, unlikes, and re-likes the same post, User B only receives **one** notification (no spam)
- User B does **not** receive a notification if they like their own post
- The notification appears in the bell dropdown within 30 seconds (polling interval)
- Clicking the notification navigates to `/feed`

---

### US-02 — Post Comment Notification
**As a** post author,
**I want to** receive a notification when someone comments on my post,
**So that** I can join the conversation.

**Acceptance Criteria:**
- When User A comments on User B's post, User B receives a `post_comment` notification
- The notification shows User A's avatar, name, and a quoted preview of the comment (up to 80 chars)
- User B does **not** receive a notification if they comment on their own post
- Each comment creates its own notification (no deduplication — each comment is unique)
- The notification appears in the bell dropdown within 30 seconds

---

### US-03 — Comment Reply Notification
**As a** commenter,
**I want to** receive a notification when someone replies to my comment,
**So that** I can follow the thread and respond.

**Acceptance Criteria:**
- When User A replies to User B's comment, User B receives a `comment_reply` notification
- The notification shows User A's avatar, name, and a quoted preview of the reply (up to 80 chars)
- User B does **not** receive a notification if they reply to their own comment
- Replies at level 2 (reply-to-reply) notify the level-1 comment author, not the original post author
- The notification appears in the bell dropdown within 30 seconds

---

### US-04 — Cancelled Friend Request Cleans Up Notification
**As a** user who received a friend request,
**I want** the friend request notification to disappear if the sender cancels it,
**So that** I don't see stale Accept/Decline prompts for requests that no longer exist.

**Acceptance Criteria:**
- When User A sends a friend request to User B → User B gets a `friend_request` notification
- When User A cancels the request → User B's **unread** `friend_request` notification is deleted
- If User B had already read the notification, it stays as history
- When User A re-sends the request → User B gets a **fresh** notification (no duplicates)

---

### US-05 — Cancelled Join Request Cleans Up Notification
**As a** trip organizer,
**I want** the join request notification to disappear if the requester cancels,
**So that** I don't see pending Approve/Decline prompts for withdrawn requests.

**Acceptance Criteria:**
- When User A requests to join a trip → The organizer gets a `trip_join_request` notification
- When User A cancels the request → The organizer's **unread** `trip_join_request` notification is deleted
- If the organizer had already read the notification, it stays as history

---

### US-06 — Notification Icons for Feed Activity
**As a** user viewing my notifications,
**I want** feed-type notifications to have distinct icons and colors,
**So that** I can quickly distinguish a post like from a comment reply at a glance.

**Acceptance Criteria:**
- `post_like` → pink heart icon
- `post_comment` → blue chat bubble icon
- `comment_reply` → indigo reply-arrow icon
- Icons appear correctly in both the bell dropdown and the full `/notifications` page

---

### US-07 — Feed Filter Tab on Notifications Page
**As a** user on the notifications page,
**I want** to filter notifications to show only feed activity (likes, comments, replies),
**So that** I can focus on social interactions without trip or friend request noise.

**Acceptance Criteria:**
- A "Feed" tab appears alongside All, Unread, Trip Invites, and Join Requests tabs
- Clicking Feed filters the list to only `post_like`, `post_comment`, `comment_reply`, `comment_like` notifications
- Load More works correctly within the Feed filter

---

### US-08 — Action Describer in Notification Body
**As a** user reading my notifications,
**I want** each feed notification to clearly state what action was taken,
**So that** I understand at a glance what happened without having to decode just a name and content snippet.

**Acceptance Criteria:**
- `post_like` → shows "**username** liked your post" with post content as a secondary line
- `post_comment` → shows "**username** commented on your post" with comment preview as a secondary line
- `comment_reply` → shows "**username** replied to your comment" with reply preview as a secondary line
- Long previews wrap to 2 lines maximum then ellipsis (`line-clamp-2`)
- Behaviour is identical in both the bell dropdown and the `/notifications` page
- Non-feed types (trip invites, friend requests, etc.) keep their existing inline format unchanged

---

### US-09 — Unlike Removes Unread Like Notification
**As a** post author,
**I want** the like notification to be removed if the liker immediately undoes the like,
**So that** I don't see notifications for actions that were quickly reversed.

**Acceptance Criteria:**
- When User A unlikes a post after liking it, their unread `post_like` notification is deleted from User B's inbox
- Already-read notifications are **not** deleted (they serve as history)
- Only the specific liker's notification is removed — other users' like notifications on the same post are unaffected

---

### US-10 — Time Dividers on Notifications Page
**As a** user viewing my notifications,
**I want** notifications grouped by time period with a visual divider,
**So that** I can quickly orient myself to how recent each notification is.

**Acceptance Criteria:**
- Notifications are separated into at most four groups: **Today**, **Last 7 days**, **This month**, **Older**
- A group divider (horizontal rule + label) appears before the first notification of each group
- Dividers are dynamic — groups with no notifications are never shown
- The first divider has no extra top padding; subsequent dividers have spacing to separate groups clearly
- Dividers appear correctly in all filter tabs (All, Unread, Trip Invites, Join Requests, Feed)
- When "Load More" loads items in a new time bucket, the new divider is inserted correctly above those items
- When "Load More" loads items in an already-rendered bucket, no duplicate divider appears
- Switching filter tabs resets all dividers correctly (no leftover groups from the previous tab)

---

## Task Breakdown

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1 | Extend `notifications` CHECK constraint to include `post_like`, `post_comment`, `comment_reply` | `065_feed_notifications.sql` | ✅ Done |
| 2 | Update `create_notification` RPC type guard to accept new types | `065_feed_notifications.sql` | ✅ Done |
| 3 | Add `delete_notification_by_ref` RPC (cleanup by type + JSONB key/value) | `065_feed_notifications.sql` | ✅ Done |
| 4 | Add `notify_post_like` DB trigger (AFTER INSERT on `post_interactions`) | `065_feed_notifications.sql` | ✅ Done |
| 5 | Add `notify_post_comment` DB trigger (AFTER INSERT on `post_comments`) | `065_feed_notifications.sql` | ✅ Done |
| 6 | Wire `delete_notification_by_ref` in `cancelFriendRequest` action | `src/actions/friends.ts` | ✅ Done |
| 7 | Wire `delete_notification_by_ref` in `cancelJoinRequest` action | `src/actions/trips.ts` | ✅ Done |
| 8 | Add `post_like`, `post_comment`, `comment_reply` icons to bell dropdown | `src/components/Notification/NotificationBell.astro` | ✅ Done |
| 9 | Add same icons + Feed filter tab to `/notifications` page | `src/pages/notifications/index.astro` | ✅ Done |
| 10 | Add `notify_post_unlike` trigger — remove unread `post_like` notification on unlike | `067_unlike_removes_unread_notification.sql` | ⏳ Needs DB run |
| 11 | Add `buildNotificationBody()` — action describer for feed notification types (bell + page) | `NotificationBell.astro`, `notifications/index.astro` | ✅ Done |
| 12 | Long comment preview: `line-clamp-2` instead of `truncate` | `NotificationBell.astro`, `notifications/index.astro` | ✅ Done |
| 13 | Add time-period dividers (Today / Last 7 days / This month / Older) — dynamic, no empty groups | `src/pages/notifications/index.astro` | ✅ Done |

---

## Migrations to Run

| File | Status | Notes |
|------|--------|-------|
| `database-migrations/065_feed_notifications.sql` | ✅ Applied | Core feed notification triggers + RPC |
| `database-migrations/067_unlike_removes_unread_notification.sql` | ⏳ Pending | Run in Supabase SQL editor; safe to re-run (`CREATE OR REPLACE` + `DROP IF EXISTS`) |

Run pending migrations in the Supabase SQL editor in order.

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| `post_like` deduplication | Skip if unread notification from same liker on same post exists | Prevents spam from like → unlike → re-like cycles; unread-based so a second like after reading is informative |
| `post_comment` / `comment_reply` deduplication | None | Each comment has a unique ID; no spam risk |
| Unlike removes notification? | Yes (unread only) | Prevents orphaned action prompts; read notifications stay as history |
| Cleanup scope | Unread only | Already-read notifications serve as history |
| Trip invite withdrawal | Not implemented | No withdraw action exists in `trips.ts` yet; add when feature is built |
| `action_url` for feed notifications | `/feed` | No individual post permalink exists yet; update when post pages are added |
| Time divider bucket boundaries | Today / Last 7 days / This month / Older | Calendar-day comparison so "Today" is always the current date; "Last 7 days" is 1–6 days ago; "This month" is 7–29 days ago |
| Empty-group suppression | Client-side — `renderedGroups` Set tracks which buckets have been inserted | Prevents showing "Last 7 days" header with nothing under it; no DB changes needed |
| Load More divider deduplication | `renderedGroups.has(bucket)` check before inserting | Same bucket label is never inserted twice even across multiple loads |

---

## Verification Checklist

### Feed Notifications
- [x] User A likes User B's post → B gets `post_like` within 30s
- [x] User A likes own post → no notification
- [x] User A likes → unlikes → re-likes B's post → only 1 notification (dedup)
- [x] User A comments on B's post → B gets `post_comment`
- [x] User A comments on own post → no notification
- [x] User A replies to B's comment → B gets `comment_reply`
- [x] User A replies to own comment → no notification
- [x] Bell badge count increments correctly
- [x] Clicking notification navigates to `/feed`
- [x] `post_like` shows pink heart icon
- [x] `post_comment` shows blue chat bubble icon
- [x] `comment_reply` shows indigo reply arrow icon

### Action Describer (US-08)
- [x] `post_like` notification shows "**username** liked your post" + post content below
- [x] `post_comment` notification shows "**username** commented on your post" + comment preview below
- [x] `comment_reply` notification shows "**username** replied to your comment" + reply preview below
- [x] Long previews (>2 lines) are clamped with ellipsis in both bell and page
- [x] Non-feed types (trip invites, friend requests) still use existing inline format

### Unlike Removes Notification (US-09)
- [x] User A likes → unlikes B's post → B's unread `post_like` notification is gone (requires migration 067)
- [x] B had already read the notification → unlike does NOT remove it
- [x] User C also liked B's same post → A's unlike does NOT affect C's notification

### Notification Cleanup
- [x] A sends friend request → B gets `friend_request` notification
- [x] A cancels request → B's unread notification disappears
- [x] A re-sends request → B gets a fresh notification (no duplicates)
- [x] A requests to join trip → organizer gets `trip_join_request`
- [x] A cancels join request → organizer's unread notification disappears

### Feed Filter Tab
- [x] "Feed" tab appears on `/notifications` page
- [x] Feed tab shows only `post_like`, `post_comment`, `comment_reply`, `comment_like`
- [x] Load More works within Feed filter

### Time Dividers (US-10)
- [x] Notifications from today appear under a "Today" divider
- [x] Notifications from 1–6 days ago appear under a "Last 7 days" divider
- [x] Notifications from 7–29 days ago appear under a "This month" divider
- [x] Notifications 30+ days old appear under an "Older" divider
- [x] If there are no notifications in a bucket, its divider does not appear at all
- [x] First divider has no extra top padding; each subsequent divider has visible spacing above it
- [x] Switching between filter tabs resets dividers — no stale group headers from the previous tab
- [x] "Load More" within the same bucket adds notifications without a duplicate divider
- [x] "Load More" that crosses into a new bucket inserts the correct new divider before those items
- [x] Dividers display correctly in all five filter tabs (All, Unread, Trip Invites, Join Requests, Feed)
