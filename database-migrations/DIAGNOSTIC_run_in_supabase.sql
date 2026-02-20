-- =====================================================
-- DIAGNOSTIC — Run this in Supabase SQL Editor
-- Copy + paste the entire file, then run it.
-- Share the output so we can see what's failing.
-- =====================================================

-- 1. Does the trigger exist on auth.users?
SELECT
    t.tgname   AS trigger_name,
    n.nspname  AS table_schema,
    c.relname  AS table_name,
    p.proname  AS function_name
FROM pg_trigger t
JOIN pg_class c     ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p      ON p.oid = t.tgfoid
WHERE t.tgname = 'on_auth_user_created';


-- 2. Which version of the function body is live?
--    (Shows the first 300 chars — enough to spot if it's 017/019/020)
SELECT
    LEFT(prosrc, 300) AS function_body_preview
FROM pg_proc
WHERE proname       = 'handle_new_user'
  AND pronamespace  = 'public'::regnamespace;


-- 3. Check tables exist and counts
SELECT
    (SELECT COUNT(*) FROM public.users)                                          AS public_users_total,
    (SELECT COUNT(*) FROM public.user_information)                               AS user_information_total,
    (SELECT COUNT(*) FROM public.user_settings)                                  AS user_settings_total,
    (SELECT COUNT(*) FROM public.users pu
       WHERE NOT EXISTS (
           SELECT 1 FROM auth.users au WHERE au.id = pu.auth_id
       ))                                                                         AS orphaned_users;


-- 4. Check constraints on public.users
SELECT
    conname        AS constraint_name,
    contype        AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY contype;


-- 5. Test bare INSERT (simulates what the trigger does)
--    This will either succeed (then constraints are fine)
--    or fail with the ACTUAL error message.
DO $$
DECLARE
    v_test_auth_id UUID := gen_random_uuid();
    v_test_email   TEXT := 'trigger_diag_' || extract(epoch from now())::bigint || '@test.internal';
    v_user_id      UUID;
BEGIN
    RAISE NOTICE 'Diagnostic: testing bare INSERT into public.users';
    RAISE NOTICE '  auth_id = %', v_test_auth_id;
    RAISE NOTICE '  username = %', 'user_' || LEFT(REPLACE(v_test_auth_id::TEXT, '-', ''), 8);
    RAISE NOTICE '  email = %', v_test_email;

    INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
    VALUES (
        v_test_auth_id,
        'user_' || LEFT(REPLACE(v_test_auth_id::TEXT, '-', ''), 8),
        v_test_email,
        NULL,
        NULL
    )
    RETURNING user_id INTO v_user_id;

    RAISE NOTICE 'Diagnostic: INSERT succeeded → user_id = %', v_user_id;

    -- Clean up
    DELETE FROM public.users WHERE user_id = v_user_id;
    RAISE NOTICE 'Diagnostic: cleanup done — constraints are OK';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Diagnostic: INSERT FAILED → SQLSTATE=% MESSAGE=%', SQLSTATE, SQLERRM;
    RAISE NOTICE 'This is the actual reason the trigger crashes.';
END $$;
