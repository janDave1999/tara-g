import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_TYPES = [
  "sightseeing", "dining", "shopping", "entertainment",
  "adventure", "cultural", "relaxation", "other",
] as const;

// ── GET /api/project82/[province_key]/logs ────────────────────────────────
export const GET: APIRoute = async ({ locals, params }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const provinceKey = params.province_key?.toUpperCase();
  if (!provinceKey) return json({ error: "province_key required" }, 400);

  const { data: logs, error } = await supabaseAdmin
    .from("province_travel_logs")
    .select("id, title, description, activity_type, location, visited_at, trip_id, created_at, updated_at")
    .eq("user_id", authId)
    .eq("province_key", provinceKey)
    .order("visited_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return json({ error: "Failed to fetch logs" }, 500);
  return json({ logs: logs ?? [] });
};

// ── POST /api/project82/[province_key]/logs ───────────────────────────────
export const POST: APIRoute = async ({ locals, params, request }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const provinceKey = params.province_key?.toUpperCase();
  if (!provinceKey) return json({ error: "province_key required" }, 400);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { title, description, activity_type, location, visited_at, trip_id } = body as {
    title?: string;
    description?: string;
    activity_type?: string;
    location?: string;
    visited_at?: string;
    trip_id?: string;
  };

  if (!title || title.trim().length === 0)
    return json({ error: "title is required" }, 400);
  if (title.trim().length > 200)
    return json({ error: "title max 200 chars" }, 400);
  if (!activity_type || !VALID_TYPES.includes(activity_type as any))
    return json({ error: `activity_type must be one of: ${VALID_TYPES.join(", ")}` }, 400);

  const { data: log, error } = await supabaseAdmin
    .from("province_travel_logs")
    .insert({
      user_id:       authId,
      province_key:  provinceKey,
      title:         title.trim(),
      description:   description?.trim() || null,
      activity_type,
      location:      location?.trim() || null,
      visited_at:    visited_at || null,
      trip_id:       trip_id || null,
    })
    .select()
    .single();

  if (error) return json({ error: "Failed to create log" }, 500);
  return json({ log }, 201);
};

// ── Helper ────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
