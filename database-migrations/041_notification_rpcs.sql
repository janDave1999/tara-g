-- =====================================================
-- MIGRATION 041: NOTIFICATION RPCs
-- =====================================================
-- Implements in-app notification system
--
-- Tables: notifications (already exists from 007)
--
-- Functions:
--   create_notification           - Create a notification
--   get_user_notifications       - Get user's notifications (paginated)
--   get_unread_count             - Get unread notification count
--   mark_notification_read       - Mark single notification as read
--   mark_all_notifications_read  - Mark all notifications as read
--   delete_notification          - Delete a notification
--   delete_old_notifications     - Clean up old notifications
-- =====================================================

-- 1. create_notification
-- =====================================================
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB, VARCHAR, BOOLEAN, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message VARCHAR,
    p_data JSONB DEFAULT '{}'::JSONB,
    p_action_url TEXT DEFAULT NULL,
    p_priority VARCHAR DEFAULT 'normal',
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Validate type
    IF p_type NOT IN (
        'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
        'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 
        'trip_member_removed', 'trip_update', 'trip_reminder',
        'friend_request', 'friend_accepted', 'system_announcement'
    ) THEN
        RAISE EXCEPTION 'Invalid notification type: %', p_type;
    END IF;

    -- Validate priority
    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        p_priority := 'normal';
    END IF;

    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        action_url,
        priority,
        expires_at
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_action_url,
        p_priority,
        p_expires_at
    )
    RETURNING notification_id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;


-- 2. get_user_notifications
-- =====================================================
DROP FUNCTION IF EXISTS get_user_notifications(UUID, INTEGER, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_user_notifications(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_unread_only BOOLEAN DEFAULT FALSE
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
                'notification_id', n.notification_id,
                'type', n.type,
                'title', n.title,
                'message', n.message,
                'data', n.data,
                'is_read', n.is_read,
                'priority', n.priority,
                'action_url', n.action_url,
                'created_at', n.created_at,
                'read_at', n.read_at
            ) ORDER BY n.created_at DESC
        )
        FROM (
            SELECT n.notification_id, n.type, n.title, n.message, n.data, n.is_read, 
                   n.priority, n.action_url, n.created_at, n.read_at
            FROM notifications n
            WHERE n.user_id = p_user_id
              AND (p_unread_only = FALSE OR n.is_read = FALSE)
              AND (n.expires_at IS NULL OR n.expires_at > NOW())
            ORDER BY n.created_at DESC
            LIMIT p_limit
            OFFSET p_offset
        ) n
    ), '[]'::JSONB);
END;
$$;


-- 3. get_unread_count
-- =====================================================
DROP FUNCTION IF EXISTS get_unread_count(UUID);

CREATE OR REPLACE FUNCTION public.get_unread_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN COALESCE((
        SELECT COUNT(*)::INTEGER
        FROM notifications n
        WHERE n.user_id = p_user_id
          AND n.is_read = FALSE
          AND (n.expires_at IS NULL OR n.expires_at > NOW())
    ), 0);
END;
$$;


-- 4. mark_notification_read
-- =====================================================
DROP FUNCTION IF EXISTS mark_notification_read(UUID, UUID);

CREATE OR REPLACE FUNCTION public.mark_notification_read(
    p_notification_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE notification_id = p_notification_id
      AND user_id = p_user_id
      AND is_read = FALSE;

    RETURN FOUND;
END;
$$;


-- 5. mark_all_notifications_read
-- =====================================================
DROP FUNCTION IF EXISTS mark_all_notifications_read(UUID);

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id
      AND is_read = FALSE
      AND (expires_at IS NULL OR expires_at > NOW());

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- 6. delete_notification
-- =====================================================
DROP FUNCTION IF EXISTS delete_notification(UUID, UUID);

CREATE OR REPLACE FUNCTION public.delete_notification(
    p_notification_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM notifications
    WHERE notification_id = p_notification_id
      AND user_id = p_user_id;

    RETURN FOUND;
END;
$$;


-- 7. delete_old_notifications (cleanup)
-- =====================================================
DROP FUNCTION IF EXISTS delete_old_notifications(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.delete_old_notifications(
    p_user_id UUID,
    p_days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE user_id = p_user_id
      AND is_read = TRUE
      AND created_at < NOW() - (p_days_old || ' days')::INTERVAL
      AND (expires_at IS NULL OR expires_at < NOW());

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION delete_notification TO authenticated;
GRANT EXECUTE ON FUNCTION delete_old_notifications TO authenticated;
