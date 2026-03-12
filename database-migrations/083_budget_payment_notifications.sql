-- 083_budget_payment_notifications.sql
--
-- Adds budget-related notification types and a weekly cron RPC that
-- reminds trip members of outstanding expense splits and unpaid pool
-- contributions.
--
-- New notification types:
--   budget_payment_reminder  – member still owes money on expense splits
--   budget_pool_reminder     – member hasn't finished paying into the pool
--
-- Also backfills trip_tomorrow / trip_needs_status that migration 072 uses
-- but never added to the constraint / guard.
--
-- New RPC:
--   check_budget_and_notify()  – called by the "0 9 * * 1" cron trigger


-- ── STEP 1: Extend table CHECK constraint ─────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
    'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 'trip_member_removed',
    'trip_update', 'trip_reminder', 'trip_tomorrow', 'trip_needs_status',
    'friend_request', 'friend_accepted', 'system_announcement',
    'post_like', 'post_comment', 'comment_reply', 'comment_like',
    'budget_payment_reminder', 'budget_pool_reminder'
));


-- ── STEP 2: Update create_notification type guard ─────────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id    UUID,
    p_type       VARCHAR,
    p_title      VARCHAR,
    p_message    VARCHAR,
    p_data       JSONB        DEFAULT '{}'::JSONB,
    p_action_url TEXT         DEFAULT NULL,
    p_priority   VARCHAR      DEFAULT 'normal',
    p_expires_at TIMESTAMPTZ  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    IF p_type NOT IN (
        'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
        'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added',
        'trip_member_removed', 'trip_update', 'trip_reminder', 'trip_tomorrow',
        'trip_needs_status', 'friend_request', 'friend_accepted', 'system_announcement',
        'post_like', 'post_comment', 'comment_reply', 'comment_like',
        'budget_payment_reminder', 'budget_pool_reminder'
    ) THEN
        RAISE EXCEPTION 'Invalid notification type: %', p_type;
    END IF;

    IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
        p_priority := 'normal';
    END IF;

    INSERT INTO notifications (
        user_id, type, title, message, data, action_url, priority, expires_at
    ) VALUES (
        p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_priority, p_expires_at
    )
    RETURNING notification_id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;


-- ── STEP 3: check_budget_and_notify ──────────────────────────────────────────
-- Runs weekly (Monday 09:00 UTC). Notifies members with:
--   (a) unsettled expense splits on active trips
--   (b) pending / partial pool contributions on active trips
--
-- Deduplication: skips if an unread notification of the same type for the
-- same trip was already created within the past 6 days.
CREATE OR REPLACE FUNCTION public.check_budget_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec RECORD;
BEGIN

    -- ── (a) Unsettled expense splits ─────────────────────────────────────────
    -- expense_splits.user_id stores auth.users(id); notifications needs internal users.user_id
    FOR v_rec IN
        SELECT
            u.user_id                 AS internal_user_id,
            te.trip_id,
            t.title                   AS trip_title,
            SUM(es.share_amount)      AS total_owed
        FROM   expense_splits  es
        JOIN   users           u  ON u.auth_id  = es.user_id
        JOIN   trip_expenses   te ON te.id      = es.expense_id
        JOIN   trips           t  ON t.trip_id  = te.trip_id
        WHERE  es.is_settled = FALSE
          AND  t.status NOT IN ('archived', 'cancelled', 'completed')
        GROUP BY u.user_id, te.trip_id, t.title
        HAVING SUM(es.share_amount) > 0
    LOOP
        -- Skip if already notified for this trip in the last 6 days
        CONTINUE WHEN EXISTS (
            SELECT 1
            FROM   notifications
            WHERE  user_id                = v_rec.internal_user_id
              AND  type                   = 'budget_payment_reminder'
              AND  (data->>'trip_id')::uuid = v_rec.trip_id
              AND  created_at             > NOW() - INTERVAL '6 days'
        );

        PERFORM create_notification(
            p_user_id    => v_rec.internal_user_id,
            p_type       => 'budget_payment_reminder',
            p_title      => 'You still owe money',
            p_message    => 'You owe ₱' || to_char(v_rec.total_owed, 'FM999,999,990.00') || ' for "' || v_rec.trip_title || '". Settle up with your group!',
            p_data       => jsonb_build_object(
                'trip_id',     v_rec.trip_id,
                'amount_owed', v_rec.total_owed
            ),
            p_action_url => format('/trips/%s/expenses', v_rec.trip_id),
            p_priority   => 'normal'
        );
    END LOOP;


    -- ── (b) Unpaid / partial pool contributions ──────────────────────────────
    -- pool_contributions.user_id stores auth.users(id); notifications needs internal users.user_id
    FOR v_rec IN
        SELECT
            u.user_id                                     AS internal_user_id,
            pc.trip_id,
            t.title                                       AS trip_title,
            (pc.amount - COALESCE(pc.amount_paid, 0))     AS remaining
        FROM   pool_contributions pc
        JOIN   users              u  ON u.auth_id  = pc.user_id
        JOIN   trips              t  ON t.trip_id  = pc.trip_id
        WHERE  pc.status IN ('pending', 'partial')
          AND  t.status NOT IN ('archived', 'cancelled', 'completed')
          AND  (pc.amount - COALESCE(pc.amount_paid, 0)) > 0
    LOOP
        CONTINUE WHEN EXISTS (
            SELECT 1
            FROM   notifications
            WHERE  user_id                = v_rec.internal_user_id
              AND  type                   = 'budget_pool_reminder'
              AND  (data->>'trip_id')::uuid = v_rec.trip_id
              AND  created_at             > NOW() - INTERVAL '6 days'
        );

        PERFORM create_notification(
            p_user_id    => v_rec.internal_user_id,
            p_type       => 'budget_pool_reminder',
            p_title      => 'Pool contribution pending',
            p_message    => 'You still need to contribute ₱' || to_char(v_rec.remaining, 'FM999,999,990.00') || ' to the travel fund for "' || v_rec.trip_title || '".',
            p_data       => jsonb_build_object(
                'trip_id',   v_rec.trip_id,
                'remaining', v_rec.remaining
            ),
            p_action_url => format('/trips/%s/expenses', v_rec.trip_id),
            p_priority   => 'normal'
        );
    END LOOP;

END;
$$;

GRANT EXECUTE ON FUNCTION public.check_budget_and_notify TO authenticated;
