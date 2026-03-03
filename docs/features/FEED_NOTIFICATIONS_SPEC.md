# Feed Social Notifications — Feature Spec

## Overview

Add in-app notifications for feed social interactions:
- Someone **likes** your post → notify post author
- Someone **comments** on your post → notify post author
- Someone **replies** to your comment → notify comment author

Notifications appear in the existing `NotificationBell` dropdown and `/notifications` page
within the 30-second polling window.

This spec also formalizes the **notification lifecycle** (cleanup on reversal, deduplication)
that applies to ALL notification types — not just the new feed ones.

---

## Notification Lifecycle Model

Notifications fall into two categories:

### Action-Required
These have Accept / Decline / Approve buttons in the bell dropdown.
When the **originating action is cancelled or resolved**, the notification must be deleted
(it is no longer actionable and clutters the inbox).

| Type | Created when | Deleted when |
|------|-------------|-------------|
| `friend_request` | A sends request to B | A cancels the request |
| `trip_invite` | A invites B to trip | A withdraws the invite |
| `trip_join_request` | A requests to join trip | A cancels the request |

On **re-send** (A cancels then sends again): delete the old notification first, then create a fresh one.
This prevents duplicate "accept/decline" cards in B's inbox.

### Informational
These carry past-tense information only — no action button. We deduplicate
to prevent notification spam from accidental like → unlike → like cycles.

| Type | Created when | Deleted when | Deduplication |
|------|-------------|-------------|---------------|
| `post_like` | A likes B's post | A **unlikes** the post (unread only) — via `notify_post_unlike` trigger (`067_unlike_removes_unread_notification.sql`) | Skip if an unread `post_like` for the same (actor A, post) already exists |
| `post_comment` | A comments on B's post | Never | None (each comment is unique) |
| `comment_reply` | A replies to B's comment | Never | None (each reply is unique) |

---

## New Notification Types

| Type | Recipient | Self-notify |
|------|----------|-------------|
| `post_like` | Post author | Never |
| `post_comment` | Post author | Never |
| `comment_reply` | Parent comment author | Never |

---

## Payload Shape

### `post_like`
```json
{
  "avatar_url": "post/{uuid}.jpg | null",
  "username":   "jandave",
  "post_id":    "uuid"
}
```
- title: `"{full_name} liked your post"`
- message: `COALESCE(post_title, first 60 chars of content + "…")`
- action_url: `/feed`

### `post_comment`
```json
{
  "avatar_url": "post/{uuid}.jpg | null",
  "username":   "jandave",
  "post_id":    "uuid",
  "comment_id": "uuid"
}
```
- title: `"{full_name} commented on your post"`
- message: `'"' + first 80 chars of comment + '…"'`
- action_url: `/feed`

### `comment_reply`
```json
{
  "avatar_url": "post/{uuid}.jpg | null",
  "username":   "jandave",
  "post_id":    "uuid",
  "comment_id": "uuid"
}
```
- title: `"{full_name} replied to your comment"`
- message: `'"' + first 80 chars of reply + '…"'`
- action_url: `/feed`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `database-migrations/065_feed_notifications.sql` | Create |
| `src/actions/friends.ts` | Edit — call cleanup RPC when friend request cancelled |
| `src/actions/trip.ts` | Edit — call cleanup RPC when invite withdrawn / join request cancelled |
| `src/components/Notification/NotificationBell.astro` | Edit — add icons for 3 new types |
| `src/pages/notifications/index.astro` | Edit — add icons for 3 new types |

---

## Migration 065

### Step 1 — Extend type allowlist

The `create_notification` function (migration 041) has a hardcoded `IF p_type NOT IN (...)` guard.
The `notifications` table (migration 007) has a `CHECK` constraint on `type`.
Both must be updated to include the 3 new types.

> Before running: confirm the constraint name with
> `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'notifications' AND constraint_type = 'CHECK';`

```sql
-- 1a. Extend table CHECK constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
  'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 'trip_member_removed',
  'trip_update', 'trip_reminder', 'friend_request', 'friend_accepted', 'system_announcement',
  'post_like', 'post_comment', 'comment_reply'
));

-- 1b. Drop + recreate create_notification adding new types to IN (...) guard
```

### Step 2 — New RPC: `delete_notification_by_ref`

A generic cleanup function used for action-required notifications when their source is cancelled.

```sql
CREATE OR REPLACE FUNCTION public.delete_notification_by_ref(
  p_recipient_auth_id UUID,   -- auth_id of the person who received the notification
  p_type              VARCHAR,
  p_ref_key           TEXT,   -- JSONB key to match, e.g. 'sender_user_id', 'invitation_id'
  p_ref_value         TEXT    -- value to match
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id FROM users WHERE auth_id = p_recipient_auth_id LIMIT 1;
  IF v_user_id IS NULL THEN RETURN; END IF;

  DELETE FROM notifications
  WHERE user_id = v_user_id
    AND type    = p_type
    AND data ->> p_ref_key = p_ref_value
    AND is_read = FALSE;  -- only remove unread; already-read ones can stay as history
END;
$$;
```

