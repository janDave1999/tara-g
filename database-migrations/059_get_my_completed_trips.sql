-- =====================================================
-- MIGRATION 059: get_my_completed_trips RPC
-- =====================================================
-- Returns completed trips where the calling user is
-- an owner or joined member (via trip_members).
-- Used by the post composer to pick a trip to blog about.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_completed_trips(
    p_user_id UUID,          -- auth_id
    p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE(
    trip_id     UUID,
    title       TEXT,
    cover_image TEXT,
    end_date    DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        t.trip_id,
        t.title::TEXT,
        td.cover_image::TEXT,
        td.end_date
    FROM trips t
    LEFT JOIN trip_details td ON td.trip_id = t.trip_id
    JOIN trip_members tm ON tm.trip_id = t.trip_id
    WHERE t.status         = 'completed'
      AND tm.user_id       = p_user_id   -- trip_members.user_id = auth.users.id
      AND tm.member_status = 'joined'
    ORDER BY td.end_date DESC NULLS LAST
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_completed_trips TO authenticated;
