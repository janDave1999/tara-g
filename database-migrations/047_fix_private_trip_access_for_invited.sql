-- =====================================================
-- 047: Fix private trip access for invited users
-- =====================================================
-- The get_trip_full_details function only checked trip_members
-- for the 'pending'/'invited' role. Users with a pending entry
-- in trip_invitations (direct invitations or share link invitations)
-- but no trip_members row were classified as 'visitor' and blocked
-- from private trips.
--
-- Changes:
-- 1. Add optional p_share_code parameter to accept share link codes
-- 2. Extend role determination to check trip_invitations by invitee_id
--    (for regular invitations) and by share_code (for share links)
-- =====================================================

DROP FUNCTION IF EXISTS get_trip_full_details(UUID, UUID);
DROP FUNCTION IF EXISTS get_trip_full_details(UUID, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.get_trip_full_details(
    p_trip_id         UUID,
    p_current_user_id UUID    DEFAULT NULL,
    p_share_code      VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result    JSONB;
    v_user_role TEXT;
    v_visibility TEXT;
BEGIN
    -- ─── 1. Determine user role ───────────────────────────────────────────────
    IF p_current_user_id IS NULL THEN
        v_user_role := 'visitor';
    ELSIF EXISTS (
        SELECT 1 FROM trips
        WHERE trips.trip_id = p_trip_id AND trips.owner_id = p_current_user_id
    ) THEN
        v_user_role := 'owner';
    ELSIF EXISTS (
        SELECT 1 FROM trip_members
        WHERE trip_members.trip_id = p_trip_id
          AND trip_members.user_id = p_current_user_id
          AND trip_members.member_status = 'joined'
    ) THEN
        v_user_role := 'member';
    ELSIF EXISTS (
        SELECT 1 FROM trip_members
        WHERE trip_members.trip_id = p_trip_id
          AND trip_members.user_id = p_current_user_id
          AND trip_members.member_status IN ('pending', 'invited')
    ) THEN
        v_user_role := 'pending';
    -- Check trip_invitations for direct (invitee_id-based) invitations
    ELSIF EXISTS (
        SELECT 1 FROM trip_invitations
        WHERE trip_invitations.trip_id = p_trip_id
          AND trip_invitations.invitee_id = p_current_user_id
          AND trip_invitations.status = 'pending'
          AND (trip_invitations.expires_at IS NULL OR trip_invitations.expires_at > NOW())
    ) THEN
        v_user_role := 'invited';
    -- Check trip_invitations for share link code (anyone with a valid code)
    ELSIF p_share_code IS NOT NULL AND EXISTS (
        SELECT 1 FROM trip_invitations
        WHERE trip_invitations.trip_id = p_trip_id
          AND trip_invitations.share_code = p_share_code
          AND trip_invitations.invitation_type = 'share_link'
          AND trip_invitations.status = 'pending'
          AND (trip_invitations.expires_at IS NULL OR trip_invitations.expires_at > NOW())
          AND (trip_invitations.max_uses IS NULL OR trip_invitations.current_uses < trip_invitations.max_uses)
    ) THEN
        v_user_role := 'invited';
    ELSE
        v_user_role := 'visitor';
    END IF;

    -- ─── 2. Visibility gate ───────────────────────────────────────────────────
    -- Visitors (unauthenticated or non-members without a valid invitation)
    -- cannot access private trips.
    -- Members, pending, invited users can always access their trip.
    IF v_user_role = 'visitor' THEN
        SELECT tv.visibility INTO v_visibility
        FROM trip_visibility tv
        WHERE tv.trip_id = p_trip_id;

        IF v_visibility = 'private' THEN
            RETURN NULL;
        END IF;
    END IF;

    -- ─── 3. Build result ──────────────────────────────────────────────────────
    SELECT jsonb_build_object(
        'trip_id',     t.trip_id,
        'owner_id',    t.owner_id,
        'title',       t.title,
        'description', t.description,
        'status',      t.status,
        'slug',        t.slug,
        'is_public',   t.is_public,
        'created_at',  t.created_at,
        'updated_at',  t.updated_at,
        'user_role',   v_user_role,

        -- Owner profile
        'owner', jsonb_build_object(
            'user_id',    u.user_id,
            'username',   u.username,
            'full_name',  u.full_name,
            'avatar_url', u.avatar_url
        ),

        -- Trip details row
        'trip_details', (
            SELECT to_jsonb(td)
            FROM trip_details td
            WHERE td.trip_id = t.trip_id
        ),

        -- Locations array
        'trip_locations', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id',              tl.id,
                        'location_type',   tl.location_type,
                        'is_primary',      tl.is_primary,
                        'is_mandatory',    tl.is_mandatory,
                        'order_index',     tl.order_index,
                        'scheduled_start', tl.scheduled_start,
                        'scheduled_end',   tl.scheduled_end,
                        'actual_start',    tl.actual_start,
                        'actual_end',      tl.actual_end,
                        'waiting_time',    tl.waiting_time,
                        'notes',           tl.notes,
                        'location', CASE
                            WHEN l.location_id IS NOT NULL THEN jsonb_build_object(
                                'location_id', l.location_id,
                                'name',        l.name,
                                'latitude',    l.latitude,
                                'longitude',   l.longitude
                            )
                            ELSE NULL
                        END,
                        'activities', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id',                       sa.id,
                                        'activity_type',            sa.activity_type,
                                        'description',              sa.description,
                                        'planned_duration_minutes', sa.planned_duration_minutes,
                                        'actual_duration_minutes',  sa.actual_duration_minutes,
                                        'order_index',              sa.order_index,
                                        'notes',                    sa.notes
                                    ) ORDER BY sa.order_index
                                )
                                FROM stop_activities sa
                                WHERE sa.stop_id = tl.id
                            ),
                            '[]'::jsonb
                        )
                    ) ORDER BY tl.order_index, tl.scheduled_start
                ),
                '[]'::jsonb
            )
            FROM trip_location tl
            LEFT JOIN locations l ON l.location_id = tl.location_id
            WHERE tl.trip_id = t.trip_id
        ),

        -- Members
        'trip_members', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id',                   tm.id,
                        'user_id',              tm.user_id,
                        'full_name',            u2.full_name,
                        'username',             u2.username,
                        'avatar_url',          u2.avatar_url,
                        'role',                tm.role,
                        'member_status',       tm.member_status,
                        'joined_at',           tm.joined_at,
                        'join_method',         tm.join_method,
                        'initial_contribution', tm.initial_contribution
                    )
                ),
                '[]'::jsonb
            )
            FROM trip_members tm
            JOIN users u2 ON u2.auth_id = tm.user_id
            WHERE tm.trip_id = t.trip_id
        ),

        -- Trip pool (single active pool per trip)
        'trip_pools', (
            SELECT to_jsonb(tp)
            FROM trip_pools tp
            WHERE tp.trip_id = t.trip_id
        ),

        -- Pool members
        'trip_pool_members', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'user_id',      u3.user_id,
                        'full_name',    u3.full_name,
                        'contribution', tpm.contribution,
                        'balance',      tpm.balance
                    )
                ),
                '[]'::jsonb
            )
            FROM trip_pools tp2
            JOIN trip_pool_members tpm ON tpm.pool_id = tp2.trip_pool_id
            JOIN users u3 ON u3.user_id = tpm.member_id
            WHERE tp2.trip_id = t.trip_id
        ),

        -- Expenses
        'trip_expenses', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'trip_expense_id', te.trip_expense_id,
                        'payer_id',        te.payer_id,
                        'description',     te.description,
                        'category',        te.category,
                        'amount',          te.amount,
                        'created_at',      te.created_at
                    )
                ),
                '[]'::jsonb
            )
            FROM trip_expenses te
            WHERE te.trip_id = t.trip_id
        ),

        -- Images
        'trip_images', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'image_id',   ti.image_id,
                        'image_url',  ti.image_url,
                        'type',       ti.type,
                        'is_cover',   ti.is_cover,
                        'created_at', ti.created_at
                    ) ORDER BY ti.is_cover DESC, ti.display_order
                ),
                '[]'::jsonb
            )
            FROM trip_images ti
            WHERE ti.trip_id = t.trip_id
        ),

        'trip_visibility', (
            SELECT to_jsonb(tv)
            FROM trip_visibility tv
            WHERE tv.trip_id = t.trip_id
        ),

        'trip_social', (
            SELECT to_jsonb(ts)
            FROM trip_social ts
            WHERE ts.trip_id = t.trip_id
        ),

        'tags', (
            SELECT COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'tag_id',      tt.tag_id,
                        'tag_name',    tt.tag_name,
                        'usage_count', tt.usage_count
                    )
                ),
                '[]'::jsonb
            )
            FROM trip_tag_relations ttr
            JOIN trip_tags tt ON tt.tag_id = ttr.tag_id
            WHERE ttr.trip_id = t.trip_id
        )
    )
    INTO v_result
    FROM trips t
    LEFT JOIN users u ON u.auth_id = t.owner_id
    WHERE t.trip_id = p_trip_id;

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Trip not found';
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_trip_full_details TO authenticated;
GRANT EXECUTE ON FUNCTION get_trip_full_details TO anon;
