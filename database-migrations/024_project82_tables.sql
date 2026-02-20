-- =====================================================
-- MIGRATION 024: PROJECT 82 — PROVINCE TRACKING TABLES
-- =====================================================
-- Creates tables for tracking which of the Philippines'
-- 82 provinces a user has visited.
--
-- Tables:
--   user_province_visits  — per-user visit records
--
-- Notes:
--   - province_key matches keys in src/data/phProvinces.ts
--   - province_boundaries (PostGIS) deferred to migration 025
--     when auto-detection via ST_Contains is needed
-- =====================================================


-- ── Visit stage enum ─────────────────────────────────
DO $$ BEGIN
    CREATE TYPE public.visit_stage AS ENUM (
        'pass_through',          -- transit, less than 1 day
        'short_stay',            -- ~1 day
        'extended_stay',         -- 2-3 days
        'thorough_exploration'   -- 4+ days / multiple visits
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- idempotent
END $$;


-- ── user_province_visits ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_province_visits (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    province_key      TEXT        NOT NULL,   -- e.g. "CEB", "MM", "ABR"
    stage             public.visit_stage NOT NULL,
    visit_date        DATE,
    trip_id           UUID        REFERENCES public.trips(trip_id) ON DELETE SET NULL,
    notes             TEXT,
    is_auto_detected  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, province_key)
);

-- ── Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_province_visits_user
    ON public.user_province_visits (user_id);

CREATE INDEX IF NOT EXISTS idx_province_visits_key
    ON public.user_province_visits (province_key);


-- ── updated_at trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_province_visit_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_province_visit_updated_at ON public.user_province_visits;

CREATE TRIGGER trg_province_visit_updated_at
    BEFORE UPDATE ON public.user_province_visits
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_province_visit_updated_at();


-- ── RLS: enable (service_role bypasses RLS automatically) ────
ALTER TABLE public.user_province_visits ENABLE ROW LEVEL SECURITY;

-- Drop first so migration is idempotent
DROP POLICY IF EXISTS "province_visits_select" ON public.user_province_visits;
DROP POLICY IF EXISTS "province_visits_all"    ON public.user_province_visits;

-- Users can read their own visits
-- (public profile visibility is enforced at the API layer, not here)
CREATE POLICY "province_visits_select"
    ON public.user_province_visits
    FOR SELECT
    USING (
        user_id IN (
            SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()
        )
    );

-- Users can write only their own records
CREATE POLICY "province_visits_all"
    ON public.user_province_visits
    FOR ALL
    USING (
        user_id IN (
            SELECT u.user_id FROM public.users u WHERE u.auth_id = auth.uid()
        )
    );


-- ── Grant ─────────────────────────────────────────────
GRANT ALL ON public.user_province_visits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_province_visits TO authenticated;


-- ── Verify ────────────────────────────────────────────
DO $$ BEGIN
    RAISE NOTICE 'MIGRATION 024 applied — user_province_visits table created';
END $$;
