CREATE OR REPLACE FUNCTION search_trips_optimized(
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_radius_km DECIMAL DEFAULT 50,
    p_tags TEXT[] DEFAULT NULL,
    p_min_budget INTEGER DEFAULT NULL,
    p_max_budget INTEGER DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_status trip_status[] DEFAULT ARRAY['active']::trip_status[],
    p_location_type location_type_enum DEFAULT 'destination',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    trip_id UUID,
    title VARCHAR,
    description TEXT,
    distance_km DECIMAL,
    estimated_budget INTEGER,
    tags TEXT[],
    available_spots SMALLINT,
    max_participants SMALLINT,
    current_participants SMALLINT,
    start_date DATE,
    end_date DATE,
    region VARCHAR,
    duration_days INTEGER,
    budget_per_person DECIMAL,
    relevance_score DECIMAL,
    primary_location_name VARCHAR,
    primary_location_address VARCHAR,
    images TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    search_radius DECIMAL;
    point_found BOOLEAN;
BEGIN
    -- Validate coordinates
    point_found := (p_latitude IS NOT NULL AND p_longitude IS NOT NULL);
    
    IF point_found THEN
        search_radius := p_radius_km * 1000; -- Convert to meters for PostGIS
    ELSE
        search_radius := NULL;
    END IF;

    RETURN QUERY
    WITH spatial_filtered_trips AS (
        SELECT 
            t.trip_id,
            t.title,
            t.description,
            td.estimated_budget,
            td.tags,
            td.start_date,
            td.end_date,
            td.region,
            td.duration_days,
            td.budget_per_person,
            tv.available_spots,
            tv.max_participants,
            tv.current_participants,
            
            -- Calculate distance with spatial index support
            CASE 
                WHEN point_found THEN
                    ST_Distance(
                        l.geometry::geography,
                        ST_MakePoint(p_longitude, p_latitude)::geography
                    ) / 1000 -- Convert to kilometers
                ELSE NULL
            END as distance_km,
            
            -- Advanced relevance scoring
            CASE 
                WHEN point_found THEN
                    (1.0 / (1.0 + (ST_Distance(
                        l.geometry::geography,
                        ST_MakePoint(p_longitude, p_latitude)::geography
                    ) / 1000)))
                ELSE 1.0
            END * 
            CASE 
                WHEN t.popularity_score > 0.8 THEN 1.3
                WHEN t.popularity_score > 0.5 THEN 1.2
                WHEN t.popularity_score > 0.2 THEN 1.1
                ELSE 1.0
            END * 
            CASE 
                WHEN td.duration_days <= 3 THEN 1.2
                WHEN td.duration_days <= 7 THEN 1.1
                ELSE 1.0
            END as relevance_score,
                
            -- Get primary location info (FIXED: trip_location not trip_locations)
            (SELECT l_primary.name 
             FROM trip_location tl_primary 
             INNER JOIN locations l_primary ON tl_primary.location_id = l_primary.location_id 
             WHERE tl_primary.trip_id = t.trip_id AND tl_primary.is_primary = TRUE 
             LIMIT 1) as primary_location_name,
             
            (SELECT l_primary.address 
             FROM trip_location tl_primary 
             INNER JOIN locations l_primary ON tl_primary.location_id = l_primary.location_id 
             WHERE tl_primary.trip_id = t.trip_id AND tl_primary.is_primary = TRUE 
             LIMIT 1) as primary_location_address
             
        FROM trips t
        INNER JOIN trip_details td ON t.trip_id = td.trip_id
        INNER JOIN trip_visibility tv ON t.trip_id = tv.trip_id
        LEFT JOIN trip_location tl ON t.trip_id = tl.trip_id AND tl.is_primary = TRUE
        LEFT JOIN locations l ON tl.location_id = l.location_id
        WHERE 
            -- Status filter (indexed)
            t.status = ANY(p_status)
            
            -- Spatial filter with index support
            AND (NOT point_found OR 
                 ST_DWithin(
                     l.geometry::geography,
                     ST_MakePoint(p_longitude, p_latitude)::geography,
                     search_radius
                 ))
            
            -- Location type filter (indexed) - FIXED: removed 'all' check since it's not a valid enum value
            AND (p_location_type IS NULL OR EXISTS (
                SELECT 1 FROM trip_location tl_type
                WHERE tl_type.trip_id = t.trip_id 
                AND tl_type.location_type = p_location_type
            ))
            
            -- Budget filters (indexed)
            AND (p_min_budget IS NULL OR td.estimated_budget >= p_min_budget)
            AND (p_max_budget IS NULL OR td.estimated_budget <= p_max_budget)
            
            -- Date filters (indexed)
            AND (p_start_date IS NULL OR td.end_date >= p_start_date)
            AND (p_end_date IS NULL OR td.start_date <= p_end_date)
            
            -- Tags filter (indexed)
            AND (p_tags IS NULL OR td.tags && p_tags)
            
            -- Availability filter (indexed)
            AND tv.available_spots > 0
            
            -- Public trips only
            AND t.is_public = true
    ),
    trips_with_images AS (
        SELECT 
            sft.trip_id,
            sft.title,
            sft.description,
            sft.distance_km,
            sft.estimated_budget,
            sft.tags,
            sft.available_spots,
            sft.max_participants,
            sft.current_participants,
            sft.start_date,
            sft.end_date,
            sft.region,
            sft.duration_days,
            sft.budget_per_person,
            sft.relevance_score,
            sft.primary_location_name,
            sft.primary_location_address,
            COALESCE(array_agg(ti.image_url ORDER BY ti.display_order) FILTER (WHERE ti.image_url IS NOT NULL), ARRAY[]::TEXT[]) as images
        FROM spatial_filtered_trips sft
        LEFT JOIN trip_images ti ON sft.trip_id = ti.trip_id AND ti.is_cover = TRUE
        GROUP BY 
            sft.trip_id, sft.title, sft.description, sft.distance_km, 
            sft.estimated_budget, sft.tags, sft.available_spots, sft.max_participants,
            sft.current_participants, sft.start_date, sft.end_date, sft.region,
            sft.duration_days, sft.budget_per_person, sft.relevance_score,
            sft.primary_location_name, sft.primary_location_address
    )
    SELECT 
        trip_id,
        title,
        description,
        distance_km,
        estimated_budget,
        tags,
        available_spots,
        max_participants,
        current_participants,
        start_date,
        end_date,
        region,
        duration_days,
        budget_per_person,
        relevance_score,
        primary_location_name,
        primary_location_address,
        images
    FROM trips_with_images
    ORDER BY 
        relevance_score DESC,
        CASE 
            WHEN point_found THEN distance_km 
            ELSE 999999 -- Put non-location searches after distance-based results
        END ASC NULLS LAST,
        start_date ASC NULLS LAST
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_trips_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION search_trips_optimized TO anon;