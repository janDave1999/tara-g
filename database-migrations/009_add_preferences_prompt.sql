-- =====================================================
-- ADD PREFERENCES PROMPT SETTINGS
-- =====================================================
-- Add preferences_prompt_until to user_settings
-- This field controls when to re-prompt users to set travel preferences
-- =====================================================

-- Add preferences_prompt_until to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS preferences_prompt_until TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_settings_preferences_prompt 
ON user_settings(user_id) 
WHERE preferences_prompt_until IS NOT NULL;

SELECT 'Migration completed: Added preferences_prompt_until to user_settings' as status;
