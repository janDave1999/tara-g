import { defineAction } from "astro:actions";
import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";

export const feed = {
  getPosts: defineAction({
    input: z.object({
      postType: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(10),
    }),
    handler: async ({ postType, page, limit }, context) => {
      const userId = context.locals.user_id;
      if (!userId) return { posts: [], totalCount: 0 };

      const offset = (page - 1) * limit;
      const { data, error } = await supabaseAdmin.rpc("get_feed_posts", {
        p_user_id: userId,
        p_post_type: postType ?? null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error("[feed.getPosts]", error);
      }

      return {
        posts: data ?? [],
        totalCount: (data?.[0] as any)?.total_count ?? 0,
      };
    },
  }),
};
