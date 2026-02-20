import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

/** Resolve auth_id → public.users.user_id */
async function resolveUserId(authId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .single();
  return data?.user_id ?? null;
}

// ── DELETE /api/project82/[province_key] ──────────────────────────────────
// Removes a province visit for the authenticated user.
export const DELETE: APIRoute = async ({ locals, params }) => {
  const authId = locals.user_id;
  if (!authId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const provinceKey = params.province_key?.toUpperCase();
  if (!provinceKey) {
    return json({ error: "province_key is required" }, 400);
  }

  const userId = await resolveUserId(authId);
  if (!userId) {
    return json({ error: "User not found" }, 404);
  }

  const { error, count } = await supabaseAdmin
    .from("user_province_visits")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("province_key", provinceKey);

  if (error) {
    return json({ error: "Failed to delete visit" }, 500);
  }

  if (count === 0) {
    return json({ error: "Visit not found" }, 404);
  }

  return json({ success: true });
};

// ── Helper ────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
