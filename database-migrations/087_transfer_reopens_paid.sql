-- 087_transfer_reopens_paid.sql
--
-- Fixes the 'transfer' pool action in change_cost_sharing_method so that
-- members who are already 'paid' are ALSO recalculated when the owner
-- increases the per-person target (e.g. to cover an overdrawn pool).
--
-- Before this fix, only 'pending' and 'partial' rows were updated.
-- A member who had fully paid the OLD target kept status='paid' even if
-- the new target is higher — meaning the overdraft couldn't be recouped
-- through target adjustment alone.
--
-- Change: the WHERE clause of the transfer UPDATE now includes 'paid'.
-- Logic remains the same:
--   amount_paid >= new_target → stays 'paid'   (may have overpaid → refund offline)
--   0 < amount_paid < new_target → 'partial'   (owes the difference)
--   amount_paid = 0 → 'pending'                (nothing paid yet)
--
-- refunded contributions are still excluded — their obligation is closed.

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

    DELETE FROM pool_contributions
    WHERE  trip_id = p_trip_id
      AND  status  = 'pending';

    GET DIAGNOSTICS v_pool_cancelled = ROW_COUNT;

    UPDATE pool_contributions
    SET    amount   = amount_paid,
           status   = 'paid',
           paid_at  = COALESCE(paid_at, NOW())
    WHERE  trip_id = p_trip_id
      AND  status  = 'partial';

    GET DIAGNOSTICS v_partial_cancelled = ROW_COUNT;
    v_pool_cancelled := v_pool_cancelled + v_partial_cancelled;

  ELSIF p_pool_action = 'transfer' THEN

    -- Update ALL non-refunded contributions (including 'paid') so that
    -- increasing the target reopens members who already paid the old amount.
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
      AND  status  IN ('pending', 'partial', 'paid');   -- ← now includes 'paid'

    GET DIAGNOSTICS v_pool_transferred = ROW_COUNT;

  END IF;

  -- ── Step 3: When switching AWAY from a pool method, close the pool ────
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
