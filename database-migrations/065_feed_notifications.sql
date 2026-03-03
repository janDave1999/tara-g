-- =====================================================
-- MIGRATION 065: FEED SOCIAL NOTIFICATIONS
-- =====================================================
-- New notification types: post_like, post_comment, comment_reply
-- New RPC:     delete_notification_by_ref  (cleanup for cancelled actions)
-- New triggers: notify_post_like           (AFTER INSERT on post_interactions)
--               notify_post_comment        (AFTER INSERT on post_comments)
-- =====================================================


-- ── STEP 1: Extend CHECK constraint on notifications.type ─────────────────────
-- Migration 042 last set the allowlist; we drop it and recreate with the 3 new types.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
    'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 'trip_member_removed',
    'trip_update', 'trip_reminder', 'friend_request', 'friend_accepted', 'system_announcement',
    'post_like', 'post_comment', 'comment_reply'
));


-- ── STEP 2: Update create_notification — add new types to the guard ───────────
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id    UUID,
    p_type       VARCHAR,
    p_title      VARCHAR,
    p_message    VARCHAR,
    p_data       JSONB        DEFAULT '{}'::JSONB,
    p_action_url TEXT         DEFAULT NULL,
    p_priority   VARCHAR      DEFAULT 'normal',
    p_expires_at TIMESTAMPTZ  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    IF p_type NOT IN (
        'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
        'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added',
        'trip_member_removed', 'trip_update', 'trip_reminder',
        'friend_request', 'friend_accepted', 'system_announcement',
        'post_like', 'post_comment', 'comment_reply'
    ) THEN
        RAISE EXCEPTION 'Invalid notification type: %', p_type;
    END IF;

    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        p_priority := 'normal';
    END IF;

    INSERT INTO notifications (
        user_id, type, title, message, data, action_url, priority, expires_at
    ) VALUES (
        p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_priority, p_expires_at
    )
    RETURNING notification_id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;


-- ── STEP 3: delete_notification_by_ref ───────────────────────────────────────
-- Generic cleanup RPC: removes unread notifications by type + a JSONB data key/value.
-- Used when an action-required notification is no longer actionable
-- (friend request cancelled, join request withdrawn, etc.)
--
-- p_recipient_user_id : internal users.user_id of who received the notification
-- p_type              : notification type string
-- p_ref_key           : JSONB key in notifications.data to match against
-- p_ref_value         : expected string value for that key
--
-- Only deletes IS_READ = FALSE rows — already-read ones stay as history.
CREATE OR REPLACE FUNCTION public.delete_notification_by_ref(
    p_recipient_user_id UUID,
    p_type              VARCHAR,
    p_ref_key           TEXT,
    p_ref_value         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM notifications
    WHERE user_id          = p_recipient_user_id
      AND type             = p_type
      AND data ->> p_ref_key = p_ref_value
      AND is_read          = FALSE;
END;
$$;


-- ── STEP 4: Trigger — post_like ───────────────────────────────────────────────
-- Fires AFTER INSERT on post_interactions WHERE interaction_type = 'like'.
-- Creates a 'post_like' notification for the post author, skipping:
--   • self-likes
--   • duplicates (another unread post_like from same liker on same post)
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author_id   UUID;
    v_post_title       TEXT;
    v_post_content     TEXT;
    v_liker_name       TEXT;
    v_liker_username   TEXT;
    v_liker_avatar     TEXT;
BEGIN
    -- Get post author + content snippet
    SELECT user_id, title, content
      INTO v_post_author_id, v_post_title, v_post_content
      FROM user_posts
     WHERE post_id = NEW.post_id;

    -- Skip if post not found or self-like
    IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get liker info
    SELECT full_name, username, avatar_url
      INTO v_liker_name, v_liker_username, v_liker_avatar
      FROM users
     WHERE user_id = NEW.user_id;

    -- Deduplication: skip if an unread post_like from this liker on this post already exists
    IF EXISTS (
        SELECT 1 FROM notifications
         WHERE user_id          = v_post_author_id
           AND type             = 'post_like'
           AND is_read          = FALSE
           AND data ->> 'post_id'  = NEW.post_id::TEXT
           AND data ->> 'username' = v_liker_username
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM create_notification(
        v_post_author_id,
        'post_like',
        v_liker_name || ' liked your post',
        COALESCE(NULLIF(TRIM(v_post_title), ''), LEFT(v_post_content, 60) || '…'),
        jsonb_build_object(
            'avatar_url', v_liker_avatar,
            'username',   v_liker_username,
            'post_id',    NEW.post_id::TEXT
        ),
        '/feed',
        'normal',
        NULL
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_like ON post_interactions;
CREATE TRIGGER trg_notify_post_like
    AFTER INSERT ON post_interactions
    FOR EACH ROW
    WHEN (NEW.interaction_type = 'like')
    EXECUTE FUNCTION notify_post_like();


-- ── STEP 5: Trigger — post_comment / comment_reply ───────────────────────────
-- Fires AFTER INSERT on post_comments.
-- • No parent_comment_id → top-level comment → notify post author (post_comment)
-- • Has parent_comment_id → reply → notify parent comment author (comment_reply)
-- Skips self-notifications in both cases.
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recipient_id     UUID;
    v_notif_type       TEXT;
    v_notif_title      TEXT;
    v_commenter_name   TEXT;
    v_commenter_uname  TEXT;
    v_commenter_avatar TEXT;
    v_preview          TEXT;
BEGIN
    -- Get commenter info
    SELECT full_name, username, avatar_url
      INTO v_commenter_name, v_commenter_uname, v_commenter_avatar
      FROM users
     WHERE user_id = NEW.user_id;

    IF NEW.parent_comment_id IS NULL THEN
        -- Top-level comment → notify post author
        SELECT user_id INTO v_recipient_id
          FROM user_posts WHERE post_id = NEW.post_id;
        v_notif_type  := 'post_comment';
        v_notif_title := v_commenter_name || ' commented on your post';
    ELSE
        -- Reply → notify parent comment author
        SELECT user_id INTO v_recipient_id
          FROM post_comments WHERE comment_id = NEW.parent_comment_id;
        v_notif_type  := 'comment_reply';
        v_notif_title := v_commenter_name || ' replied to your comment';
    END IF;

    -- Skip if recipient not found or self-notification
    IF v_recipient_id IS NULL OR v_recipient_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Build quoted content preview
    v_preview := '"' || LEFT(NEW.content, 80) ||
                 CASE WHEN LENGTH(NEW.content) > 80 THEN '…' ELSE '' END || '"';

    PERFORM create_notification(
        v_recipient_id,
        v_notif_type,
        v_notif_title,
        v_preview,
        jsonb_build_object(
            'avatar_url', v_commenter_avatar,
            'username',   v_commenter_uname,
            'post_id',    NEW.post_id::TEXT,
            'comment_id', NEW.comment_id::TEXT
        ),
        '/feed',
        'normal',
        NULL
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_comment ON post_comments;
CREATE TRIGGER trg_notify_post_comment
    AFTER INSERT ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_post_comment();
