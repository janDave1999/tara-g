-- =====================================================
-- 033: Create trip edit RPCs with ownership enforcement
-- =====================================================
-- Provides server-side ownership checks for all trip
-- edit operations to satisfy SR-AUTHZ-001 (IDOR protection).
--
-- Functions created:
--   update_trip_dates        — start/end/join-by dates
--   update_trip_preferences  — gender preference, max pax
--   update_trip_budget       — cost sharing, estimated budget
--   update_trip_description  — title, description, tags
--
-- Pattern: each function verifies trips.owner_id = p_user_id
-- before applying any UPDATE. Returns JSONB success/error.
-- =====================================================

-- ── 1. update_trip_dates ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_trip_dates(UUID, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_trip_dates(
    p_trip_id    UUID,
    p_user_id    UUID,
    p_start_date TEXT,
    p_end_date   TEXT,
    p_joined_by  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can edit dates');
    END IF;

    UPDATE trip_details
    SET
        start_date = p_start_date::DATE,
        end_date   = p_end_date::DATE,
        join_by    = p_joined_by::TIMESTAMPTZ
    WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_dates TO authenticated;


-- ── 2. update_trip_preferences ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_trip_preferences(UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION update_trip_preferences(
    p_trip_id     UUID,
    p_user_id     UUID,
    p_gender_pref TEXT,
    p_max_pax     INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can edit preferences');
    END IF;

    UPDATE trip_details
    SET
        gender_pref = p_gender_pref,
        max_pax     = p_max_pax::SMALLINT
    WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_preferences TO authenticated;


-- ── 3. update_trip_budget ────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_trip_budget(UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION update_trip_budget(
    p_trip_id          UUID,
    p_user_id          UUID,
    p_cost_sharing     TEXT,
    p_estimated_budget INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can edit the budget');
    END IF;

    UPDATE trip_details
    SET
        cost_sharing     = p_cost_sharing,
        estimated_budget = p_estimated_budget
    WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_budget TO authenticated;


-- ── 4. update_trip_description ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS update_trip_description(UUID, UUID, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION update_trip_description(
    p_trip_id     UUID,
    p_user_id     UUID,
    p_title       TEXT,
    p_description TEXT,
    p_tags        TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM trips
    WHERE trip_id = p_trip_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trip not found');
    END IF;

    IF v_owner_id <> p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only the trip owner can edit the description');
    END IF;

    UPDATE trips
    SET
        title       = p_title,
        description = p_description,
        updated_at  = NOW()
    WHERE trip_id = p_trip_id;

    UPDATE trip_details
    SET tags = p_tags
    WHERE trip_id = p_trip_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_trip_description TO authenticated;
