-- =====================================================
-- MIGRATION 057: toggle_post_like RPC
-- =====================================================
-- Toggles a 'like' interaction for a user on a post.
-- Inserts if not liked, deletes if already liked.
-- Keeps like_count in sync on user_posts.
-- Returns the new liked state and updated count.
-- =====================================================

CREATE OR REPLACE FUNCTION public.toggle_post_like(
    p_user_id UUID,   -- auth_id of the viewer
    p_post_id UUID
)
RETURNS TABLE(liked BOOLEAN, new_like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_internal_id UUID;
    v_already     BOOLEAN;
BEGIN
    SELECT user_id INTO v_internal_id
    FROM users
    WHERE auth_id = p_user_id
    LIMIT 1;

    SELECT EXISTS(
        SELECT 1 FROM post_interactions
        WHERE post_id          = p_post_id
          AND user_id          = v_internal_id
          AND interaction_type = 'like'
    ) INTO v_already;

    IF v_already THEN
        DELETE FROM post_interactions
        WHERE post_id          = p_post_id
          AND user_id          = v_internal_id
          AND interaction_type = 'like';

        UPDATE user_posts
        SET like_count = GREATEST(0, like_count - 1)
        WHERE post_id = p_post_id;
    ELSE
        INSERT INTO post_interactions (post_id, user_id, interaction_type)
        VALUES (p_post_id, v_internal_id, 'like')
        ON CONFLICT DO NOTHING;

        UPDATE user_posts
        SET like_count = like_count + 1
        WHERE post_id = p_post_id;
    END IF;

    RETURN QUERY
    SELECT
        NOT v_already           AS liked,
        up.like_count           AS new_like_count
    FROM user_posts up
    WHERE up.post_id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like TO authenticated;
