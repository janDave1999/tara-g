-- 084_cost_sharing_change_rpcs.sql
--
-- Two RPCs that enable the owner to safely change the cost-sharing method
-- with full visibility and control over existing obligations.
--
-- ┌───────────────────────────────────────────────────────────────────────┐
-- │ ACCOUNTING MODEL                                                      │
-- │                                                                       │
-- │ Rule 1 — Historical integrity:                                        │
-- │   Past expense_splits are never retroactively changed unless the      │
-- │   owner explicitly chooses to write them off.                         │
-- │                                                                       │
-- │ Rule 2 — Prospective-only:                                            │
-- │   The new method applies only to expenses logged after the change.    │
-- │                                                                       │
-- │ Rule 3 — Pool credit preservation:                                    │
-- │   Members who already paid into a pool (amount_paid > 0) never lose   │
-- │   that record. The paid amount stays as historical truth.             │
-- │                                                                       │
-- │ Rule 4 — Cancellation closes partial cleanly:                         │
-- │   A partial contribution (amount_paid < amount) that is cancelled     │
-- │   is closed AT what was paid — the member's credit is preserved,      │
-- │   the remaining obligation is forgiven.                               │
-- └───────────────────────────────────────────────────────────────────────┘
--
-- Scenarios covered:
--
--   split_evenly / custom_split → anything
--     May have unsettled expense_splits.
--     writeOffSplits: keep (default) | write_off
--
--   organizer_shoulders_all → anything
--     No splits, no pool. Clean transition.
--
--   everyone_pays_own → anything
--     No cross-splits (unless explicit recipients were used).
--     Generally clean.
--
--   event_fee / budget_pool → non-pool method
--     May have unsettled splits AND pending/partial pool contributions.
--     writeOffSplits: keep | write_off
--     poolAction: keep | cancel
--
--   event_fee ↔ budget_pool
--     May have unsettled splits AND pending/partial pool contributions.
--     writeOffSplits: keep | write_off
--     poolAction: keep | cancel | transfer
--       transfer: adjust pending contribution amounts to the new
--                 p_pool_per_person; members who already paid more
--                 than the new amount are closed as 'paid' (overpay
--                 recorded; refund is handled offline by the organizer).
--
-- New RPCs:
--   get_unsettled_summary(p_trip_id)           → JSONB
--   change_cost_sharing_method(p_trip_id, ...) → JSONB


-- ── 1. get_unsettled_summary ──────────────────────────────────────────────────
--
-- Returns a snapshot of outstanding obligations so the UI can warn the owner
-- before they commit a method change.
--
-- Result shape:
-- {
--   "current_method": "split_evenly",
--   "splits": {
--     "count": 2,
--     "total": 1500.00,
--     "members": [
--       { "auth_id": "...", "display_name": "Alice", "amount_owed": 750.00 }
--     ]
--   },
--   "pool": {
--     "count": 1,
--     "pending_total": 500.00,
--     "paid_total": 300.00,
--     "members": [
--       { "auth_id": "...", "display_name": "Bob",
--         "amount_paid": 300.00, "amount_remaining": 500.00,
--         "status": "partial" }
--     ]
--   }
-- }

