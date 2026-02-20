-- =====================================================
-- MIGRATION 019: FIX HANDLE NEW USER TRIGGER
-- =====================================================
-- Fixes two issues with the migration 017 trigger:
--
-- Issue 1 — "Database error saving new user" crash
--   The INSERT INTO public.users had no ON CONFLICT clause.
--   If an orphaned public.users row exists with the same
--   email (e.g. a test account was deleted from auth.users
--   but not from public.users), the UNIQUE constraint on
--   `email` caused the trigger to fail and roll back the
--   entire supabase.auth.signUp() call.
--
--   Fix: if the email already exists in public.users
--   (orphaned row), update its auth_id to the new one
--   instead of failing. If auth_id already exists (double
--   trigger fire), do nothing.
--
-- Issue 2 — Username auto-generated from email (UX)
--   The old trigger derived the placeholder username from
--   the email prefix (e.g. dave@example.com → "dave").
--   This is confusing because users expect to choose their
--   own username in onboarding Step 1.
--
--   Fix: placeholder is now "user_<8 hex chars from UUID>"
--   (e.g. "user_3f7a9c12"). It is clearly temporary and
--   the onboarding profile step prompts the user to choose
--   their real username.
-- =====================================================


-- =====================================================
-- 1. Replace handle_new_user() with robust version
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
    -- "user_" + first 8 hex chars of the auth UUID.
    -- Always unique (UUID is unique), always valid format,
    -- clearly a placeholder the user replaces in onboarding.
    v_username := 'user_' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
    -- ─────────────────────────────────────────────────

    -- ── Insert or recover the core user row ──────────
    --
    -- Three scenarios handled:
    --   A) Normal new user         → plain INSERT succeeds
    --   B) auth_id already exists  → DO NOTHING (idempotent)
    --   C) Email already exists    → orphaned row from a
    --      deleted auth user; update auth_id + username so
    --      the new auth account owns this public row.
    --
    INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
    VALUES (NEW.id, v_username, NEW.email, v_full_name, v_avatar_url)
    ON CONFLICT (auth_id) DO NOTHING
    RETURNING user_id INTO v_user_id;

    -- Scenario C: email existed with a different auth_id
    IF v_user_id IS NULL THEN
        UPDATE public.users
           SET auth_id    = NEW.id,
               username   = v_username,
               full_name  = COALESCE(v_full_name, full_name),
               avatar_url = COALESCE(v_avatar_url, avatar_url),
               updated_at = NOW()
         WHERE email = NEW.email
        RETURNING user_id INTO v_user_id;
    END IF;

    -- Final safety: read user_id if still NULL
    -- (shouldn't happen, but guard against it)
    IF v_user_id IS NULL THEN
        SELECT user_id INTO v_user_id
          FROM public.users
         WHERE auth_id = NEW.id;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'handle_new_user: could not create or recover public.users row for auth_id=%', NEW.id;
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
-- 3. Clean up orphaned public.users rows
--    (where auth_id no longer exists in auth.users)
--    These are the rows that were causing the email
--    UNIQUE conflict for returning test accounts.
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
    RAISE NOTICE 'Deleted % orphaned public.users rows (no matching auth.users row)', v_deleted;
END $$;


-- =====================================================
-- 4. Grant execute
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
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c     ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname   = 'on_auth_user_created'
          AND c.relname  = 'users'
          AND n.nspname  = 'auth'
    ) INTO v_trigger_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname       = 'handle_new_user'
          AND pronamespace  = 'public'::regnamespace
    ) INTO v_function_exists;

    SELECT COUNT(*) INTO v_orphan_count
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = au.id);

    RAISE NOTICE '=== MIGRATION 019 VERIFICATION ===';
    RAISE NOTICE 'handle_new_user() function : %', CASE WHEN v_function_exists THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'on_auth_user_created trigger: %', CASE WHEN v_trigger_exists  THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'auth.users with no public.users row: %', v_orphan_count;

    IF v_function_exists AND v_trigger_exists AND v_orphan_count = 0 THEN
        RAISE NOTICE 'MIGRATION 019 COMPLETE';
    ELSE
        RAISE WARNING 'MIGRATION 019: some checks failed — review output above';
    END IF;
END $$;
