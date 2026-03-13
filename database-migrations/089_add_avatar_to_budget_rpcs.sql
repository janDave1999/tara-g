-- 089_add_avatar_to_budget_rpcs.sql
--
-- Adds avatar_url to get_pool_contributions and get_member_balances
-- so the Budget tab can display member photos instead of initials only.

-- ── 1. get_pool_contributions ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_pool_contributions(UUID);

CREATE OR REPLACE FUNCTION get_pool_contributions(p_trip_id UUID)
RETURNS TABLE (
    id          UUID,
    trip_id     UUID,
    user_id     UUID,
    user_name   TEXT,
    avatar_url  TEXT,
    amount      DECIMAL(12,2),
    amount_paid DECIMAL(12,2),
    status      TEXT,
    paid_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.id, pc.trip_id, pc.user_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT AS user_name,
        u.avatar_url::TEXT AS avatar_url,
        pc.amount, pc.amount_paid, pc.status, pc.paid_at
    FROM pool_contributions pc
    LEFT JOIN public.users u ON u.auth_id = pc.user_id
    WHERE pc.trip_id = p_trip_id
    ORDER BY pc.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pool_contributions(UUID) TO authenticated;

-- ── 2. get_member_balances ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS get_member_balances(UUID);

CREATE OR REPLACE FUNCTION get_member_balances(p_trip_id UUID)
RETURNS TABLE (
    user_id     UUID,
    user_name   TEXT,
    avatar_url  TEXT,
    total_paid  DECIMAL(12,2),
    total_owed  DECIMAL(12,2),
    net_balance DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        tm.user_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT AS user_name,
        u.avatar_url::TEXT AS avatar_url,
        COALESCE(paid_totals.total_paid, 0) AS total_paid,
        COALESCE(owed_totals.total_owed, 0) AS total_owed,
        COALESCE(receivable_totals.total_receivable, 0) - COALESCE(owed_totals.total_owed, 0) AS net_balance
    FROM trip_members tm
    LEFT JOIN public.users u ON u.auth_id = tm.user_id
    LEFT JOIN (
        SELECT payer_id AS user_id, SUM(amount) AS total_paid
        FROM trip_expenses
        WHERE trip_id = p_trip_id
        GROUP BY payer_id
    ) paid_totals ON paid_totals.user_id = tm.user_id
    LEFT JOIN (
        SELECT es.user_id, SUM(es.share_amount) AS total_owed
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id AND es.is_settled = FALSE
        GROUP BY es.user_id
    ) owed_totals ON owed_totals.user_id = tm.user_id
    LEFT JOIN (
        SELECT te.payer_id AS user_id, SUM(es.share_amount) AS total_receivable
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id AND es.is_settled = FALSE
        GROUP BY te.payer_id
    ) receivable_totals ON receivable_totals.user_id = tm.user_id
    WHERE tm.trip_id = p_trip_id AND tm.member_status = 'joined'
    ORDER BY net_balance DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_member_balances(UUID) TO authenticated;
