-- =====================================================
-- MIGRATION 092: province_travel_logs v2
-- =====================================================
-- Enhances travel logs with location, datetime, and trip link.
-- visit_date DATE is replaced by visited_at TIMESTAMPTZ.
-- trip_id links to trips for auto-surfacing related posts.
-- =====================================================

-- Drop old date column (no data yet, safe to replace)
ALTER TABLE public.province_travel_logs
  DROP COLUMN IF EXISTS visit_date;

-- Add new columns
ALTER TABLE public.province_travel_logs
  ADD COLUMN IF NOT EXISTS location   TEXT,
  ADD COLUMN IF NOT EXISTS visited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trip_id    UUID REFERENCES public.trips(trip_id) ON DELETE SET NULL;

-- Index for trip lookups
CREATE INDEX IF NOT EXISTS province_travel_logs_trip_id
  ON public.province_travel_logs (trip_id)
  WHERE trip_id IS NOT NULL;

DO $$ BEGIN
  RAISE NOTICE 'MIGRATION 092 applied — province_travel_logs: added location, visited_at, trip_id';
END $$;
