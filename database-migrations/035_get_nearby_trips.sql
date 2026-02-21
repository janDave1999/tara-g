CREATE OR REPLACE FUNCTION get_nearby_trips(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_radius_km DECIMAL DEFAULT 50,
    p_tags TEXT[] DEFAULT NULL,
    p_location_type TEXT DEFAULT 'destination',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    trip_id UUID,
    title TEXT,
    description TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    location_name TEXT,
    distance_km DOUBLE PRECISION,
    estimated_budget INTEGER,
    tags TEXT[],
    available_spots INTEGER,
    max_participants INTEGER,
    current_participants INTEGER,
    start_date DATE,
    end_date DATE,
    region TEXT,
    duration_days INTEGER,
    budget_per_person DOUBLE PRECISION,
    images TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_radius_meters DECIMAL;
    point_found BOOLEAN;
BEGIN
    point_found := (p_latitude IS NOT NULL AND p_longitude IS NOT NULL);

    IF point_found THEN
        search_radius_meters := p_radius_km * 1000;
    ELSE
        search_radius_meters := NULL;
    END IF;

    RETURN QUERY
    SELECT
        t.trip_id,
        t.title::TEXT,
        t.description::TEXT,
        l.latitude::DOUBLE PRECISION,
        l.longitude::DOUBLE PRECISION,
        l.name::TEXT,
        CASE
            WHEN point_found AND l.geometry IS NOT NULL THEN
                ST_Distance(
                    l.geometry::geography,
                    ST_MakePoint(p_longitude, p_latitude)::geography
                ) / 1000.0
            ELSE NULL
        END::DOUBLE PRECISION AS distance_km,
        td.estimated_budget,
        COALESCE(td.tags, ARRAY[]::TEXT[]),
        tv.available_spots::INTEGER,
        tv.max_participants::INTEGER,
        tv.current_participants::INTEGER,
        td.start_date,
        td.end_date,
        td.region::TEXT,
        td.duration_days,
        td.budget_per_person::DOUBLE PRECISION,
        COALESCE(
            array_agg(ti.image_url ORDER BY ti.display_order)
                FILTER (WHERE ti.is_cover = TRUE AND ti.image_url IS NOT NULL),
            ARRAY[]::TEXT[]
        ) AS images
    FROM trips t
    INNER JOIN trip_details td ON t.trip_id = td.trip_id
    INNER JOIN trip_visibility tv ON t.trip_id = tv.trip_id
    LEFT JOIN trip_location tl
        ON t.trip_id = tl.trip_id
        AND tl.is_primary = TRUE
        AND (p_location_type = 'all' OR tl.location_type::TEXT = p_location_type)
    LEFT JOIN locations l ON tl.location_id = l.location_id
    LEFT JOIN trip_images ti ON t.trip_id = ti.trip_id
    WHERE
        t.status = 'active'
        AND tv.visibility::TEXT = 'public'

        -- Spatial filter
        AND (
            NOT point_found
            OR l.geometry IS NULL
            OR ST_DWithin(
                l.geometry::geography,
                ST_MakePoint(p_longitude, p_latitude)::geography,
                search_radius_meters
            )
        )

        -- Exclude trips that have already ended
        AND td.end_date >= CURRENT_DATE

        -- Exclude trips past their join deadline
        AND (td.join_by IS NULL OR td.join_by > NOW())

        -- Tags filter
        AND (p_tags IS NULL OR td.tags && p_tags)

        -- Availability
        AND tv.available_spots > 0

        -- Exclude user's own trips
        AND (p_user_id IS NULL OR t.owner_id != p_user_id)

        -- Exclude trips user has already joined
        AND (p_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM trip_members tm
            WHERE tm.trip_id = t.trip_id
            AND tm.user_id = p_user_id
            AND tm.member_status = 'joined'
        ))
    GROUP BY
        t.trip_id, t.title, t.description,
        l.latitude, l.longitude, l.name, l.geometry,
        td.estimated_budget, td.tags, td.start_date, td.end_date,
        td.region, td.duration_days, td.budget_per_person,
        tv.available_spots, tv.max_participants, tv.current_participants
    ORDER BY distance_km ASC NULLS LAST, td.start_date ASC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_nearby_trips TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_trips TO anon;
GRANT EXECUTE ON FUNCTION get_nearby_trips TO service_role;