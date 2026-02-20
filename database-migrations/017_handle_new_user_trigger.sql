-- =====================================================
-- MIGRATION 017: HANDLE NEW USER TRIGGER
-- =====================================================
-- Fixes the root cause: when a user signs up via
-- supabase.auth.signUp(), only auth.users is created.
-- public.users (and related rows) are never populated,
-- causing all member/trip/search queries to return null.
--
-- This migration:
--   1. Creates handle_new_user() trigger function
--   2. Attaches it to auth.users AFTER INSERT
--   3. Backfills any existing auth.users that have no
--      corresponding public.users row
--
-- Username generation from email:
--   - Take prefix before '@'
--   - Lowercase, replace invalid chars with '_'
--   - Strip leading non-alphanumeric chars
--   - Append 4-digit suffix on collision (up to 10 tries)
--   - Fallback to UUID prefix if email yields < 3 chars
--
-- OAuth metadata read:
--   - full_name: raw_user_meta_data->>'full_name' or 'name'
--   - avatar_url: raw_user_meta_data->>'avatar_url' or 'picture'
-- =====================================================


-- =====================================================
-- 1. Trigger function: handle_new_user
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username   TEXT;
    v_full_name  TEXT;
    v_avatar_url TEXT;
    v_base       TEXT;
    v_suffix     TEXT;
    v_attempt    INT := 0;
    v_user_id    UUID;
