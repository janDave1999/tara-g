-- Migration 049: Exclude share link records from pending_invitations in get_trip_members_complete
--
-- Problem: get_trip_members_complete returns ALL pending trip_invitations including
--          rows with invitation_type = 'share_link', which are link records not person invites.
-- Fix:     Add filter to only return invitation_type = 'invitation' (or NULL for legacy rows).

CREATE OR REPLACE FUNCTION public.get_trip_members_complete(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role         TEXT;
    v_user_status       TEXT;
    v_max_pax           SMALLINT;
    v_joined            BIGINT;
    v_pending_req       BIGINT;
    v_pending_inv       BIGINT;
    v_caller_user_id    UUID;
    v_result            JSONB;
BEGIN
    -- Determine user role
    IF EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        v_user_role   := 'owner';
        v_user_status := 'joined';
    ELSE
        SELECT role, member_status INTO v_user_role, v_user_status
          FROM trip_members
         WHERE trip_id = p_trip_id AND user_id = p_user_id;

        IF NOT FOUND THEN
            v_user_role   := 'visitor';
            v_user_status := 'visitor';
        END IF;
    END IF;

    SELECT max_pax INTO v_max_pax FROM trip_details WHERE trip_id = p_trip_id;
    SELECT COUNT(*) INTO v_joined      FROM trip_members    WHERE trip_id = p_trip_id AND member_status = 'joined';
    SELECT COUNT(*) INTO v_pending_req FROM trip_members    WHERE trip_id = p_trip_id AND member_status = 'pending';
    -- Count only person-to-person invitations, not share links
    SELECT COUNT(*) INTO v_pending_inv FROM trip_invitations
     WHERE trip_id = p_trip_id
       AND status = 'pending'
       AND (invitation_type IS NULL OR invitation_type = 'invitation');

    -- Get internal user_id for friend checks
    SELECT user_id INTO v_caller_user_id FROM users WHERE auth_id = p_user_id;

    SELECT jsonb_build_object(

        -- Joined members (includes owner who has role='owner')
        'members', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'member_id',           tm.id,
                    'user_id',             tm.user_id,
                    'username',            u.username,
                    'full_name',           COALESCE(u.full_name, u.username),
                    'avatar_url',          u.avatar_url,
                    'email',               u.email,
                    'role',                tm.role,
                    'member_status',       tm.member_status,
                    'join_method',         tm.join_method,
                    'joined_at',           tm.joined_at,
                    'initial_contribution', tm.initial_contribution,
                    'is_current_user',     (tm.user_id = p_user_id)
                ) ORDER BY
                    CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                    tm.joined_at
            )
            FROM trip_members tm
            JOIN users u ON u.auth_id = tm.user_id
            WHERE tm.trip_id = p_trip_id AND tm.member_status = 'joined'
        ), '[]'::JSONB),

        -- Pending requests (visible to owner/admin only)
        'pending_requests', CASE
            WHEN v_user_role IN ('owner', 'admin') THEN COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'member_id',    tm.id,
                        'user_id',      tm.user_id,
                        'username',     u.username,
                        'full_name',    COALESCE(u.full_name, u.username),
                        'avatar_url',   u.avatar_url,
                        'bio',          u.bio,
                        'role',         tm.role,
                        'requested_at', tm.joined_at,
                        'is_friend', CASE
                            WHEN v_caller_user_id IS NOT NULL THEN EXISTS (
                                SELECT 1
                                  FROM friends f
                                  JOIN users u2 ON u2.auth_id = tm.user_id
                                 WHERE f.user_id   = v_caller_user_id
                                   AND f.friend_id = u2.user_id
                            )
                            ELSE false
                        END
                    ) ORDER BY tm.joined_at
                )
                FROM trip_members tm
                JOIN users u ON u.auth_id = tm.user_id
                WHERE tm.trip_id = p_trip_id AND tm.member_status = 'pending'
            ), '[]'::JSONB)
            ELSE '[]'::JSONB
        END,

        -- Pending invitations — only person-to-person, exclude share_link records
        'pending_invitations', CASE
            WHEN v_user_role IN ('owner', 'admin') THEN COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'invitation_id',    ti.invitation_id,
                        'invitee_id',       ti.invitee_id,
                        'invitee_name',     COALESCE(u_inv.full_name, u_inv.username, ti.invitee_email),
                        'invitee_username', u_inv.username,
                        'invitee_email',    COALESCE(u_inv.email, ti.invitee_email),
                        'invitee_avatar',   u_inv.avatar_url,
                        'inviter_name',     COALESCE(u_itr.full_name, u_itr.username),
                        'message',          ti.message,
                        'created_at',       ti.created_at,
                        'expires_at',       ti.expires_at,
                        'days_until_expiry', GREATEST(0, EXTRACT(DAY FROM (ti.expires_at - NOW()))::INT)
                    ) ORDER BY ti.created_at DESC
                )
                FROM trip_invitations ti
                LEFT JOIN users u_inv ON u_inv.auth_id = ti.invitee_id
                LEFT JOIN users u_itr ON u_itr.auth_id = ti.inviter_id
                WHERE ti.trip_id = p_trip_id
                  AND ti.status = 'pending'
                  AND (ti.invitation_type IS NULL OR ti.invitation_type = 'invitation')
            ), '[]'::JSONB)
            ELSE '[]'::JSONB
        END,

        -- Summary
        'summary', jsonb_build_object(
            'total_members',        v_joined + v_pending_req,
            'joined_members',       v_joined,
            'pending_requests',     v_pending_req,
            'pending_invitations',  v_pending_inv,
            'max_participants',     v_max_pax,
            'current_participants', v_joined,
            'available_spots',      GREATEST(0, v_max_pax::BIGINT - v_joined),
            'user_role',            v_user_role,
            'user_status',          v_user_status,
            'can_invite',           (v_user_role IN ('owner', 'admin') AND v_joined < v_max_pax)
        )

    ) INTO v_result;

    RETURN v_result;
END;
$$;


-- Also fix get_trip_pending_invitations (used by TripHeader pending invites footer)
-- Same bug: returns share_link rows alongside person-to-person invitations.

CREATE OR REPLACE FUNCTION public.get_trip_pending_invitations(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_user_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN '[]'::JSONB;
        END IF;
    END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'invitation_id',    ti.invitation_id,
                'invitee_id',       ti.invitee_id,
                'invitee_name',     COALESCE(u_inv.full_name, u_inv.username, ti.invitee_email),
                'invitee_username', u_inv.username,
                'invitee_email',    COALESCE(u_inv.email, ti.invitee_email),
                'invitee_avatar',   u_inv.avatar_url,
                'inviter_name',     COALESCE(u_itr.full_name, u_itr.username),
                'message',          ti.message,
                'created_at',       ti.created_at,
                'expires_at',       ti.expires_at,
                'days_until_expiry', GREATEST(0, EXTRACT(DAY FROM (ti.expires_at - NOW()))::INT)
            ) ORDER BY ti.created_at DESC
        )
        FROM trip_invitations ti
        LEFT JOIN users u_inv ON u_inv.auth_id = ti.invitee_id
        LEFT JOIN users u_itr ON u_itr.auth_id = ti.inviter_id
        WHERE ti.trip_id = p_trip_id
          AND ti.status = 'pending'
          AND (ti.invitation_type IS NULL OR ti.invitation_type = 'invitation')
    ), '[]'::JSONB);
END;
$$;
