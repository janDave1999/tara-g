import { supabaseAdmin } from "@/lib/supabase";
import { actions } from "astro:actions";

export async function getTripById(id: string) {
//   astro action
    let { data } = await actions.trip.getTripDetails({ slug: id });
    console.log("data", data);

  return data;
}

export async function getFriendsOfUser(userId: string) {
  const { data } = await supabaseAdmin
    .from("friends")
    .select("friend_id")
    .eq("user_id", userId);

  return data?.map(r => r.friend_id) ?? [];
}

export async function isBlocked(ownerId: string, viewerId: string) {
  const { data } = await supabaseAdmin
    .from("blocks")
    .select("*")
    .eq("blocker_id", ownerId)
    .eq("blocked_id", viewerId)
    .maybeSingle();

  return !!data;
}
