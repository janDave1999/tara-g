-- Trip Budget & Expense RPC Functions
-- Migration: 074_trip_budget_expense_rpcs.sql

-- Get budget settings for a trip
CREATE OR REPLACE FUNCTION get_trip_budget_settings(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    cost_sharing_method TEXT,
    budget_estimate DECIMAL(12,2),
    pool_enabled BOOLEAN,
    pool_per_person DECIMAL(12,2),
    pool_status TEXT,
    allow_members_to_log BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tbs.id, tbs.trip_id, tbs.cost_sharing_method::TEXT,
        tbs.budget_estimate, tbs.pool_enabled, tbs.pool_per_person,
        tbs.pool_status, tbs.allow_members_to_log, tbs.created_at, tbs.updated_at
    FROM trip_budget_settings tbs
    WHERE tbs.trip_id = p_trip_id;
END;
$$;

-- Create or update budget settings
CREATE OR REPLACE FUNCTION upsert_trip_budget_settings(
    p_trip_id UUID,
    p_cost_sharing_method TEXT DEFAULT 'split_evenly',
    p_budget_estimate DECIMAL(12,2) DEFAULT NULL,
    p_pool_enabled BOOLEAN DEFAULT FALSE,
    p_pool_per_person DECIMAL(12,2) DEFAULT NULL,
    p_allow_members_to_log BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings_id UUID;
BEGIN
    INSERT INTO trip_budget_settings (
        trip_id, cost_sharing_method, budget_estimate, 
        pool_enabled, pool_per_person, allow_members_to_log
    ) VALUES (
        p_trip_id, p_cost_sharing_method::cost_sharing_method, p_budget_estimate,
        p_pool_enabled, p_pool_per_person, p_allow_members_to_log
    )
    ON CONFLICT (trip_id) DO UPDATE SET
        cost_sharing_method = EXCLUDED.cost_sharing_method,
        budget_estimate = EXCLUDED.budget_estimate,
        pool_enabled = EXCLUDED.pool_enabled,
        pool_per_person = EXCLUDED.pool_per_person,
        allow_members_to_log = EXCLUDED.allow_members_to_log,
        updated_at = NOW()
    RETURNING id INTO v_settings_id;
    
    RETURN v_settings_id;
END;
$$;

-- Get expenses for a trip
CREATE OR REPLACE FUNCTION get_trip_expenses(
    p_trip_id UUID,
    p_category TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
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
    stop_id UUID,
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
        te.receipt_url, te.stop_id, te.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'user_id', es.user_id,
                    'share_amount', es.share_amount,
                    'user_name', (SELECT COALESCE(u2.full_name, u2.username, u2.email) FROM public.users u2 WHERE u2.auth_id = es.user_id)
                )
            ) FILTER (WHERE es.id IS NOT NULL),
            '[]'::jsonb
        ) as splits
    FROM trip_expenses te
    LEFT JOIN expense_splits es ON es.expense_id = te.id
    LEFT JOIN public.users u ON u.auth_id = te.payer_id
    WHERE te.trip_id = p_trip_id
        AND (p_category IS NULL OR te.category = p_category)
        AND (p_user_id IS NULL OR te.payer_id = p_user_id OR es.user_id = p_user_id)
        AND (p_start_date IS NULL OR te.date >= p_start_date)
        AND (p_end_date IS NULL OR te.date <= p_end_date)
    GROUP BY te.id, u.full_name, u.username, u.email
    ORDER BY te.date DESC, te.created_at DESC;
END;
$$;

