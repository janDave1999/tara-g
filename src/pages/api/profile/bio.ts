import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

export const PATCH: APIRoute = async ({ locals, request }) => {
  const authId = locals.user_id;
  if (!authId) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { bio } = body as { bio?: unknown };
  
  if (bio !== undefined && typeof bio !== "string") {
    return json({ error: "bio must be a string" }, 400);
  }

  const trimmedBio = bio?.trim() ?? "";

  if (trimmedBio.length > 280) {
    return json({ error: "Bio must be 280 characters or less" }, 400);
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .single();

  if (!user) {
    return json({ error: "User not found" }, 404);
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ 
      bio: trimmedBio || null,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", user.user_id);

  if (error) {
    console.error("[profile/bio] Update failed:", error);
    return json({ error: "Failed to save bio" }, 500);
  }

  return json({ success: true, bio: trimmedBio });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
