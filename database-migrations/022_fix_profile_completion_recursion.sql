-- =====================================================
-- MIGRATION 022: FIX INFINITE RECURSION IN PROFILE COMPLETION
-- =====================================================
-- Problem: update_profile_completion() triggers on user_information INSERT,
-- then the function UPDATEs user_information, which triggers itself again.
-- This causes infinite recursion and "stack depth limit exceeded" error.
--
-- Fix: Drop the trigger on user_information. The function will still calculate
-- profile completion based on users and user_travel_preferences tables.
-- =====================================================

-- Drop the problematic trigger that causes infinite recursion
DROP TRIGGER IF EXISTS trigger_user_info_completion ON user_information;

-- The triggers on users and user_travel_preferences are fine - they only
-- READ user_information, they don't write to it.

DO $$ BEGIN
    RAISE NOTICE 'MIGRATION 022 applied — removed recursive trigger on user_information';
END $$;
