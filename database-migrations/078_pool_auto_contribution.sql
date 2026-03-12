-- 078_pool_auto_contribution.sql
--
-- Auto-create pool_contributions rows when a member joins a trip that has
-- a fixed per-person fee (pool_enabled = true, pool_per_person > 0).
--
-- Two mechanisms:
--   1. Trigger on trip_members — fires when a member's status becomes 'joined'.
--   2. Updated upsert_trip_budget_settings — retroactively creates contributions
--      for all currently joined members when pool settings are saved/changed.

-- ── 1. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_create_pool_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pool_enabled   BOOLEAN;
    v_pool_per_person DECIMAL(12,2);
BEGIN
    -- Only act when member_status is (or becomes) 'joined'
    IF NEW.member_status != 'joined' THEN
        RETURN NEW;
    END IF;

    -- For UPDATE rows, skip if status was already 'joined' (no change)
    IF TG_OP = 'UPDATE' AND OLD.member_status = 'joined' THEN
        RETURN NEW;
    END IF;

    -- Look up pool settings for this trip
    SELECT pool_enabled, pool_per_person
    INTO v_pool_enabled, v_pool_per_person
    FROM trip_budget_settings
    WHERE trip_id = NEW.trip_id;

    -- Auto-create contribution if pool is active with a per-person amount
    IF v_pool_enabled = TRUE
        AND v_pool_per_person IS NOT NULL
        AND v_pool_per_person > 0
    THEN
        INSERT INTO pool_contributions (trip_id, user_id, amount)
        VALUES (NEW.trip_id, NEW.user_id, v_pool_per_person)
        ON CONFLICT (trip_id, user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop old trigger if it exists, then recreate
DROP TRIGGER IF EXISTS trigger_auto_pool_contribution ON trip_members;

CREATE TRIGGER trigger_auto_pool_contribution
    AFTER INSERT OR UPDATE OF member_status ON trip_members
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_pool_contribution();

-- ── 2. Updated upsert_trip_budget_settings ───────────────────────────────────
--
-- Keeps all existing logic and adds a retroactive pass: when pool is enabled
-- with a per-person amount, create contributions for every joined member who
-- does not already have one.

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

    -- Retroactively create contributions for all currently joined members
    -- who do not yet have a contribution row.
    IF p_pool_enabled = TRUE
        AND p_pool_per_person IS NOT NULL
        AND p_pool_per_person > 0
    THEN
        FOR v_member_uid IN
            SELECT user_id FROM trip_members
            WHERE trip_id = p_trip_id AND member_status = 'joined'
        LOOP
            INSERT INTO pool_contributions (trip_id, user_id, amount)
            VALUES (p_trip_id, v_member_uid, p_pool_per_person)
            ON CONFLICT (trip_id, user_id) DO NOTHING;
        END LOOP;
    END IF;

    RETURN v_settings_id;
END;
$$;
