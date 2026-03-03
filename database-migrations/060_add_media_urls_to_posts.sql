-- =====================================================
-- MIGRATION 060: add media_urls to user_posts
-- =====================================================
-- Adds a TEXT[] column to store R2 keys for uploaded
-- photos attached to a post (up to 4).
-- =====================================================

ALTER TABLE user_posts
    ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';
