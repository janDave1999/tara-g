-- 086_pool_balance_tracking.sql
--
-- Tracks which expenses were paid from the shared pool, enabling:
--   1. Real-time pool balance (collected − spent from pool)
--   2. Per-member refundable recalculation when pool expenses are added
--
-- ┌───────────────────────────────────────────────────────────────────────┐
-- │ ACCOUNTING MODEL (Pool Balance)                                       │
-- │                                                                       │
-- │  Pool Collected    = SUM(amount_paid) across all contributions        │
-- │  Pool Spent        = SUM(amount) from pool-sourced expenses           │
-- │  Pool Balance      = Pool Collected − Pool Spent                      │
-- │                                                                       │
-- │  Member Refundable (if pool dissolved today):                         │
-- │    = (member_amount_paid / total_collected) × pool_balance            │
-- │    = proportional share of remaining balance                          │
-- │                                                                       │
-- │  If pool_balance ≤ 0 → all funds consumed; refundable = 0            │
-- └───────────────────────────────────────────────────────────────────────┘

-- ── 1. Schema: add paid_from_pool flag to trip_expenses ───────────────────

ALTER TABLE trip_expenses
  ADD COLUMN IF NOT EXISTS paid_from_pool BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Update add_trip_expense to accept and store the flag ───────────────

CREATE OR REPLACE FUNCTION add_trip_expense(
    p_trip_id        UUID,
    p_payer_id       UUID,
    p_amount         DECIMAL(12,2),
    p_description    TEXT,
    p_category       TEXT,
    p_date           DATE,
    p_is_shared      BOOLEAN    DEFAULT TRUE,
    p_receipt_url    TEXT       DEFAULT NULL,
    p_stop_id        UUID       DEFAULT NULL,
    p_recipient_ids  UUID[]     DEFAULT NULL,
    p_created_by     UUID       DEFAULT NULL,
    p_paid_from_pool BOOLEAN    DEFAULT FALSE
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
        date, receipt_url, stop_id, created_by, is_shared, paid_from_pool
    ) VALUES (
        p_trip_id, p_payer_id, p_amount, p_description, p_category,
        p_date, p_receipt_url, p_stop_id, p_created_by, p_is_shared, p_paid_from_pool
    )
    RETURNING id INTO v_expense_id;

    -- Pool-sourced expenses never generate splits — the pool absorbs the cost
    IF p_paid_from_pool THEN
        RETURN v_expense_id;
    END IF;

    -- Skip splits for organizer_shoulders_all
    IF v_cost_sharing = 'organizer_shoulders_all' THEN
        RETURN v_expense_id;
    END IF;

    -- Everyone_pays_own: only create splits if explicit recipients given
    IF v_cost_sharing = 'everyone_pays_own' AND (p_recipient_ids IS NULL OR array_length(p_recipient_ids, 1) IS NULL) THEN
        RETURN v_expense_id;
    END IF;

    IF NOT p_is_shared THEN
        RETURN v_expense_id;
    END IF;

    -- ── Determine recipient set ───────────────────────────────────────────
    IF p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
        -- Explicit recipient list (custom split / selective share)
        v_member_count := array_length(p_recipient_ids, 1);
        v_share_amount := ROUND(p_amount / NULLIF(v_member_count, 0), 2);

        FOR v_user_id IN SELECT UNNEST(p_recipient_ids) LOOP
            -- Payer's share is absorbed; skip creating a split for them
            IF v_user_id <> p_payer_id THEN
                INSERT INTO expense_splits (expense_id, user_id, share_amount, is_settled)
                VALUES (v_expense_id, v_user_id, v_share_amount, FALSE);
            END IF;
        END LOOP;
    ELSE
        -- All joined trip members
        SELECT COUNT(*) INTO v_member_count
        FROM trip_members
        WHERE trip_id = p_trip_id AND member_status = 'joined';

        v_share_amount := ROUND(p_amount / NULLIF(v_member_count, 0), 2);

        FOR v_user_id IN
            SELECT user_id FROM trip_members
            WHERE trip_id = p_trip_id AND member_status = 'joined'
        LOOP
            IF v_user_id <> p_payer_id THEN
                INSERT INTO expense_splits (expense_id, user_id, share_amount, is_settled)
                VALUES (v_expense_id, v_user_id, v_share_amount, FALSE);
            END IF;
        END LOOP;
    END IF;

    RETURN v_expense_id;
END;
$$;


