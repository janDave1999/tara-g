/**
 * POST /api/project82/sync
 *
 * Scans all completed trips (owned + approved member) for the authenticated
 * user, detects which provinces each stop falls in via point-in-polygon,
 * assigns a visit stage, and upserts into user_province_visits.
 *
 * Rules:
 *  - Manual entries (is_auto_detected = FALSE) are never overwritten
 *  - Auto-detected entries are only upgraded, never downgraded
 *  - Stage: primary stop uses trip duration, others use location_type
 */

import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";
import { findProvince } from "@/lib/project82/geoCache";

// ── Stage helpers ─────────────────────────────────────────────────────────────

const STAGE_RANK: Record<string, number> = {
  pass_through:         0,
  short_stay:           1,
  extended_stay:        2,
  thorough_exploration: 3,
};

function stageForPrimaryStop(durationDays: number): string {
  if (durationDays >= 4) return "thorough_exploration";
  if (durationDays >= 2) return "extended_stay";
  if (durationDays >= 1) return "short_stay";
  return "pass_through";
}

function stageForSecondaryStop(locationType: string): string {
  return locationType === "accommodation" ? "short_stay" : "pass_through";
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function resolveUserId(authId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) console.error("[sync] resolveUserId error for auth_id=", authId, error);
  if (!data?.user_id) console.error("[sync] resolveUserId: no public.users row for auth_id=", authId);
  return data?.user_id ?? null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ locals }) => {
  try {
    const user_id = locals.user_id;
    // 2. Collect all completed trip IDs for this user (owned + approved member)
    const [ownedRes, memberRes] = await Promise.all([
      supabaseAdmin
        .from("trips")
        .select("trip_id")
        .eq("owner_id", user_id)
        .eq("status", "completed"),
      supabaseAdmin
        .from("trip_members")
        .select("trip_id")
        .eq("user_id", user_id)
        .eq("member_status", "joined"),
    ]);

    console.log(`[sync] Found ${ownedRes.data?.length ?? 0} owned completed trips and ${memberRes.data?.length ?? 0} approved member trips for user_id=${user_id}`);
    // De-duplicate trip IDs
    const tripIdSet = new Set<string>();
    for (const row of ownedRes.data ?? []) tripIdSet.add(row.trip_id);

    // For member trips, verify they are completed
    if (memberRes.data && memberRes.data.length > 0) {
      const memberTripIds = memberRes.data.map((r) => r.trip_id);
      const { data: completedMemberTrips } = await supabaseAdmin
        .from("trips")
        .select("trip_id")
        .in("trip_id", memberTripIds)
        .eq("status", "completed");
      for (const row of completedMemberTrips ?? []) tripIdSet.add(row.trip_id);
    }

    const tripIds = [...tripIdSet];
    if (tripIds.length === 0) {
      return json({ added: 0, updated: 0, skipped: 0, tripsScanned: 0, visits: [], message: "No completed trips found." });
    }

    // 3. Fetch trip durations
    const { data: tripDetails } = await supabaseAdmin
      .from("trip_details")
      .select("trip_id, duration_days")
      .in("trip_id", tripIds);

    const durationMap = new Map<string, number>(
      (tripDetails ?? []).map((d) => [d.trip_id, d.duration_days ?? 1])
    );

    // 4. Fetch all trip stops with coordinates (flat query, no nested joins)
    const { data: stops, error: stopsError } = await supabaseAdmin
      .from("trip_location")
      .select("trip_id, location_type, is_primary, location_id")
      .in("trip_id", tripIds);

    if (stopsError) return json({ error: "Failed to fetch trip stops" }, 500);

    const locationIds = [...new Set((stops ?? []).map((s) => s.location_id).filter(Boolean))];

    // 5. Fetch coordinates for all location IDs in one query
    const { data: locations, error: locError } = await supabaseAdmin
      .from("locations")
      .select("location_id, latitude, longitude")
      .in("location_id", locationIds);

    if (locError) return json({ error: "Failed to fetch locations" }, 500);

    const locationMap = new Map(
      (locations ?? []).map((l) => [l.location_id, l])
    );

    // 6. Load existing visits
    const { data: existingVisits } = await supabaseAdmin
      .from("user_province_visits")
      .select("province_key, stage, is_auto_detected")
      .eq("user_id", user_id);

    const manualKeys = new Set(
      (existingVisits ?? []).filter((v) => !v.is_auto_detected).map((v) => v.province_key)
    );
    const autoStageMap = new Map(
      (existingVisits ?? []).filter((v) => v.is_auto_detected).map((v) => [v.province_key, v.stage])
    );

    // 7. Detect provinces from stops
    const detectedMap = new Map<string, { stage: string; tripId: string }>();

    for (const stop of stops ?? []) {
      const loc = locationMap.get(stop.location_id);
      if (!loc?.latitude || !loc?.longitude) continue;

      const provinceKey = findProvince(Number(loc.longitude), Number(loc.latitude));
      if (!provinceKey) continue;

      const durationDays = durationMap.get(stop.trip_id) ?? 1;
      const stage = stop.is_primary
        ? stageForPrimaryStop(durationDays)
        : stageForSecondaryStop(stop.location_type ?? "");

      const current = detectedMap.get(provinceKey);
      if (!current || STAGE_RANK[stage] > STAGE_RANK[current.stage]) {
        detectedMap.set(provinceKey, { stage, tripId: stop.trip_id });
      }
    }

    // 8. Build upsert rows
    const upsertRows: object[] = [];
    let added = 0, updated = 0, skipped = 0;

    for (const [provinceKey, { stage, tripId }] of detectedMap) {
      if (manualKeys.has(provinceKey)) { skipped++; continue; }

      const existingStage = autoStageMap.get(provinceKey);
      if (existingStage !== undefined && STAGE_RANK[existingStage] >= STAGE_RANK[stage]) {
        skipped++;
        continue;
      }

      upsertRows.push({
        user_id:          user_id,
        province_key:     provinceKey,
        stage,
        trip_id:          tripId,
        is_auto_detected: true,
        updated_at:       new Date().toISOString(),
      });

      if (existingStage === undefined) added++;
      else updated++;
    }

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from("user_province_visits")
        .upsert(upsertRows, { onConflict: "user_id,province_key" });
      if (upsertErr) {
        console.error("[sync] upsert error:", JSON.stringify(upsertErr));
        console.error("[sync] upsert rows sample:", JSON.stringify(upsertRows[0]));
        return json({ error: "Failed to save detected visits" }, 500);
      }
    }

    // 9. Return fresh visit list
    const { data: updatedVisits } = await supabaseAdmin
      .from("user_province_visits")
      .select("id, province_key, stage, visit_date, trip_id, notes, is_auto_detected")
      .eq("user_id", user_id);

    return json({ added, updated, skipped, tripsScanned: tripIds.length, visits: updatedVisits ?? [] });

  } catch (err) {
    console.error("[sync] Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

// ── Helper ────────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
