-- Fix add_trip_expense: handle organizer_shoulders_all cost sharing method
-- The v2 rewrite (075) dropped this case, causing it to silently fall through
-- to split_evenly logic and create incorrect splits.

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
            -- Count all joined members (including payer) for equal per-person share
            SELECT COUNT(*) INTO v_member_count
            FROM trip_members
            WHERE trip_id = p_trip_id AND member_status = 'joined';

            IF v_member_count > 1 THEN
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

        ELSIF v_cost_sharing = 'organizer_shoulders_all' THEN
            -- Organizer covers all costs; no splits created for anyone
            NULL;

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
