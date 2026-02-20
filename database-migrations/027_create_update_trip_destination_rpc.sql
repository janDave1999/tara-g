-- =====================================================
-- 027: Create update_trip_destination RPC
-- =====================================================
-- Updates the primary destination of a trip (owner only).
-- Finds the locations row linked via trip_location
-- (location_type = 'destination', is_primary = TRUE)
-- and updates name, coordinates, and PostGIS geometry.
--
-- p_coordinates: JSON string "[lng, lat]" (Mapbox order)
-- =====================================================

DROP FUNCTION IF EXISTS update_trip_destination(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_trip_destination(
    p_trip_id        UUID,
    p_user_id        UUID,
    p_region_address TEXT,
    p_coordinates    TEXT   -- "[lng, lat]" JSON array
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_owner_id   UUID;
    v_location_id UUID;
    v_coords     JSONB;
    v_lng        DOUBLE PRECISION;
    v_lat        DOUBLE PRECISION;
BEGIN
    -- Verify ownership
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can edit the destination');
    END IF;

    -- Parse [lng, lat] coordinates
    BEGIN
        v_coords := p_coordinates::JSONB;
        v_lng    := (v_coords->0)::DOUBLE PRECISION;
        v_lat    := (v_coords->1)::DOUBLE PRECISION;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid coordinates format — expected [lng, lat]');
    END;

    -- Get the location_id for the primary destination
    SELECT location_id INTO v_location_id
    FROM trip_location
    WHERE trip_id     = p_trip_id
      AND location_type = 'destination'
      AND is_primary    = TRUE
    LIMIT 1;

    IF v_location_id IS NULL THEN
        -- No existing primary destination row — create one
        INSERT INTO locations (name, address, latitude, longitude, geometry)
        VALUES (
            p_region_address,
            p_region_address,
            v_lat,
            v_lng,
            ST_SetSRID(ST_MakePoint(v_lng::float8, v_lat::float8), 4326)
        )
        RETURNING location_id INTO v_location_id;

        INSERT INTO trip_location (trip_id, location_id, location_type, is_primary, is_mandatory, order_index)
        VALUES (p_trip_id, v_location_id, 'destination', TRUE, TRUE, 1);
    ELSE
        -- Update the existing locations row
        UPDATE locations
        SET
            name      = p_region_address,
            address   = p_region_address,
            latitude  = v_lat,
            longitude = v_lng,
            geometry  = ST_SetSRID(ST_MakePoint(v_lng::float8, v_lat::float8), 4326),
            updated_at = NOW()
        WHERE location_id = v_location_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'location_id', v_location_id);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_destination TO authenticated;
