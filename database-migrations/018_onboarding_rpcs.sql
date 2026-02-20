-- =====================================================
-- MIGRATION 018: ONBOARDING RPC FUNCTIONS
-- =====================================================
-- Creates all RPC functions called by onboarding actions
-- in src/actions/user.ts.
--
-- All functions receive p_user_id = auth.users.id (auth_id)
-- and internally resolve to public.users.user_id.
--
-- Functions:
--   check_username_availability  - real-time username check
--   update_user_profile          - Step 1: profile data
--   set_user_interests           - Step 2: interest categories
--   set_travel_preferences       - Step 3: travel preferences
--   skip_onboarding_step         - mark a step as skipped
--   complete_user_onboarding     - mark all steps done
--   get_onboarding_status        - check completion state
--   get_user_profile_data        - load all profile data
--   get_user_stats               - trip/friend counts
--
-- Schema notes:
--   users.gender constraint: 'male','female','other','prefer_not_to_say'
--     → action sends 'non-binary' → mapped to 'other'
--     → action sends ''           → mapped to NULL
--   user_travel_preferences.pace_preference constraint: 'relaxed','moderate','fast','any'
--     → action sends 'packed'     → mapped to 'fast'
--   nationality is stored in user_information.nationality (column added below)
-- =====================================================


-- =====================================================
-- 0. Schema additions required by onboarding actions
-- =====================================================

-- nationality is a distinct concept from location_country
ALTER TABLE public.user_information
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);


