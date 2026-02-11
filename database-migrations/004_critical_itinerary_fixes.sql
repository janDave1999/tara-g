-- =====================================================
-- PHASE 1: CRITICAL ITINERARY FIXES (CLEANED)
-- =====================================================
-- This migration adds core itinerary functionality:
-- 1. Creates missing tables if needed
-- 2. Adds essential RPC functions
-- 3. Implements performance indexes
-- No ALTER or DROP statements - only creates if not exists
-- =====================================================

-- =====================================================
-- 1. CREATE ENUM TYPES (IF NOT EXISTS)
-- =====================================================

-- Create activity type enum for proper classification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type_enum') THEN
        CREATE TYPE activity_type_enum AS ENUM (
            'sightseeing', 
            'dining', 
            'shopping', 
            'entertainment', 
            'sports', 
            'relaxation', 
            'cultural', 
            'adventure', 
            'other'
        );
    END IF;
END $$;

-- =====================================================
-- 2. CREATE STOP_ACTIVITIES TABLE (IF NOT EXISTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS stop_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stop_id UUID NOT NULL REFERENCES trip_location(id) ON DELETE CASCADE,
    activity_type activity_type_enum NOT NULL DEFAULT 'other',
    description TEXT,
    planned_duration_minutes INTEGER CHECK (planned_duration_minutes > 0),
    actual_duration_minutes INTEGER CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0),
    notes TEXT,
    order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(stop_id, order_index)
);

-- =====================================================
-- 3. CREATE CRITICAL RPC FUNCTIONS
-- =====================================================

-- Function to get complete itinerary with nested activities
CREATE OR REPLACE FUNCTION get_complete_itinerary(p_trip_id UUID)
RETURNS TABLE(
    stops JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH ordered_stops AS (
        SELECT 
            tl.id,
            tl.order_index,
            tl.location_type,
            tl.scheduled_start,
            tl.scheduled_end,
            tl.actual_start,
            tl.actual_end,
            tl.notes,
            tl.is_primary,
            tl.is_mandatory,
            tl.waiting_time,
            l.name as location_name,
            l.address,
            l.latitude,
            l.longitude,
            l.geometry,
            -- Distance from previous stop (if geometry available)
            CASE 
                WHEN tl.order_index > 0 AND l_prev.geometry IS NOT NULL THEN
                    ST_Distance(
                        l_prev.geometry::geography,
                        l.geometry::geography
                    ) / 1000
                ELSE 0
            END as distance_from_previous_km
        FROM trip_location tl
        INNER JOIN locations l ON tl.location_id = l.location_id
        LEFT JOIN LATERAL (
            SELECT l2.geometry
            FROM trip_location tl2
            INNER JOIN locations l2 ON tl2.location_id = l2.location_id
            WHERE tl2.trip_id = tl.trip_id 
            AND tl2.order_index = tl.order_index - 1
            LIMIT 1
        ) l_prev ON true
        WHERE tl.trip_id = p_trip_id
        ORDER BY tl.order_index, tl.created_at
    )
    SELECT 
        jsonb_build_object(
            'id', os.id,
            'order_index', os.order_index,
            'location_type', os.location_type,
            'scheduled_start', os.scheduled_start,
            'scheduled_end', os.scheduled_end,
            'actual_start', os.actual_start,
            'actual_end', os.actual_end,
            'notes', os.notes,
            'is_primary', os.is_primary,
            'is_mandatory', os.is_mandatory,
            'waiting_time', os.waiting_time,
            'location_name', os.location_name,
            'address', os.address,
            'latitude', os.latitude,
            'longitude', os.longitude,
            'distance_from_previous_km', os.distance_from_previous_km,
            'activities', COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', sa.id,
                            'stop_id', sa.stop_id,
                            'activity_type', sa.activity_type,
                            'description', sa.description,
                            'planned_duration_minutes', sa.planned_duration_minutes,
                            'actual_duration_minutes', sa.actual_duration_minutes,
                            'notes', sa.notes,
                            'order_index', sa.order_index,
                            'created_at', sa.created_at,
                            'updated_at', sa.updated_at
                        ) ORDER BY sa.order_index
                    )
                    FROM stop_activities sa
                    WHERE sa.stop_id = os.id
                ), '[]'::jsonb
            )
        ) as stops
    FROM ordered_stops os
    ORDER BY os.order_index;
END;
$$;

