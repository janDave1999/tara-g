-- =====================================================
-- ADD itinerary_public TO trip_visibility
-- =====================================================
-- Allows trip owners to expose the itinerary to
-- non-members (visitors, pending requesters, invited).
-- When false (default), itinerary is shown only to
-- the owner and joined members.
-- =====================================================

ALTER TABLE trip_visibility
  ADD COLUMN IF NOT EXISTS itinerary_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN trip_visibility.itinerary_public IS
  'When true, the trip itinerary is visible to all viewers regardless of membership status.';
