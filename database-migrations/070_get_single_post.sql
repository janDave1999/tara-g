-- Migration 070: get_single_post RPC + increment_share_count RPC
-- Used by the dedicated /post/[id] page (authenticated & unauthenticated).

-- ─── 1. get_single_post ──────────────────────────────────────────────────────
-- Returns JSONB for a single public post, or NULL if not found / not public.
-- p_viewer_id is the Supabase auth_id (UUID) of the current user; pass NULL for guests.

CREATE OR REPLACE FUNCTION public.get_single_post(
  p_post_id   UUID,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_internal UUID;
  v_result          JSONB;
BEGIN
  -- Resolve auth_id → internal user_id for like-status check
  IF p_viewer_id IS NOT NULL THEN
    SELECT user_id INTO v_viewer_internal
    FROM users
    WHERE auth_id = p_viewer_id
    LIMIT 1;
  END IF;

  SELECT jsonb_build_object(
    'post_id',            up.post_id,
    'author_auth_id',     u.auth_id,
    'author_username',    u.username,
    'author_full_name',   u.full_name,
    'author_avatar',      u.avatar_url,
    'trip_id',            up.trip_id,
    'trip_title',         t.title,
    'post_type',          up.post_type,
    'title',              up.title,
    'content',            up.content,
    'hashtags',           up.hashtags,
    'location_name',      up.location_name,
    'like_count',         up.like_count,
    'comment_count',      up.comment_count,
    'share_count',        up.share_count,
    'created_at',         up.created_at,
    'is_liked_by_viewer', EXISTS (
      SELECT 1 FROM post_interactions pi
      WHERE pi.post_id = up.post_id
        AND pi.user_id = v_viewer_internal
        AND pi.interaction_type = 'like'
    ),
    'media_urls', COALESCE((
      SELECT jsonb_agg(pm.url ORDER BY pm.display_order)
      FROM post_media pm
      WHERE pm.post_id = up.post_id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM user_posts up
  JOIN  users u ON u.user_id = up.user_id
  LEFT JOIN trips t ON t.trip_id = up.trip_id
  WHERE up.post_id  = p_post_id
    AND up.is_public = TRUE;

  RETURN v_result; -- NULL when not found or not public
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_single_post(UUID, UUID) TO anon, authenticated;

-- ─── 2. increment_share_count ────────────────────────────────────────────────
-- Called client-side after a successful native share or clipboard copy.
-- No deduplication — sharing the same post multiple times is valid.

CREATE OR REPLACE FUNCTION public.increment_share_count(p_post_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_posts
  SET share_count = share_count + 1
  WHERE post_id = p_post_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_share_count(UUID) TO anon, authenticated;
