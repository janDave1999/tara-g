-- =====================================================
-- MIGRATION 058: post comments RPCs
-- =====================================================
-- get_post_comments  — fetch top-level comments for a post
-- create_post_comment — insert a comment + bump comment_count
-- =====================================================

-- -------------------------------------------------------
-- get_post_comments
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_post_comments(
    p_post_id UUID,
    p_limit   INTEGER DEFAULT 20,
    p_offset  INTEGER DEFAULT 0
)
RETURNS TABLE(
    comment_id       UUID,
    author_auth_id   UUID,
    author_username  TEXT,
    author_full_name TEXT,
    author_avatar    TEXT,
    content          TEXT,
    created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.comment_id,
        u.auth_id                                   AS author_auth_id,
        u.username::TEXT                            AS author_username,
        COALESCE(u.full_name, u.username)::TEXT     AS author_full_name,
        u.avatar_url::TEXT                          AS author_avatar,
        pc.content,
        pc.created_at
    FROM post_comments pc
    JOIN users u ON u.user_id = pc.user_id
    WHERE pc.post_id             = p_post_id
      AND pc.is_deleted          = FALSE
      AND pc.parent_comment_id   IS NULL
    ORDER BY pc.created_at ASC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_comments TO authenticated;

-- -------------------------------------------------------
-- create_post_comment
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_post_comment(
    p_user_id UUID,   -- auth_id
    p_post_id UUID,
    p_content TEXT
)
RETURNS TABLE(comment_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_internal_id UUID;
BEGIN
    SELECT user_id INTO v_internal_id
    FROM users
    WHERE auth_id = p_user_id
    LIMIT 1;

    IF v_internal_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    RETURN QUERY
    INSERT INTO post_comments (post_id, user_id, content)
    VALUES (p_post_id, v_internal_id, p_content)
    RETURNING post_comments.comment_id, post_comments.created_at;

    UPDATE user_posts
    SET comment_count = comment_count + 1
    WHERE post_id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_post_comment TO authenticated;
