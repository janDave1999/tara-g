import { defineAction } from "astro:actions";
import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";

export const search = {
  global: defineAction({
    input: z.object({
      q: z.string().min(2),
      limit: z.number().int().min(1).max(20).default(3),
    }),
    handler: async ({ q, limit }, context) => {
      const userId = context.locals.user_id;
      if (!userId) return { users: [], trips: [], posts: [] };

      const [usersResult, tripsResult, postsResult] = await Promise.all([
        supabaseAdmin.rpc("search_users_for_invitation", {
          p_search_query: q,
          p_current_user_id: userId,
          p_trip_id: null,
          p_limit: limit,
        }),
        supabaseAdmin.rpc("get_recent_trips", {
          p_user_id: userId,
          p_search: q,
          p_tags: null,
          p_region: null,
          p_limit: limit,
          p_offset: 0,
        }),
        supabaseAdmin.rpc("search_posts", {
          p_query: q,
          p_limit: limit,
        }),
      ]);

      if (usersResult.error) console.error("[search.global:users]", usersResult.error);
      if (tripsResult.error) console.error("[search.global:trips]", tripsResult.error);
      if (postsResult.error) console.error("[search.global:posts]", postsResult.error);

      return {
        users: usersResult.data ?? [],
        trips: tripsResult.data ?? [],
        posts: postsResult.data ?? [],
      };
    },
  }),
};
