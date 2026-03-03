-- =====================================================
-- MIGRATION 068: COMMENT LIKE NOTIFICATION
-- =====================================================
-- When User A likes User B's comment, notify User B.
-- When User A unlikes, remove the unread notification.
--
-- Deduplication: skip if an unread comment_like from the
-- same liker on the same comment already exists.
-- Self-likes never generate a notification.
-- =====================================================


-- ── STEP 1: Extend CHECK constraint ──────────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
    'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 'trip_member_removed',
    'trip_update', 'trip_reminder', 'friend_request', 'friend_accepted', 'system_announcement',
    'post_like', 'post_comment', 'comment_reply', 'comment_like'
));


-- ── STEP 2: Update create_notification type guard ────────────────────────────
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
        'post_like', 'post_comment', 'comment_reply', 'comment_like'
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


-- ── STEP 3: Trigger — notify_comment_like ────────────────────────────────────
-- Fires AFTER INSERT on comment_interactions WHERE interaction_type = 'like'.
-- Notifies the comment author, skipping:
--   • self-likes
--   • duplicate unread comment_like from same liker on same comment
CREATE OR REPLACE FUNCTION public.notify_comment_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_comment_author_id UUID;
    v_post_id           UUID;
    v_comment_preview   TEXT;
    v_liker_name        TEXT;
    v_liker_username    TEXT;
    v_liker_avatar      TEXT;
BEGIN
    -- Get comment author, post, and quoted preview
    SELECT pc.user_id,
           pc.post_id,
           '"' || LEFT(pc.content, 80) ||
               CASE WHEN LENGTH(pc.content) > 80 THEN '…' ELSE '' END || '"'
      INTO v_comment_author_id, v_post_id, v_comment_preview
      FROM post_comments pc
     WHERE pc.comment_id = NEW.comment_id;

    -- Skip if comment not found or self-like
    IF v_comment_author_id IS NULL OR v_comment_author_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get liker info
    SELECT full_name, username, avatar_url
      INTO v_liker_name, v_liker_username, v_liker_avatar
      FROM users
     WHERE user_id = NEW.user_id;

    -- Deduplication: skip if an unread comment_like from this liker on this comment already exists
    IF EXISTS (
        SELECT 1 FROM notifications
         WHERE user_id               = v_comment_author_id
           AND type                  = 'comment_like'
           AND is_read               = FALSE
           AND data ->> 'comment_id' = NEW.comment_id::TEXT
           AND data ->> 'username'   = v_liker_username
    ) THEN
        RETURN NEW;
    END IF;

    PERFORM create_notification(
        v_comment_author_id,
        'comment_like',
        v_liker_name || ' liked your comment',
        v_comment_preview,
        jsonb_build_object(
            'avatar_url', v_liker_avatar,
            'username',   v_liker_username,
            'post_id',    v_post_id::TEXT,
            'comment_id', NEW.comment_id::TEXT
        ),
        '/feed',
        'normal',
        NULL
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_like ON comment_interactions;
CREATE TRIGGER trg_notify_comment_like
    AFTER INSERT ON comment_interactions
    FOR EACH ROW
    WHEN (NEW.interaction_type = 'like')
    EXECUTE FUNCTION notify_comment_like();


-- ── STEP 4: Trigger — notify_comment_unlike (cleanup) ────────────────────────
-- Fires AFTER DELETE on comment_interactions WHERE interaction_type = 'like'.
-- Removes the unread comment_like notification for the specific liker + comment.
-- Already-read notifications are preserved as history.
CREATE OR REPLACE FUNCTION public.notify_comment_unlike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_comment_author_id UUID;
    v_liker_username    TEXT;
BEGIN
    -- Get comment author
    SELECT user_id INTO v_comment_author_id
      FROM post_comments
     WHERE comment_id = OLD.comment_id;

    -- Skip if comment not found or was a self-like
    IF v_comment_author_id IS NULL OR v_comment_author_id = OLD.user_id THEN
        RETURN OLD;
    END IF;

    -- Get liker's username (used as the notification data key)
    SELECT username INTO v_liker_username
      FROM users
     WHERE user_id = OLD.user_id;

    -- Remove unread comment_like for this liker + comment only
    DELETE FROM notifications
     WHERE user_id               = v_comment_author_id
       AND type                  = 'comment_like'
       AND data ->> 'comment_id' = OLD.comment_id::TEXT
       AND data ->> 'username'   = v_liker_username
       AND is_read               = FALSE;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_unlike ON comment_interactions;
CREATE TRIGGER trg_notify_comment_unlike
    AFTER DELETE ON comment_interactions
    FOR EACH ROW
    WHEN (OLD.interaction_type = 'like')
    EXECUTE FUNCTION notify_comment_unlike();
