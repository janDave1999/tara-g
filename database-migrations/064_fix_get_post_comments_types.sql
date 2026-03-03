-- Migration 064: Fix get_post_comments return type mismatch
--
-- PostgreSQL requires exact type match in RETURNS TABLE when using SECURITY DEFINER.
-- users.username / full_name / avatar_url are VARCHAR columns; pc.content may also be VARCHAR.
-- Adding explicit ::TEXT casts resolves error code 42804.

CREATE OR REPLACE FUNCTION public.get_post_comments(
  p_post_id   UUID,
  p_viewer_id UUID    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 50,
  p_offset    INTEGER DEFAULT 0
)
RETURNS TABLE(
  comment_id         UUID,
  parent_comment_id  UUID,
  author_auth_id     UUID,
  author_username    TEXT,
  author_full_name   TEXT,
  author_avatar      TEXT,
  content            TEXT,
  like_count         INTEGER,
  dislike_count      INTEGER,
  viewer_interaction TEXT,
  created_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_viewer_internal UUID;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT user_id INTO v_viewer_internal
    FROM users WHERE auth_id = p_viewer_id LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    pc.comment_id,
    pc.parent_comment_id,
    u.auth_id,
    u.username::TEXT,
    u.full_name::TEXT,
    u.avatar_url::TEXT,
    pc.content::TEXT,
    pc.like_count,
    pc.dislike_count,
    ci.interaction_type::TEXT,
    pc.created_at
  FROM post_comments pc
  JOIN  users u ON u.user_id = pc.user_id
  LEFT JOIN comment_interactions ci
    ON ci.comment_id = pc.comment_id
   AND ci.user_id = v_viewer_internal
  WHERE pc.post_id    = p_post_id
    AND pc.is_deleted = FALSE
  ORDER BY COALESCE(pc.parent_comment_id, pc.comment_id), pc.created_at ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;
