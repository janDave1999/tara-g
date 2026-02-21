-- =====================================================
-- 031: Fix get_discover_trips
-- =====================================================
-- Changes vs 010:
--   1. Add owner_name + owner_avatar to RETURNS TABLE
--      (TripCard 'discover' type renders these in the footer)
--   2. Remove the 30-day hard cap in the no-preferences path
--      (previously hid trips starting > 30 days away)
--   3. Exclude the calling user's own trips from results
--   4. Join users table for owner name + avatar in both paths
-- =====================================================

DROP FUNCTION IF EXISTS get_discover_trips(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_discover_trips(
    p_user_id      UUID,
    p_search       TEXT    DEFAULT NULL,
    p_region       TEXT    DEFAULT NULL,
    p_budget       TEXT    DEFAULT NULL,
    p_travel_style TEXT    DEFAULT NULL,
    p_pace         TEXT    DEFAULT NULL,
    p_limit        INTEGER DEFAULT 12,
    p_offset       INTEGER DEFAULT 0
)
RETURNS TABLE(
    trip_id              UUID,
    title                TEXT,
    description          TEXT,
    status               TEXT,
    owner_id             UUID,
    owner_name           TEXT,
    owner_avatar         TEXT,
    slug                 TEXT,
    cover_image          TEXT,
    start_date           DATE,
    end_date             DATE,
    region               TEXT,
    max_pax              INTEGER,
    current_participants INTEGER,
    estimated_budget     INTEGER,
    tags                 TEXT[],
    total_count          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_preferences BOOLEAN := FALSE;
    v_budget_range    TEXT;
    v_travel_styles   TEXT[];
    v_pace_pref       TEXT;
BEGIN
    -- Load user travel preferences (if any)
    SELECT
        CASE WHEN budget_range IS NOT NULL OR travel_style IS NOT NULL OR pace_preference IS NOT NULL
             THEN TRUE ELSE FALSE END,
        budget_range,
        travel_style,
        pace_preference
    INTO v_has_preferences, v_budget_range, v_travel_styles, v_pace_pref
    FROM user_travel_preferences
    WHERE user_id = p_user_id;

    IF v_has_preferences AND (v_budget_range IS NOT NULL OR v_travel_styles IS NOT NULL OR v_pace_pref IS NOT NULL) THEN
        -- ── Preference-aware path ────────────────────────────────────────────
        RETURN QUERY
        SELECT
            t.trip_id,
            t.title::TEXT,
            t.description,
            t.status::TEXT,
            t.owner_id,
            u.username::TEXT           AS owner_name,
            u.avatar_url               AS owner_avatar,
            t.slug::TEXT,
            (SELECT ti.image_url FROM trip_images ti
              WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE LIMIT 1) AS cover_image,
            td.start_date,
            td.end_date,
            td.region::TEXT,
            td.max_pax,
            tv.current_participants,
            td.estimated_budget,
            td.tags,
            COUNT(*) OVER()            AS total_count
        FROM trips t
        INNER JOIN trip_details    td ON td.trip_id = t.trip_id
        INNER JOIN trip_visibility tv ON tv.trip_id = t.trip_id
        INNER JOIN users           u  ON u.auth_id  = t.owner_id
        WHERE t.status         = 'active'
          AND tv.visibility    = 'public'
          AND td.start_date   >= CURRENT_DATE
          -- Exclude caller's own trips
          AND t.owner_id      != p_user_id
          -- Budget filter
          AND (p_budget IS NULL OR (
              CASE
                  WHEN p_budget = 'budget'   THEN td.estimated_budget <= 5000
                  WHEN p_budget = 'moderate' THEN td.estimated_budget > 5000 AND td.estimated_budget <= 15000
                  WHEN p_budget = 'luxury'   THEN td.estimated_budget > 15000
                  ELSE TRUE
              END
          ))
          -- Search filter
          AND (p_search IS NULL
               OR t.title       ILIKE '%' || p_search || '%'
               OR t.description ILIKE '%' || p_search || '%')
          -- Region filter
          AND (p_region IS NULL OR td.region ILIKE '%' || p_region || '%')
        ORDER BY
            CASE
                WHEN td.estimated_budget IS NOT NULL AND v_budget_range IS NOT NULL AND
                     ((v_budget_range = 'budget'   AND td.estimated_budget <= 5000) OR
                      (v_budget_range = 'moderate' AND td.estimated_budget BETWEEN 5001 AND 15000) OR
                      (v_budget_range = 'luxury'   AND td.estimated_budget > 15000))
                THEN 0 ELSE 1
            END,
            t.popularity_score DESC,
            td.start_date ASC
        LIMIT p_limit OFFSET p_offset;

    ELSE
        -- ── Generic path (no preferences or all null) ───────────────────────
        RETURN QUERY
        SELECT
            t.trip_id,
            t.title::TEXT,
            t.description,
            t.status::TEXT,
            t.owner_id,
            u.username::TEXT           AS owner_name,
            u.avatar_url               AS owner_avatar,
            t.slug::TEXT,
            (SELECT ti.image_url FROM trip_images ti
              WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE LIMIT 1) AS cover_image,
            td.start_date,
            td.end_date,
            td.region::TEXT,
            td.max_pax,
            tv.current_participants,
            td.estimated_budget,
            td.tags,
            COUNT(*) OVER()            AS total_count
        FROM trips t
        INNER JOIN trip_details    td ON td.trip_id = t.trip_id
        INNER JOIN trip_visibility tv ON tv.trip_id = t.trip_id
        INNER JOIN users           u  ON u.auth_id  = t.owner_id
        WHERE t.status         = 'active'
          AND tv.visibility    = 'public'
          AND td.start_date   >= CURRENT_DATE
          -- Exclude caller's own trips
          AND t.owner_id      != p_user_id
          -- Search filter
          AND (p_search IS NULL
               OR t.title       ILIKE '%' || p_search || '%'
               OR t.description ILIKE '%' || p_search || '%')
          -- Region filter
          AND (p_region IS NULL OR td.region ILIKE '%' || p_region || '%')
        ORDER BY
            td.start_date ASC,
            t.popularity_score DESC
        LIMIT p_limit OFFSET p_offset;

    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discover_trips TO authenticated;
