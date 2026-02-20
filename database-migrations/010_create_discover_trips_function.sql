-- =====================================================
-- GET_DISCOVER_TRIPS RPC FUNCTION
-- =====================================================
-- Returns trips for the Discover tab with optional preference filtering
-- Falls back to generic "popular + upcoming" if no preferences set
-- =====================================================

CREATE OR REPLACE FUNCTION get_discover_trips(
    p_user_id UUID,
    p_search TEXT DEFAULT NULL,
    p_region TEXT DEFAULT NULL,
    p_budget TEXT DEFAULT NULL,
    p_travel_style TEXT DEFAULT NULL,
    p_pace TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 12,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    trip_id UUID,
    title TEXT,
    description TEXT,
    status TEXT,
    owner_id UUID,
    slug TEXT,
    cover_image TEXT,
    start_date DATE,
    end_date DATE,
    region TEXT,
    max_pax INTEGER,
    current_participants INTEGER,
    estimated_budget INTEGER,
    tags TEXT[],
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_preferences BOOLEAN := FALSE;
    v_budget_range TEXT;
    v_travel_styles TEXT[];
    v_pace_pref TEXT;
BEGIN
    -- Check if user has travel preferences
    SELECT 
        CASE WHEN budget_range IS NOT NULL OR travel_style IS NOT NULL OR pace_preference IS NOT NULL 
             THEN TRUE ELSE FALSE END,
        budget_range,
        travel_style,
        pace_preference
    INTO v_has_preferences, v_budget_range, v_travel_styles, v_pace_pref
    FROM user_travel_preferences
    WHERE user_id = p_user_id;

    -- Build and execute query based on preferences
    IF v_has_preferences AND (v_budget_range IS NOT NULL OR v_travel_styles IS NOT NULL OR v_pace_pref IS NOT NULL) THEN
        -- User has preferences - filter by them
        RETURN QUERY
        WITH filtered_trips AS (
            SELECT 
                t.trip_id,
                t.title,
                t.description,
                t.status::TEXT,
                t.owner_id,
                t.slug,
                (SELECT image_url FROM trip_images WHERE trip_id = t.trip_id AND is_cover = TRUE LIMIT 1) as cover_image,
                td.start_date,
                td.end_date,
                td.region,
                td.max_pax,
                tv.current_participants,
                td.estimated_budget,
                td.tags,
                COUNT(*) OVER() as total_count
            FROM trips t
            INNER JOIN trip_details td ON t.trip_id = td.trip_id
            INNER JOIN trip_visibility tv ON t.trip_id = tv.trip_id
            WHERE t.status = 'active'
                AND tv.visibility = 'public'
                AND td.start_date >= CURRENT_DATE

                -- Apply preference filters if provided
                AND (p_budget IS NULL OR (
                    CASE 
                        WHEN p_budget = 'budget' THEN td.estimated_budget <= 5000
                        WHEN p_budget = 'moderate' THEN td.estimated_budget > 5000 AND td.estimated_budget <= 15000
                        WHEN p_budget = 'luxury' THEN td.estimated_budget > 15000
                        ELSE TRUE
                    END
                ))
                
                -- Search filter
                AND (p_search IS NULL OR t.title ILIKE '%' || p_search || '%' OR t.description ILIKE '%' || p_search || '%')
                
                -- Region filter
                AND (p_region IS NULL OR td.region ILIKE '%' || p_region || '%')
                
            ORDER BY 
                -- Prioritize trips matching user preferences
                CASE 
                    WHEN td.estimated_budget IS NOT NULL AND v_budget_range IS NOT NULL AND
                         ((v_budget_range = 'budget' AND td.estimated_budget <= 5000) OR
                          (v_budget_range = 'moderate' AND td.estimated_budget BETWEEN 5001 AND 15000) OR
                          (v_budget_range = 'luxury' AND td.estimated_budget > 15000))
                         THEN 0
                    ELSE 1
                END,
                -- Then by popularity and date
                t.popularity_score DESC,
                td.start_date ASC
            LIMIT p_limit OFFSET p_offset
        )
        SELECT * FROM filtered_trips;
    ELSE
        -- No preferences - show generic popular + upcoming trips
        RETURN QUERY
        WITH generic_trips AS (
            SELECT 
                t.trip_id,
                t.title,
                t.description,
                t.status::TEXT,
                t.owner_id,
                t.slug,
                (SELECT image_url FROM trip_images WHERE trip_id = t.trip_id AND is_cover = TRUE LIMIT 1) as cover_image,
                td.start_date,
                td.end_date,
                td.region,
                td.max_pax,
                tv.current_participants,
                td.estimated_budget,
                td.tags,
                COUNT(*) OVER() as total_count
            FROM trips t
            INNER JOIN trip_details td ON t.trip_id = td.trip_id
            INNER JOIN trip_visibility tv ON t.trip_id = tv.trip_id
            WHERE t.status = 'active'
                AND tv.visibility = 'public'
                AND td.start_date >= CURRENT_DATE
                AND td.start_date <= CURRENT_DATE + INTERVAL '30 days'
                
                -- Search filter
                AND (p_search IS NULL OR t.title ILIKE '%' || p_search || '%' OR t.description ILIKE '%' || p_search || '%')
                
                -- Region filter
                AND (p_region IS NULL OR td.region ILIKE '%' || p_region || '%')
                
            ORDER BY 
                -- Upcoming trips first, then by popularity
                td.start_date ASC,
                t.popularity_score DESC
            LIMIT p_limit OFFSET p_offset
        )
        SELECT * FROM generic_trips;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_discover_trips TO authenticated;

SELECT 'Created get_discover_trips function' as status;
