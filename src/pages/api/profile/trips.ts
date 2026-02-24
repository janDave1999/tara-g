import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";
import { PUBLIC_R2_URL } from "astro:env/client";

const VALID_FILTERS = ["all", "owned", "joined"] as const;

export const GET: APIRoute = async ({ locals, url }) => {
  const authId = locals.user_id;
  if (!authId) {
    return json({ error: "Unauthorized" }, 401);
  }

  const filterParam = url.searchParams.get("filter") ?? "all";
  const filter = VALID_FILTERS.includes(filterParam as typeof VALID_FILTERS[number])
    ? filterParam as typeof VALID_FILTERS[number]
    : "all";

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("auth_id", authId)
    .single();

  if (!user) {
    return json({ error: "User not found" }, 404);
  }

  let tripIds: string[] = [];

  if (filter === "owned") {
    const { data: ownedTrips } = await supabaseAdmin
      .from("trips")
      .select("trip_id")
      .eq("owner_id", authId);
    tripIds = (ownedTrips ?? []).map(t => t.trip_id);
  } else if (filter === "joined") {
    const { data: joinedTrips } = await supabaseAdmin
      .from("trip_members")
      .select("trip_id")
      .eq("user_id", user.user_id)
      .eq("member_status", "joined");
    tripIds = (joinedTrips ?? []).map(t => t.trip_id);
  } else {
    const { data: ownedTrips } = await supabaseAdmin
      .from("trips")
      .select("trip_id")
      .eq("owner_id", authId);
    const { data: joinedTrips } = await supabaseAdmin
      .from("trip_members")
      .select("trip_id")
      .eq("user_id", user.user_id)
      .eq("member_status", "joined");
    const ownedIds = (ownedTrips ?? []).map(t => t.trip_id);
    const joinedIds = (joinedTrips ?? []).map(t => t.trip_id);
    tripIds = [...new Set([...ownedIds, ...joinedIds])];
  }

  if (tripIds.length === 0) {
    return json({ trips: [] });
  }

  const { data: trips, error } = await supabaseAdmin
    .from("trips")
    .select("trip_id, title")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[profile/trips] Fetch failed:", error);
    return json({ error: "Failed to fetch trips" }, 500);
  }

  const tripIdList = (trips ?? []).map(t => t.trip_id);

  const [{ data: coverImages }, { data: primaryLocations }] = await Promise.all([
    supabaseAdmin
      .from("trip_images")
      .select("trip_id, image_url")
      .in("trip_id", tripIdList)
      .eq("is_cover", true),
    supabaseAdmin
      .from("trip_locations")
      .select("trip_id, location_id, is_primary")
      .in("trip_id", tripIdList)
      .eq("is_primary", true)
  ]);

  const locationIds = (primaryLocations ?? [])
    .map(l => l.location_id)
    .filter(Boolean);

  const { data: locations } = locationIds.length > 0
    ? await supabaseAdmin
        .from("locations")
        .select("location_id, name, city")
        .in("location_id", locationIds)
    : { data: [] };

  const locationMap = new Map(
    (locations ?? []).map(l => [l.location_id, l])
  );

  const coverMap = new Map(
    (coverImages ?? []).map(c => [c.trip_id, c.image_url])
  );

  const destMap = new Map(
    (primaryLocations ?? []).map(l => {
      const loc = locationMap.get(l.location_id);
      return [l.trip_id, loc?.name ?? loc?.city ?? null];
    })
  );

  const formatted = (trips ?? []).map(t => ({
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
