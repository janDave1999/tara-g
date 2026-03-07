-- 072_trip_status_notification_system.sql
-- Trip Status Notification System: Add 'on-going' status and notification RPC

-- Step 1: Add 'on-going' status to trip_status enum
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'on-going';

-- Step 2: Create the check and notify function
CREATE OR REPLACE FUNCTION check_trip_status_and_notify()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_record RECORD;
  member_record RECORD;
  notification_id UUID;
BEGIN
  -- Step 1: Notify owner + members about trips starting tomorrow
  FOR trip_record IN
    SELECT t.id, t.title, t.owner_id
    FROM trip_details t
    WHERE t.start_date = CURRENT_DATE + 1
      AND t.status IN ('active', 'planning')
  LOOP
    -- Notify owner
    PERFORM create_notification(
      trip_record.owner_id,
      'trip_tomorrow',
      'Trip starts tomorrow!',
      format('%s starts tomorrow! Get ready for your adventure!', trip_record.title),
      NULL,
      NULL,
      NULL,
      'high',
      format('/trips/%s', trip_record.id)
    );
    
    -- Notify members
    FOR member_record IN
      SELECT tm.user_id FROM trip_members tm WHERE tm.trip_id = trip_record.id
    LOOP
      PERFORM create_notification(
        member_record.user_id,
        'trip_tomorrow',
        'Trip starts tomorrow!',
        format('%s starts tomorrow! Get ready for your adventure!', trip_record.title),
        NULL,
        NULL,
        NULL,
        'high',
        format('/trips/%s', trip_record.id)
      );
    END LOOP;
  END LOOP;

  -- Step 2: Auto-set status to 'on-going' for trips starting today
  UPDATE trip_details
  SET status = 'on-going'
  WHERE start_date = CURRENT_DATE
    AND status IN ('active', 'planning');

  -- Step 3: Notify owner about trips that ended yesterday
  FOR trip_record IN
    SELECT t.id, t.title, t.owner_id
    FROM trip_details t
    WHERE t.end_date = CURRENT_DATE - 1
      AND t.status NOT IN ('completed', 'archived', 'cancelled')
  LOOP
    PERFORM create_notification(
      trip_record.owner_id,
      'trip_needs_status',
      'Update your trip status',
      format('Your trip "%s" has ended. Please update the status.', trip_record.title),
      NULL,
      NULL,
      NULL,
      'high',
      format('/trips/%s', trip_record.id)
    );
  END LOOP;

  -- Step 4: Auto-archive trips ended 2+ days ago
  UPDATE trip_details
  SET status = 'archived'
  WHERE end_date < CURRENT_DATE - 1
    AND status NOT IN ('completed', 'archived', 'cancelled');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_trip_status_and_notify TO authenticated;
