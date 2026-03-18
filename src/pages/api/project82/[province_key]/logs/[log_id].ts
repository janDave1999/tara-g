import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_TYPES = [
  "sightseeing", "dining", "shopping", "entertainment",
  "adventure", "cultural", "relaxation", "other",
] as const;

// ── PUT /api/project82/[province_key]/logs/[log_id] ───────────────────────
export const PUT: APIRoute = async ({ locals, params, request }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const logId = params.log_id;
  if (!logId) return json({ error: "log_id required" }, 400);

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
    .update({
      title:         title.trim(),
      description:   description?.trim() || null,
      activity_type,
      location:      location?.trim() || null,
      visited_at:    visited_at || null,
      trip_id:       trip_id || null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", logId)
    .eq("user_id", authId)
    .select()
    .single();

  if (error) return json({ error: "Failed to update log" }, 500);
  if (!log)  return json({ error: "Log not found" }, 404);
  return json({ log });
};

// ── DELETE /api/project82/[province_key]/logs/[log_id] ────────────────────
export const DELETE: APIRoute = async ({ locals, params }) => {
  const authId = locals.user_id;
  if (!authId) return json({ error: "Unauthorized" }, 401);

  const logId = params.log_id;
  if (!logId) return json({ error: "log_id required" }, 400);

  const { error, count } = await supabaseAdmin
    .from("province_travel_logs")
    .delete({ count: "exact" })
    .eq("id", logId)
    .eq("user_id", authId);

  if (error) return json({ error: "Failed to delete log" }, 500);
  if (count === 0) return json({ error: "Log not found" }, 404);
  return json({ success: true });
};

// ── Helper ────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
