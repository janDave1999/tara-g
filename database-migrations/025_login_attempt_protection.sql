-- =====================================================
-- MIGRATION 025: LOGIN ATTEMPT PROTECTION
-- =====================================================
-- Tracks failed login attempts to prevent brute force attacks
-- Implements progressive cooldown: 5min/15min/30min
-- =====================================================

-- Create login_attempts table
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address INET,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN DEFAULT FALSE
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_email 
    ON public.login_attempts(email, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip 
    ON public.login_attempts(ip_address, attempted_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON public.login_attempts TO authenticated;
GRANT SELECT, INSERT ON public.login_attempts TO service_role;

-- Function to check login attempt cooldown
-- Returns JSON: { "allowed": boolean, "remaining_seconds": number, "attempts": number }
CREATE OR REPLACE FUNCTION public.check_login_cooldown(
    p_email TEXT,
    p_ip_address INET DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempts_24h INT;
    v_earliest_fail TIMESTAMPTZ;
    v_cooldown_seconds INT := 0;
    v_remaining_seconds INT := 0;
    v_allowed BOOLEAN := true;
BEGIN
    -- Count failed attempts in last 24 hours
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_attempts_24h, v_earliest_fail
    FROM public.login_attempts
    WHERE email = LOWER(p_email)
      AND success = false
      AND attempted_at > NOW() - INTERVAL '24 hours';

    v_attempts_24h := COALESCE(v_attempts_24h, 0);

    -- Apply progressive cooldown
    IF v_attempts_24h >= 7 THEN
        -- 7+ attempts = 30 minutes cooldown
        v_cooldown_seconds := 1800;
    ELSIF v_attempts_24h >= 6 THEN
        -- 6 attempts = 15 minutes cooldown
        v_cooldown_seconds := 900;
    ELSIF v_attempts_24h >= 5 THEN
        -- 5 attempts = 5 minutes cooldown
        v_cooldown_seconds := 300;
    END IF;

    -- Check if still in cooldown period
    IF v_cooldown_seconds > 0 AND v_earliest_fail IS NOT NULL THEN
        v_remaining_seconds := v_cooldown_seconds - EXTRACT(EPOCH FROM (NOW() - v_earliest_fail))::INT;
        
        -- If within cooldown period
        IF v_remaining_seconds > 0 THEN
            v_allowed := false;
        ELSE
            -- Cooldown expired, allow attempt
            v_allowed := true;
            v_remaining_seconds := 0;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining_seconds', v_remaining_seconds,
        'attempts', v_attempts_24h,
        'cooldown_seconds', v_cooldown_seconds
    );
END;
$$;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(
    p_email TEXT,
    p_ip_address INET DEFAULT NULL,
    p_success BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, ip_address, success)
    VALUES (LOWER(p_email), p_ip_address, p_success);

    -- Cleanup old attempts (keep last 30 days)
    DELETE FROM public.login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.check_login_cooldown(TEXT, INET) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, INET, BOOLEAN) TO authenticated;

-- =====================================================
-- Verification
-- =====================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname IN ('check_login_cooldown', 'record_login_attempt')
      AND pronamespace = 'public'::regnamespace;

    RAISE NOTICE '=== MIGRATION 025 VERIFICATION ===';
    RAISE NOTICE 'Login protection functions created: %/2', v_count;

    IF v_count = 2 THEN
        RAISE NOTICE 'MIGRATION 025 COMPLETE: Login attempt protection ready';
    ELSE
        RAISE WARNING 'MIGRATION 025: Only %/2 functions found', v_count;
    END IF;
END $$;
