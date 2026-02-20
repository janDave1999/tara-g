-- =====================================================
-- MIGRATION 020: FIX TRIGGER — PROPER EXCEPTION HANDLING
-- =====================================================
-- Migration 019 used ON CONFLICT (auth_id) DO NOTHING,
-- which only guards against auth_id duplicates.
--
-- If public.users already has a row with the same EMAIL
-- (but a different auth_id — an orphaned test account),
-- PostgreSQL raises an unhandled unique_violation exception
-- that propagates out of the trigger and causes Supabase
-- to return "Database error saving new user".
--
-- Fix: wrap the INSERT in a nested BEGIN…EXCEPTION block
-- that catches unique_violation regardless of which column
-- caused it, then selectively repairs the conflict.
--
-- Additionally cleans up any orphaned public.users rows
-- so the test environment starts fresh.
-- =====================================================


-- =====================================================
-- 1. Replace handle_new_user() — exception-safe version
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
    v_user_id    UUID;
BEGIN
    -- ── OAuth metadata ────────────────────────────────
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'),      ''),
        NULL
    );
    v_avatar_url := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'),    ''),
        NULL
    );
    -- ─────────────────────────────────────────────────

    -- ── Placeholder username from UUID ────────────────
    -- "user_<8 hex chars>" e.g. "user_3f7a9c12"
    -- User sets their real username in onboarding Step 1.
    v_username := 'user_' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
    -- ─────────────────────────────────────────────────

    -- ── Insert the core user row (exception-safe) ─────
    --
    -- Nested BEGIN…EXCEPTION catches any unique_violation
    -- regardless of which column (auth_id OR email) caused it.
    --
    --   Case A: Completely new user
    --     → INSERT succeeds, v_user_id set
    --
    --   Case B: auth_id already in public.users
    --     (trigger fired twice, or idempotent re-run)
    --     → unique_violation caught → SELECT by auth_id → found
    --
    --   Case C: email already in public.users with different auth_id
    --     (orphaned row from a deleted test auth account)
    --     → unique_violation caught → SELECT by auth_id → not found
    --     → UPDATE the orphaned row, claim it for the new auth_id
    --
    BEGIN
        INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
        VALUES (NEW.id, v_username, NEW.email, v_full_name, v_avatar_url)
        RETURNING user_id INTO v_user_id;

    EXCEPTION WHEN unique_violation THEN
        -- Find out which conflict we hit
        SELECT user_id INTO v_user_id
          FROM public.users
         WHERE auth_id = NEW.id;

        IF NOT FOUND THEN
            -- Case C: email conflict with a different (orphaned) row
            -- Reclaim the row by pointing it to the new auth account.
            UPDATE public.users
               SET auth_id    = NEW.id,
                   username   = v_username,
                   full_name  = COALESCE(v_full_name, full_name),
                   avatar_url = COALESCE(v_avatar_url, avatar_url),
                   updated_at = NOW()
             WHERE email = NEW.email
            RETURNING user_id INTO v_user_id;
        END IF;
        -- Case B: auth_id was found → v_user_id already set, do nothing else
    END;
    -- ─────────────────────────────────────────────────

    -- ── Final safety net ──────────────────────────────
    IF v_user_id IS NULL THEN
        SELECT user_id INTO v_user_id
          FROM public.users
         WHERE auth_id = NEW.id;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'handle_new_user: could not create or recover public.users row '
            '— auth_id=%, email=%', NEW.id, NEW.email;
    END IF;
    -- ─────────────────────────────────────────────────

    -- ── Skeleton rows for dependent tables ───────────
    INSERT INTO public.user_information (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    -- ─────────────────────────────────────────────────

    RETURN NEW;
END;
$$;


-- =====================================================
-- 2. Re-attach trigger (idempotent)
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =====================================================
-- 3. Delete orphaned public.users rows
--    (rows whose auth_id no longer exists in auth.users)
--    This clears leftover test accounts that were
--    causing the email UNIQUE conflict.
-- =====================================================
DO $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM public.users pu
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = pu.auth_id
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'Deleted % orphaned public.users rows', v_deleted;
END $$;


-- =====================================================
-- 4. Grant
-- =====================================================
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;


-- =====================================================
-- 5. Verify
-- =====================================================
DO $$
DECLARE
    v_trigger_exists  BOOLEAN;
    v_orphan_count    BIGINT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c     ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname   = 'on_auth_user_created'
          AND c.relname  = 'users'
          AND n.nspname  = 'auth'
    ) INTO v_trigger_exists;

    SELECT COUNT(*) INTO v_orphan_count
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = au.id);

    RAISE NOTICE '=== MIGRATION 020 VERIFICATION ===';
    RAISE NOTICE 'on_auth_user_created trigger : %', CASE WHEN v_trigger_exists THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'auth.users with no public.users row: %', v_orphan_count;

    IF v_trigger_exists AND v_orphan_count = 0 THEN
        RAISE NOTICE 'MIGRATION 020 COMPLETE';
    ELSE
        RAISE WARNING 'MIGRATION 020: some checks failed';
    END IF;
END $$;
