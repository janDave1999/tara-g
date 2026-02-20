-- =====================================================
-- MIGRATION 023: FIX ONBOARDING STATUS FIELD NAME
-- =====================================================
-- Problem: get_onboarding_status RPC returns 'is_complete' but the frontend
-- (middleware/index.ts) expects 'onboarding_completed'.
-- This caused users to be stuck in onboarding redirect loop.
--
-- Fix: Change 'is_complete' to 'onboarding_completed' in the RPC return.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_status(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id          UUID;
    v_profile_done     BOOLEAN := false;
    v_interests_done   BOOLEAN := false;
    v_preferences_done BOOLEAN := false;
    v_profile_skip     BOOLEAN := false;
    v_interests_skip   BOOLEAN := false;
    v_preferences_skip BOOLEAN := false;
    v_next_step        TEXT;
    v_is_complete      BOOLEAN;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'onboarding_completed', false, 
            'next_step', 'profile',
            'steps', jsonb_build_object(
                'profile',     jsonb_build_object('completed', false, 'skipped', false),
                'interests',   jsonb_build_object('completed', false, 'skipped', false),
                'preferences', jsonb_build_object('completed', false, 'skipped', false)
            )
        );
    END IF;

    -- Read progress rows
    SELECT
        BOOL_OR(CASE WHEN step_name = 'profile'     AND completed THEN true END),
        BOOL_OR(CASE WHEN step_name = 'interests'   AND completed THEN true END),
        BOOL_OR(CASE WHEN step_name = 'preferences' AND completed THEN true END),
        BOOL_OR(CASE WHEN step_name = 'profile'     AND skipped   THEN true END),
        BOOL_OR(CASE WHEN step_name = 'interests'   AND skipped   THEN true END),
        BOOL_OR(CASE WHEN step_name = 'preferences' AND skipped   THEN true END)
    INTO
        v_profile_done, v_interests_done, v_preferences_done,
        v_profile_skip, v_interests_skip, v_preferences_skip
    FROM public.user_onboarding_progress
    WHERE user_id = v_user_id;

    v_profile_done     := COALESCE(v_profile_done, false);
    v_interests_done   := COALESCE(v_interests_done, false);
    v_preferences_done := COALESCE(v_preferences_done, false);
    v_profile_skip     := COALESCE(v_profile_skip, false);
    v_interests_skip   := COALESCE(v_interests_skip, false);
    v_preferences_skip := COALESCE(v_preferences_skip, false);

    -- Determine next incomplete non-skipped step
    v_next_step := CASE
        WHEN NOT v_profile_done     AND NOT v_profile_skip     THEN 'profile'
        WHEN NOT v_interests_done   AND NOT v_interests_skip   THEN 'interests'
        WHEN NOT v_preferences_done AND NOT v_preferences_skip THEN 'preferences'
        ELSE NULL
    END;

    -- Complete when all steps are either done or skipped
    v_is_complete := (v_profile_done OR v_profile_skip)
                 AND (v_interests_done OR v_interests_skip)
                 AND (v_preferences_done OR v_preferences_skip);

    RETURN jsonb_build_object(
        'onboarding_completed', v_is_complete,  -- Changed from 'is_complete'
        'next_step',   v_next_step,
        'steps', jsonb_build_object(
            'profile',     jsonb_build_object('completed', v_profile_done,     'skipped', v_profile_skip),
            'interests',   jsonb_build_object('completed', v_interests_done,   'skipped', v_interests_skip),
            'preferences', jsonb_build_object('completed', v_preferences_done, 'skipped', v_preferences_skip)
        )
    );
END;
$$;

DO $$ BEGIN
    RAISE NOTICE 'MIGRATION 023 applied — fixed onboarding_completed field name';
END $$;
