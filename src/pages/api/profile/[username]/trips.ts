import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";
import { PUBLIC_R2_URL } from "astro:env/client";

export const GET: APIRoute = async ({ locals, params }) => {
  const { username } = params;
  if (!username) return json({ error: "Missing username" }, 400);

  const viewerAuthId = locals.user_id;

  // Resolve profile owner
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("user_id, auth_id")
    .eq("username", username)
    .single();

  if (!owner) return json({ error: "User not found" }, 404);

  // Determine if viewer is the owner or a friend (affects trip visibility)
  let isFriendOrOwner = false;
  if (viewerAuthId === owner.auth_id) {
    isFriendOrOwner = true;
  } else if (viewerAuthId) {
    const { data: viewerUser } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("auth_id", viewerAuthId)
      .single();

    if (viewerUser) {
      const { data: friendship } = await supabaseAdmin
        .from("friends")
        .select("user_id")
        .eq("user_id", viewerUser.user_id)
        .eq("friend_id", owner.user_id)
        .maybeSingle();

      isFriendOrOwner = !!friendship;
    }
  }

  // Fetch owned trips.
  // Visibility lives in the trip_visibility table (not a column on trips).
  // Friends/owner see everything; others only see trips marked 'public'.
  const { data: trips, error } = isFriendOrOwner
    ? await supabaseAdmin
        .from("trips")
        .select("trip_id, title, status")
        .eq("owner_id", owner.auth_id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
    : await supabaseAdmin
        .from("trips")
        .select("trip_id, title, status, trip_visibility!inner(visibility)")
        .eq("owner_id", owner.auth_id)
        .neq("status", "draft")
        .eq("trip_visibility.visibility", "public")
        .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/profile/trips] Fetch error:", error);
    return json({ error: "Failed to fetch trips" }, 500);
  }

  if (!trips || trips.length === 0) return json({ trips: [] });

  const tripIds = trips.map((t) => t.trip_id);

  const [{ data: coverImages }, { data: primaryLocations }] = await Promise.all([
    supabaseAdmin
      .from("trip_images")
      .select("trip_id, image_url")
      .in("trip_id", tripIds)
      .eq("is_cover", true),
    supabaseAdmin
      .from("trip_locations")
      .select("trip_id, location_id, is_primary")
      .in("trip_id", tripIds)
      .eq("is_primary", true),
  ]);

  const locationIds = (primaryLocations ?? [])
    .map((l) => l.location_id)
    .filter(Boolean);

  const { data: locations } =
    locationIds.length > 0
      ? await supabaseAdmin
          .from("locations")
          .select("location_id, name, city")
          .in("location_id", locationIds)
      : { data: [] };

  const locationMap = new Map((locations ?? []).map((l) => [l.location_id, l]));
  const coverMap = new Map((coverImages ?? []).map((c) => [c.trip_id, c.image_url]));
  const destMap = new Map(
    (primaryLocations ?? []).map((l) => {
      const loc = locationMap.get(l.location_id);
      return [l.trip_id, loc?.name ?? loc?.city ?? null];
    }),
  );

  const formatted = trips.map((t) => ({
    id: t.trip_id,
    title: t.title,
    cover_image_url: coverMap.get(t.trip_id)
      ? `${PUBLIC_R2_URL}${coverMap.get(t.trip_id)}`
      : null,
    destination: destMap.get(t.trip_id) ?? null,
  }));

  return json({ trips: formatted });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