CREATE OR REPLACE FUNCTION public.get_unsettled_summary(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_method   TEXT;
  v_splits_count     INT   := 0;
  v_splits_total     DECIMAL(12,2) := 0;
  v_splits_members   JSONB := '[]'::JSONB;
  v_pool_count       INT   := 0;
  v_pool_pending     DECIMAL(12,2) := 0;
  v_pool_paid        DECIMAL(12,2) := 0;
  v_pool_members     JSONB := '[]'::JSONB;
  v_refund_count     INT   := 0;
  v_refund_total     DECIMAL(12,2) := 0;
  v_refund_members   JSONB := '[]'::JSONB;
BEGIN

  -- Current cost-sharing method
  SELECT COALESCE(cost_sharing_method::TEXT, 'split_evenly')
  INTO   v_current_method
  FROM   trip_budget_settings
  WHERE  trip_id = p_trip_id;

  -- ── Unsettled expense splits (aggregated per debtor) ──────────────────
  SELECT
    COALESCE(COUNT(*)::INT, 0),
    COALESCE(SUM(member_total), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'auth_id',      auth_id,
          'display_name', display_name,
          'amount_owed',  member_total
        )
        ORDER BY member_total DESC
      ),
      '[]'::JSONB
    )
  INTO v_splits_count, v_splits_total, v_splits_members
  FROM (
    SELECT
      es.user_id                                              AS auth_id,
      COALESCE(u.full_name, u.username, u.email, 'Member')   AS display_name,
      SUM(es.share_amount)                                    AS member_total
    FROM   expense_splits es
    JOIN   trip_expenses  te ON te.id     = es.expense_id
    LEFT JOIN users       u  ON u.auth_id = es.user_id
    WHERE  te.trip_id    = p_trip_id
      AND  es.is_settled = FALSE
    GROUP  BY es.user_id, u.full_name, u.username, u.email
    HAVING SUM(es.share_amount) > 0
  ) split_by_member;

  -- ── Pending / partial pool contributions ──────────────────────────────
  SELECT
    COALESCE(COUNT(*)::INT, 0),
    COALESCE(SUM(pc.amount - COALESCE(pc.amount_paid, 0)), 0),
    COALESCE(SUM(COALESCE(pc.amount_paid, 0)), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'auth_id',          pc.user_id,
          'display_name',     COALESCE(u.full_name, u.username, u.email, 'Member'),
          'amount_paid',      COALESCE(pc.amount_paid, 0),
          'amount_remaining', pc.amount - COALESCE(pc.amount_paid, 0),
          'status',           pc.status
        )
        ORDER BY pc.amount - COALESCE(pc.amount_paid, 0) DESC
      ),
      '[]'::JSONB
    )
  INTO v_pool_count, v_pool_pending, v_pool_paid, v_pool_members
  FROM   pool_contributions pc
  LEFT JOIN users           u  ON u.auth_id = pc.user_id
  WHERE  pc.trip_id = p_trip_id
    AND  pc.status  IN ('pending', 'partial');

  -- ── Fully-paid contributions (refundable when leaving a pool method) ──
  SELECT
    COALESCE(COUNT(*)::INT, 0),
    COALESCE(SUM(COALESCE(pc.amount_paid, pc.amount)), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'auth_id',      pc.user_id,
          'display_name', COALESCE(u.full_name, u.username, u.email, 'Member'),
          'amount_paid',  COALESCE(pc.amount_paid, pc.amount)
        )
        ORDER BY COALESCE(pc.amount_paid, pc.amount) DESC
      ),
      '[]'::JSONB
    )
  INTO v_refund_count, v_refund_total, v_refund_members
  FROM   pool_contributions pc
  LEFT JOIN users           u  ON u.auth_id = pc.user_id
  WHERE  pc.trip_id = p_trip_id
    AND  pc.status  = 'paid';

  RETURN jsonb_build_object(
    'current_method', COALESCE(v_current_method, 'split_evenly'),
    'splits', jsonb_build_object(
      'count',   v_splits_count,
      'total',   v_splits_total,
      'members', v_splits_members
    ),
    'pool', jsonb_build_object(
      'count',         v_pool_count,
      'pending_total', v_pool_pending,
      'paid_total',    v_pool_paid,
      'members',       v_pool_members
    ),
    'refundable', jsonb_build_object(
      'count',   v_refund_count,
      'total',   v_refund_total,
      'members', v_refund_members
    )
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unsettled_summary TO authenticated;


-- ── 2. change_cost_sharing_method ────────────────────────────────────────────
--
-- Atomically reconciles existing obligations and saves the new settings.
--
-- Parameters:
--   p_write_off_splits  BOOLEAN  DEFAULT FALSE
--     FALSE → existing unsettled splits remain (members still owe)
--     TRUE  → all unsettled expense_splits for this trip are marked
--             as settled (is_settled=TRUE, settled_at=NOW()).
--             Use when the owner wants to start fresh with no old debts.
--
--   p_pool_action  TEXT  DEFAULT 'keep'
--     Applies only to pending / partial pool_contributions.
--
--     'keep'
--       Leave pending contributions untouched. Members still owe.
--
--     'cancel'
--       • fully pending rows (amount_paid = 0): DELETE entirely.
--       • partial rows (amount_paid > 0): close at amount paid.
--         Sets amount = amount_paid, status = 'paid'.
--         The paid credit is preserved; remaining obligation is forgiven.
--
--     'transfer'
--       For event_fee ↔ budget_pool transitions.
--       Updates the contribution target (amount) to p_pool_per_person.
--       Per-member outcome:
--         amount_paid >= new_amount → status = 'paid'    (overpay; refund offline)
--         0 < amount_paid < new_amount → status = 'partial' (still owes difference)
--         amount_paid = 0 → status = 'pending'           (nothing paid yet)
--       This preserves every member's payment history exactly.
--
-- Returns a JSONB summary of every action taken.

CREATE OR REPLACE FUNCTION public.change_cost_sharing_method(
  p_trip_id              UUID,
  p_new_method           TEXT,
  p_budget_estimate      DECIMAL(12,2) DEFAULT NULL,
  p_pool_per_person      DECIMAL(12,2) DEFAULT NULL,
  p_allow_members_to_log BOOLEAN       DEFAULT TRUE,
  p_write_off_splits     BOOLEAN       DEFAULT FALSE,
  p_pool_action          TEXT          DEFAULT 'keep'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_splits_written_off INT := 0;
  v_pool_cancelled     INT := 0;
  v_partial_cancelled  INT := 0;
  v_pool_transferred   INT := 0;
  v_pool_enabled       BOOLEAN;
BEGIN

  -- ── Validate inputs ────────────────────────────────────────────────────
  IF p_new_method NOT IN (
    'split_evenly', 'organizer_shoulders_all', 'everyone_pays_own',
    'custom_split', 'event_fee', 'budget_pool'
  ) THEN
    RAISE EXCEPTION 'Invalid cost sharing method: %', p_new_method;
  END IF;

  IF p_pool_action NOT IN ('keep', 'cancel', 'transfer') THEN
    RAISE EXCEPTION 'Invalid pool_action "%". Must be keep, cancel, or transfer.', p_pool_action;
  END IF;

  -- 'transfer' only makes sense when changing between pool methods
  IF p_pool_action = 'transfer' AND p_new_method NOT IN ('event_fee', 'budget_pool') THEN
    RAISE EXCEPTION 'pool_action=transfer requires new method to be event_fee or budget_pool.';
  END IF;

  IF p_pool_action = 'transfer' AND p_pool_per_person IS NULL THEN
    RAISE EXCEPTION 'pool_action=transfer requires p_pool_per_person to be set.';
  END IF;

  v_pool_enabled := p_new_method IN ('event_fee', 'budget_pool');

  -- ── Step 1: Reconcile expense splits ──────────────────────────────────
  IF p_write_off_splits THEN
    UPDATE expense_splits
    SET    is_settled = TRUE,
           settled_at = NOW()
    WHERE  expense_id IN (
             SELECT id FROM trip_expenses WHERE trip_id = p_trip_id
           )
      AND  is_settled = FALSE;

    GET DIAGNOSTICS v_splits_written_off = ROW_COUNT;
  END IF;

  -- ── Step 2: Reconcile pool contributions ──────────────────────────────
  IF p_pool_action = 'cancel' THEN

    -- Fully pending (nothing paid) → remove entirely
    DELETE FROM pool_contributions
    WHERE  trip_id = p_trip_id
      AND  status  = 'pending';

    GET DIAGNOSTICS v_pool_cancelled = ROW_COUNT;

    -- Partial (some paid) → close at what was paid; preserves credit
    UPDATE pool_contributions
    SET    amount   = amount_paid,
           status   = 'paid',
           paid_at  = COALESCE(paid_at, NOW())
    WHERE  trip_id = p_trip_id
      AND  status  = 'partial';

    GET DIAGNOSTICS v_partial_cancelled = ROW_COUNT;
    v_pool_cancelled := v_pool_cancelled + v_partial_cancelled;

  ELSIF p_pool_action = 'transfer' THEN

    UPDATE pool_contributions
    SET
      amount = p_pool_per_person,
      status = CASE
        WHEN COALESCE(amount_paid, 0) >= p_pool_per_person THEN 'paid'
        WHEN COALESCE(amount_paid, 0) > 0                  THEN 'partial'
        ELSE                                                     'pending'
      END,
      paid_at = CASE
        WHEN COALESCE(amount_paid, 0) >= p_pool_per_person AND paid_at IS NULL
        THEN NOW()
        ELSE paid_at
      END
    WHERE  trip_id = p_trip_id
      AND  status  IN ('pending', 'partial');

    GET DIAGNOSTICS v_pool_transferred = ROW_COUNT;

  END IF;

  -- ── Step 3: When switching AWAY from a pool method, also update pool_status
  IF NOT v_pool_enabled THEN
    UPDATE trip_budget_settings
    SET    pool_status = 'closed'
    WHERE  trip_id = p_trip_id;
  END IF;

  -- ── Step 4: Upsert the new budget settings ────────────────────────────
  INSERT INTO trip_budget_settings (
    trip_id,
    cost_sharing_method,
    budget_estimate,
    pool_enabled,
    pool_per_person,
    pool_status,
    allow_members_to_log,
    updated_at
  )
  VALUES (
    p_trip_id,
    p_new_method::cost_sharing_method,
    p_budget_estimate,
    v_pool_enabled,
    p_pool_per_person,
    CASE WHEN v_pool_enabled THEN 'open' ELSE 'closed' END,
    p_allow_members_to_log,
    NOW()
  )
  ON CONFLICT (trip_id) DO UPDATE
    SET cost_sharing_method  = EXCLUDED.cost_sharing_method,
        budget_estimate      = EXCLUDED.budget_estimate,
        pool_enabled         = EXCLUDED.pool_enabled,
        pool_per_person      = EXCLUDED.pool_per_person,
        pool_status          = EXCLUDED.pool_status,
        allow_members_to_log = EXCLUDED.allow_members_to_log,
        updated_at           = NOW();

  -- ── Return audit summary ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'new_method',          p_new_method,
    'splits_written_off',  v_splits_written_off,
    'pool_cancelled',      v_pool_cancelled,
    'pool_transferred',    v_pool_transferred
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.change_cost_sharing_method TO authenticated;
