-- =====================================================
-- MIGRATION 042: ADD NOTIFICATION TYPES
-- =====================================================
-- Add new notification types to the allowed list
-- =====================================================

-- Drop existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with all types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
    'trip_invite', 
    'friend_request', 
    'friend_accepted', 
    'trip_update',
    'trip_reminder', 
    'payment_due', 
    'trip_comment', 
    'trip_like',
    'trip_nearby', 
    'new_follower', 
    'system_announcement',
    -- New types
    'trip_join_request',
    'trip_join_approved',
    'trip_join_declined',
    'trip_invite_accepted',
    'trip_invite_declined',
    'trip_member_added',
    'trip_member_removed'
));
