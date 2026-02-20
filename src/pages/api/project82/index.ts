import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_STAGES = ["pass_through", "short_stay", "extended_stay", "thorough_exploration"];

/** Resolve auth_id → public.users.user_id */
async function resolveUserId(authId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .single();
  return data?.user_id ?? null;
}

// ── GET /api/project82 ────────────────────────────────────────────────────
// Returns the authenticated user's province visits.
// Optional query param: ?user_id=<auth_id>  (respects is_profile_public)
export const GET: APIRoute = async ({ locals, url }) => {
  const authId = locals.user_id;
  const targetAuthId = url.searchParams.get("user_id") ?? authId;

  if (!targetAuthId) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Resolve to internal user_id
  const userId = await resolveUserId(targetAuthId);
  if (!userId) {
    return json({ error: "User not found" }, 404);
  }

  // Privacy check when viewing another user
  if (targetAuthId !== authId) {
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("is_profile_public")
      .eq("user_id", userId)
      .single();

    if (!profile?.is_profile_public) {
      return json({ error: "This profile is private" }, 403);
    }
  }

  const { data: visits, error } = await supabaseAdmin
    .from("user_province_visits")
    .select("id, province_key, stage, visit_date, trip_id, notes, is_auto_detected, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

    console.log(visits);
    console.log(error);
  if (error) {
    return json({ error: "Failed to fetch visits" }, 500);
  }

  return json({ visits: visits ?? [] });
};

// ── POST /api/project82 ───────────────────────────────────────────────────
// Upserts a province visit for the authenticated user.
// Body: { province_key, stage, visit_date?, notes? }
export const POST: APIRoute = async ({ locals, request }) => {
  const authId = locals.user_id;
  if (!authId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = await resolveUserId(authId);
  if (!userId) {
    return json({ error: "User not found" }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { province_key, stage, visit_date, notes } = body as {
    province_key?: string;
    stage?: string;
    visit_date?: string;
    notes?: string;
  };

  if (!province_key || typeof province_key !== "string" || province_key.trim() === "") {
    return json({ error: "province_key is required" }, 400);
  }
  if (!stage || !VALID_STAGES.includes(stage)) {
    return json({ error: `stage must be one of: ${VALID_STAGES.join(", ")}` }, 400);
  }

  const record = {
    user_id: userId,
    province_key: province_key.trim().toUpperCase(),
    stage,
    visit_date: visit_date || null,
    notes: notes || null,
    is_auto_detected: false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("user_province_visits")
    .upsert(record, { onConflict: "user_id,province_key" })
    .select()
    .single();

  if (error) {
    return json({ error: "Failed to save visit" }, 500);
  }

  return json({ visit: data }, 201);
};

// ── Helper ────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
