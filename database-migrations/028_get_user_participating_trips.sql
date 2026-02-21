-- =====================================================
-- GET USER PARTICIPATING TRIPS
-- =====================================================
-- Returns all trips the user is participating in,
-- regardless of participation state:
--   'joined'  → member_status = 'joined' in trip_members
--   'pending' → member_status = 'pending' in trip_members (join request)
--   'invited' → status = 'pending' in trip_invitations (non-expired)
--
-- Owned trips are excluded (they appear in My Trips tab).
-- Results carry a `participation_status` column so the UI
-- can render the correct badge on each TripCard.
--
-- Used by: /trips page "Joined" tab
-- =====================================================

DROP FUNCTION IF EXISTS get_user_participating_trips(UUID, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_user_participating_trips(
    p_user_id  UUID,
    p_search   TEXT    DEFAULT NULL,
    p_status   TEXT    DEFAULT NULL,   -- filters by trip.status (e.g. 'active')
    p_limit    INTEGER DEFAULT 12,
    p_offset   INTEGER DEFAULT 0
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
    participation_status TEXT,   -- 'joined' | 'pending' | 'invited'
    invitation_id        UUID,   -- non-null for 'invited' rows
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
        combined.trip_id,
        combined.title,
        combined.description,
        combined.status,
        combined.slug,
        combined.cover_image,
        combined.start_date,
        combined.end_date,
        combined.region,
        combined.tags,
        combined.role,
        combined.owner_name,
        combined.owner_avatar,
        combined.participation_status,
        combined.invitation_id,
        combined.created_at,
        COUNT(*) OVER() AS total_count
    FROM (

        -- ── 1. Trips user is a member of (joined or pending request) ──────────
        SELECT
            t.trip_id,
            t.title::TEXT,
            t.description,
            t.status::TEXT,
            t.slug::TEXT,
            (SELECT ti2.image_url
               FROM trip_images ti2
              WHERE ti2.trip_id = t.trip_id AND ti2.is_cover = TRUE
              LIMIT 1)                 AS cover_image,
            td.start_date,
            td.end_date,
            td.region::TEXT,
            td.tags,
            tm.role::TEXT,
            u.username::TEXT           AS owner_name,
            u.avatar_url               AS owner_avatar,
            tm.member_status::TEXT     AS participation_status,
            NULL::UUID                 AS invitation_id,
            t.created_at
        FROM trip_members tm
        INNER JOIN trips t         ON t.trip_id  = tm.trip_id
        INNER JOIN trip_details td ON td.trip_id = t.trip_id
        INNER JOIN users u         ON u.auth_id  = t.owner_id
        WHERE tm.user_id = p_user_id
            AND tm.member_status IN ('joined', 'pending')
            -- Exclude trips the user owns (those go in "My Trips")
            AND t.owner_id != p_user_id

        UNION ALL

        -- ── 2. Trips user has been invited to ─────────────────────────────────
        SELECT
            t.trip_id,
            t.title::TEXT,
            t.description,
            t.status::TEXT,
            t.slug::TEXT,
            (SELECT ti2.image_url
               FROM trip_images ti2
              WHERE ti2.trip_id = t.trip_id AND ti2.is_cover = TRUE
              LIMIT 1)                 AS cover_image,
            td.start_date,
            td.end_date,
            td.region::TEXT,
            td.tags,
            NULL::TEXT                 AS role,
            u.username::TEXT           AS owner_name,
            u.avatar_url               AS owner_avatar,
            'invited'::TEXT            AS participation_status,
            inv.invitation_id,
            t.created_at
        FROM trip_invitations inv
        INNER JOIN trips t         ON t.trip_id  = inv.trip_id
        INNER JOIN trip_details td ON td.trip_id = t.trip_id
        INNER JOIN users u         ON u.auth_id  = t.owner_id
        WHERE inv.invitee_id = p_user_id
            AND inv.status   = 'pending'
            AND inv.expires_at > NOW()
            -- Skip trips where user is already a member/pending
            -- (avoids duplicates if invite + join-request coexist)
            AND NOT EXISTS (
                SELECT 1 FROM trip_members tm2
                WHERE tm2.trip_id = inv.trip_id
                  AND tm2.user_id = p_user_id
                  AND tm2.member_status IN ('joined', 'pending')
            )

    ) combined
    WHERE
        (p_status IS NULL OR combined.status = p_status)
        AND (
            p_search IS NULL
            OR combined.title       ILIKE '%' || p_search || '%'
            OR combined.description ILIKE '%' || p_search || '%'
        )
    ORDER BY combined.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_participating_trips TO authenticated;
