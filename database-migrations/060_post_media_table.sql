-- =====================================================
-- MIGRATION 060: post_media pivot table
-- =====================================================
-- Replaces the media_urls TEXT[] column approach with
-- a proper relational table for post media attachments.
-- =====================================================

-- Remove column if it was already added
ALTER TABLE user_posts DROP COLUMN IF EXISTS media_urls;

-- Pivot table: one row per media attachment per post
CREATE TABLE IF NOT EXISTS post_media (
    media_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       UUID        NOT NULL REFERENCES user_posts(post_id) ON DELETE CASCADE,
    url           TEXT        NOT NULL,   -- R2 key (not full URL)
    display_order SMALLINT    NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
