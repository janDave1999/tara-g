-- =====================================================
-- MIGRATION 055: get_people_you_may_know RPC
-- =====================================================
-- Returns suggested users ranked by social proximity:
--   Priority 1 — Trip mates (shared same trip, active or completed)
--   Priority 2 — Mutual connections (friends of friends)
--   Priority 3 — Random active users (fills remaining slots)
-- Excludes: the viewer, existing friends, inactive users.
-- Returns relation context (reason + shared_count) for display.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_people_you_may_know(
    p_user_id UUID,    -- auth_id of the viewer
    p_limit   INTEGER  DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_internal_id UUID;
BEGIN
    -- Resolve auth_id → internal user_id (for friends table)
    SELECT user_id INTO v_internal_id
    FROM users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN RETURN '[]'::JSONB; END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(result.row_json ORDER BY result.priority ASC, result.shared_count DESC)
        FROM (
            SELECT DISTINCT ON (u.auth_id)
                jsonb_build_object(
                    'auth_id',         u.auth_id,
                    'username',        u.username::TEXT,
                    'full_name',       COALESCE(u.full_name, u.username)::TEXT,
                    'avatar_url',      u.avatar_url::TEXT,
                    'relation_reason', c.reason,
                    'shared_count',    c.shared_count
                ) AS row_json,
                c.priority,
                c.shared_count
            FROM (
                -- ── Priority 1: Trip mates ──────────────────────────────
                SELECT
                    tm2.user_id                          AS candidate_auth_id,
                    'trip_mate'::TEXT                    AS reason,
                    COUNT(DISTINCT tm1.trip_id)::INTEGER AS shared_count,
                    1                                    AS priority
                FROM trip_members tm1
                JOIN trips t
                    ON  t.trip_id = tm1.trip_id
                    AND t.status IN ('active', 'completed')
                JOIN trip_members tm2
                    ON  tm2.trip_id       = tm1.trip_id
                    AND tm2.user_id      != p_user_id
                    AND tm2.member_status = 'joined'
                WHERE tm1.user_id        = p_user_id
                  AND tm1.member_status  = 'joined'
                GROUP BY tm2.user_id

                UNION ALL

                -- ── Priority 2: Friends of friends (mutuals) ────────────
                SELECT
                    u2.auth_id                            AS candidate_auth_id,
                    'mutual'::TEXT                        AS reason,
                    COUNT(DISTINCT f2.friend_id)::INTEGER AS shared_count,
                    2                                     AS priority
                FROM friends f1
                JOIN friends f2
                    ON  f2.user_id    = f1.friend_id
                    AND f2.friend_id != v_internal_id
                JOIN users u2
                    ON  u2.user_id = f2.friend_id
                WHERE f1.user_id = v_internal_id
                GROUP BY u2.auth_id

                UNION ALL

                -- ── Priority 3: Random active users (fill remaining) ────
                SELECT
                    u3.auth_id  AS candidate_auth_id,
                    NULL::TEXT  AS reason,
                    0           AS shared_count,
                    3           AS priority
                FROM users u3
                WHERE u3.is_active = TRUE
                  AND u3.auth_id  != p_user_id

            ) c
            JOIN users u ON u.auth_id = c.candidate_auth_id
            WHERE u.is_active  = TRUE
              AND u.auth_id   != p_user_id
              -- Exclude users who are already friends
              AND NOT EXISTS (
                  SELECT 1 FROM friends ef
                  WHERE ef.user_id   = v_internal_id
                    AND ef.friend_id = u.user_id
              )
            ORDER BY u.auth_id, c.priority ASC
        ) result
        LIMIT p_limit
    ), '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_people_you_may_know TO authenticated;
