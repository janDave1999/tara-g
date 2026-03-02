-- =====================================================
-- MIGRATION 054: search_posts RPC
-- =====================================================
-- Full-text search on user_posts (title + content).
-- Returns public posts only with author info.
-- Used by actions.search.global for the search dropdown.
-- =====================================================

CREATE OR REPLACE FUNCTION public.search_posts(
    p_query TEXT,
    p_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(row_json)
        FROM (
            SELECT jsonb_build_object(
                'post_id',         up.post_id,
                'post_type',       up.post_type,
                'title',           up.title,
                'content',         LEFT(up.content, 120),
                'hashtags',        up.hashtags,
                'author_username', u.username,
                'author_avatar',   u.avatar_url,
                'created_at',      up.created_at
            ) AS row_json
            FROM user_posts up
            JOIN users u ON u.user_id = up.user_id
            WHERE up.is_public = TRUE
              AND (
                  up.title   ILIKE '%' || p_query || '%'
                  OR up.content ILIKE '%' || p_query || '%'
              )
            ORDER BY up.created_at DESC
            LIMIT p_limit
        ) sub
    ), '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_posts TO authenticated;