**Callers:**

| Action cancelled | Caller | p_type | p_ref_key | p_ref_value |
|-----------------|--------|--------|-----------|-------------|
| Friend request cancelled | `friends.ts` cancel handler | `friend_request` | `sender_user_id` | canceller's internal user_id |
| Trip invite withdrawn | `trip.ts` withdraw handler | `trip_invite` | `invitation_id` | invitation UUID |
| Join request cancelled | `trip.ts` cancel handler | `trip_join_request` | `member_id` | requester's internal user_id |

The action handlers in TypeScript call:
```typescript
await supabaseAdmin.rpc("delete_notification_by_ref", {
  p_recipient_auth_id: recipientAuthId,
  p_type:              "friend_request",
  p_ref_key:           "sender_user_id",
  p_ref_value:         senderInternalUserId,
});
```

### Step 3 — Trigger: `post_like`

**AFTER INSERT** on `post_interactions` (only `interaction_type = 'like'`).

```
1. Skip if interaction_type != 'like'
2. Look up post author (user_posts WHERE post_id = NEW.post_id)
3. Skip if author == liker (self-like)
4. DEDUPLICATION: skip if an unread 'post_like' notification already exists
   WHERE user_id = author AND data->>'post_id' = NEW.post_id AND data->>'username' = liker_username AND is_read = FALSE
5. Get liker's full_name, username, avatar_url
6. Get post title / content snippet
7. Call create_notification(...)
```

### Step 4 — Trigger: `post_comment` / `comment_reply`

**AFTER INSERT** on `post_comments`.

```
IF parent_comment_id IS NULL THEN
  recipient = post author (user_posts WHERE post_id = NEW.post_id)
  type      = 'post_comment'
  title     = "{full_name} commented on your post"
ELSE
  recipient = parent comment author (post_comments WHERE comment_id = NEW.parent_comment_id)
  type      = 'comment_reply'
  title     = "{full_name} replied to your comment"
END IF

Skip if recipient == commenter (self)
message = '"' || LEFT(NEW.content, 80) || (CASE WHEN length > 80 THEN '…' ELSE '' END) || '"'
data    = { avatar_url, username, post_id, comment_id }
Call create_notification(recipient, type, title, message, data, '/feed', 'normal', NULL)
```

No deduplication needed — each comment is a distinct entity (unique comment_id).

---

## NotificationBell + Notifications Page

### Icons
Both `NotificationBell.astro` and `notifications/index.astro` include `getNotificationIcon()` with:

| Type | SVG icon | Color class |
|------|----------|-------------|
| `post_like` | Heart (filled) | `text-pink-500` |
| `post_comment` | Chat bubble | `text-blue-500` |
| `comment_reply` | Reply arrow | `text-indigo-500` |

No action buttons — informational types navigate to `action_url` on click.

### Action Describer — `buildNotificationBody()`
Feed-type notifications render a two-line body:

```
[username] liked your post          ← action verb
"First 80 chars of content…"        ← message preview, line-clamp-2
```

Non-feed types keep their original inline format: `[username] [message]`.

Implemented as a `buildNotificationBody(notification)` helper in both files.

### Feed Filter Tab
`/notifications` page has a "Feed" tab that client-side filters to
`post_like`, `post_comment`, `comment_reply` only.

---

## Verification Checklist

**Feed notifications (new):**
- [ ] A likes B's post → B gets `post_like` within 30s
- [ ] A likes own post → no notification
- [ ] A likes, unlikes, re-likes B's post → only 1 notification (dedup)
- [ ] A comments on B's post → B gets `post_comment`
- [ ] A replies to B's comment → B gets `comment_reply`
- [ ] A replies to own comment → no notification
- [ ] Bell badge increments correctly
- [ ] Clicking notification → navigates to `/feed`

**Cleanup on reversal (existing + new):**
- [ ] A sends friend request → B gets notification
- [ ] A cancels friend request → B's `friend_request` notification disappears (if unread)
- [ ] A re-sends friend request → B gets a fresh notification (no duplicates)
- [ ] Trip invite withdrawn → invitee's unread `trip_invite` notification removed
- [ ] Join request cancelled → organizer's unread `trip_join_request` notification removed

---

## Open Questions

- **`post_like` deduplication window**: Currently "while still unread". Alternative: fixed 24h window.
  Unread-based is simpler (no timestamp comparison) and more user-friendly (if B reads the first like
  notification, a new one for a re-like is informative).
- **comment_like notifications**: Out of scope. Dislike notifications definitely not wanted.
- **Post permalink**: `action_url = /feed` for now. Update when individual post pages exist.
- **Constraint name in production**: Verify before running migration (see Step 1 note).
- **Existing friend_request/invite cleanup**: The TypeScript handlers need to be identified
  (where in `friends.ts` / `trip.ts` the cancel/withdraw actions are) before wiring up the RPC call.