-- Function to create stop with activities (atomic operation)
CREATE OR REPLACE FUNCTION create_stop_with_activities(
    p_trip_id UUID,
    p_location_id UUID,
    p_location_type location_type_enum DEFAULT 'destination',
    p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
    p_scheduled_end TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_is_mandatory BOOLEAN DEFAULT TRUE,
    p_activities JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stop_id UUID;
    v_order_index INTEGER;
BEGIN
    -- Auto-assign order index
    SELECT COALESCE(MAX(order_index), -1) + 1 INTO v_order_index
    FROM trip_location
    WHERE trip_id = p_trip_id;
    
    -- Validate time sequence
    IF p_scheduled_start IS NOT NULL AND p_scheduled_end IS NOT NULL THEN
        IF p_scheduled_end <= p_scheduled_start THEN
            RAISE EXCEPTION 'scheduled_end must be after scheduled_start';
        END IF;
    END IF;
    
    -- Create stop
    INSERT INTO trip_location (
        trip_id,
        location_id,
        location_type,
        scheduled_start,
        scheduled_end,
        notes,
        is_mandatory,
        order_index,
        created_at,
        updated_at
    ) VALUES (
        p_trip_id,
        p_location_id,
        p_location_type,
        p_scheduled_start,
        p_scheduled_end,
        p_notes,
        p_is_mandatory,
        v_order_index,
        NOW(),
        NOW()
    ) RETURNING id INTO v_stop_id;
    
    -- Create activities if provided
    IF jsonb_array_length(p_activities) > 0 THEN
        INSERT INTO stop_activities (
            stop_id,
            activity_type,
            description,
            planned_duration_minutes,
            order_index,
            created_at,
            updated_at
        )
        SELECT 
            v_stop_id,
            (activity->>'activity_type')::activity_type_enum,
            activity->>'description',
            (activity->>'planned_duration_minutes')::INTEGER,
            (activity->>'order_index')::INTEGER,
            NOW(),
            NOW()
        FROM jsonb_array_elements(p_activities) as activity;
    END IF;
    
    -- Update trip tracking
    UPDATE trips 
    SET last_accessed = NOW(),
        updated_at = NOW()
    WHERE trip_id = p_trip_id;
    
    RETURN v_stop_id;
END;
$$;

-- Function to update stop
CREATE OR REPLACE FUNCTION update_itinerary_stop(
    p_stop_id UUID,
    p_location_type location_type_enum DEFAULT NULL,
    p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
    p_scheduled_end TIMESTAMPTZ DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_is_mandatory BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id UUID;
    v_old_scheduled_start TIMESTAMPTZ;
    v_old_scheduled_end TIMESTAMPTZ;
    v_new_scheduled_start TIMESTAMPTZ;
    v_new_scheduled_end TIMESTAMPTZ;
BEGIN
    -- Get current values and trip_id
    SELECT trip_id, scheduled_start, scheduled_end 
    INTO v_trip_id, v_old_scheduled_start, v_old_scheduled_end
    FROM trip_location
    WHERE id = p_stop_id;
    
    IF v_trip_id IS NULL THEN
        RAISE EXCEPTION 'Stop not found: %', p_stop_id;
    END IF;
    
    -- Determine final values for validation
    v_new_scheduled_start := COALESCE(p_scheduled_start, v_old_scheduled_start);
    v_new_scheduled_end := COALESCE(p_scheduled_end, v_old_scheduled_end);
    
    -- Validate time sequence if both are set
    IF v_new_scheduled_start IS NOT NULL AND v_new_scheduled_end IS NOT NULL THEN
        IF v_new_scheduled_end <= v_new_scheduled_start THEN
            RAISE EXCEPTION 'scheduled_end must be after scheduled_start';
        END IF;
    END IF;
    
    -- Update stop
    UPDATE trip_location SET
        location_type = COALESCE(p_location_type, location_type),
        scheduled_start = COALESCE(p_scheduled_start, scheduled_start),
        scheduled_end = COALESCE(p_scheduled_end, scheduled_end),
        notes = COALESCE(p_notes, notes),
        is_mandatory = COALESCE(p_is_mandatory, is_mandatory),
        updated_at = NOW()
    WHERE id = p_stop_id;
    
    -- Update trip tracking
    UPDATE trips 
    SET last_accessed = NOW(),
        updated_at = NOW()
    WHERE trip_id = v_trip_id;
    
    RETURN TRUE;
END;
$$;

-- Function to delete stop (with reordering)
CREATE OR REPLACE FUNCTION delete_itinerary_stop(
    p_stop_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip_id UUID;
    v_order_index INTEGER;
BEGIN
    -- Get trip info before deletion
    SELECT trip_id, order_index INTO v_trip_id, v_order_index
    FROM trip_location
    WHERE id = p_stop_id;
    
    IF v_trip_id IS NULL THEN
        RAISE EXCEPTION 'Stop not found: %', p_stop_id;
    END IF;
    
    -- Delete stop (activities will cascade due to FK constraint)
    DELETE FROM trip_location
    WHERE id = p_stop_id;
    
    -- Reorder remaining stops to fill the gap
    UPDATE trip_location
    SET order_index = order_index - 1,
        updated_at = NOW()
    WHERE trip_id = v_trip_id
    AND order_index > v_order_index;
    
    -- Update trip tracking
    UPDATE trips 
    SET last_accessed = NOW(),
        updated_at = NOW()
    WHERE trip_id = v_trip_id;
    
    RETURN TRUE;
END;
$$;

-- Function to reorder stops (batch operation)
CREATE OR REPLACE FUNCTION reorder_itinerary_stops(
    p_trip_id UUID,
    p_stop_orders JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order_record JSONB;
    v_stop_id UUID;
    v_new_order INTEGER;
BEGIN
    -- Validate trip exists
    IF NOT EXISTS (SELECT 1 FROM trips WHERE trip_id = p_trip_id) THEN
        RAISE EXCEPTION 'Trip not found: %', p_trip_id;
    END IF;
    
    -- Validate all stops belong to this trip
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_stop_orders) as order_rec
        LEFT JOIN trip_location tl ON (order_rec->>'stop_id')::UUID = tl.id
        WHERE tl.trip_id IS NULL OR (tl.trip_id IS NOT NULL AND tl.trip_id != p_trip_id)
    ) THEN
        RAISE EXCEPTION 'Invalid stop IDs provided for trip: %', p_trip_id;
    END IF;
    
    -- Update all stop orders in a single transaction
    FOR v_order_record IN SELECT * FROM jsonb_array_elements(p_stop_orders) LOOP
        v_stop_id := (v_order_record->>'stop_id')::UUID;
        v_new_order := (v_order_record->>'order_index')::INTEGER;
        
        IF v_new_order < 0 THEN
            RAISE EXCEPTION 'Invalid order index % for stop %', v_new_order, v_stop_id;
        END IF;
        
        UPDATE trip_location
        SET order_index = v_new_order,
            updated_at = NOW()
        WHERE id = v_stop_id;
    END LOOP;
    
    -- Update trip tracking
    UPDATE trips 
    SET last_accessed = NOW(),
        updated_at = NOW()
    WHERE trip_id = p_trip_id;
    
    RETURN TRUE;
END;
$$;

-- =====================================================
-- 4. CREATE ESSENTIAL INDEXES
-- =====================================================

-- Core composite index for itinerary retrieval
CREATE INDEX IF NOT EXISTS idx_trip_location_itinerary_composite 
ON trip_location (trip_id, order_index, location_type, scheduled_start);

-- Index for activity ordering
CREATE INDEX IF NOT EXISTS idx_stop_activities_ordered 
ON stop_activities (stop_id, order_index, activity_type);

-- Time-based index for scheduling queries
CREATE INDEX IF NOT EXISTS idx_trip_location_time_range 
ON trip_location (trip_id, scheduled_start, scheduled_end) 
WHERE scheduled_start IS NOT NULL;

-- Index for stop type filtering
CREATE INDEX IF NOT EXISTS idx_trip_location_type 
ON trip_location (location_type, is_mandatory);

-- Activity type index for filtering
CREATE INDEX IF NOT EXISTS idx_stop_activities_type 
ON stop_activities (activity_type, planned_duration_minutes);

-- Index for stop activities foreign key
CREATE INDEX IF NOT EXISTS idx_stop_activities_stop_id_fk
ON stop_activities (stop_id);

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_complete_itinerary TO authenticated;
GRANT EXECUTE ON FUNCTION create_stop_with_activities TO authenticated;
GRANT EXECUTE ON FUNCTION update_itinerary_stop TO authenticated;
GRANT EXECUTE ON FUNCTION delete_itinerary_stop TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_itinerary_stops TO authenticated;

-- =====================================================
-- 6. VERIFICATION
-- =====================================================

DO $$
DECLARE
    v_function_count INTEGER;
    v_index_count INTEGER;
BEGIN
    -- Verify functions created
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc 
    WHERE proname IN (
        'get_complete_itinerary', 
        'create_stop_with_activities', 
        'update_itinerary_stop', 
        'delete_itinerary_stop', 
        'reorder_itinerary_stops'
    );
    
    -- Verify indexes created
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname IN (
        'idx_trip_location_itinerary_composite',
        'idx_stop_activities_ordered',
        'idx_trip_location_time_range',
        'idx_trip_location_type',
        'idx_stop_activities_type'
    );
    
    -- Report results
    RAISE NOTICE '=== PHASE 1 VERIFICATION RESULTS ===';
    RAISE NOTICE 'RPC Functions Created: %/5', v_function_count;
    RAISE NOTICE 'Indexes Created: %/5', v_index_count;
    
    IF v_function_count = 5 AND v_index_count >= 5 THEN
        RAISE NOTICE 'PHASE 1: CRITICAL ITINERARY FIXES COMPLETED SUCCESSFULLY!';
        RAISE NOTICE 'Stop functionality is now operational';
        RAISE NOTICE 'Performance optimizations in place';
    ELSE
        RAISE WARNING 'Some components may not have been created. Check previous messages.';
    END IF;
END $$;

SELECT '=== MIGRATION COMPLETE ===' as status,
       'Itinerary functions and indexes ready' as message,
       NOW() as completed_at;