-- =====================================================
-- MIGRATION 091: province_travel_logs
-- =====================================================
-- Stores per-province personal travel/activity logs.
-- user_id references auth.users(id) directly (same pattern as migration 038).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.province_travel_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  province_key  TEXT        NOT NULL,
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description   TEXT,
  activity_type TEXT        NOT NULL DEFAULT 'other'
                            CHECK (activity_type IN (
                              'sightseeing','dining','shopping','entertainment',
                              'adventure','cultural','relaxation','other'
                            )),
  visit_date    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-user, per-province queries
CREATE INDEX IF NOT EXISTS province_travel_logs_user_province
  ON public.province_travel_logs (user_id, province_key);

-- RLS
ALTER TABLE public.province_travel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "travel_logs_select"
  ON public.province_travel_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "travel_logs_all"
  ON public.province_travel_logs FOR ALL
  USING (user_id = auth.uid());

GRANT ALL ON public.province_travel_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.province_travel_logs TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'MIGRATION 091 applied — province_travel_logs table created';
END $$;
