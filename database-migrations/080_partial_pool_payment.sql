-- 080_partial_pool_payment.sql
--
-- Adds partial payment (downpayment) support to pool_contributions.
-- The owner can record either a full payment or a partial amount.
-- Status progression: pending → partial → paid

-- ── 1. Schema changes ─────────────────────────────────────────────────────────

-- Track cumulative amount paid so far (default 0)
ALTER TABLE pool_contributions
    ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0);

-- Widen the status constraint to allow 'partial'
ALTER TABLE pool_contributions DROP CONSTRAINT IF EXISTS pool_contributions_status_check;
ALTER TABLE pool_contributions
    ADD CONSTRAINT pool_contributions_status_check
    CHECK (status IN ('pending', 'partial', 'paid'));

-- ── 2. Updated get_pool_contributions (adds amount_paid to result) ────────────

DROP FUNCTION IF EXISTS get_pool_contributions(UUID);

CREATE OR REPLACE FUNCTION get_pool_contributions(p_trip_id UUID)
RETURNS TABLE (
    id          UUID,
    trip_id     UUID,
    user_id     UUID,
    user_name   TEXT,
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
        pc.amount, pc.amount_paid, pc.status, pc.paid_at
    FROM pool_contributions pc
    LEFT JOIN public.users u ON u.auth_id = pc.user_id
    WHERE pc.trip_id = p_trip_id
    ORDER BY pc.created_at;
END;
$$;

-- ── 3. record_pool_payment ────────────────────────────────────────────────────
--
-- p_contribution_id  – the contribution row to update
-- p_payment_amount   – amount being paid now
-- p_full_payment     – if TRUE, marks as fully paid regardless of p_payment_amount
--
-- Returns the updated status and running totals.

CREATE OR REPLACE FUNCTION record_pool_payment(
    p_contribution_id UUID,
    p_payment_amount  DECIMAL(12,2),
    p_full_payment    BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    new_status    TEXT,
    new_paid      DECIMAL(12,2),
    total_amount  DECIMAL(12,2),
    remaining     DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_amount      DECIMAL(12,2);
    v_paid_so_far DECIMAL(12,2);
    v_new_paid    DECIMAL(12,2);
    v_new_status  TEXT;
BEGIN
    SELECT amount, amount_paid
    INTO v_amount, v_paid_so_far
    FROM pool_contributions
    WHERE id = p_contribution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contribution not found';
    END IF;

    IF p_full_payment THEN
        v_new_paid   := v_amount;
        v_new_status := 'paid';
    ELSE
        v_new_paid := LEAST(v_paid_so_far + p_payment_amount, v_amount);
        IF v_new_paid >= v_amount THEN
            v_new_status := 'paid';
        ELSIF v_new_paid > 0 THEN
            v_new_status := 'partial';
        ELSE
            v_new_status := 'pending';
        END IF;
    END IF;

    UPDATE pool_contributions
    SET
        amount_paid = v_new_paid,
        status      = v_new_status,
        paid_at     = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END
    WHERE id = p_contribution_id;

    RETURN QUERY SELECT
        v_new_status,
        v_new_paid,
        v_amount,
        GREATEST(v_amount - v_new_paid, 0::DECIMAL(12,2));
END;
$$;
