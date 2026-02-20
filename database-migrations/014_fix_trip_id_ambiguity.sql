-- =====================================================
-- FIX: AMBIGUOUS trip_id IN create_trip_with_details
-- =====================================================
-- Problem: RETURNS TABLE declares a trip_id output column, which
--   conflicts with `RETURNING trip_id` in `INSERT INTO trips`.
--   PostgreSQL cannot determine whether trip_id refers to the
--   output parameter or the table column → "column reference is ambiguous".
-- Fix: Qualify with table name → RETURNING trips.trip_id INTO v_trip_id
-- =====================================================

DROP FUNCTION IF EXISTS create_trip_with_details(
    VARCHAR, TEXT, VARCHAR, UUID,
    DATE, DATE, TIMESTAMPTZ,
    SMALLINT,
    VARCHAR, DECIMAL, DECIMAL,
    VARCHAR, DECIMAL, DECIMAL, TIMESTAMPTZ,
    VARCHAR, DECIMAL, DECIMAL, TIMESTAMPTZ,
    VARCHAR, VARCHAR, SMALLINT, INTEGER, TEXT[]
);

CREATE OR REPLACE FUNCTION create_trip_with_details(
    p_title        VARCHAR(200),
    p_description  TEXT,
    p_slug         VARCHAR(100),
    p_owner_id     UUID,
    p_start_date   DATE,
    p_end_date     DATE,
    p_join_by      TIMESTAMPTZ,
    p_max_pax      SMALLINT,
    p_region_name  VARCHAR(200),
    p_region_lat   DECIMAL(10,8),
    p_region_lng   DECIMAL(11,8),
    p_pickup_name     VARCHAR(200),
    p_pickup_lat      DECIMAL(10,8),
    p_pickup_lng      DECIMAL(11,8),
    p_pickup_datetime TIMESTAMPTZ,
    p_dropoff_name     VARCHAR(200),
    p_dropoff_lat      DECIMAL(10,8),
    p_dropoff_lng      DECIMAL(11,8),
    p_dropoff_datetime TIMESTAMPTZ,
    p_gender_pref      VARCHAR(20)  DEFAULT 'any',
    p_cost_sharing     VARCHAR(30)  DEFAULT 'split_evenly',
    p_waiting_time     SMALLINT     DEFAULT 15,
    p_estimated_budget INTEGER      DEFAULT NULL,
    p_tags             TEXT[]       DEFAULT '{}'
)
RETURNS TABLE(
    success  BOOLEAN,
    message  TEXT,
    trip_id  UUID,
    data     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id             UUID;
    v_region_id           UUID;
    v_pickup_location_id  UUID;
    v_dropoff_location_id UUID;
    v_error_message       TEXT;
BEGIN
    -- =====================================================
    -- VALIDATION PHASE
    -- =====================================================

    IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 3 THEN
        RETURN QUERY SELECT FALSE, 'Title must be at least 3 characters long', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_description IS NULL OR LENGTH(TRIM(p_description)) < 10 THEN
        RETURN QUERY SELECT FALSE, 'Description must be at least 10 characters long', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_start_date IS NULL OR p_end_date IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Start date and end date are required', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_end_date < p_start_date THEN
        RETURN QUERY SELECT FALSE, 'End date cannot be before start date', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_start_date < CURRENT_DATE THEN
        RETURN QUERY SELECT FALSE, 'Trip cannot start in the past', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_join_by < NOW() THEN
        RETURN QUERY SELECT FALSE, 'Join deadline cannot be in the past', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_max_pax < 2 OR p_max_pax > 50 THEN
        RETURN QUERY SELECT FALSE, 'Maximum participants must be between 2 and 50', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_region_lat IS NULL OR p_region_lng IS NULL OR
       p_region_lat  < -90  OR p_region_lat  > 90  OR
       p_region_lng  < -180 OR p_region_lng  > 180 THEN
        RETURN QUERY SELECT FALSE, 'Invalid region coordinates', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_pickup_lat IS NULL OR p_pickup_lng IS NULL OR
       p_pickup_lat  < -90  OR p_pickup_lat  > 90  OR
       p_pickup_lng  < -180 OR p_pickup_lng  > 180 THEN
        RETURN QUERY SELECT FALSE, 'Invalid pickup coordinates', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_dropoff_lat IS NULL OR p_dropoff_lng IS NULL OR
       p_dropoff_lat  < -90  OR p_dropoff_lat  > 90  OR
       p_dropoff_lng  < -180 OR p_dropoff_lng  > 180 THEN
        RETURN QUERY SELECT FALSE, 'Invalid dropoff coordinates', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_pickup_datetime::DATE > p_start_date THEN
        RETURN QUERY SELECT FALSE, 'Pickup date must be on or before trip start date', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    IF p_pickup_datetime >= p_dropoff_datetime THEN
        RETURN QUERY SELECT FALSE, 'Dropoff time must be after pickup time', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    -- =====================================================
    -- LOCATION CREATION PHASE
    -- =====================================================

    INSERT INTO locations (name, latitude, longitude, address)
    VALUES (p_region_name, p_region_lat, p_region_lng, p_region_name)
    RETURNING locations.location_id INTO v_region_id;

    IF v_region_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Failed to create region location', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    INSERT INTO locations (name, latitude, longitude, address)
    VALUES (p_pickup_name, p_pickup_lat, p_pickup_lng, p_pickup_name)
    RETURNING locations.location_id INTO v_pickup_location_id;

    IF v_pickup_location_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Failed to create pickup location', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    INSERT INTO locations (name, latitude, longitude, address)
    VALUES (p_dropoff_name, p_dropoff_lat, p_dropoff_lng, p_dropoff_name)
    RETURNING locations.location_id INTO v_dropoff_location_id;

    IF v_dropoff_location_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Failed to create dropoff location', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    -- =====================================================
    -- TRIP CREATION PHASE
    -- =====================================================

    INSERT INTO trips (
        owner_id, title, description, slug,
        is_public, status, created_at, updated_at
    )
    VALUES (
        p_owner_id, p_title, p_description, p_slug,
        FALSE, 'active', NOW(), NOW()
    )
    -- FIX: qualify with table name to avoid ambiguity with RETURNS TABLE output column
    RETURNING trips.trip_id INTO v_trip_id;

    IF v_trip_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Failed to create trip', NULL::UUID, NULL::JSONB;
        RETURN;
    END IF;

    -- =====================================================
    -- TRIP DETAILS CREATION PHASE
    -- =====================================================

    INSERT INTO trip_details (
        trip_id, description, start_date, end_date,
        estimated_budget, max_pax, gender_pref, cost_sharing,
        join_by, join_by_time, region, tags, created_at, updated_at
    )
    VALUES (
        v_trip_id, p_description, p_start_date, p_end_date,
        p_estimated_budget, p_max_pax, p_gender_pref, p_cost_sharing,
        p_join_by, '23:59:59', p_region_name, p_tags, NOW(), NOW()
    );

    -- =====================================================
    -- TRIP VISIBILITY CREATION PHASE
    -- =====================================================

    INSERT INTO trip_visibility (
        trip_id, visibility, max_participants,
        current_participants, is_reusable, created_at, updated_at
    )
    VALUES (
        v_trip_id, 'private', p_max_pax,
        1, FALSE, NOW(), NOW()
    );

    -- =====================================================
    -- TRIP LOCATIONS CREATION PHASE
    -- =====================================================

    INSERT INTO trip_location (
        trip_id, location_id, location_type,
        is_primary, is_mandatory, order_index,
        created_at, updated_at
    )
    VALUES (
        v_trip_id, v_region_id, 'destination',
        TRUE, TRUE, 1,
        NOW(), NOW()
    );

    INSERT INTO trip_location (
        trip_id, location_id, location_type,
        scheduled_start, waiting_time,
        is_primary, is_mandatory, order_index,
        created_at, updated_at
    )
    VALUES (
        v_trip_id, v_pickup_location_id, 'pickup',
        p_pickup_datetime, p_waiting_time,
        FALSE, TRUE, 2,
        NOW(), NOW()
    );

    INSERT INTO trip_location (
        trip_id, location_id, location_type,
        scheduled_end,
        is_primary, is_mandatory, order_index,
        created_at, updated_at
    )
    VALUES (
        v_trip_id, v_dropoff_location_id, 'dropoff',
        p_dropoff_datetime,
        FALSE, TRUE, 3,
        NOW(), NOW()
    );

    -- =====================================================
    -- TRIP MEMBERS CREATION PHASE
    -- =====================================================

    INSERT INTO trip_members (
        trip_id, user_id, role, member_status,
        join_method, joined_at, created_at, updated_at
    )
    VALUES (
        v_trip_id, p_owner_id, 'owner', 'joined',
        'owner', NOW(), NOW(), NOW()
    );

    -- =====================================================
    -- SUCCESS RESPONSE
    -- =====================================================

    RETURN QUERY SELECT
        TRUE,
        'Trip created successfully',
        v_trip_id,
        jsonb_build_object(
            'trip_id',    v_trip_id,
            'title',      p_title,
            'slug',       p_slug,
            'start_date', p_start_date,
            'end_date',   p_end_date
        );

EXCEPTION
    WHEN unique_violation THEN
        v_error_message := SQLERRM;
        IF v_error_message LIKE '%trips_slug_key%' THEN
            RETURN QUERY SELECT FALSE, 'Trip slug already exists. Please choose a different title.', NULL::UUID, NULL::JSONB;
        ELSIF v_error_message LIKE '%trips_title_owner_key%' THEN
            RETURN QUERY SELECT FALSE, 'You already have a trip with this title.', NULL::UUID, NULL::JSONB;
        ELSE
            RETURN QUERY SELECT FALSE, 'Database constraint violation: ' || v_error_message, NULL::UUID, NULL::JSONB;
        END IF;

    WHEN OTHERS THEN
        RETURN QUERY SELECT FALSE, 'Database error: ' || SQLERRM, NULL::UUID, NULL::JSONB;
END;
$$;

GRANT EXECUTE ON FUNCTION create_trip_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION create_trip_with_details TO service_role;

SELECT 'Fixed create_trip_with_details: resolved trip_id ambiguity' AS status;
