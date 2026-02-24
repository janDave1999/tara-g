-- =====================================================
-- Migration: 039_add_bucket_count_to_user_stats
-- Description: Add bucket_count to get_user_stats RPC for Project 82
-- Date: February 2026
-- =====================================================

-- Drop and recreate get_user_stats with bucket_count
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_user_stats(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_bucket_count INTEGER;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    -- Calculate bucket_count: count distinct provinces from user's completed trips
    -- This will be NULL if not yet implemented; frontend handles fallback
    BEGIN
        SELECT COUNT(DISTINCT t.province_key)::INTEGER INTO v_bucket_count
        FROM public.trips t
        WHERE t.owner_id = p_user_id
          AND t.status = 'completed'
          AND t.province_key IS NOT NULL;
    EXCEPTION WHEN undefined_column THEN
        v_bucket_count := NULL;
    END;

    RETURN (
        SELECT jsonb_build_object(
            'trips_owned',    COUNT(DISTINCT CASE WHEN t.owner_id = p_user_id THEN t.trip_id END),
            'trips_joined',   COUNT(DISTINCT CASE WHEN tm.user_id = p_user_id AND tm.member_status = 'joined' AND t.owner_id != p_user_id THEN t.trip_id END),
            'trips_active',   COUNT(DISTINCT CASE WHEN t.status = 'active' AND (t.owner_id = p_user_id OR (tm.user_id = p_user_id AND tm.member_status = 'joined')) THEN t.trip_id END),
            'trips_completed',COUNT(DISTINCT CASE WHEN t.status = 'completed' AND (t.owner_id = p_user_id OR (tm.user_id = p_user_id AND tm.member_status = 'joined')) THEN t.trip_id END),
            'friends_count',  (SELECT COUNT(*) FROM public.friends f WHERE f.user_id = v_user_id),
            'bucket_count',  v_bucket_count,
            'profile_completion', (
                SELECT ui.profile_completion_percentage
                  FROM public.user_information ui
                 WHERE ui.user_id = v_user_id
            )
        )
        FROM public.trips t
        LEFT JOIN public.trip_members tm ON tm.trip_id = t.trip_id AND tm.user_id = p_user_id
        WHERE t.owner_id = p_user_id
           OR (tm.user_id = p_user_id AND tm.member_status = 'joined')
    );
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO authenticated;
