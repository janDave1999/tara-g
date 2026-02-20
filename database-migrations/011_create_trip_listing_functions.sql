-- =====================================================
-- TRIP LISTING RPC FUNCTIONS
-- =====================================================
-- Functions for the /trips page tabs:
--   get_user_owned_trips   → "My Trips" tab
--   get_user_member_trips  → "Joined" tab
--   get_recent_trips       → General public feed (legacy/API)
--   get_suggested_trips    → Sidebar suggestions
--
-- Schema fixes applied vs original functions:
--   - trip_images uses image_url (not key_name)
--   - member_status enum: 'joined' (not 'active')
--   - trip_status enum: 'active' (not 'planning'/'upcoming')
--   - Owner info: users.avatar_url via users.auth_id = trips.owner_id
--     (user_information has no avatar_url)
--   - Block checking: blocks references users.user_id, not auth.users.id
--   - Pagination: COUNT(*) OVER() window fn instead of separate subquery
--   - VARCHAR columns cast to TEXT to match RETURNS TABLE declarations:
--     trips.title VARCHAR(200), trips.slug VARCHAR(100),
--     trip_details.region VARCHAR(200), users.username VARCHAR(50)
-- =====================================================


-- Drop existing versions first to allow return-type changes
DROP FUNCTION IF EXISTS get_user_owned_trips(UUID, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_user_member_trips(UUID, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_recent_trips(UUID, TEXT, TEXT[], TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_suggested_trips(UUID, INTEGER);

-- =====================================================
-- 1. GET_USER_OWNED_TRIPS
-- =====================================================
-- Returns trips owned by p_user_id with member counts.
-- Supports search and status filter.
-- =====================================================

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


-- =====================================================
-- 2. GET_USER_MEMBER_TRIPS
-- =====================================================
-- Returns trips the user has joined (member_status = 'joined').
-- Includes owner info (username + avatar_url from users table).
-- p_member_status filters by trip status (e.g. 'active', 'completed').
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_member_trips(
    p_user_id       UUID,
    p_search        TEXT    DEFAULT NULL,
    p_member_status TEXT    DEFAULT NULL,
    p_limit         INTEGER DEFAULT 12,
    p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE(
    trip_id              UUID,
    title                TEXT,
    description          TEXT,
    status               TEXT,
    slug                 TEXT,
    cover_image          TEXT,
    start_date           DATE,
    end_date             DATE,
    region               TEXT,
    tags                 TEXT[],
    role                 TEXT,
    owner_name           TEXT,
    owner_avatar         TEXT,
    created_at           TIMESTAMPTZ,
    total_count          BIGINT
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
        (SELECT image_url
           FROM trip_images ti
          WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE
          LIMIT 1) AS cover_image,
        td.start_date,
        td.end_date,
        td.region::TEXT,
        td.tags,
        tm.role::TEXT,
        u.username::TEXT  AS owner_name,
        u.avatar_url      AS owner_avatar,
        t.created_at,
        COUNT(*) OVER() AS total_count
    FROM trip_members tm
    INNER JOIN trips t         ON t.trip_id  = tm.trip_id
    INNER JOIN trip_details td ON td.trip_id = t.trip_id
    -- trips.owner_id = auth.users.id; users.auth_id = auth.users.id
    INNER JOIN users u         ON u.auth_id  = t.owner_id
    WHERE tm.user_id = p_user_id            -- trip_members.user_id references auth.users.id
        AND tm.member_status = 'joined'
        AND (p_member_status IS NULL OR t.status::TEXT = p_member_status)
        AND (p_search IS NULL
             OR t.title       ILIKE '%' || p_search || '%'
             OR t.description ILIKE '%' || p_search || '%')
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_member_trips TO authenticated;


-- =====================================================
-- 3. GET_RECENT_TRIPS
-- =====================================================
-- Returns recent public + active trips visible to p_user_id.
-- Excludes trips from/to users blocked by the viewer.
-- Supports search, region, and tag filtering.
-- =====================================================

CREATE OR REPLACE FUNCTION get_recent_trips(
    p_user_id UUID,
    p_search  TEXT     DEFAULT NULL,
    p_tags    TEXT[]   DEFAULT NULL,
    p_region  TEXT     DEFAULT NULL,
    p_limit   INTEGER  DEFAULT 12,
    p_offset  INTEGER  DEFAULT 0
)
RETURNS TABLE(
    trip_id              UUID,
    title                TEXT,
    description          TEXT,
    status               TEXT,
    slug                 TEXT,
    cover_image          TEXT,
    start_date           DATE,
    end_date             DATE,
    region               TEXT,
    tags                 TEXT[],
    max_pax              SMALLINT,
    current_participants SMALLINT,
    owner_name           TEXT,
    owner_avatar         TEXT,
    created_at           TIMESTAMPTZ,
    total_count          BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_viewer_user_id UUID;
BEGIN
    -- Resolve auth.users.id → users.user_id for block lookups
    -- (blocks table references users.user_id, not auth.users.id)
    SELECT user_id INTO v_viewer_user_id
    FROM users
    WHERE auth_id = p_user_id;

    RETURN QUERY
    SELECT
        t.trip_id,
        t.title::TEXT,
        t.description,
        t.status::TEXT,
        t.slug::TEXT,
        (SELECT image_url
           FROM trip_images ti
          WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE
          LIMIT 1) AS cover_image,
        td.start_date,
        td.end_date,
        td.region::TEXT,
        td.tags,
        td.max_pax,
        tv.current_participants,
        u.username::TEXT  AS owner_name,
        u.avatar_url      AS owner_avatar,
        t.created_at,
        COUNT(*) OVER() AS total_count
    FROM trips t
    INNER JOIN trip_details    td ON td.trip_id = t.trip_id
    INNER JOIN trip_visibility tv ON tv.trip_id = t.trip_id
    INNER JOIN users u             ON u.auth_id  = t.owner_id
    WHERE t.status        = 'active'
        AND tv.visibility = 'public'
        -- Block filter: skip trips owned by users who blocked viewer (or vice-versa)
        AND (v_viewer_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM blocks b
            WHERE (b.blocker_id = v_viewer_user_id AND b.blocked_id = u.user_id)
               OR (b.blocker_id = u.user_id        AND b.blocked_id = v_viewer_user_id)
        ))
        AND (p_search IS NULL
             OR t.title       ILIKE '%' || p_search || '%'
             OR t.description ILIKE '%' || p_search || '%')
        AND (p_region IS NULL OR td.region ILIKE '%' || p_region || '%')
        AND (p_tags   IS NULL OR td.tags && p_tags)
    ORDER BY t.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_trips TO authenticated;


-- =====================================================
-- 4. GET_SUGGESTED_TRIPS
-- =====================================================
-- Returns up to p_limit trips scored against the user's
-- travel preferences (budget, popularity, availability).
-- Excludes: user's own trips, trips already joined/pending,
--           trips from blocked users.
-- Optimized: no correlated subqueries in scoring.
-- =====================================================

CREATE OR REPLACE FUNCTION get_suggested_trips(
    p_user_id UUID,
    p_limit   INTEGER DEFAULT 6
)
RETURNS TABLE(
    trip_id              UUID,
    title                TEXT,
    description          TEXT,
    status               TEXT,
    slug                 TEXT,
    cover_image          TEXT,
    start_date           DATE,
    end_date             DATE,
    region               TEXT,
    tags                 TEXT[],
    max_pax              SMALLINT,
    current_participants SMALLINT,
    owner_name           TEXT,
    owner_avatar         TEXT,
    match_score          INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_viewer_user_id UUID;
    v_budget_range   TEXT;
    v_travel_styles  TEXT[];
    v_pace_pref      TEXT;
BEGIN
    -- Resolve auth.users.id → users.user_id
    SELECT user_id INTO v_viewer_user_id
    FROM users WHERE auth_id = p_user_id;

    -- Load user travel preferences (NULL if not set)
    IF v_viewer_user_id IS NOT NULL THEN
        SELECT budget_range, travel_style, pace_preference
        INTO v_budget_range, v_travel_styles, v_pace_pref
        FROM user_travel_preferences
        WHERE user_id = v_viewer_user_id;
    END IF;

    RETURN QUERY
    SELECT
        t.trip_id,
        t.title::TEXT,
        t.description,
        t.status::TEXT,
        t.slug::TEXT,
        (SELECT image_url
           FROM trip_images ti
          WHERE ti.trip_id = t.trip_id AND ti.is_cover = TRUE
          LIMIT 1) AS cover_image,
        td.start_date,
        td.end_date,
        td.region::TEXT,
        td.tags,
        td.max_pax,
        tv.current_participants,
        u.username::TEXT  AS owner_name,
        u.avatar_url      AS owner_avatar,
        -- match_score: budget(0-50) + availability(0-20) + popularity(0-30)
        (
            CASE
                WHEN v_budget_range IS NULL                                                    THEN 33
                WHEN v_budget_range = 'budget'   AND td.estimated_budget <= 5000               THEN 50
                WHEN v_budget_range = 'moderate' AND td.estimated_budget BETWEEN 5001 AND 15000 THEN 50
                WHEN v_budget_range = 'luxury'   AND td.estimated_budget > 15000               THEN 50
                ELSE 20
            END
            +
            CASE WHEN tv.available_spots > 0 THEN 20 ELSE 0 END
            +
            CASE
                WHEN t.popularity_score > 0.5 THEN 30
                WHEN t.popularity_score > 0.2 THEN 15
                ELSE 0
            END
        )::INTEGER AS match_score
    FROM trips t
    INNER JOIN trip_details    td ON td.trip_id = t.trip_id
    INNER JOIN trip_visibility tv ON tv.trip_id = t.trip_id
    INNER JOIN users u             ON u.auth_id  = t.owner_id
    WHERE t.status        = 'active'
        AND tv.visibility = 'public'
        AND td.start_date >= CURRENT_DATE
        -- Exclude user's own trips
        AND t.owner_id != p_user_id
        -- Exclude trips the user already joined or has pending request
        AND NOT EXISTS (
            SELECT 1 FROM trip_members tm
             WHERE tm.trip_id       = t.trip_id
               AND tm.user_id       = p_user_id
               AND tm.member_status IN ('joined', 'pending')
        )
        -- Block filter
        AND (v_viewer_user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM blocks b
            WHERE (b.blocker_id = v_viewer_user_id AND b.blocked_id = u.user_id)
               OR (b.blocker_id = u.user_id        AND b.blocked_id = v_viewer_user_id)
        ))
    ORDER BY match_score DESC, t.popularity_score DESC, td.start_date ASC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_suggested_trips TO authenticated;


SELECT 'Created trip listing functions: get_user_owned_trips, get_user_member_trips, get_recent_trips, get_suggested_trips' AS status;
