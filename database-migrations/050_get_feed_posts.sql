-- =====================================================
-- MIGRATION 050: get_feed_posts RPC
-- =====================================================
-- Fetches paginated public posts for the /feeds page.
-- Phase 1: All public posts, chronological.
-- Phase 2: Filter to friends only (using friends table).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_feed_posts(
    p_user_id   UUID,          -- auth_id of the viewer (reserved for future friends filter)
    p_post_type TEXT    DEFAULT NULL,
    p_limit     INTEGER DEFAULT 10,
    p_offset    INTEGER DEFAULT 0
)
RETURNS TABLE(
    post_id          UUID,
    author_auth_id   UUID,
    author_username  TEXT,
    author_full_name TEXT,
    author_avatar    TEXT,
    trip_id          UUID,
    trip_title       TEXT,
    post_type        TEXT,
    title            TEXT,
    content          TEXT,
    hashtags         TEXT[],
    location_name    TEXT,
    like_count       INTEGER,
    comment_count    INTEGER,
    share_count      INTEGER,
    created_at       TIMESTAMPTZ,
    total_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.post_id,
        u.auth_id                                       AS author_auth_id,
        u.username::TEXT                                AS author_username,
        COALESCE(u.full_name, u.username)::TEXT         AS author_full_name,
        u.avatar_url::TEXT                              AS author_avatar,
        up.trip_id,
        t.title::TEXT                                   AS trip_title,
        up.post_type::TEXT,
        up.title::TEXT,
        up.content::TEXT,
        up.hashtags,
        up.location_name::TEXT,
        up.like_count,
        up.comment_count,
        up.share_count,
        up.created_at,
        COUNT(*) OVER ()                                AS total_count
    FROM user_posts up
    JOIN  users u ON u.user_id = up.user_id
    LEFT JOIN trips t ON t.trip_id = up.trip_id
    WHERE up.is_public = TRUE
      AND (p_post_type IS NULL OR up.post_type = p_post_type)
    ORDER BY up.created_at DESC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_feed_posts TO authenticated;