-- ── 3. get_pool_balance ───────────────────────────────────────────────────
--
-- Returns the current pool state:
--   collected      — total amount_paid across all contributions
--   spent          — total amount from pool-sourced expenses
--   balance        — collected − spent (what's left in the pool)
--   members        — per-member breakdown with proportional refundable amount
--
-- Result shape:
-- {
--   "collected":  2000.00,
--   "spent":       500.00,
--   "balance":    1500.00,
--   "members": [
--     { "auth_id": "...", "display_name": "Alice",
--       "amount_paid": 1000.00, "refundable": 750.00 }
--   ]
-- }

CREATE OR REPLACE FUNCTION public.get_pool_balance(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collected  DECIMAL(12,2) := 0;
  v_spent      DECIMAL(12,2) := 0;
  v_balance    DECIMAL(12,2);
  v_members    JSONB         := '[]'::JSONB;
BEGIN

  -- Total collected from paid/partial contributions
  -- Legacy guard: rows where status='paid' but amount_paid=0 → use amount
  SELECT COALESCE(SUM(
    CASE WHEN status = 'paid' AND COALESCE(amount_paid, 0) = 0
         THEN amount
         ELSE COALESCE(amount_paid, 0)
    END
  ), 0)
  INTO v_collected
  FROM pool_contributions
  WHERE trip_id = p_trip_id
    AND status IN ('paid', 'partial');

  -- Total spent from the pool
  SELECT COALESCE(SUM(amount), 0)
  INTO v_spent
  FROM trip_expenses
  WHERE trip_id = p_trip_id
    AND paid_from_pool = TRUE;

  -- Allow negative balance (overdraft) so the UI can warn about it.
  -- Clamping to 0 would hide the fact that the pool is overdrawn.
  v_balance := v_collected - v_spent;

  -- Per-member breakdown (only for paid/partial contributors)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'auth_id',      pc.user_id,
        'display_name', COALESCE(u.full_name, u.username, u.email, 'Member'),
        'amount_paid',  CASE WHEN pc.status = 'paid' AND COALESCE(pc.amount_paid, 0) = 0
                             THEN pc.amount
                             ELSE COALESCE(pc.amount_paid, 0)
                        END,
        'refundable',   CASE
                          WHEN v_collected > 0 AND v_balance > 0 THEN
                            ROUND(
                              (CASE WHEN pc.status = 'paid' AND COALESCE(pc.amount_paid, 0) = 0
                                    THEN pc.amount
                                    ELSE COALESCE(pc.amount_paid, 0)
                               END
                               / v_collected) * v_balance,
                              2
                            )
                          ELSE 0
                        END
      )
      ORDER BY COALESCE(pc.amount_paid, 0) DESC
    ),
    '[]'::JSONB
  )
  INTO v_members
  FROM pool_contributions pc
  LEFT JOIN users u ON u.auth_id = pc.user_id
  WHERE pc.trip_id = p_trip_id
    AND pc.status IN ('paid', 'partial');

  RETURN jsonb_build_object(
    'collected', v_collected,
    'spent',     v_spent,
    'balance',   v_balance,
    'members',   v_members
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_balance TO authenticated;


-- ── 4. Expose paid_from_pool in get_trip_expenses ────────────────────────
--
-- Must DROP first — PostgreSQL disallows changing return type in place.

DROP FUNCTION IF EXISTS get_trip_expenses(UUID);

CREATE OR REPLACE FUNCTION get_trip_expenses(p_trip_id UUID)
RETURNS TABLE (
    id            UUID,
    trip_id       UUID,
    payer_id      UUID,
    payer_name    TEXT,
    amount        DECIMAL(12,2),
    description   TEXT,
    category      TEXT,
    date          DATE,
    receipt_url   TEXT,
    is_shared     BOOLEAN,
    paid_from_pool BOOLEAN,
    created_at    TIMESTAMPTZ,
    splits        JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.id, te.trip_id, te.payer_id,
        COALESCE(u.full_name, u.username, u.email)::TEXT AS payer_name,
        te.amount, te.description, te.category, te.date,
        te.receipt_url, te.is_shared, te.paid_from_pool, te.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'split_id',    es.id,
                    'user_id',     es.user_id,
                    'share_amount', es.share_amount,
                    'user_name',   (SELECT COALESCE(u2.full_name, u2.username, u2.email)
                                    FROM public.users u2 WHERE u2.auth_id = es.user_id),
                    'is_settled',  es.is_settled
                )
            ) FILTER (WHERE es.id IS NOT NULL),
            '[]'::jsonb
        ) AS splits
    FROM trip_expenses te
    LEFT JOIN expense_splits es ON es.expense_id = te.id
    LEFT JOIN public.users    u  ON u.auth_id     = te.payer_id
    WHERE te.trip_id = p_trip_id
    GROUP BY te.id, u.full_name, u.username, u.email
    ORDER BY te.date DESC, te.created_at DESC;
END;
$$;
