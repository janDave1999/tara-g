-- =====================================================
-- FIX: LOCATION GEOMETRY TRIGGER
-- =====================================================
-- Problem: ST_MakePoint fails with "function st_makepoint(numeric, numeric)
--   does not exist" because:
--   1. PostGIS is in the `extensions` schema in Supabase, which is not
--      included in the trigger function's search_path by default.
--   2. DECIMAL columns are numeric type; explicit cast to float8 needed.
-- Fix: Recreate the trigger function with SET search_path = public, extensions
--   and explicit ::double precision casts on lat/lng.
-- =====================================================

CREATE OR REPLACE FUNCTION update_location_geometry()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geometry := ST_SetSRID(
        ST_MakePoint(
            NEW.longitude::double precision,
            NEW.latitude::double precision
        ),
        4326
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, extensions;

SELECT 'Fixed update_location_geometry trigger function' AS status;
