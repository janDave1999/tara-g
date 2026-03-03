-- =====================================================
-- MIGRATION 067: UNLIKE REMOVES UNREAD post_like NOTIFICATION
-- =====================================================
-- When a user unlikes a post (DELETE on post_interactions),
-- remove their unread post_like notification from the post
-- author's inbox — matching by both post_id AND username
-- so only the specific liker's notification is removed,
-- not notifications from other likers on the same post.
--
-- Already-read notifications are preserved as history.
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_post_unlike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_post_author_id UUID;
    v_liker_username TEXT;
BEGIN
    -- Get post author
    SELECT user_id INTO v_post_author_id
    FROM user_posts
    WHERE post_id = OLD.post_id;

    -- Skip if post not found or was a self-like
    IF v_post_author_id IS NULL OR v_post_author_id = OLD.user_id THEN
        RETURN OLD;
    END IF;

    -- Get liker's username (used as the notification data key)
    SELECT username INTO v_liker_username
    FROM users
    WHERE user_id = OLD.user_id;

    -- Remove the unread post_like notification for this liker + post only.
    -- Match on BOTH post_id and username to avoid touching notifications
    -- from other users who liked the same post.
    DELETE FROM notifications
    WHERE user_id          = v_post_author_id
      AND type             = 'post_like'
      AND data ->> 'post_id'  = OLD.post_id::TEXT
      AND data ->> 'username' = v_liker_username
      AND is_read          = FALSE;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_unlike ON post_interactions;
CREATE TRIGGER trg_notify_post_unlike
    AFTER DELETE ON post_interactions
    FOR EACH ROW
    WHEN (OLD.interaction_type = 'like')
    EXECUTE FUNCTION notify_post_unlike();
