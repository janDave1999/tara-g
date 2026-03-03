-- =====================================================
-- MIGRATION 069: ADD TYPE FILTER TO get_user_notifications
-- =====================================================
-- Adds optional p_types TEXT[] parameter so callers can
-- filter by notification type at the DB level.
-- Without this, client-side tab filtering on paginated
-- results silently drops feed-type notifications that fall
-- outside the first page of mixed results.
--
-- Existing callers (no 5th arg) are unaffected — p_types
-- defaults to NULL which means "no filter, return all types".
-- =====================================================

DROP FUNCTION IF EXISTS public.get_user_notifications(UUID, INTEGER, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_user_notifications(
    p_user_id    UUID,
    p_limit      INTEGER  DEFAULT 20,
    p_offset     INTEGER  DEFAULT 0,
    p_unread_only BOOLEAN DEFAULT FALSE,
    p_types      TEXT[]   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'notification_id', n.notification_id,
                'type',            n.type,
                'title',           n.title,
                'message',         n.message,
                'data',            n.data,
                'is_read',         n.is_read,
                'priority',        n.priority,
                'action_url',      n.action_url,
                'created_at',      n.created_at,
                'read_at',         n.read_at
            ) ORDER BY n.created_at DESC
        )
        FROM (
            SELECT n.notification_id, n.type, n.title, n.message, n.data,
                   n.is_read, n.priority, n.action_url, n.created_at, n.read_at
            FROM notifications n
            WHERE n.user_id = p_user_id
              AND (p_unread_only = FALSE OR n.is_read = FALSE)
              AND (n.expires_at IS NULL OR n.expires_at > NOW())
              AND (p_types IS NULL OR n.type = ANY(p_types))
            ORDER BY n.created_at DESC
            LIMIT  p_limit
            OFFSET p_offset
        ) n
    ), '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_notifications(UUID, INTEGER, INTEGER, BOOLEAN, TEXT[]) TO authenticated;
