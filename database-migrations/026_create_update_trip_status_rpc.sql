-- =====================================================
-- 026: Create update_trip_status RPC
-- =====================================================
-- Allows a trip owner to update the status of their trip.
-- Validates ownership before applying the change.
-- =====================================================

DROP FUNCTION IF EXISTS update_trip_status(UUID, UUID, trip_status);

CREATE OR REPLACE FUNCTION update_trip_status(
    p_trip_id   UUID,
    p_user_id   UUID,
    p_new_status trip_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    -- Verify ownership
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can change the status');
    END IF;

    -- Apply the status change
    UPDATE trips
    SET status = p_new_status
    WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true, 'status', p_new_status::TEXT);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_status TO authenticated;
