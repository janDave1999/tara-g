-- Budget Expense V2 Migration
-- Run this to add new columns and update functions

-- 1. Add new columns
ALTER TABLE trip_expenses ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT TRUE;
ALTER TABLE expense_splits ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE expense_splits ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- 2. Recreate functions
CREATE OR REPLACE FUNCTION get_trip_expenses(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    payer_id UUID,
    payer_name TEXT,
    amount DECIMAL(12,2),
    description TEXT,
    category TEXT,
    date DATE,
    receipt_url TEXT,
    is_shared BOOLEAN,
    created_at TIMESTAMPTZ,
    splits JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id, te.trip_id, te.payer_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT as payer_name,
        te.amount, te.description, te.category, te.date,
        te.receipt_url, te.is_shared, te.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'split_id', es.id,
                    'user_id', es.user_id,
                    'share_amount', es.share_amount,
                    'user_name', (SELECT COALESCE(u2.full_name, u2.username, u2.email) FROM public.users u2 WHERE u2.auth_id = es.user_id),
                    'is_settled', es.is_settled
                )
            ) FILTER (WHERE es.id IS NOT NULL),
            '[]'::jsonb
        ) as splits
    FROM trip_expenses te
    LEFT JOIN expense_splits es ON es.expense_id = te.id
    LEFT JOIN public.users u ON u.auth_id = te.payer_id
    WHERE te.trip_id = p_trip_id
    GROUP BY te.id, u.full_name, u.username, u.email
    ORDER BY te.date DESC, te.created_at DESC;
END;
$$;

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
        COALESCE(u.full_name, u.username, u.email)::TEXT as user_name,
        COALESCE(paid_totals.total_paid, 0) as total_paid,
        COALESCE(owed_totals.total_owed, 0) as total_owed,
        COALESCE(paid_totals.total_paid, 0) - COALESCE(owed_totals.total_owed, 0) as net_balance
    FROM trip_members tm
    LEFT JOIN public.users u ON u.auth_id = tm.user_id
    LEFT JOIN (
        SELECT payer_id as user_id, SUM(amount) as total_paid
        FROM trip_expenses
        WHERE trip_id = p_trip_id
        GROUP BY payer_id
    ) paid_totals ON paid_totals.user_id = tm.user_id
    LEFT JOIN (
        SELECT es.user_id, SUM(es.share_amount) as total_owed
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id AND es.is_settled = FALSE
        GROUP BY es.user_id
    ) owed_totals ON owed_totals.user_id = tm.user_id
    WHERE tm.trip_id = p_trip_id AND tm.member_status = 'joined'
    ORDER BY net_balance DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_member_owes(p_trip_id UUID, p_user_id UUID)
RETURNS TABLE (
    split_id UUID,
    expense_id UUID,
    expense_description TEXT,
    expense_amount DECIMAL(12,2),
    expense_date DATE,
    payer_id UUID,
    payer_name TEXT,
    share_amount DECIMAL(12,2),
    is_settled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.id as split_id,
        te.id as expense_id,
        te.description as expense_description,
        te.amount as expense_amount,
        te.date as expense_date,
        te.payer_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT as payer_name,
        es.share_amount,
        es.is_settled
    FROM expense_splits es
    JOIN trip_expenses te ON te.id = es.expense_id
    LEFT JOIN public.users u ON u.auth_id = te.payer_id
    WHERE te.trip_id = p_trip_id
      AND es.user_id = p_user_id
      AND es.is_settled = FALSE
    ORDER BY te.date DESC;
END;
$$;

CREATE OR REPLACE FUNCTION settle_expense_split(p_split_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE expense_splits
    SET is_settled = TRUE, settled_at = NOW()
    WHERE id = p_split_id;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_trip_settlement(p_trip_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    from_user_name TEXT,
    to_user_id UUID,
    to_user_name TEXT,
    amount DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH balances AS (
        SELECT 
            es.user_id as from_user_id,
            te.payer_id as to_user_id,
            SUM(es.share_amount) as amount
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id
          AND es.is_settled = FALSE
        GROUP BY es.user_id, te.payer_id
        HAVING SUM(es.share_amount) > 0
    )
    SELECT 
        b.from_user_id,
        (SELECT COALESCE(full_name, username, email)::TEXT FROM public.users WHERE auth_id = b.from_user_id),
        b.to_user_id,
        (SELECT COALESCE(full_name, username, email)::TEXT FROM public.users WHERE auth_id = b.to_user_id),
        b.amount
    FROM balances b;
END;
$$;

CREATE OR REPLACE FUNCTION add_trip_expense(
    p_trip_id UUID,
    p_payer_id UUID,
    p_amount DECIMAL(12,2),
    p_description TEXT,
    p_category TEXT,
    p_date DATE,
    p_is_shared BOOLEAN DEFAULT TRUE,
    p_receipt_url TEXT DEFAULT NULL,
    p_stop_id UUID DEFAULT NULL,
    p_recipient_ids UUID[] DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense_id UUID;
    v_member_count INT;
    v_share_amount DECIMAL(12,2);
    v_cost_sharing TEXT;
    v_user_id UUID;
BEGIN
    SELECT COALESCE(cost_sharing_method, 'split_evenly')::TEXT INTO v_cost_sharing
    FROM trip_budget_settings
    WHERE trip_id = p_trip_id;

    IF v_cost_sharing IS NULL THEN
        v_cost_sharing := 'split_evenly';
    END IF;

    INSERT INTO trip_expenses (
        trip_id, payer_id, amount, description, category,
        date, receipt_url, stop_id, created_by, is_shared
    ) VALUES (
        p_trip_id, p_payer_id, p_amount, p_description, p_category,
        p_date, p_receipt_url, p_stop_id, p_created_by, p_is_shared
    )
    RETURNING id INTO v_expense_id;

    IF p_is_shared = TRUE THEN
        IF v_cost_sharing = 'split_evenly' OR v_cost_sharing = 'custom_split' THEN
            SELECT COUNT(*) INTO v_member_count
            FROM trip_members
            WHERE trip_id = p_trip_id AND member_status = 'joined';

            IF v_member_count > 0 THEN
                v_share_amount := p_amount / v_member_count;
                
                FOR v_user_id IN
                    SELECT user_id FROM trip_members
                    WHERE trip_id = p_trip_id AND member_status = 'joined'
                        AND user_id != p_payer_id
                LOOP
                    INSERT INTO expense_splits (expense_id, user_id, share_amount)
                    VALUES (v_expense_id, v_user_id, v_share_amount);
                END LOOP;
            END IF;
        ELSIF v_cost_sharing = 'everyone_pays_own' THEN
            IF p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
                v_share_amount := p_amount / array_length(p_recipient_ids, 1);
                
                FOREACH v_user_id IN ARRAY p_recipient_ids
                LOOP
                    INSERT INTO expense_splits (expense_id, user_id, share_amount)
                    VALUES (v_expense_id, v_user_id, v_share_amount);
                END LOOP;
            END IF;
        END IF;
    END IF;

    RETURN v_expense_id;
END;
$$;
