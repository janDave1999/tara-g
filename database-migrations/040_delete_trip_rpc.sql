-- =====================================================
-- MIGRATION 040: DELETE TRIP RPC
-- =====================================================
-- Implements: Delete trip functionality for trip owners
--
-- This function allows trip owners to permanently delete their trip.
-- Due to ON DELETE CASCADE on most tables, the following will be
-- automatically deleted:
--   - trip_details
--   - trip_location
--   - trip_visibility
--   - trip_members
--   - trip_images
--   - trip_tags
--   - trip_tag_relations
--   - trip_invitations
--   - trip_expenses
--   - trip_social
--   - trip_suggestions
--   - trip_pools
--   - trip_pool_members
--   - messages (via trip_id)
--   - project_82_entries (via trip_id SET NULL)
--
-- Function: delete_trip
-- =====================================================

DROP FUNCTION IF EXISTS delete_trip(UUID, UUID);

CREATE OR REPLACE FUNCTION public.delete_trip(
    p_trip_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_deleted_count INTEGER;
BEGIN
    -- Verify trip exists and user is owner
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Trip not found');
    END IF;

    -- Check ownership
    IF v_owner_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Only the trip owner can delete this trip');
    END IF;

    -- Delete the trip (cascades to all related tables)
    DELETE FROM trips WHERE trip_id = p_trip_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_deleted_count > 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Trip deleted successfully'
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Failed to delete trip'
        );
    END IF;
END;
$$;
