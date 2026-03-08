-- Migration 072: get_user_posts RPC
-- Returns paginated public posts for a specific author.
-- Used on /profile/[username] to show that user's posts below the trip grid.
-- Same join structure as get_feed_posts (migration 050) but filtered to one author.
-- Granted to anon so unauthenticated visitors can view public profiles.

CREATE OR REPLACE FUNCTION public.get_user_posts(
  p_author_auth_id  UUID,
  p_viewer_id       UUID    DEFAULT NULL,
  p_limit           INTEGER DEFAULT 10,
  p_offset          INTEGER DEFAULT 0
)
RETURNS TABLE(
  post_id            UUID,
  author_auth_id     UUID,
  author_username    TEXT,
  author_full_name   TEXT,
  author_avatar      TEXT,
  trip_id            UUID,
  trip_title         TEXT,
  post_type          TEXT,
  title              TEXT,
  content            TEXT,
  hashtags           TEXT[],
  location_name      TEXT,
  like_count         INTEGER,
  comment_count      INTEGER,
  share_count        INTEGER,
  created_at         TIMESTAMPTZ,
  total_count        BIGINT,
  is_liked_by_viewer BOOLEAN,
  is_public          BOOLEAN,
  media_urls         TEXT[]
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
    COUNT(*) OVER ()                                AS total_count,
    EXISTS (
      SELECT 1 FROM post_interactions pi2
      WHERE pi2.post_id = up.post_id
        AND pi2.user_id = (SELECT user_id FROM users WHERE auth_id = p_viewer_id LIMIT 1)
        AND pi2.interaction_type = 'like'
    )                                               AS is_liked_by_viewer,
    up.is_public,
    COALESCE(
      (SELECT ARRAY_AGG(pm.url ORDER BY pm.display_order)
       FROM post_media pm
       WHERE pm.post_id = up.post_id),
      '{}'
    )                                               AS media_urls
  FROM user_posts up
  JOIN  users u ON u.user_id = up.user_id
  LEFT JOIN trips t ON t.trip_id = up.trip_id
  WHERE u.auth_id = p_author_auth_id
    AND (up.is_public = TRUE OR p_viewer_id = p_author_auth_id)
  ORDER BY up.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_posts(UUID, UUID, INTEGER, INTEGER) TO anon, authenticated;
