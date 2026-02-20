-- =====================================================
-- MIGRATION 021: TRIGGER WITH STEP-BY-STEP LOGGING
-- =====================================================
-- Replaces handle_new_user() with a version that emits
-- RAISE LOG at every step.
--
-- WHERE TO SEE THE LOGS:
--   Supabase Dashboard → Logs → Postgres
--   (NOT the Auth logs — that's a different section)
--   Filter by: "handle_new_user"
--
-- After running this migration, try to register again,
-- then check Postgres logs immediately. You will see
-- exactly which line crashed and the actual error.
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
    RAISE LOG 'handle_new_user [1/7] CALLED: auth_id=%, email=%', NEW.id, NEW.email;

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
    RAISE LOG 'handle_new_user [2/7] metadata: full_name=%, avatar_url=%',
        v_full_name, v_avatar_url;
    -- ─────────────────────────────────────────────────

    -- ── Placeholder username from UUID ────────────────
    v_username := 'user_' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
    RAISE LOG 'handle_new_user [3/7] username=%', v_username;
    -- ─────────────────────────────────────────────────

    -- ── Insert into public.users ──────────────────────
    RAISE LOG 'handle_new_user [4/7] attempting INSERT into public.users';

    BEGIN
        INSERT INTO public.users (auth_id, username, email, full_name, avatar_url)
        VALUES (NEW.id, v_username, NEW.email, v_full_name, v_avatar_url)
        RETURNING user_id INTO v_user_id;

        RAISE LOG 'handle_new_user [4/7] INSERT ok → user_id=%', v_user_id;

    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'handle_new_user [4/7] unique_violation caught, checking which column';

            SELECT user_id INTO v_user_id
              FROM public.users
             WHERE auth_id = NEW.id;

            IF FOUND THEN
                RAISE LOG 'handle_new_user [4/7] auth_id conflict → using existing user_id=%', v_user_id;
            ELSE
                RAISE LOG 'handle_new_user [4/7] email conflict (orphaned row) → reclaiming';

                UPDATE public.users
                   SET auth_id    = NEW.id,
                       username   = v_username,
                       full_name  = COALESCE(v_full_name, full_name),
                       avatar_url = COALESCE(v_avatar_url, avatar_url),
                       updated_at = NOW()
                 WHERE email = NEW.email
                RETURNING user_id INTO v_user_id;

                RAISE LOG 'handle_new_user [4/7] UPDATE result: user_id=%', v_user_id;
            END IF;

        WHEN OTHERS THEN
            -- Log the actual error before re-raising
            RAISE LOG 'handle_new_user [4/7] UNEXPECTED ERROR: SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
            RAISE; -- propagate — will appear in Postgres logs above
    END;
    -- ─────────────────────────────────────────────────

    -- ── Safety check ─────────────────────────────────
    IF v_user_id IS NULL THEN
        RAISE LOG 'handle_new_user [5/7] v_user_id still NULL, doing fallback SELECT';
        SELECT user_id INTO v_user_id FROM public.users WHERE auth_id = NEW.id;
    END IF;

    IF v_user_id IS NULL THEN
        RAISE LOG 'handle_new_user FATAL: could not obtain user_id for auth_id=% email=%', NEW.id, NEW.email;
        RAISE EXCEPTION 'handle_new_user: could not create or recover public.users row — auth_id=%, email=%',
            NEW.id, NEW.email;
    END IF;

    RAISE LOG 'handle_new_user [5/7] user_id confirmed: %', v_user_id;
    -- ─────────────────────────────────────────────────

    -- ── user_information skeleton ─────────────────────
    RAISE LOG 'handle_new_user [6/7] inserting user_information';

    INSERT INTO public.user_information (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'handle_new_user [6/7] user_information done';
    -- ─────────────────────────────────────────────────

    -- ── user_settings skeleton ────────────────────────
    RAISE LOG 'handle_new_user [7/7] inserting user_settings';

    INSERT INTO public.user_settings (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'handle_new_user [7/7] COMPLETE — user_id=%', v_user_id;
    -- ─────────────────────────────────────────────────

    RETURN NEW;

EXCEPTION WHEN OTHERS THEN
    -- Outer catch: something failed outside the INSERT block
    RAISE LOG 'handle_new_user OUTER EXCEPTION: SQLSTATE=%, SQLERRM=%', SQLSTATE, SQLERRM;
    RAISE; -- propagate so signUp() still returns an error (not silently succeed with broken data)
END;
$$;


-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DO $$ BEGIN
    RAISE NOTICE 'MIGRATION 021 applied — trigger now logs every step to Postgres logs';
END $$;