BEGIN
    -- Read OAuth metadata (populated by Google/Facebook sign-in)
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULL
    );
    v_avatar_url := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), ''),
        NULL
    );

    -- ── Generate base username from email prefix ──────────
    -- Step 1: grab the part before '@' and lowercase
    v_base := LOWER(SPLIT_PART(NEW.email, '@', 1));
    -- Step 2: replace anything that isn't a-z, 0-9, or _ with '_'
    v_base := REGEXP_REPLACE(v_base, '[^a-z0-9_]', '_', 'g');
    -- Step 3: strip leading characters that are not a-z or 0-9
    v_base := REGEXP_REPLACE(v_base, '^[^a-z0-9]+', '');
    -- Step 4: cap at 30 characters
    v_base := SUBSTRING(v_base FROM 1 FOR 30);

    -- Step 5: if result is still too short, fall back to UUID prefix
    IF COALESCE(LENGTH(v_base), 0) < 3 THEN
        v_base := LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
    END IF;
    -- ─────────────────────────────────────────────────────

    -- ── Ensure uniqueness with collision handling ─────────
    v_username := v_base;

    WHILE EXISTS (SELECT 1 FROM public.users WHERE username = v_username) LOOP
        v_attempt := v_attempt + 1;
        v_suffix  := TO_CHAR(FLOOR(RANDOM() * 9000 + 1000)::INT, 'FM0000');
        v_username := SUBSTRING(v_base FROM 1 FOR 25) || '_' || v_suffix;

        -- Hard limit: after 10 tries use epoch remainder (deterministic)
        IF v_attempt > 10 THEN
            v_username := SUBSTRING(v_base FROM 1 FOR 20) || '_'
                       || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT % 100000, 'FM00000');
            EXIT;
        END IF;
    END LOOP;
    -- ─────────────────────────────────────────────────────

    -- ── Insert the core user row ──────────────────────────
    INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
    VALUES (NEW.id, v_username, NEW.email, v_full_name, v_avatar_url)
    RETURNING user_id INTO v_user_id;
    -- ─────────────────────────────────────────────────────

    -- ── Insert skeleton rows for dependent tables ─────────
    -- user_information is required for the profile-completion trigger
    INSERT INTO public.user_information (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- user_settings provides defaults (language, theme, timezone, etc.)
    INSERT INTO public.user_settings (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    -- ─────────────────────────────────────────────────────

    RETURN NEW;
END;
$$;


-- =====================================================
-- 2. Attach trigger to auth.users
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =====================================================
-- 3. Backfill: populate public.users for any existing
--    auth.users that have no corresponding row
-- =====================================================
DO $$
DECLARE
    v_rec        RECORD;
    v_username   TEXT;
    v_base       TEXT;
    v_suffix     TEXT;
    v_attempt    INT;
    v_user_id    UUID;
    v_backfilled INT := 0;
BEGIN
    FOR v_rec IN
        SELECT
            au.id,
            au.email,
            COALESCE(
                NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
                NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
                NULL
            ) AS full_name,
            COALESCE(
                NULLIF(TRIM(au.raw_user_meta_data->>'avatar_url'), ''),
                NULLIF(TRIM(au.raw_user_meta_data->>'picture'), ''),
                NULL
            ) AS avatar_url
        FROM auth.users au
        WHERE NOT EXISTS (
            SELECT 1 FROM public.users u WHERE u.auth_id = au.id
        )
    LOOP
        -- Generate base username (same logic as trigger)
        v_base := LOWER(SPLIT_PART(v_rec.email, '@', 1));
        v_base := REGEXP_REPLACE(v_base, '[^a-z0-9_]', '_', 'g');
        v_base := REGEXP_REPLACE(v_base, '^[^a-z0-9]+', '');
        v_base := SUBSTRING(v_base FROM 1 FOR 30);

        IF COALESCE(LENGTH(v_base), 0) < 3 THEN
            v_base := LEFT(REPLACE(v_rec.id::TEXT, '-', ''), 8);
        END IF;

        -- Find unique username
        v_attempt  := 0;
        v_username := v_base;
        WHILE EXISTS (SELECT 1 FROM public.users WHERE username = v_username) LOOP
            v_attempt := v_attempt + 1;
            v_suffix  := TO_CHAR(FLOOR(RANDOM() * 9000 + 1000)::INT, 'FM0000');
            v_username := SUBSTRING(v_base FROM 1 FOR 25) || '_' || v_suffix;
            IF v_attempt > 10 THEN
                v_username := SUBSTRING(v_base FROM 1 FOR 20) || '_'
                           || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT % 100000, 'FM00000');
                EXIT;
            END IF;
        END LOOP;

        -- Insert user row
        INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
        VALUES (v_rec.id, v_username, v_rec.email, v_rec.full_name, v_rec.avatar_url)
        ON CONFLICT (auth_id) DO NOTHING
        RETURNING user_id INTO v_user_id;

        IF v_user_id IS NOT NULL THEN
            -- Insert dependent skeleton rows
            INSERT INTO public.user_information (user_id)
            VALUES (v_user_id)
            ON CONFLICT (user_id) DO NOTHING;

            INSERT INTO public.user_settings (user_id)
            VALUES (v_user_id)
            ON CONFLICT (user_id) DO NOTHING;

            v_backfilled := v_backfilled + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Backfilled % existing auth.users into public.users', v_backfilled;
END $$;


-- =====================================================
-- 4. Grant execute permission
-- =====================================================
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;


-- =====================================================
-- 5. Verification
-- =====================================================
DO $$
DECLARE
    v_trigger_exists  BOOLEAN;
    v_function_exists BOOLEAN;
    v_orphan_count    BIGINT;
BEGIN
    -- Check trigger exists on auth.users
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = 'on_auth_user_created'
          AND c.relname = 'users'
          AND n.nspname = 'auth'
    ) INTO v_trigger_exists;

    -- Check function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'handle_new_user'
          AND pronamespace = 'public'::regnamespace
    ) INTO v_function_exists;

    -- Count remaining auth.users with no public.users row
    SELECT COUNT(*) INTO v_orphan_count
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = au.id);

    RAISE NOTICE '=== MIGRATION 017 VERIFICATION ===';
    RAISE NOTICE 'handle_new_user() function: %', CASE WHEN v_function_exists THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'on_auth_user_created trigger: %', CASE WHEN v_trigger_exists THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'auth.users with no public.users row: %', v_orphan_count;

    IF v_function_exists AND v_trigger_exists AND v_orphan_count = 0 THEN
        RAISE NOTICE 'MIGRATION 017 COMPLETE: All users synced, trigger active';
    ELSE
        RAISE WARNING 'MIGRATION 017: Some checks failed — review above output';
    END IF;
END $$;
