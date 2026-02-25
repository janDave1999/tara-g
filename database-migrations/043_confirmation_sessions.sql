-- =====================================================
-- MIGRATION 043: CONFIRMATION SESSIONS FOR AUTO SIGN-IN
-- =====================================================
-- Add table to track pending email confirmations
-- Enables WebSocket-based auto sign-in after email confirmation
-- =====================================================

-- Create confirmation_sessions table
CREATE TABLE IF NOT EXISTS confirmation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_confirmation_sessions_token 
ON confirmation_sessions(session_token);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_confirmation_sessions_user_id 
ON confirmation_sessions(user_id);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_confirmation_sessions_expires_at 
ON confirmation_sessions(expires_at) WHERE used_at IS NULL;

-- Function to create confirmation session
CREATE OR REPLACE FUNCTION create_confirmation_session(
    p_user_id UUID,
    p_email TEXT,
    p_token TEXT,
    p_expires_minutes INT DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Clean up expired sessions first
    DELETE FROM confirmation_sessions 
    WHERE expires_at < NOW();

    -- Insert new session
    INSERT INTO confirmation_sessions (
        user_id,
        session_token,
        email,
        expires_at
    ) VALUES (
        p_user_id,
        p_token,
        p_email,
        NOW() + (p_expires_minutes || ' minutes')::INTERVAL
    )
    RETURNING id INTO v_session_id;

    RETURN v_session_id;
END;
$$;

-- Function to confirm and get tokens
CREATE OR REPLACE FUNCTION confirm_session(
    p_token TEXT,
    OUT success BOOLEAN,
    OUT user_id UUID,
    OUT email TEXT,
    OUT message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session confirmation_sessions%ROWTYPE;
BEGIN
    -- Find valid session
    SELECT * INTO v_session
    FROM confirmation_sessions
    WHERE session_token = p_token
      AND used_at IS NULL
      AND expires_at > NOW();

    IF NOT FOUND THEN
        success := FALSE;
        user_id := NULL;
        email := NULL;
        message := 'Invalid or expired confirmation token';
        RETURN;
    END IF;

    -- Mark as used
    UPDATE confirmation_sessions
    SET used_at = NOW()
    WHERE id = v_session.id;

    -- Update user email_confirm
    UPDATE users
    SET email_confirm = TRUE,
        email_confirmed_at = NOW()
    WHERE id = v_session.user_id;

    success := TRUE;
    user_id := v_session.user_id;
    email := v_session.email;
    message := 'Email confirmed successfully';
END;
$$;

-- Function to cleanup expired sessions (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_confirmation_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM confirmation_sessions 
    WHERE expires_at < NOW()
    RETURNING 1 INTO v_deleted;

    RETURN COALESCE(v_deleted, 0);
END;
$$;