-- Add expense with splits
CREATE OR REPLACE FUNCTION add_trip_expense(
    p_trip_id UUID,
    p_payer_id UUID,
    p_amount DECIMAL(12,2),
    p_description TEXT,
    p_category TEXT,
    p_date DATE,
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
    -- Get cost sharing method
    SELECT COALESCE(cost_sharing_method, 'split_evenly')::TEXT INTO v_cost_sharing
    FROM trip_budget_settings
    WHERE trip_id = p_trip_id;

    -- Default to split_evenly if no settings exist
    IF v_cost_sharing IS NULL THEN
        v_cost_sharing := 'split_evenly';
    END IF;

    -- Insert expense
    INSERT INTO trip_expenses (
        trip_id, payer_id, amount, description, category,
        date, receipt_url, stop_id, created_by
    ) VALUES (
        p_trip_id, p_payer_id, p_amount, p_description, p_category,
        p_date, p_receipt_url, p_stop_id, p_created_by
    )
    RETURNING id INTO v_expense_id;

    -- Calculate splits based on cost sharing method
    IF v_cost_sharing = 'split_evenly' THEN
        -- Get member count (excluding payer)
        SELECT COUNT(*) INTO v_member_count
        FROM trip_members
        WHERE trip_id = p_trip_id AND member_status = 'joined';

        IF v_member_count > 0 THEN
            v_share_amount := p_amount / v_member_count;
            
            -- Insert splits for all members (excluding payer)
            FOR v_user_id IN
                SELECT user_id FROM trip_members
                WHERE trip_id = p_trip_id AND member_status = 'joined'
                    AND user_id != p_payer_id
            LOOP
                INSERT INTO expense_splits (expense_id, user_id, share_amount)
                VALUES (v_expense_id, v_user_id, v_share_amount);
            END LOOP;
        END IF;

    ELSIF v_cost_sharing = 'organizer_shoulders_all' THEN
        -- Organizer covers all, no splits needed
        NULL;

    ELSIF v_cost_sharing = 'custom_split' AND p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
        -- Custom split: divide equally among recipients
        v_share_amount := p_amount / array_length(p_recipient_ids, 1);
        
        FOREACH v_user_id IN ARRAY p_recipient_ids
        LOOP
            INSERT INTO expense_splits (expense_id, user_id, share_amount)
            VALUES (v_expense_id, v_user_id, v_share_amount);
        END LOOP;

    ELSIF v_cost_sharing = 'everyone_pays_own' THEN
        -- Each person is only responsible for their own expenses
        IF p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
            v_share_amount := p_amount / array_length(p_recipient_ids, 1);
            
            FOREACH v_user_id IN ARRAY p_recipient_ids
            LOOP
                INSERT INTO expense_splits (expense_id, user_id, share_amount)
                VALUES (v_expense_id, v_user_id, v_share_amount);
            END LOOP;
        END IF;
    END IF;

    RETURN v_expense_id;
END;
$$;

-- Delete expense
CREATE OR REPLACE FUNCTION delete_trip_expense(p_expense_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM expense_splits WHERE expense_id = p_expense_id;
    DELETE FROM trip_expenses WHERE id = p_expense_id;
END;
$$;

-- Calculate settlement
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
    WITH paid AS (
        SELECT payer_id as user_id, SUM(te.amount) as total_paid
        FROM trip_expenses te
        WHERE te.trip_id = p_trip_id
        GROUP BY payer_id
    ),
    owed AS (
        SELECT es.user_id, SUM(es.share_amount) as total_owed
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id
        GROUP BY es.user_id
    ),
    balances AS (
        SELECT 
            COALESCE(p.user_id, o.user_id) as user_id,
            COALESCE(p.total_paid, 0) as total_paid,
            COALESCE(o.total_owed, 0) as total_owed,
            COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0) as net_balance
        FROM paid p
        FULL OUTER JOIN owed o ON p.user_id = o.user_id
    )
    SELECT 
        debtor.user_id,
        (SELECT COALESCE(full_name, username, email)::TEXT FROM public.users WHERE auth_id = debtor.user_id),
        creditor.user_id,
        (SELECT COALESCE(full_name, username, email)::TEXT FROM public.users WHERE auth_id = creditor.user_id),
        LEAST(creditor.net_balance, ABS(debtor.net_balance)) as amount
    FROM balances creditor
    CROSS JOIN balances debtor
    WHERE debtor.net_balance < -0.01 
      AND creditor.net_balance > 0.01
      AND LEAST(creditor.net_balance, ABS(debtor.net_balance)) > 0.01
    ORDER BY amount DESC;
END;
$$;

-- Pool contribution RPCs
CREATE OR REPLACE FUNCTION get_pool_contributions(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    user_id UUID,
    user_name TEXT,
    amount DECIMAL(12,2),
    status TEXT,
    paid_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id, pc.trip_id, pc.user_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT as user_name,
        pc.amount, pc.status, pc.paid_at
    FROM pool_contributions pc
    LEFT JOIN public.users u ON u.auth_id = pc.user_id
    WHERE pc.trip_id = p_trip_id
    ORDER BY pc.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_pool_contribution(
    p_trip_id UUID,
    p_user_id UUID,
    p_amount DECIMAL(12,2)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO pool_contributions (trip_id, user_id, amount)
    VALUES (p_trip_id, p_user_id, p_amount)
    ON CONFLICT (trip_id, user_id) DO UPDATE SET
        amount = EXCLUDED.amount
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_contribution_paid(p_contribution_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE pool_contributions
    SET status = 'paid', paid_at = NOW()
    WHERE id = p_contribution_id;
END;
$$;

-- Get expense summary (total by category)
CREATE OR REPLACE FUNCTION get_trip_expense_summary(p_trip_id UUID)
RETURNS TABLE (
    category TEXT,
    total DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.category,
        SUM(te.amount) as total
    FROM trip_expenses te
    WHERE te.trip_id = p_trip_id
    GROUP BY te.category
    ORDER BY total DESC;
END;
$$;

-- Get member balances
CREATE OR REPLACE FUNCTION get_trip_member_balances(p_trip_id UUID)
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
        WHERE te.trip_id = p_trip_id
        GROUP BY es.user_id
    ) owed_totals ON owed_totals.user_id = tm.user_id
    WHERE tm.trip_id = p_trip_id AND tm.member_status = 'joined'
    ORDER BY net_balance DESC;
END;
$$;

-- Record a settlement
CREATE OR REPLACE FUNCTION record_settlement(
    p_trip_id UUID,
    p_from_user_id UUID,
    p_to_user_id UUID,
    p_amount DECIMAL(12,2),
    p_method TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settlement_id UUID;
BEGIN
    INSERT INTO expense_settlements (
        trip_id, from_user_id, to_user_id, amount, status, method
    ) VALUES (
        p_trip_id, p_from_user_id, p_to_user_id, p_amount, 'settled', p_method
    )
    RETURNING id INTO v_settlement_id;
    
    RETURN v_settlement_id;
END;
$$;
