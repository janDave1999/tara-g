-- Migration: Add confirmation token columns to users table
-- Date: 2026-02-23

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS confirmation_token TEXT,
ADD COLUMN IF NOT EXISTS confirmation_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_confirmation_token 
ON users(confirmation_token) 
WHERE confirmation_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_confirmation 
ON users(email, confirmation_token);
