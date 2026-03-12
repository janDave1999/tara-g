-- 085_mark_contribution_refunded.sql
--
-- Adds an RPC for the trip owner to mark a pool contribution as refunded.
-- Used when the cost-sharing method changed away from a pool method and
-- a member who already paid needs to be reimbursed offline.
--
-- The 'refunded' status already exists in the pool_contributions check
-- constraint (added in 006). This migration just exposes the action as
-- a safe, owner-only RPC.
--
-- Accounting rule:
--   status → 'refunded'
--   No other columns change — amount_paid remains as historical truth.
--   The refund itself happens offline (cash, bank transfer, etc.).

CREATE OR REPLACE FUNCTION public.mark_contribution_refunded(
  p_contribution_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pool_contributions
  SET    status = 'refunded'
  WHERE  id     = p_contribution_id
    AND  status = 'paid';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contribution not found or not in paid status (id: %)', p_contribution_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_contribution_refunded TO authenticated;
