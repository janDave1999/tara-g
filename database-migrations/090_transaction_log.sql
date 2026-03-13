-- 090_transaction_log.sql
--
-- get_transaction_log: unified chronological ledger for a trip's Budget tab.
--
-- Event types returned:
--   'contribution'  — member paid their pool/fee share (pool IN ↑)
--   'refund'        — owner refunded a member (pool OUT ↓)
--   'pool_expense'  — expense charged directly from pool funds (pool OUT ↓)
--   'expense'       — out-of-pocket expense logged by a member (neutral)
--   'settlement'    — a split debt settled between two members (neutral)
--
-- direction:
--   'in'      — increases pool balance (contribution)
--   'out'     — decreases pool balance (pool expense, refund)
--   'neutral' — no pool movement (direct expense, settlement)
--
-- running_balance:
--   Rolling pool balance after each in/out event (NULL for neutral events).
--   Ordered oldest-first for the window, but the result set is newest-first.

CREATE OR REPLACE FUNCTION public.get_transaction_log(p_trip_id UUID)
RETURNS TABLE (
  event_id      TEXT,
  event_type    TEXT,
  event_at      TIMESTAMPTZ,
  actor_name    TEXT,
  actor_avatar  TEXT,
  direction     TEXT,
  amount        DECIMAL(12,2),
  label         TEXT,
  sub_label     TEXT,
  running_balance DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH raw AS (

    -- ── 1. Contributions received ────────────────────────────────────────────
    SELECT
      'contrib_' || pc.id::TEXT                   AS event_id,
      'contribution'                               AS event_type,
      COALESCE(pc.paid_at, pc.created_at)          AS event_at,
      COALESCE(u.full_name, u.username, u.email)   AS actor_name,
      u.avatar_url                                 AS actor_avatar,
      'in'                                         AS direction,
      pc.amount_paid                               AS amount,
      'Contribution received'                      AS label,
      COALESCE(u.full_name, u.username, 'Member')  AS sub_label
    FROM pool_contributions pc
    LEFT JOIN public.users u ON u.auth_id = pc.user_id
    WHERE pc.trip_id = p_trip_id
      AND pc.amount_paid > 0
      AND pc.status != 'refunded'

    UNION ALL

    -- ── 2. Refunds issued ────────────────────────────────────────────────────
    SELECT
      'refund_' || pc.id::TEXT                     AS event_id,
      'refund'                                     AS event_type,
      COALESCE(pc.paid_at, pc.created_at)          AS event_at,
      COALESCE(u.full_name, u.username, u.email)   AS actor_name,
      u.avatar_url                                 AS actor_avatar,
      'out'                                        AS direction,
      pc.amount_paid                               AS amount,
      'Refund issued'                              AS label,
      COALESCE(u.full_name, u.username, 'Member')  AS sub_label
    FROM pool_contributions pc
    LEFT JOIN public.users u ON u.auth_id = pc.user_id
    WHERE pc.trip_id = p_trip_id
      AND pc.status = 'refunded'

    UNION ALL

    -- ── 3. Pool expenses (charged from shared fund) ──────────────────────────
    SELECT
      'poolexp_' || te.id::TEXT                    AS event_id,
      'pool_expense'                               AS event_type,
      te.created_at                                AS event_at,
      COALESCE(u.full_name, u.username, u.email)   AS actor_name,
      u.avatar_url                                 AS actor_avatar,
      'out'                                        AS direction,
      te.amount                                    AS amount,
      te.description                               AS label,
      INITCAP(te.category::TEXT) || ' · from pool' AS sub_label
    FROM trip_expenses te
    LEFT JOIN public.users u ON u.auth_id = te.payer_id
    WHERE te.trip_id = p_trip_id
      AND te.paid_from_pool = TRUE

    UNION ALL

    -- ── 4. Direct expenses (out-of-pocket) ──────────────────────────────────
    SELECT
      'expense_' || te.id::TEXT                    AS event_id,
      'expense'                                    AS event_type,
      te.created_at                                AS event_at,
      COALESCE(u.full_name, u.username, u.email)   AS actor_name,
      u.avatar_url                                 AS actor_avatar,
      'neutral'                                    AS direction,
      te.amount                                    AS amount,
      te.description                               AS label,
      INITCAP(te.category::TEXT) || ' · paid by ' ||
        COALESCE(u.full_name, u.username, 'member') AS sub_label
    FROM trip_expenses te
    LEFT JOIN public.users u ON u.auth_id = te.payer_id
    WHERE te.trip_id = p_trip_id
      AND (te.paid_from_pool IS NULL OR te.paid_from_pool = FALSE)

    UNION ALL

    -- ── 5. Expense-split settlements ─────────────────────────────────────────
    SELECT
      'settle_' || es.id::TEXT                       AS event_id,
      'settlement'                                   AS event_type,
      COALESCE(es.settled_at, NOW())                 AS event_at,
      COALESCE(du.full_name, du.username, du.email)  AS actor_name,
      du.avatar_url                                  AS actor_avatar,
      'neutral'                                      AS direction,
      es.share_amount                                AS amount,
      te.description                                 AS label,
      'Settled with ' ||
        COALESCE(pu.full_name, pu.username, 'organizer') AS sub_label
    FROM expense_splits es
    JOIN trip_expenses te ON te.id = es.expense_id
    LEFT JOIN public.users du ON du.auth_id = es.user_id        -- debtor
    LEFT JOIN public.users pu ON pu.auth_id = te.payer_id       -- payer/creditor
    WHERE te.trip_id = p_trip_id
      AND es.is_settled = TRUE

  ),

  -- Running balance: cumulative pool movement (in minus out), oldest first
  with_running AS (
    SELECT
      raw.*,
      CASE WHEN raw.direction IN ('in', 'out') THEN
        SUM(
          CASE
            WHEN raw.direction = 'in'  THEN raw.amount
            WHEN raw.direction = 'out' THEN -raw.amount
            ELSE 0
          END
        ) OVER (ORDER BY raw.event_at ASC, raw.event_id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
      ELSE NULL
      END AS running_balance
    FROM raw
  )

  SELECT
    wr.event_id,
    wr.event_type,
    wr.event_at,
    wr.actor_name::TEXT,
    wr.actor_avatar::TEXT,
    wr.direction,
    wr.amount,
    wr.label::TEXT,
    wr.sub_label::TEXT,
    wr.running_balance
  FROM with_running wr
  ORDER BY wr.event_at DESC, wr.event_id DESC;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_log(UUID) TO authenticated;
