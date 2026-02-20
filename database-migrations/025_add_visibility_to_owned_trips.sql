-- =====================================================
-- 025: Add visibility to get_user_owned_trips RPC
-- =====================================================
-- Extends the owned trips listing function to include
-- the visibility field from trip_visibility so the
-- trip card can show and toggle it.
-- =====================================================

DROP FUNCTION IF EXISTS get_user_owned_trips(UUID, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_owned_trips(
    p_user_id  UUID,
    p_search   TEXT    DEFAULT NULL,
    p_status   TEXT    DEFAULT NULL,
    p_limit    INTEGER DEFAULT 12,
    p_offset   INTEGER DEFAULT 0
)
RETURNS TABLE(
    trip_id          UUID,
    title            TEXT,
    description      TEXT,
    status           TEXT,
    slug             TEXT,
    visibility       TEXT,
    cover_image      TEXT,
    start_date       DATE,
    end_date         DATE,
    region           TEXT,
    tags             TEXT[],
    member_count     BIGINT,
    created_at       TIMESTAMPTZ,
    total_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.trip_id,
        t.title::TEXT,
        t.description,
        t.status::TEXT,
        t.slug::TEXT,
        COALESCE(tv.visibility::TEXT, 'private') AS visibility,
        (SELECT image_url
           FROM trip_images ti
          WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE
          LIMIT 1) AS cover_image,
        td.start_date,
        td.end_date,
        td.region::TEXT,
        td.tags,
        (SELECT COUNT(*)
           FROM trip_members tm
          WHERE tm.trip_id = t.trip_id
            AND tm.member_status = 'joined') AS member_count,
        t.created_at,
        COUNT(*) OVER() AS total_count
    FROM trips t
    INNER JOIN trip_details td ON td.trip_id = t.trip_id
    LEFT JOIN trip_visibility tv ON tv.trip_id = t.trip_id
    WHERE t.owner_id = p_user_id
        AND (p_status IS NULL OR t.status::TEXT = p_status)
        AND (p_search IS NULL
             OR t.title       ILIKE '%' || p_search || '%'
             OR t.description ILIKE '%' || p_search || '%')
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_owned_trips TO authenticated;
