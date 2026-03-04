-- Migration 071: Reach-based share tracking
-- share_count = unique people who opened a shared link (not times share button was pressed)
-- Modelled after Bitly: one share_id per share action, count per unique visitor.
-- DB trigger owns share_count increment (same pattern as like_count / comment_count).

-- ─── 1. post_shares ──────────────────────────────────────────────────────────
-- One row per share action (when a user clicks the Share button).

CREATE TABLE IF NOT EXISTS post_shares (
  share_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES user_posts(post_id) ON DELETE CASCADE,
  sharer_id   UUID REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = anonymous sharer
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);

-- ─── 2. post_share_visits ────────────────────────────────────────────────────
-- One row per unique visitor who followed a share link.
-- visitor_token = auth user_id (UUID string) for logged-in users,
--                 OR a UUID stored in localStorage (__tara_visitor__) for anonymous visitors.

CREATE TABLE IF NOT EXISTS post_share_visits (
  visit_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id        UUID NOT NULL REFERENCES post_shares(share_id) ON DELETE CASCADE,
  visitor_token   TEXT NOT NULL,
  visited_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(share_id, visitor_token)  -- same person clicking same link twice = ignored
);

CREATE INDEX IF NOT EXISTS idx_post_share_visits_share ON post_share_visits(share_id);

-- ─── 3. Trigger — owns share_count ──────────────────────────────────────────
-- Fires AFTER INSERT on post_share_visits (not on ON CONFLICT — those don't fire triggers).
-- This is the sole owner of share_count updates.

CREATE OR REPLACE FUNCTION public.trg_share_visit_increment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_posts
  SET share_count = share_count + 1
  WHERE post_id = (
    SELECT post_id FROM post_shares WHERE share_id = NEW.share_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_share_visit_insert ON post_share_visits;

CREATE TRIGGER trg_after_share_visit_insert
AFTER INSERT ON post_share_visits
FOR EACH ROW EXECUTE FUNCTION trg_share_visit_increment();

-- ─── 4. create_share_link ────────────────────────────────────────────────────
-- Called when a user clicks the Share button.
-- Returns the share_id UUID to embed as ?sid= in the share URL.

CREATE OR REPLACE FUNCTION public.create_share_link(
  p_post_id   UUID,
  p_user_id   UUID DEFAULT NULL   -- auth_id of sharer; NULL for anonymous
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_internal_id UUID;
  v_share_id    UUID;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT user_id INTO v_internal_id
    FROM users
    WHERE auth_id = p_user_id
    LIMIT 1;
  END IF;

  INSERT INTO post_shares (post_id, sharer_id)
  VALUES (p_post_id, v_internal_id)
  RETURNING share_id INTO v_share_id;

  RETURN v_share_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_share_link(UUID, UUID) TO anon, authenticated;

-- ─── 5. record_share_visit ───────────────────────────────────────────────────
-- Called client-side (JS) when a visitor opens a ?sid= URL.
-- ON CONFLICT DO NOTHING means trigger only fires on genuine new visits.
-- Self-visit guard: if the visitor is the sharer, skip silently.

CREATE OR REPLACE FUNCTION public.record_share_visit(
  p_share_id      UUID,
  p_visitor_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Self-visit guard: sharer opening their own link does not count
  IF EXISTS (
    SELECT 1
    FROM post_shares ps
    JOIN users u ON u.user_id = ps.sharer_id
    WHERE ps.share_id = p_share_id
      AND u.auth_id::TEXT = p_visitor_token
  ) THEN
    RETURN;
  END IF;

  INSERT INTO post_share_visits (share_id, visitor_token)
  VALUES (p_share_id, p_visitor_token)
  ON CONFLICT (share_id, visitor_token) DO NOTHING;
  -- Trigger fires only when a row is actually inserted
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_share_visit(UUID, TEXT) TO anon, authenticated;
