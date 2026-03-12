-- 081_owner_exclusion_and_ui_fixes.sql
--
-- 1. Update auto_create_pool_contribution trigger:
--    Skip creating a contribution for the trip owner when cost_sharing_method = 'event_fee'.
--    (Budget pool: owner IS included — they contribute too.)
--
-- 2. Update upsert_trip_budget_settings retroactive loop:
--    Same rule — skip owner for event_fee only.
--
-- 3. Delete any existing owner contribution rows for event_fee trips (cleanup).

-- ── 1. Updated trigger function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_create_pool_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pool_enabled    BOOLEAN;
    v_pool_per_person DECIMAL(12,2);
    v_cost_sharing    TEXT;
    v_member_role     TEXT;
BEGIN
    IF NEW.member_status != 'joined' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.member_status = 'joined' THEN
        RETURN NEW;
    END IF;

    SELECT pool_enabled, pool_per_person, cost_sharing_method::TEXT
    INTO v_pool_enabled, v_pool_per_person, v_cost_sharing
    FROM trip_budget_settings
    WHERE trip_id = NEW.trip_id;

    IF v_pool_enabled = TRUE
        AND v_pool_per_person IS NOT NULL
        AND v_pool_per_person > 0
    THEN
        -- For event_fee: skip the trip owner (they collect, not pay)
        IF v_cost_sharing = 'event_fee' AND NEW.role = 'owner' THEN
            RETURN NEW;
        END IF;

        INSERT INTO pool_contributions (trip_id, user_id, amount)
        VALUES (NEW.trip_id, NEW.user_id, v_pool_per_person)
        ON CONFLICT (trip_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_pool_contribution ON trip_members;
CREATE TRIGGER trigger_auto_pool_contribution
    AFTER INSERT OR UPDATE OF member_status ON trip_members
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_pool_contribution();

-- ── 2. Updated upsert_trip_budget_settings ────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_trip_budget_settings(
    p_trip_id             UUID,
    p_cost_sharing_method TEXT            DEFAULT 'split_evenly',
    p_budget_estimate     DECIMAL(12,2)   DEFAULT NULL,
    p_pool_enabled        BOOLEAN         DEFAULT FALSE,
    p_pool_per_person     DECIMAL(12,2)   DEFAULT NULL,
    p_allow_members_to_log BOOLEAN        DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings_id UUID;
    v_member_uid  UUID;
    v_member_role TEXT;
BEGIN
    INSERT INTO trip_budget_settings (
        trip_id, cost_sharing_method, budget_estimate,
        pool_enabled, pool_per_person, allow_members_to_log
    ) VALUES (
        p_trip_id, p_cost_sharing_method::cost_sharing_method, p_budget_estimate,
        p_pool_enabled, p_pool_per_person, p_allow_members_to_log
    )
    ON CONFLICT (trip_id) DO UPDATE SET
        cost_sharing_method  = EXCLUDED.cost_sharing_method,
        budget_estimate      = EXCLUDED.budget_estimate,
        pool_enabled         = EXCLUDED.pool_enabled,
        pool_per_person      = EXCLUDED.pool_per_person,
        allow_members_to_log = EXCLUDED.allow_members_to_log,
        updated_at           = NOW()
    RETURNING id INTO v_settings_id;

    IF p_pool_enabled = TRUE
        AND p_pool_per_person IS NOT NULL
        AND p_pool_per_person > 0
    THEN
        FOR v_member_uid, v_member_role IN
            SELECT user_id, role FROM trip_members
            WHERE trip_id = p_trip_id AND member_status = 'joined'
        LOOP
            -- event_fee: skip owner; budget_pool: include everyone
            IF p_cost_sharing_method = 'event_fee' AND v_member_role = 'owner' THEN
                CONTINUE;
            END IF;

            INSERT INTO pool_contributions (trip_id, user_id, amount)
            VALUES (p_trip_id, v_member_uid, p_pool_per_person)
            ON CONFLICT (trip_id, user_id) DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_settings_id;
END;
$$;

-- ── 3. Clean up existing owner contribution rows for event_fee trips ──────────

DELETE FROM pool_contributions pc
WHERE EXISTS (
    SELECT 1 FROM trip_budget_settings tbs
    WHERE tbs.trip_id = pc.trip_id
      AND tbs.cost_sharing_method = 'event_fee'
)
AND EXISTS (
    SELECT 1 FROM trip_members tm
    WHERE tm.trip_id = pc.trip_id
      AND tm.user_id = pc.user_id
      AND tm.role = 'owner'
);