-- =====================================================
-- 1. check_username_availability
--    Called by: onboarding.checkUsername
--    p_exclude_user_id = auth.users.id of the current user
--    (excludes their own username from the uniqueness check)
-- =====================================================
DROP FUNCTION IF EXISTS public.check_username_availability(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.check_username_availability(
    p_username        TEXT,
    p_exclude_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_taken BOOLEAN;
BEGIN
    -- Validate format before hitting the table
    IF LENGTH(TRIM(p_username)) < 3 THEN
        RETURN jsonb_build_object('available', false, 'message', 'Username must be at least 3 characters');
    END IF;

    IF p_username !~ '^[a-zA-Z0-9_]+$' THEN
        RETURN jsonb_build_object('available', false, 'message', 'Username can only contain letters, numbers, and underscores');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.users
         WHERE LOWER(username) = LOWER(p_username)
           AND (p_exclude_user_id IS NULL OR auth_id != p_exclude_user_id)
    ) INTO v_taken;

    IF v_taken THEN
        RETURN jsonb_build_object('available', false, 'message', 'Username is already taken');
    ELSE
        RETURN jsonb_build_object('available', true, 'message', 'Username is available');
    END IF;
END;
$$;


-- =====================================================
-- 2. update_user_profile
--    Called by: onboarding.updateProfile (Step 1)
--    Updates users + user_information, marks step complete
-- =====================================================
DROP FUNCTION IF EXISTS public.update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id         UUID,            -- auth.users.id
    p_username        TEXT DEFAULT NULL,
    p_first_name      TEXT DEFAULT NULL,
    p_last_name       TEXT DEFAULT NULL,
    p_bio             TEXT DEFAULT NULL,
    p_avatar_url      TEXT DEFAULT NULL,
    p_dob             TEXT DEFAULT NULL,   -- ISO date string e.g. '1995-06-15'
    p_nationality     TEXT DEFAULT NULL,
    p_location_city   TEXT DEFAULT NULL,
    p_location_country TEXT DEFAULT NULL,
    p_gender          TEXT DEFAULT NULL,   -- may be 'non-binary' or ''
    p_phone_number    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id    UUID;
    v_full_name  TEXT;
    v_gender     TEXT;
    v_dob        DATE;
BEGIN
    -- Resolve internal user_id from auth_id
    SELECT user_id INTO v_user_id
      FROM public.users
     WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- ── Username update ───────────────────────────────
    IF p_username IS NOT NULL AND TRIM(p_username) != '' THEN
        -- Validate format
        IF LENGTH(TRIM(p_username)) < 3 THEN
            RETURN jsonb_build_object('success', false, 'message', 'Username must be at least 3 characters');
        END IF;
        IF p_username !~ '^[a-zA-Z0-9_]+$' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Username can only contain letters, numbers, and underscores');
        END IF;
        -- Check uniqueness (exclude self)
        IF EXISTS (
            SELECT 1 FROM public.users
             WHERE LOWER(username) = LOWER(p_username)
               AND user_id != v_user_id
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Username is already taken');
        END IF;
    END IF;
    -- ─────────────────────────────────────────────────

    -- ── Gender mapping ────────────────────────────────
    -- DB constraint: 'male','female','other','prefer_not_to_say'
    v_gender := CASE
        WHEN p_gender = 'non-binary' THEN 'other'
        WHEN p_gender = '' OR p_gender IS NULL THEN NULL
        WHEN p_gender IN ('male', 'female', 'other', 'prefer_not_to_say') THEN p_gender
        ELSE NULL
    END;
    -- ─────────────────────────────────────────────────

    -- ── DOB parsing ───────────────────────────────────
    BEGIN
        v_dob := p_dob::DATE;
    EXCEPTION WHEN OTHERS THEN
        v_dob := NULL;
    END;
    -- ─────────────────────────────────────────────────

    -- ── Build full_name from first + last ─────────────
    IF p_first_name IS NOT NULL OR p_last_name IS NOT NULL THEN
        v_full_name := TRIM(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
        IF v_full_name = '' THEN v_full_name := NULL; END IF;
    END IF;
    -- ─────────────────────────────────────────────────

    -- ── Update users table ────────────────────────────
    UPDATE public.users
       SET username   = COALESCE(LOWER(NULLIF(TRIM(p_username), '')), username),
           full_name  = COALESCE(v_full_name, full_name),
           bio        = COALESCE(NULLIF(TRIM(p_bio), ''), bio),
           avatar_url = COALESCE(NULLIF(TRIM(p_avatar_url), ''), avatar_url),
           updated_at = NOW()
     WHERE user_id = v_user_id;
    -- ─────────────────────────────────────────────────

    -- ── Upsert user_information ───────────────────────
    INSERT INTO public.user_information (
        user_id, first_name, last_name, phone_number,
        date_of_birth, gender, nationality,
        location_city, location_country
    )
    VALUES (
        v_user_id,
        NULLIF(TRIM(COALESCE(p_first_name, '')), ''),
        NULLIF(TRIM(COALESCE(p_last_name, '')), ''),
        NULLIF(TRIM(COALESCE(p_phone_number, '')), ''),
        v_dob,
        v_gender,
        NULLIF(TRIM(COALESCE(p_nationality, '')), ''),
        NULLIF(TRIM(COALESCE(p_location_city, '')), ''),
        NULLIF(TRIM(COALESCE(p_location_country, '')), '')
    )
    ON CONFLICT (user_id) DO UPDATE
       SET first_name       = COALESCE(EXCLUDED.first_name,       user_information.first_name),
           last_name        = COALESCE(EXCLUDED.last_name,        user_information.last_name),
           phone_number     = COALESCE(EXCLUDED.phone_number,     user_information.phone_number),
           date_of_birth    = COALESCE(EXCLUDED.date_of_birth,    user_information.date_of_birth),
           gender           = COALESCE(EXCLUDED.gender,           user_information.gender),
           nationality      = COALESCE(EXCLUDED.nationality,      user_information.nationality),
           location_city    = COALESCE(EXCLUDED.location_city,    user_information.location_city),
           location_country = COALESCE(EXCLUDED.location_country, user_information.location_country),
           updated_at       = NOW();
    -- ─────────────────────────────────────────────────

    -- ── Mark profile step complete ────────────────────
    INSERT INTO public.user_onboarding_progress (user_id, step_name, completed, completed_at)
    VALUES (v_user_id, 'profile', true, NOW())
    ON CONFLICT (user_id, step_name) DO UPDATE
       SET completed    = true,
           completed_at = NOW(),
           skipped      = false,
           updated_at   = NOW();
    -- ─────────────────────────────────────────────────

    RETURN jsonb_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;


-- =====================================================
-- 3. set_user_interests
--    Called by: onboarding.setInterests (Step 2)
--    Replaces all interests, marks step complete
-- =====================================================
DROP FUNCTION IF EXISTS public.set_user_interests(UUID, TEXT[]);

CREATE OR REPLACE FUNCTION public.set_user_interests(
    p_user_id   UUID,
    p_interests TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id   UUID;
    v_interest  TEXT;
    v_priority  INT := 1;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    IF array_length(p_interests, 1) IS NULL OR array_length(p_interests, 1) < 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Please select at least 3 interests');
    END IF;

    -- Replace all existing interests
    DELETE FROM public.user_interests WHERE user_id = v_user_id;

    FOREACH v_interest IN ARRAY p_interests LOOP
        INSERT INTO public.user_interests (user_id, interest_category, priority)
        VALUES (v_user_id, v_interest, v_priority)
        ON CONFLICT (user_id, interest_category) DO UPDATE
           SET priority   = EXCLUDED.priority,
               updated_at = NOW();
        v_priority := v_priority + 1;
    END LOOP;

    -- Mark step complete
    INSERT INTO public.user_onboarding_progress (user_id, step_name, completed, completed_at)
    VALUES (v_user_id, 'interests', true, NOW())
    ON CONFLICT (user_id, step_name) DO UPDATE
       SET completed    = true,
           completed_at = NOW(),
           skipped      = false,
           updated_at   = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Interests saved successfully');
END;
$$;


-- =====================================================
-- 4. set_travel_preferences
--    Called by: onboarding.setTravelPreferences (Step 3)
--    Upserts user_travel_preferences, marks step complete
-- =====================================================
DROP FUNCTION IF EXISTS public.set_travel_preferences(UUID, TEXT, TEXT[], TEXT, TEXT[], INT, INT, BOOLEAN, TEXT[], TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION public.set_travel_preferences(
    p_user_id              UUID,
    p_budget_range         TEXT    DEFAULT NULL,
    p_travel_style         TEXT[]  DEFAULT NULL,
    p_pace_preference      TEXT    DEFAULT NULL,  -- may be 'packed' → mapped to 'fast'
    p_accommodation_type   TEXT[]  DEFAULT NULL,
    p_preferred_group_size INT     DEFAULT NULL,
    p_max_group_size       INT     DEFAULT NULL,
    p_willing_to_split_costs BOOLEAN DEFAULT NULL,
    p_languages_spoken     TEXT[]  DEFAULT NULL,
    p_dietary_restrictions TEXT[]  DEFAULT NULL,
    p_accessibility_needs  TEXT[]  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id      UUID;
    v_pace         TEXT;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Map 'packed' → 'fast' (action enum mismatch with DB constraint)
    v_pace := CASE
        WHEN p_pace_preference = 'packed' THEN 'fast'
        WHEN p_pace_preference IN ('relaxed', 'moderate', 'fast', 'any') THEN p_pace_preference
        ELSE NULL
    END;

    INSERT INTO public.user_travel_preferences (
        user_id, budget_range, travel_style, pace_preference,
        accommodation_type, preferred_group_size, max_group_size,
        willing_to_split_costs, languages_spoken, dietary_restrictions,
        accessibility_needs
    )
    VALUES (
        v_user_id,
        p_budget_range,
        COALESCE(p_travel_style, '{}'),
        COALESCE(v_pace, 'moderate'),
        COALESCE(p_accommodation_type, '{}'),
        COALESCE(p_preferred_group_size, 4),
        COALESCE(p_max_group_size, 20),
        COALESCE(p_willing_to_split_costs, true),
        COALESCE(p_languages_spoken, '{}'),
        COALESCE(p_dietary_restrictions, '{}'),
        COALESCE(p_accessibility_needs, '{}')
    )
    ON CONFLICT (user_id) DO UPDATE
       SET budget_range           = COALESCE(EXCLUDED.budget_range,           user_travel_preferences.budget_range),
           travel_style           = COALESCE(NULLIF(EXCLUDED.travel_style, '{}'), user_travel_preferences.travel_style),
           pace_preference        = COALESCE(EXCLUDED.pace_preference,        user_travel_preferences.pace_preference),
           accommodation_type     = COALESCE(NULLIF(EXCLUDED.accommodation_type, '{}'), user_travel_preferences.accommodation_type),
           preferred_group_size   = COALESCE(EXCLUDED.preferred_group_size,   user_travel_preferences.preferred_group_size),
           max_group_size         = COALESCE(EXCLUDED.max_group_size,         user_travel_preferences.max_group_size),
           willing_to_split_costs = COALESCE(EXCLUDED.willing_to_split_costs, user_travel_preferences.willing_to_split_costs),
           languages_spoken       = COALESCE(NULLIF(EXCLUDED.languages_spoken, '{}'), user_travel_preferences.languages_spoken),
           dietary_restrictions   = COALESCE(NULLIF(EXCLUDED.dietary_restrictions, '{}'), user_travel_preferences.dietary_restrictions),
           accessibility_needs    = COALESCE(NULLIF(EXCLUDED.accessibility_needs, '{}'), user_travel_preferences.accessibility_needs),
           updated_at             = NOW();

    -- Mark step complete
    INSERT INTO public.user_onboarding_progress (user_id, step_name, completed, completed_at)
    VALUES (v_user_id, 'preferences', true, NOW())
    ON CONFLICT (user_id, step_name) DO UPDATE
       SET completed    = true,
           completed_at = NOW(),
           skipped      = false,
           updated_at   = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Travel preferences saved successfully');
END;
$$;


-- =====================================================
-- 5. skip_onboarding_step
--    Called by: onboarding.skipOnboardingStep
--    Step names: 'profile', 'interests', 'preferences', 'verification'
-- =====================================================
DROP FUNCTION IF EXISTS public.skip_onboarding_step(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.skip_onboarding_step(
    p_user_id   UUID,
    p_step_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    INSERT INTO public.user_onboarding_progress (user_id, step_name, skipped, completed)
    VALUES (v_user_id, p_step_name, true, false)
    ON CONFLICT (user_id, step_name) DO UPDATE
       SET skipped    = true,
           updated_at = NOW()
     WHERE user_onboarding_progress.completed = false;  -- don't un-complete a finished step

    RETURN jsonb_build_object('success', true, 'message', 'Step skipped');
END;
$$;


-- =====================================================
-- 6. complete_user_onboarding
--    Called by: onboarding.completeOnboarding
--    Marks all three steps as completed
-- =====================================================
DROP FUNCTION IF EXISTS public.complete_user_onboarding(UUID);

CREATE OR REPLACE FUNCTION public.complete_user_onboarding(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Upsert all core steps as completed
    INSERT INTO public.user_onboarding_progress (user_id, step_name, completed, completed_at)
    SELECT v_user_id, step, true, NOW()
      FROM UNNEST(ARRAY['profile', 'interests', 'preferences']) AS step
    ON CONFLICT (user_id, step_name) DO UPDATE
       SET completed    = true,
           completed_at = COALESCE(user_onboarding_progress.completed_at, NOW()),
           updated_at   = NOW();

    RETURN jsonb_build_object('success', true, 'message', 'Onboarding completed');
END;
$$;


-- =====================================================
-- 7. get_onboarding_status
--    Called by: onboarding.getOnboardingStatus
--    Returns step completion state and next step
-- =====================================================
DROP FUNCTION IF EXISTS public.get_onboarding_status(UUID);

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
        RETURN jsonb_build_object('is_complete', false, 'next_step', 'profile',
            'steps', jsonb_build_object(
                'profile',     jsonb_build_object('completed', false, 'skipped', false),
                'interests',   jsonb_build_object('completed', false, 'skipped', false),
                'preferences', jsonb_build_object('completed', false, 'skipped', false)
            ));
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
        'is_complete', v_is_complete,
        'next_step',   v_next_step,
        'steps', jsonb_build_object(
            'profile',     jsonb_build_object('completed', v_profile_done,     'skipped', v_profile_skip),
            'interests',   jsonb_build_object('completed', v_interests_done,   'skipped', v_interests_skip),
            'preferences', jsonb_build_object('completed', v_preferences_done, 'skipped', v_preferences_skip)
        )
    );
END;
$$;


-- =====================================================
-- 8. get_user_profile_data
--    Called by: onboarding.getUserProfileData
--    Returns merged profile, information, preferences, interests
-- =====================================================
DROP FUNCTION IF EXISTS public.get_user_profile_data(UUID);

CREATE OR REPLACE FUNCTION public.get_user_profile_data(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_result  JSONB;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    SELECT jsonb_build_object(
        'profile', jsonb_build_object(
            'user_id',     u.user_id,
            'auth_id',     u.auth_id,
            'username',    u.username,
            'email',       u.email,
            'full_name',   u.full_name,
            'avatar_url',  u.avatar_url,
            'bio',         u.bio,
            'is_verified', u.is_verified,
            'is_private',  u.is_private,
            'created_at',  u.created_at
        ),
        'information', jsonb_build_object(
            'first_name',        ui.first_name,
            'last_name',         ui.last_name,
            'phone_number',      ui.phone_number,
            'date_of_birth',     ui.date_of_birth,
            'gender',            ui.gender,
            'nationality',       ui.nationality,
            'location_city',     ui.location_city,
            'location_country',  ui.location_country,
            'emergency_contact_name',  ui.emergency_contact_name,
            'emergency_contact_phone', ui.emergency_contact_phone,
            'profile_completion_percentage', ui.profile_completion_percentage
        ),
        'preferences', COALESCE((
            SELECT jsonb_build_object(
                'budget_range',           utp.budget_range,
                'travel_style',           utp.travel_style,
                'pace_preference',        utp.pace_preference,
                'accommodation_type',     utp.accommodation_type,
                'preferred_group_size',   utp.preferred_group_size,
                'max_group_size',         utp.max_group_size,
                'willing_to_split_costs', utp.willing_to_split_costs,
                'languages_spoken',       utp.languages_spoken,
                'dietary_restrictions',   utp.dietary_restrictions,
                'accessibility_needs',    utp.accessibility_needs
            )
            FROM public.user_travel_preferences utp
            WHERE utp.user_id = v_user_id
        ), '{}'::JSONB),
        'interests', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'category', ui2.interest_category,
                    'priority', ui2.priority
                ) ORDER BY ui2.priority
            )
            FROM public.user_interests ui2
            WHERE ui2.user_id = v_user_id
        ), '[]'::JSONB),
        'onboarding', (SELECT public.get_onboarding_status(p_user_id))
    ) INTO v_result
    FROM public.users u
    LEFT JOIN public.user_information ui ON ui.user_id = u.user_id
    WHERE u.user_id = v_user_id;

    RETURN v_result;
END;
$$;


-- =====================================================
-- 9. get_user_stats
--    Called by: onboarding.getUserStats
--    Returns trip counts, friend count, member count
-- =====================================================
DROP FUNCTION IF EXISTS public.get_user_stats(UUID);

CREATE OR REPLACE FUNCTION public.get_user_stats(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
      FROM public.users WHERE auth_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User not found');
    END IF;

    RETURN (
        SELECT jsonb_build_object(
            'trips_owned',    COUNT(DISTINCT CASE WHEN t.owner_id = p_user_id THEN t.trip_id END),
            'trips_joined',   COUNT(DISTINCT CASE WHEN tm.user_id = p_user_id AND tm.member_status = 'joined' AND t.owner_id != p_user_id THEN t.trip_id END),
            'trips_active',   COUNT(DISTINCT CASE WHEN t.status = 'active' AND (t.owner_id = p_user_id OR (tm.user_id = p_user_id AND tm.member_status = 'joined')) THEN t.trip_id END),
            'trips_completed',COUNT(DISTINCT CASE WHEN t.status = 'completed' AND (t.owner_id = p_user_id OR (tm.user_id = p_user_id AND tm.member_status = 'joined')) THEN t.trip_id END),
            'friends_count',  (SELECT COUNT(*) FROM public.friends f WHERE f.user_id = v_user_id),
            'profile_completion', (
                SELECT ui.profile_completion_percentage
                  FROM public.user_information ui
                 WHERE ui.user_id = v_user_id
            )
        )
        FROM public.trips t
        LEFT JOIN public.trip_members tm ON tm.trip_id = t.trip_id AND tm.user_id = p_user_id
        WHERE t.owner_id = p_user_id
           OR (tm.user_id = p_user_id AND tm.member_status = 'joined')
    );
END;
$$;


-- =====================================================
-- Grant execute to authenticated role
-- =====================================================
GRANT EXECUTE ON FUNCTION public.check_username_availability(TEXT, UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_interests(UUID, TEXT[])                TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_travel_preferences(UUID, TEXT, TEXT[], TEXT, TEXT[], INT, INT, BOOLEAN, TEXT[], TEXT[], TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_onboarding_step(UUID, TEXT)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_user_onboarding(UUID)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_data(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID)                            TO authenticated;


-- =====================================================
-- Verification
-- =====================================================
DO $$
DECLARE
    v_fn_count INT;
BEGIN
    SELECT COUNT(*) INTO v_fn_count
    FROM pg_proc
    WHERE proname IN (
        'check_username_availability', 'update_user_profile', 'set_user_interests',
        'set_travel_preferences', 'skip_onboarding_step', 'complete_user_onboarding',
        'get_onboarding_status', 'get_user_profile_data', 'get_user_stats'
    ) AND pronamespace = 'public'::regnamespace;

    RAISE NOTICE '=== MIGRATION 018 VERIFICATION ===';
    RAISE NOTICE 'Onboarding RPC functions created: %/9', v_fn_count;

    IF v_fn_count = 9 THEN
        RAISE NOTICE 'MIGRATION 018 COMPLETE: All onboarding RPCs ready';
    ELSE
        RAISE WARNING 'MIGRATION 018: Only %/9 functions found — check for errors above', v_fn_count;
    END IF;
END $$;
