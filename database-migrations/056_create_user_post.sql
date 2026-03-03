-- =====================================================
-- MIGRATION 056: create_user_post RPC
-- =====================================================
-- Creates a new public post for the authenticated user.
-- p_trip_id is REQUIRED — posts must be tied to a
-- completed trip the user owned or joined.
-- Media is inserted separately into post_media table
-- by the application layer after this RPC returns.
-- Returns the new post_id and created_at timestamp.
-- =====================================================

-- Drop all known old signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_user_post(UUID, TEXT, TEXT, TEXT, TEXT[], UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_user_post(UUID, UUID, TEXT, TEXT, TEXT[], TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_user_post(UUID, UUID, TEXT, TEXT, TEXT[], TEXT);
DROP FUNCTION IF EXISTS public.create_user_post(UUID, UUID, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.create_user_post(
    p_user_id  UUID,
    p_trip_id  UUID,          -- required: completed trip
    p_content  TEXT,
    p_title    TEXT    DEFAULT NULL,
    p_hashtags TEXT[]  DEFAULT '{}',
    p_location TEXT    DEFAULT NULL
)
RETURNS TABLE(post_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_internal_id UUID;
BEGIN
    SELECT user_id INTO v_internal_id
    FROM users
    WHERE auth_id = p_user_id
    LIMIT 1;

    IF v_internal_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate trip is completed and user is owner or joined member
    IF NOT EXISTS (
        SELECT 1 FROM trips t
        JOIN trip_members tm ON tm.trip_id = t.trip_id
        WHERE t.trip_id        = p_trip_id
          AND t.status         = 'completed'
          AND tm.user_id       = p_user_id   -- auth_id
          AND tm.member_status = 'joined'
    ) THEN
        RAISE EXCEPTION 'Trip not found, not completed, or you are not a member';
    END IF;

    RETURN QUERY
    INSERT INTO user_posts (
        user_id,
        trip_id,
        post_type,
        title,
        content,
        hashtags,
        location_name,
        is_public
    )
    VALUES (
        v_internal_id,
        p_trip_id,
        'trip_completed',
        p_title,
        p_content,
        COALESCE(p_hashtags, '{}'),
        p_location,
        TRUE
    )
    RETURNING user_posts.post_id, user_posts.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_post TO authenticated;
