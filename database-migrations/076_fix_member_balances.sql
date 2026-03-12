-- Fix get_member_balances: use receivable-based net_balance
--
-- The payer is excluded from expense_splits (only others' shares are stored).
-- So "total_paid - total_owed" overstates the payer's balance.
-- Correct formula: net_balance = what others owe you - what you owe others
--   = SUM(splits where you are the payer, unsettled)
--   - SUM(splits where you are the debtor, unsettled)

CREATE OR REPLACE FUNCTION get_member_balances(p_trip_id UUID)
RETURNS TABLE (
    user_id UUID,
    user_name TEXT,
    total_paid DECIMAL(12,2),
    total_owed DECIMAL(12,2),
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
        -- How much this member has paid out of pocket
        COALESCE(paid_totals.total_paid, 0) AS total_paid,
        -- How much this member still owes others (their unsettled splits on others' expenses)
        COALESCE(owed_totals.total_owed, 0) AS total_owed,
        -- net = what others owe them (unsettled splits on their expenses)
        --     - what they owe others (unsettled splits on others' expenses)
        COALESCE(receivable_totals.total_receivable, 0) - COALESCE(owed_totals.total_owed, 0) AS net_balance
    FROM trip_members tm
    LEFT JOIN public.users u ON u.auth_id = tm.user_id
    -- Total paid = sum of expenses where this member is the payer
    LEFT JOIN (
        SELECT payer_id AS user_id, SUM(amount) AS total_paid
        FROM trip_expenses
        WHERE trip_id = p_trip_id
        GROUP BY payer_id
    ) paid_totals ON paid_totals.user_id = tm.user_id
    -- Total owed = sum of their unsettled splits (only appears when someone ELSE paid)
    LEFT JOIN (
        SELECT es.user_id, SUM(es.share_amount) AS total_owed
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id AND es.is_settled = FALSE
        GROUP BY es.user_id
    ) owed_totals ON owed_totals.user_id = tm.user_id
    -- Total receivable = sum of unsettled splits FOR expenses this member paid
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
