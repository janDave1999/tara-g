-- Migration 063: Reports
--
-- Allows users to report posts or comments.
-- One report per user per target (enforced by UNIQUE constraint).
-- Reviewed by admins directly in Supabase dashboard.

-- ─── reports table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  report_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_type VARCHAR(10)  NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id   UUID         NOT NULL,
  reason      VARCHAR(50)  NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'other')),
  status      VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_target
  ON reports(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports(status, created_at DESC);

-- ─── create_report RPC ────────────────────────────────────────────────────────
-- Returns already_reported = TRUE if the user already reported this target,
-- so the client can show an appropriate toast.

DROP FUNCTION IF EXISTS public.create_report(UUID, VARCHAR, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION public.create_report(
  p_user_id     UUID,
  p_target_type VARCHAR,
  p_target_id   UUID,
  p_reason      VARCHAR
)
RETURNS TABLE(report_id UUID, already_reported BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_internal_id UUID;
  v_new_id      UUID;
BEGIN
  SELECT user_id INTO v_internal_id
  FROM users WHERE auth_id = p_user_id LIMIT 1;

  IF v_internal_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO reports (reporter_id, target_type, target_id, reason)
  VALUES (v_internal_id, p_target_type, p_target_id, p_reason)
  ON CONFLICT (reporter_id, target_type, target_id) DO NOTHING
  RETURNING reports.report_id INTO v_new_id;

  IF v_new_id IS NOT NULL THEN
    RETURN QUERY SELECT v_new_id, FALSE;
  ELSE
    RETURN QUERY SELECT NULL::UUID, TRUE;
  END IF;
END;
$$;
