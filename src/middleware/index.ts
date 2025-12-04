import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import micromatch from "micromatch";
import { isBlocked, getFriendsOfUser } from "@/scripts/trip/Visibility";
import { getTripDetails } from "@/scripts/trip/details";
import type { TripDetailsRES } from "@/actions/trips";

const protectedRoutes = ["/dashboard/**", "/feeds/**", "/trips/**", "/trips/create"];
const redirectRoutes = ["/signin(|/)", "/register(|/)", "/"];
const proptectedAPIRoutes = ["/api/trips/**", "/api/feeds/**"];

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    // ✨ Always try to resolve logged-in user (even on public routes)
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
      });

      if (!error) {
        const { data: userData } = await supabase.auth.getUser(
          data?.session?.access_token
        );

        locals.user_id = userData?.user?.id ?? null;
        locals.avatar_url = userData?.user?.user_metadata?.avatar_url ?? null;

        // update cookies silently in the background
        cookies.set("sb-access-token", data.session?.access_token!, {
          sameSite: "strict",
          path: "/",
          secure: true,
        });
        cookies.set("sb-refresh-token", data.session?.refresh_token!, {
          sameSite: "strict",
          path: "/",
          secure: true,
        });
      }
    }

    // 🔒 Protected UI pages
    if (micromatch.isMatch(url.pathname, protectedRoutes)) {
      if (!locals.user_id) {
        console.log("🔒 Protected UI pages");
        return redirect("/signin");
      }
    }

    // 🔒 Protected actions
    // if (url.pathname.startsWith("/_actions/")) {
    //   if (!locals.user_id) {
    //     console.log("🔒 Protected actions");
    //     return new Response("Unauthorized", { status: 401 });
    //   }
    // }

    // 🔒 Protected API
    if (micromatch.isMatch(url.pathname, proptectedAPIRoutes)) {
      if (!locals.user_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }
    }

    // 🚫 Redirect if a logged-in user visits /signin or /register
    if (micromatch.isMatch(url.pathname, redirectRoutes)) {
      if (locals.user_id) {
        return redirect("/feeds");
      }
    }

    if (url.pathname.startsWith("/trips/") || url.pathname.startsWith("/api/trips/")) {
      const userId = locals.user_id;

      // No user → reject immediately
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }

      // Extract tripId from URL: /trips/123 → 123
      const segments = url.pathname.split("/");
      const tripId = segments[2]; // index 2 = after /trips/

      if (tripId && tripId !== "create") {
        const trip: TripDetailsRES = await getTripDetails({ slug: tripId });
        if (!trip) {
          return new Response("Trip not found", { status: 404 });
        }

        // 1. Block check
        if (await isBlocked(trip.data?.owner_id, userId)) {
          return new Response("Forbidden: You are blocked by the trip owner", { status: 403 });
        }

        // 2. Owner → always allowed
        if (trip.data?.owner_id === userId) {
          return next();
        }

        // 3. Public → allowed
        if (trip.data?.trip_visibility?.[0]?.visibility === "public") {
          return next();
        }

        // 4. Friends → check actual friendship
        if (trip.data?.trip_visibility?.[0]?.visibility === "friends") {
          const friends = await getFriendsOfUser(trip.data?.owner_id);
          if (friends.includes(userId)) {
            return next();
          }
          return new Response("Forbidden: Friends only", { status: 403 });
        }

        // 5. Private → block
        if (trip.data?.trip_visibility?.[0]?.visibility === "private") {
          return new Response("Forbidden: Private trip", { status: 403 });
        }
      }
    }


    return next();
  }
);

