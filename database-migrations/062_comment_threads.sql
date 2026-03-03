-- Migration 062: Comment threads + comment reactions (like/dislike)
--
-- 1. Add dislike_count to post_comments
-- 2. Create comment_interactions pivot table
-- 3. Update get_post_comments RPC to return all comments (top-level + replies)
--    with reaction counts and viewer's own interaction state
-- 4. Add toggle_comment_interaction RPC

-- ─── 1. dislike_count column ─────────────────────────────────────────────────

ALTER TABLE post_comments
  ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0 CHECK (dislike_count >= 0);

-- ─── 2. comment_interactions ─────────────────────────────────────────────────
-- One reaction per user per comment (like OR dislike, not both).

CREATE TABLE IF NOT EXISTS comment_interactions (
  interaction_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id       UUID         NOT NULL REFERENCES post_comments(comment_id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  interaction_type VARCHAR(10)  NOT NULL CHECK (interaction_type IN ('like', 'dislike')),
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_interactions_comment
  ON comment_interactions(comment_id);

-- ─── 3. get_post_comments (updated) ──────────────────────────────────────────
-- Returns ALL comments for a post (top-level + replies) ordered so that
-- replies appear immediately after their parent.
-- Caller builds the display tree on the client.

DROP FUNCTION IF EXISTS public.get_post_comments(UUID, INTEGER, INTEGER);

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
  -- Group replies under their parent; within group, oldest first
  ORDER BY COALESCE(pc.parent_comment_id, pc.comment_id), pc.created_at ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- ─── 4. toggle_comment_interaction ───────────────────────────────────────────
-- Toggles a like or dislike on a comment.
-- Rules:
--   • Same type clicked again → removes the reaction
--   • Different type → switches the reaction (decrements old, increments new)
--   • No prior reaction → adds the reaction

CREATE OR REPLACE FUNCTION public.toggle_comment_interaction(
  p_user_id    UUID,
  p_comment_id UUID,
  p_type       VARCHAR(10)
)
RETURNS TABLE(active_interaction TEXT, new_like_count INTEGER, new_dislike_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_internal_id UUID;
  v_existing    VARCHAR(10);
BEGIN
  SELECT user_id INTO v_internal_id
  FROM users WHERE auth_id = p_user_id LIMIT 1;

  IF v_internal_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT interaction_type INTO v_existing
  FROM comment_interactions
  WHERE comment_id = p_comment_id AND user_id = v_internal_id;

  IF v_existing = p_type THEN
    -- ── Toggle off (same button pressed again) ──────────────────────────────
    DELETE FROM comment_interactions
    WHERE comment_id = p_comment_id AND user_id = v_internal_id;

    IF p_type = 'like' THEN
      UPDATE post_comments
        SET like_count = GREATEST(0, like_count - 1)
      WHERE comment_id = p_comment_id;
    ELSE
      UPDATE post_comments
        SET dislike_count = GREATEST(0, dislike_count - 1)
      WHERE comment_id = p_comment_id;
    END IF;

    RETURN QUERY
    SELECT NULL::TEXT, pc.like_count, pc.dislike_count
    FROM post_comments pc WHERE pc.comment_id = p_comment_id;

  ELSIF v_existing IS NOT NULL THEN
    -- ── Switch reaction ─────────────────────────────────────────────────────
    UPDATE comment_interactions
      SET interaction_type = p_type
    WHERE comment_id = p_comment_id AND user_id = v_internal_id;

    IF p_type = 'like' THEN
      UPDATE post_comments
        SET like_count    = like_count + 1,
            dislike_count = GREATEST(0, dislike_count - 1)
      WHERE comment_id = p_comment_id;
    ELSE
      UPDATE post_comments
        SET dislike_count = dislike_count + 1,
            like_count    = GREATEST(0, like_count - 1)
      WHERE comment_id = p_comment_id;
    END IF;

    RETURN QUERY
    SELECT p_type::TEXT, pc.like_count, pc.dislike_count
    FROM post_comments pc WHERE pc.comment_id = p_comment_id;

  ELSE
    -- ── New reaction ────────────────────────────────────────────────────────
    INSERT INTO comment_interactions (comment_id, user_id, interaction_type)
    VALUES (p_comment_id, v_internal_id, p_type);

    IF p_type = 'like' THEN
      UPDATE post_comments SET like_count = like_count + 1 WHERE comment_id = p_comment_id;
    ELSE
      UPDATE post_comments SET dislike_count = dislike_count + 1 WHERE comment_id = p_comment_id;
    END IF;

    RETURN QUERY
    SELECT p_type::TEXT, pc.like_count, pc.dislike_count
    FROM post_comments pc WHERE pc.comment_id = p_comment_id;
  END IF;
END;
$$;
