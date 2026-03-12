-- 082_selective_expense_split.sql
--
-- Extend add_trip_expense so that when p_recipient_ids is provided,
-- those specific members are used for splitting regardless of the
-- cost_sharing_method. When p_recipient_ids is NULL/empty, existing
-- method-based logic applies unchanged.
--
-- Payer is always EXCLUDED from splits (they already paid their share).
-- Payer IS counted in the denominator so their share is accounted for.

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
    v_expense_id    UUID;
    v_member_count  INT;
    v_share_amount  DECIMAL(12,2);
    v_cost_sharing  TEXT;
    v_user_id       UUID;
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

        -- ── Selective split (explicit recipient list) ──────────────────────────
        -- Works for any cost sharing method. Payer is skipped from splits but
        -- counted in the denominator so each person's share is correct.
        IF p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
            v_member_count := array_length(p_recipient_ids, 1);
            v_share_amount := p_amount / v_member_count;

            FOREACH v_user_id IN ARRAY p_recipient_ids
            LOOP
                -- Payer already covered their share; skip them
                IF v_user_id != p_payer_id THEN
                    INSERT INTO expense_splits (expense_id, user_id, share_amount)
                    VALUES (v_expense_id, v_user_id, v_share_amount);
                END IF;
            END LOOP;

        -- ── Fallback: method-based defaults ───────────────────────────────────
        ELSIF v_cost_sharing IN ('split_evenly', 'custom_split', 'event_fee', 'budget_pool') THEN
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
            NULL; -- organizer covers everything, no splits

        ELSIF v_cost_sharing = 'everyone_pays_own' THEN
            NULL; -- each person pays independently; no cross-splits without explicit recipients

        END IF;
    END IF;

    RETURN v_expense_id;
END;
$$;
