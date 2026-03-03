-- Migration 061: Fix double-count on likes and comments
--
-- Root cause: both the RPCs (toggle_post_like, create_post_comment) AND the trigger
-- in 007_enhanced_social_features.sql independently update like_count / comment_count.
-- Fix: remove manual counter UPDATEs from the RPCs. The trigger becomes the sole owner.
--
-- Also adds p_parent_comment_id to create_post_comment for reply support (used in 062).

-- ─── toggle_post_like ────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.toggle_post_like(UUID, UUID);

CREATE OR REPLACE FUNCTION public.toggle_post_like(
  p_user_id UUID,
  p_post_id UUID
)
RETURNS TABLE(liked BOOLEAN, new_like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_internal_id UUID;
  v_already     BOOLEAN;
BEGIN
  SELECT user_id INTO v_internal_id
  FROM users WHERE auth_id = p_user_id LIMIT 1;

  IF v_internal_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM post_interactions
    WHERE post_id = p_post_id
      AND user_id = v_internal_id
      AND interaction_type = 'like'
  ) INTO v_already;

  IF v_already THEN
    DELETE FROM post_interactions
    WHERE post_id = p_post_id
      AND user_id = v_internal_id
      AND interaction_type = 'like';
  ELSE
    INSERT INTO post_interactions (post_id, user_id, interaction_type)
    VALUES (p_post_id, v_internal_id, 'like')
    ON CONFLICT DO NOTHING;
  END IF;

  -- The trigger in 007 now owns like_count; read back the confirmed value.
  RETURN QUERY
  SELECT NOT v_already, up.like_count
  FROM user_posts up
  WHERE up.post_id = p_post_id;
END;
$$;

-- ─── create_post_comment ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.create_post_comment(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_post_comment(UUID, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_post_comment(
  p_user_id           UUID,
  p_post_id           UUID,
  p_content           TEXT,
  p_parent_comment_id UUID DEFAULT NULL
)
RETURNS TABLE(comment_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_internal_id UUID;
BEGIN
  SELECT user_id INTO v_internal_id
  FROM users WHERE auth_id = p_user_id LIMIT 1;

  IF v_internal_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN QUERY
  INSERT INTO post_comments (post_id, user_id, content, parent_comment_id)
  VALUES (p_post_id, v_internal_id, p_content, p_parent_comment_id)
  RETURNING post_comments.comment_id, post_comments.created_at;

  -- The trigger in 007 now owns comment_count; no manual UPDATE needed.
END;
$$;
