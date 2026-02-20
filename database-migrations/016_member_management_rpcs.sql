-- =====================================================
-- MIGRATION 016: MEMBER MANAGEMENT RPCs
-- =====================================================
-- Implements US13-US17: Trip participation and member management
--
-- Schema notes:
--   - trips.owner_id              → auth.users(id)
--   - trip_members.user_id        → auth.users(id)
--   - trip_invitations.inviter_id → auth.users(id)
--   - trip_invitations.invitee_id → auth.users(id)
--   - users.auth_id               → auth.users(id)  [join via this]
--   - friends.user_id/friend_id   → users.user_id   [internal UUID]
--   - Owner is in trip_members with role='owner', member_status='joined'
--   - trip_visibility.current_participants starts at 1 (owner)
--
-- Functions:
--   join_trip                      US14 - request to join
--   cancel_join_request            US14 - cancel pending request
--   leave_trip                     US14 - leave joined trip
--   approve_join_request           US15 - owner approves request
--   reject_join_request            US15 - owner rejects request
--   remove_trip_member             US16 - owner removes member
--   send_trip_invitations          US17 - send invitations
--   cancel_trip_invitation         US17 - cancel sent invitation
--   accept_trip_invitation         US17 - invitee accepts
--   decline_trip_invitation        US17 - invitee declines
--   get_trip_members_complete      US13 - full member dashboard data
--   get_trip_members               US13 - joined members list
--   get_trip_join_requests         US15 - pending requests list
--   get_trip_pending_invitations   US17 - pending invitations list
--   get_trip_members_summary       US13 - member count summary
--   get_trip_invitation_suggestions US17 - suggest users to invite
--   search_users_for_invitation    US17 - search users by name/email
--   get_user_pending_invitations   US17 - user's own invitations
--   get_trip_invitations           US17 - all trip invitations
-- =====================================================


-- =====================================================
-- 1. join_trip
-- =====================================================
DROP FUNCTION IF EXISTS join_trip(UUID, UUID);

