import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { defineProtectedAction } from "./utils";
import { uploadToR2 } from "@/scripts/R2/upload";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const feed = {
  getPosts: defineAction({
    input: z.object({
      postType: z.string().optional(),
      page:     z.number().default(1),
      limit:    z.number().default(10),
    }),
    handler: async ({ postType, page, limit }, context) => {
      const userId = context.locals.user_id;
      if (!userId) return { posts: [], totalCount: 0 };

      const offset = (page - 1) * limit;
      const { data, error } = await supabaseAdmin.rpc("get_feed_posts", {
        p_user_id:   userId,
        p_post_type: postType ?? null,
        p_limit:     limit,
        p_offset:    offset,
      });

      if (error) console.error("[feed.getPosts]", error);

      return {
        posts:      data ?? [],
        totalCount: (data?.[0] as any)?.total_count ?? 0,
      };
    },
  }),

  getMyCompletedTrips: defineAction({
    input: z.object({}),
    handler: defineProtectedAction(async (_input, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("get_my_completed_trips", {
        p_user_id: userId,
      });

      if (error) console.error("[feed.getMyCompletedTrips]", error);

      return { trips: data ?? [] };
    }),
  }),

  uploadPostMedia: defineAction({
    accept: "json",
    input: z.object({
      files: z.array(z.object({
        file: z.string(), // base64
        name: z.string(),
        type: z.string(),
      })).min(1).max(4),
    }),
    handler: defineProtectedAction(async ({ files }, context) => {
      const { userId } = context;
      const r2 = (context as any).locals?.runtime?.env?.TRIP_HERO;
      if (!r2) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Storage unavailable" });

      const keys: string[] = [];

      for (const f of files) {
        if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
          throw new ActionError({ code: "BAD_REQUEST", message: `Invalid file type: ${f.type}` });
        }

        const buffer = Buffer.from(f.file, "base64");
        const padding = f.file.endsWith("==") ? 2 : f.file.endsWith("=") ? 1 : 0;
        const sizeInBytes = (f.file.length * 3) / 4 - padding;
        if (sizeInBytes > MAX_FILE_SIZE) {
          throw new ActionError({ code: "BAD_REQUEST", message: "File exceeds 5MB limit" });
        }

        const ext     = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const keyname = `post/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        await uploadToR2(buffer, f.name, f.type, keyname, r2);
        keys.push(keyname);
      }

      return { keys };
    }),
  }),

  createPost: defineAction({
    input: z.object({
      tripId:    z.string().uuid(),
      content:   z.string().min(1).max(1000),
      title:     z.string().max(200).optional(),
      hashtags:  z.array(z.string()).default([]),
      location:  z.string().max(200).optional(),
      mediaUrls: z.array(z.string()).default([]),
    }),
    handler: defineProtectedAction(async ({ tripId, content, title, hashtags, location, mediaUrls }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("create_user_post", {
        p_user_id:  userId,
        p_trip_id:  tripId,
        p_content:  content,
        p_title:    title ?? null,
        p_hashtags: hashtags,
        p_location: location ?? null,
      });

      if (error) {
        console.error("[feed.createPost]", error);
        throw new Error("Failed to create post");
      }

      const postId = data?.[0]?.post_id;

      // Insert media rows into post_media pivot table
      if (postId && mediaUrls.length > 0) {
        const mediaRows = mediaUrls.map((url, i) => ({
          post_id:       postId,
          url,
          display_order: i,
        }));
        const { error: mediaError } = await supabaseAdmin
          .from("post_media")
          .insert(mediaRows);

        if (mediaError) {
          console.error("[feed.createPost] media insert", mediaError);
          // Post was created — don't throw, just log. Media loss is recoverable.
        }
      }

      return { postId, createdAt: data?.[0]?.created_at };
    }),
  }),

  toggleLike: defineAction({
    input: z.object({ postId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ postId }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("toggle_post_like", {
        p_user_id: userId,
        p_post_id: postId,
      });

      if (error) {
        console.error("[feed.toggleLike]", error);
        throw new Error("Failed to toggle like");
      }

      return {
        liked:        data?.[0]?.liked ?? false,
        newLikeCount: data?.[0]?.new_like_count ?? 0,
      };
    }),
  }),

  getComments: defineAction({
    input: z.object({
      postId: z.string().uuid(),
      limit:  z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    handler: async ({ postId, limit, offset }, context) => {
      if (!context.locals.user_id) return { comments: [] };

      const { data, error } = await supabaseAdmin.rpc("get_post_comments", {
        p_post_id: postId,
        p_limit:   limit,
        p_offset:  offset,
      });

      if (error) console.error("[feed.getComments]", error);

      return { comments: data ?? [] };
    },
  }),

  createComment: defineAction({
    input: z.object({
      postId:  z.string().uuid(),
      content: z.string().min(1).max(500),
    }),
    handler: defineProtectedAction(async ({ postId, content }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("create_post_comment", {
        p_user_id: userId,
        p_post_id: postId,
        p_content: content,
      });

      if (error) {
        console.error("[feed.createComment]", error);
        throw new Error("Failed to post comment");
      }

      return { commentId: data?.[0]?.comment_id, createdAt: data?.[0]?.created_at };
    }),
  }),
};