CREATE OR REPLACE FUNCTION public.join_trip(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT, member_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_status TEXT;
    v_max_pax     SMALLINT;
    v_joined      BIGINT;
    v_existing    TEXT;
    v_member_id   UUID;
BEGIN
    -- Verify trip exists and is active
    SELECT t.status, td.max_pax
      INTO v_trip_status, v_max_pax
      FROM trips t
      JOIN trip_details td ON td.trip_id = t.trip_id
     WHERE t.trip_id = p_trip_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Trip not found', NULL::UUID; RETURN;
    END IF;

    IF v_trip_status != 'active' THEN
        RETURN QUERY SELECT false, 'This trip is not accepting new members', NULL::UUID; RETURN;
    END IF;

    -- Owner cannot join their own trip
    IF EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        RETURN QUERY SELECT false, 'You are the owner of this trip', NULL::UUID; RETURN;
    END IF;

    -- Check existing membership status
    SELECT member_status INTO v_existing
      FROM trip_members
     WHERE trip_id = p_trip_id AND user_id = p_user_id;

    IF FOUND THEN
        CASE v_existing
            WHEN 'joined' THEN
                RETURN QUERY SELECT false, 'You are already a member of this trip', NULL::UUID; RETURN;
            WHEN 'pending' THEN
                RETURN QUERY SELECT false, 'You already have a pending join request', NULL::UUID; RETURN;
            WHEN 'invited' THEN
                -- Accept the existing invitation
                UPDATE trip_members
                   SET member_status = 'joined', joined_at = NOW()
                 WHERE trip_id = p_trip_id AND user_id = p_user_id
                 RETURNING id INTO v_member_id;

                UPDATE trip_visibility
                   SET current_participants = current_participants + 1
                 WHERE trip_id = p_trip_id;

                RETURN QUERY SELECT true, 'Joined trip via invitation', v_member_id; RETURN;
            ELSE
                -- 'left' or 'removed' — allow re-request
                UPDATE trip_members
                   SET member_status = 'pending', joined_at = NOW(), join_method = 'request'
                 WHERE trip_id = p_trip_id AND user_id = p_user_id
                 RETURNING id INTO v_member_id;

                RETURN QUERY SELECT true, 'Join request sent successfully', v_member_id; RETURN;
        END CASE;
    END IF;

    -- Check capacity
    SELECT COUNT(*) INTO v_joined
      FROM trip_members
     WHERE trip_id = p_trip_id AND member_status = 'joined';

    IF v_joined >= v_max_pax THEN
        RETURN QUERY SELECT false, 'This trip is full', NULL::UUID; RETURN;
    END IF;

    -- Create join request
    INSERT INTO trip_members (trip_id, user_id, role, member_status, join_method)
    VALUES (p_trip_id, p_user_id, 'member', 'pending', 'request')
    RETURNING id INTO v_member_id;

    RETURN QUERY SELECT true, 'Join request sent successfully', v_member_id;
END;
$$;


-- =====================================================
-- 2. cancel_join_request
-- =====================================================
DROP FUNCTION IF EXISTS cancel_join_request(UUID, UUID);

CREATE OR REPLACE FUNCTION public.cancel_join_request(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rows INT;
BEGIN
    DELETE FROM trip_members
     WHERE trip_id = p_trip_id
       AND user_id  = p_user_id
       AND member_status = 'pending';

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RETURN QUERY SELECT false, 'No pending request found for this trip';
    ELSE
        RETURN QUERY SELECT true, 'Join request cancelled successfully';
    END IF;
END;
$$;


-- =====================================================
-- 3. leave_trip
-- =====================================================
DROP FUNCTION IF EXISTS leave_trip(UUID, UUID);

CREATE OR REPLACE FUNCTION public.leave_trip(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    -- Owner cannot leave their own trip
    IF EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        RETURN QUERY SELECT false, 'Trip owner cannot leave the trip'; RETURN;
    END IF;

    SELECT member_status INTO v_status
      FROM trip_members
     WHERE trip_id = p_trip_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'You are not a member of this trip'; RETURN;
    END IF;

    IF v_status != 'joined' THEN
        RETURN QUERY SELECT false, 'You cannot leave a trip you have not joined'; RETURN;
    END IF;

    UPDATE trip_members
       SET member_status = 'left'
     WHERE trip_id = p_trip_id AND user_id = p_user_id;

    UPDATE trip_visibility
       SET current_participants = GREATEST(0, current_participants - 1)
     WHERE trip_id = p_trip_id;

    RETURN QUERY SELECT true, 'Successfully left the trip';
END;
$$;


-- =====================================================
-- 4. approve_join_request
-- =====================================================
DROP FUNCTION IF EXISTS approve_join_request(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.approve_join_request(
    p_member_id   UUID,
    p_trip_id     UUID,
    p_approver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user UUID;
    v_max_pax     SMALLINT;
    v_joined      BIGINT;
BEGIN
    -- Verify approver is owner or admin
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_approver_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_approver_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'You do not have permission to approve join requests');
        END IF;
    END IF;

    -- Get the pending member's user_id
    SELECT user_id INTO v_target_user
      FROM trip_members
     WHERE id = p_member_id AND trip_id = p_trip_id AND member_status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pending join request not found');
    END IF;

    -- Check capacity
    SELECT td.max_pax INTO v_max_pax FROM trip_details td WHERE td.trip_id = p_trip_id;
    SELECT COUNT(*) INTO v_joined FROM trip_members WHERE trip_id = p_trip_id AND member_status = 'joined';

    IF v_joined >= v_max_pax THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trip is full, cannot approve request');
    END IF;

    UPDATE trip_members
       SET member_status = 'joined', joined_at = NOW()
     WHERE id = p_member_id AND trip_id = p_trip_id;

    UPDATE trip_visibility
       SET current_participants = current_participants + 1
     WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Join request approved successfully',
        'user_id', v_target_user
    );
END;
$$;


-- =====================================================
-- 5. reject_join_request
-- =====================================================
DROP FUNCTION IF EXISTS reject_join_request(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.reject_join_request(
    p_member_id   UUID,
    p_trip_id     UUID,
    p_rejector_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify rejector is owner or admin
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_rejector_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_rejector_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'You do not have permission to reject join requests');
        END IF;
    END IF;

    DELETE FROM trip_members
     WHERE id = p_member_id AND trip_id = p_trip_id AND member_status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Pending join request not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Join request rejected');
END;
$$;


-- =====================================================
-- 6. remove_trip_member
-- =====================================================
DROP FUNCTION IF EXISTS remove_trip_member(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.remove_trip_member(
    p_member_id  UUID,
    p_trip_id    UUID,
    p_remover_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user UUID;
BEGIN
    -- Verify remover is owner or admin
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_remover_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_remover_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'You do not have permission to remove members');
        END IF;
    END IF;

    SELECT user_id INTO v_target_user
      FROM trip_members
     WHERE id = p_member_id AND trip_id = p_trip_id AND member_status = 'joined';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Member not found');
    END IF;

    -- Cannot remove the trip owner
    IF EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = v_target_user) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot remove the trip owner');
    END IF;

    UPDATE trip_members
       SET member_status = 'removed'
     WHERE id = p_member_id AND trip_id = p_trip_id;

    UPDATE trip_visibility
       SET current_participants = GREATEST(0, current_participants - 1)
     WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true, 'message', 'Member removed from trip');
END;
$$;


-- =====================================================
-- 7. send_trip_invitations
-- =====================================================
DROP FUNCTION IF EXISTS send_trip_invitations(UUID, UUID, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.send_trip_invitations(
    p_trip_id    UUID,
    p_inviter_id UUID,
    p_invitees   JSONB,
    p_message    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitee       JSONB;
    v_invitee_id    UUID;
    v_invitee_email TEXT;
    v_invitation_id UUID;
    v_invitations   JSONB := '[]'::JSONB;
BEGIN
    -- Verify inviter is owner or admin
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_inviter_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_inviter_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'You do not have permission to send invitations', 'invitations', '[]'::JSONB);
        END IF;
    END IF;

    FOR v_invitee IN SELECT * FROM jsonb_array_elements(p_invitees) LOOP
        v_invitee_id    := (v_invitee->>'user_id')::UUID;
        v_invitee_email := v_invitee->>'email';

        -- Skip users already joined or pending
        IF v_invitee_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = v_invitee_id
               AND member_status IN ('joined', 'pending')
        ) THEN
            CONTINUE;
        END IF;

        -- Upsert invitation: update if pending exists, else insert
        IF v_invitee_id IS NOT NULL THEN
            SELECT invitation_id INTO v_invitation_id
              FROM trip_invitations
             WHERE trip_id = p_trip_id AND invitee_id = v_invitee_id AND status = 'pending'
             LIMIT 1;
        ELSE
            SELECT invitation_id INTO v_invitation_id
              FROM trip_invitations
             WHERE trip_id = p_trip_id AND invitee_email = v_invitee_email AND status = 'pending'
             LIMIT 1;
        END IF;

        IF FOUND THEN
            UPDATE trip_invitations
               SET message    = p_message,
                   expires_at = NOW() + INTERVAL '7 days',
                   updated_at = NOW()
             WHERE invitation_id = v_invitation_id;
        ELSE
            INSERT INTO trip_invitations (trip_id, inviter_id, invitee_id, invitee_email, message, status)
            VALUES (p_trip_id, p_inviter_id, v_invitee_id, v_invitee_email, p_message, 'pending')
            RETURNING invitation_id INTO v_invitation_id;
        END IF;

        -- Upsert trip_members with 'invited' status
        IF v_invitee_id IS NOT NULL THEN
            INSERT INTO trip_members (trip_id, user_id, role, member_status, join_method, invitation_id)
            VALUES (p_trip_id, v_invitee_id, 'member', 'invited', 'invitation', v_invitation_id)
            ON CONFLICT (trip_id, user_id) DO UPDATE
               SET member_status = CASE
                       WHEN trip_members.member_status IN ('left', 'removed') THEN 'invited'::member_status
                       ELSE trip_members.member_status
                   END,
                   invitation_id = EXCLUDED.invitation_id;
        END IF;

        v_invitations := v_invitations || jsonb_build_array(jsonb_build_object(
            'invitation_id', v_invitation_id,
            'invitee_id',    v_invitee_id,
            'invitee_email', v_invitee_email
        ));
    END LOOP;

    RETURN jsonb_build_object('invitations', v_invitations);
END;
$$;


-- =====================================================
-- 8. cancel_trip_invitation
-- =====================================================
DROP FUNCTION IF EXISTS cancel_trip_invitation(UUID, UUID);

CREATE OR REPLACE FUNCTION public.cancel_trip_invitation(
    p_invitation_id UUID,
    p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id    UUID;
    v_invitee_id UUID;
BEGIN
    -- Caller must be the inviter or the trip owner
    SELECT trip_id, invitee_id INTO v_trip_id, v_invitee_id
      FROM trip_invitations
     WHERE invitation_id = p_invitation_id
       AND status = 'pending'
       AND (inviter_id = p_user_id
            OR EXISTS (SELECT 1 FROM trips WHERE trip_id = trip_invitations.trip_id AND owner_id = p_user_id));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation not found or you do not have permission to cancel it');
    END IF;

    UPDATE trip_invitations
       SET status = 'cancelled', updated_at = NOW()
     WHERE invitation_id = p_invitation_id;

    -- Remove from trip_members if still in 'invited' state
    IF v_invitee_id IS NOT NULL THEN
        DELETE FROM trip_members
         WHERE trip_id      = v_trip_id
           AND user_id      = v_invitee_id
           AND member_status = 'invited'
           AND invitation_id = p_invitation_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Invitation cancelled');
END;
$$;


-- =====================================================
-- 9. accept_trip_invitation
-- =====================================================
DROP FUNCTION IF EXISTS accept_trip_invitation(UUID, UUID);

CREATE OR REPLACE FUNCTION public.accept_trip_invitation(
    p_invitation_id UUID,
    p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id   UUID;
    v_member_id UUID;
    v_max_pax   SMALLINT;
    v_joined    BIGINT;
BEGIN
    SELECT trip_id INTO v_trip_id
      FROM trip_invitations
     WHERE invitation_id = p_invitation_id
       AND invitee_id    = p_user_id
       AND status        = 'pending'
       AND expires_at    > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation not found or has expired');
    END IF;

    SELECT td.max_pax INTO v_max_pax FROM trip_details td WHERE td.trip_id = v_trip_id;
    SELECT COUNT(*) INTO v_joined FROM trip_members WHERE trip_id = v_trip_id AND member_status = 'joined';

    IF v_joined >= v_max_pax THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trip is full');
    END IF;

    UPDATE trip_invitations
       SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
     WHERE invitation_id = p_invitation_id;

    INSERT INTO trip_members (trip_id, user_id, role, member_status, join_method, invitation_id)
    VALUES (v_trip_id, p_user_id, 'member', 'joined', 'invitation', p_invitation_id)
    ON CONFLICT (trip_id, user_id) DO UPDATE
       SET member_status = 'joined', joined_at = NOW(), invitation_id = p_invitation_id
    RETURNING id INTO v_member_id;

    UPDATE trip_visibility
       SET current_participants = current_participants + 1
     WHERE trip_id = v_trip_id;

    RETURN jsonb_build_object(
        'success',   true,
        'message',   'Successfully joined the trip!',
        'trip_id',   v_trip_id,
        'member_id', v_member_id
    );
END;
$$;


-- =====================================================
-- 10. decline_trip_invitation
-- =====================================================
DROP FUNCTION IF EXISTS decline_trip_invitation(UUID, UUID);

CREATE OR REPLACE FUNCTION public.decline_trip_invitation(
    p_invitation_id UUID,
    p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id UUID;
BEGIN
    SELECT trip_id INTO v_trip_id
      FROM trip_invitations
     WHERE invitation_id = p_invitation_id
       AND invitee_id    = p_user_id
       AND status        = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invitation not found');
    END IF;

    UPDATE trip_invitations
       SET status = 'declined', responded_at = NOW(), updated_at = NOW()
     WHERE invitation_id = p_invitation_id;

    DELETE FROM trip_members
     WHERE trip_id       = v_trip_id
       AND user_id       = p_user_id
       AND member_status = 'invited';

    RETURN jsonb_build_object('success', true, 'message', 'Invitation declined');
END;
$$;


-- =====================================================
-- 11. get_trip_members_complete
-- Returns CompleteMembersData for the Member.astro modal
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_members_complete(UUID, UUID);

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
    v_caller_user_id    UUID;  -- internal users.user_id of caller
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
    SELECT COUNT(*) INTO v_joined    FROM trip_members WHERE trip_id = p_trip_id AND member_status = 'joined';
    SELECT COUNT(*) INTO v_pending_req FROM trip_members WHERE trip_id = p_trip_id AND member_status = 'pending';
    SELECT COUNT(*) INTO v_pending_inv FROM trip_invitations WHERE trip_id = p_trip_id AND status = 'pending';

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

        -- Pending invitations (visible to owner/admin only)
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
                WHERE ti.trip_id = p_trip_id AND ti.status = 'pending'
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


-- =====================================================
-- 12. get_trip_members
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_members(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_trip_members(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
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
            ) ORDER BY tm.joined_at
        )
        FROM trip_members tm
        JOIN users u ON u.auth_id = tm.user_id
        WHERE tm.trip_id = p_trip_id AND tm.member_status = 'joined'
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 13. get_trip_join_requests
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_join_requests(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_trip_join_requests(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_user_id UUID;
BEGIN
    -- Only owner/admin can view requests
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        IF NOT EXISTS (
            SELECT 1 FROM trip_members
             WHERE trip_id = p_trip_id AND user_id = p_user_id
               AND member_status = 'joined' AND role IN ('owner', 'admin')
        ) THEN
            RETURN '[]'::JSONB;
        END IF;
    END IF;

    SELECT user_id INTO v_caller_user_id FROM users WHERE auth_id = p_user_id;

    RETURN COALESCE((
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
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 14. get_trip_pending_invitations
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_pending_invitations(UUID, UUID);

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
        WHERE ti.trip_id = p_trip_id AND ti.status = 'pending'
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 15. get_trip_members_summary
-- Returns a TABLE row (accessed via data?.[0])
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_members_summary(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_trip_members_summary(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    total_members        BIGINT,
    joined_members       BIGINT,
    pending_requests     BIGINT,
    pending_invitations  BIGINT,
    max_participants     SMALLINT,
    current_participants BIGINT,
    available_spots      BIGINT,
    user_role            TEXT,
    user_status          TEXT,
    can_invite           BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role    TEXT;
    v_status  TEXT;
    v_max     SMALLINT;
    v_joined  BIGINT;
    v_pending BIGINT;
    v_inv     BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id AND owner_id = p_user_id) THEN
        v_role := 'owner'; v_status := 'joined';
    ELSE
        SELECT role, member_status INTO v_role, v_status
          FROM trip_members WHERE trip_id = p_trip_id AND user_id = p_user_id;
        IF NOT FOUND THEN v_role := 'visitor'; v_status := 'visitor'; END IF;
    END IF;

    SELECT max_pax INTO v_max FROM trip_details WHERE trip_id = p_trip_id;
    SELECT COUNT(*) INTO v_joined  FROM trip_members    WHERE trip_id = p_trip_id AND member_status = 'joined';
    SELECT COUNT(*) INTO v_pending FROM trip_members    WHERE trip_id = p_trip_id AND member_status = 'pending';
    SELECT COUNT(*) INTO v_inv     FROM trip_invitations WHERE trip_id = p_trip_id AND status = 'pending';

    RETURN QUERY SELECT
        v_joined + v_pending,
        v_joined,
        v_pending,
        v_inv,
        v_max,
        v_joined,
        GREATEST(0::BIGINT, v_max::BIGINT - v_joined),
        v_role,
        v_status,
        v_role IN ('owner', 'admin') AND v_joined < v_max;
END;
$$;


-- =====================================================
-- 16. get_trip_invitation_suggestions
-- Returns users who are friends with the caller and
-- not already in the trip
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_invitation_suggestions(UUID, UUID, INT);

CREATE OR REPLACE FUNCTION public.get_trip_invitation_suggestions(
    p_user_id UUID,
    p_trip_id UUID DEFAULT NULL,
    p_limit   INT  DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_user_id UUID;
BEGIN
    SELECT user_id INTO v_caller_user_id FROM users WHERE auth_id = p_user_id;
    IF NOT FOUND THEN RETURN '[]'::JSONB; END IF;

    RETURN COALESCE((
        SELECT jsonb_agg(sub.row_json)
        FROM (
            SELECT jsonb_build_object(
                'user_id',         u.auth_id,
                'full_name',       COALESCE(u.full_name, u.username),
                'username',        u.username,
                'email',           u.email,
                'avatar_url',      u.avatar_url,
                'relation_reason', 'Friend'
            ) AS row_json
            FROM friends f
            JOIN users u ON u.user_id = f.friend_id
            WHERE f.user_id = v_caller_user_id
              AND u.auth_id != p_user_id
              AND u.is_active = TRUE
              AND (p_trip_id IS NULL OR NOT EXISTS (
                  SELECT 1 FROM trip_members tm
                   WHERE tm.trip_id = p_trip_id
                     AND tm.user_id = u.auth_id
                     AND tm.member_status IN ('joined', 'pending', 'invited')
              ))
              AND (p_trip_id IS NULL OR NOT EXISTS (
                  SELECT 1 FROM trip_invitations ti
                   WHERE ti.trip_id   = p_trip_id
                     AND ti.invitee_id = u.auth_id
                     AND ti.status    = 'pending'
              ))
            LIMIT p_limit
        ) sub
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 17. search_users_for_invitation
-- =====================================================
DROP FUNCTION IF EXISTS search_users_for_invitation(TEXT, UUID, UUID, INT);

CREATE OR REPLACE FUNCTION public.search_users_for_invitation(
    p_search_query   TEXT,
    p_current_user_id UUID,
    p_trip_id        UUID DEFAULT NULL,
    p_limit          INT  DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(sub.row_json)
        FROM (
            SELECT jsonb_build_object(
                'user_id',         u.auth_id,
                'full_name',       COALESCE(u.full_name, u.username),
                'username',        u.username,
                'email',           u.email,
                'avatar_url',      u.avatar_url,
                'relation_reason', NULL
            ) AS row_json
            FROM users u
            WHERE u.auth_id  != p_current_user_id
              AND u.is_active = TRUE
              AND (
                  u.username  ILIKE '%' || p_search_query || '%' OR
                  u.full_name ILIKE '%' || p_search_query || '%' OR
                  u.email     ILIKE '%' || p_search_query || '%'
              )
              AND (p_trip_id IS NULL OR NOT EXISTS (
                  SELECT 1 FROM trip_members tm
                   WHERE tm.trip_id = p_trip_id
                     AND tm.user_id = u.auth_id
                     AND tm.member_status IN ('joined', 'pending', 'invited')
              ))
              AND (p_trip_id IS NULL OR NOT EXISTS (
                  SELECT 1 FROM trip_invitations ti
                   WHERE ti.trip_id    = p_trip_id
                     AND ti.invitee_id = u.auth_id
                     AND ti.status     = 'pending'
              ))
            ORDER BY
                CASE WHEN u.username ILIKE p_search_query || '%' THEN 0 ELSE 1 END,
                u.full_name
            LIMIT p_limit
        ) sub
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 18. get_user_pending_invitations
-- =====================================================
DROP FUNCTION IF EXISTS get_user_pending_invitations(UUID);

CREATE OR REPLACE FUNCTION public.get_user_pending_invitations(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'invitation_id',    ti.invitation_id,
                'trip_id',          ti.trip_id,
                'trip_title',       t.title,
                'inviter_name',     COALESCE(u_itr.full_name, u_itr.username),
                'message',          ti.message,
                'created_at',       ti.created_at,
                'expires_at',       ti.expires_at,
                'days_until_expiry', GREATEST(0, EXTRACT(DAY FROM (ti.expires_at - NOW()))::INT)
            ) ORDER BY ti.created_at DESC
        )
        FROM trip_invitations ti
        JOIN trips t ON t.trip_id = ti.trip_id
        LEFT JOIN users u_itr ON u_itr.auth_id = ti.inviter_id
        WHERE ti.invitee_id = p_user_id
          AND ti.status     = 'pending'
          AND ti.expires_at > NOW()
    ), '[]'::JSONB);
END;
$$;


-- =====================================================
-- 19. get_trip_invitations
-- =====================================================
DROP FUNCTION IF EXISTS get_trip_invitations(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_trip_invitations(
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
                'status',           ti.status,
                'message',          ti.message,
                'created_at',       ti.created_at,
                'expires_at',       ti.expires_at
            ) ORDER BY ti.created_at DESC
        )
        FROM trip_invitations ti
        LEFT JOIN users u_inv ON u_inv.auth_id = ti.invitee_id
        LEFT JOIN users u_itr ON u_itr.auth_id = ti.inviter_id
        WHERE ti.trip_id = p_trip_id
    ), '[]'::JSONB);
END;
$$;
