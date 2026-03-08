import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { defineProtectedAction } from "./utils";
import { uploadToR2 } from "@/scripts/R2/upload";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const feed = {
  getUserPosts: defineAction({
    input: z.object({
      authorId: z.string().uuid(),
      page:     z.number().default(1),
      limit:    z.number().default(10),
    }),
    handler: async ({ authorId, page, limit }, context) => {
      const offset = (page - 1) * limit;
      const { data, error } = await supabaseAdmin.rpc("get_user_posts", {
        p_author_auth_id: authorId,
        p_viewer_id:      context.locals.user_id ?? null,
        p_limit:          limit,
        p_offset:         offset,
      });
      if (error) console.error("[feed.getUserPosts]", error);
      const rows = (data as any[]) ?? [];
      return { posts: rows, totalCount: rows[0]?.total_count ?? 0 };
    },
  }),

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
      content:   z.string().min(1).max(10000),
      title:     z.string().max(200).optional(),
      hashtags:  z.array(z.string()).default([]),
      location:  z.string().max(200).optional(),
      mediaUrls: z.array(z.string()).default([]),
    }),
    handler: defineProtectedAction(async ({ tripId, content, title, hashtags, location, mediaUrls }, context) => {
      const { userId } = context;

      // Strip dangerous HTML — allow basic formatting tags only
      const safeContent = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
        .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, "");

      const { data, error } = await supabaseAdmin.rpc("create_user_post", {
        p_user_id:  userId,
        p_trip_id:  tripId,
        p_content:  safeContent,
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
      limit:  z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }),
    handler: async ({ postId, limit, offset }, context) => {

      const { data, error } = await supabaseAdmin.rpc("get_post_comments", {
        p_post_id:   postId,
        p_viewer_id: context.locals.user_id ?? null,
        p_limit:     limit,
        p_offset:    offset,
      });

      if (error) console.error("[feed.getComments]", error);

      return { comments: data ?? [] };
    },
  }),

  createComment: defineAction({
    input: z.object({
      postId:          z.string().uuid(),
      content:         z.string().min(1).max(500),
      parentCommentId: z.string().uuid().optional(),
    }),
    handler: defineProtectedAction(async ({ postId, content, parentCommentId }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("create_post_comment", {
        p_user_id:            userId,
        p_post_id:            postId,
        p_content:            content,
        p_parent_comment_id:  parentCommentId ?? null,
      });

      if (error) {
        console.error("[feed.createComment]", error);
        throw new Error("Failed to post comment");
      }

      return { commentId: data?.[0]?.comment_id, createdAt: data?.[0]?.created_at };
    }),
  }),

  toggleCommentLike: defineAction({
    input: z.object({
      commentId: z.string().uuid(),
      type:      z.enum(['like', 'dislike']),
    }),
    handler: defineProtectedAction(async ({ commentId, type }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("toggle_comment_interaction", {
        p_user_id:    userId,
        p_comment_id: commentId,
        p_type:       type,
      });

      if (error) {
        console.error("[feed.toggleCommentLike]", error);
        throw new Error("Failed to update reaction");
      }

      return {
        activeInteraction: data?.[0]?.active_interaction ?? null,
        newLikeCount:      data?.[0]?.new_like_count ?? 0,
        newDislikeCount:   data?.[0]?.new_dislike_count ?? 0,
      };
    }),
  }),

  getPost: defineAction({
    input: z.object({ postId: z.string().uuid() }),
    handler: async ({ postId }, context) => {
      const { data, error } = await supabaseAdmin.rpc('get_single_post', {
        p_post_id:   postId,
        p_viewer_id: context.locals.user_id ?? null,
      });
      if (error) console.error("[feed.getPost]", error);
      return { post: (data as any) ?? null };
    },
  }),

  createShareLink: defineAction({
    input: z.object({ postId: z.string().uuid() }),
    handler: async ({ postId }, context) => {
      const { data, error } = await supabaseAdmin.rpc('create_share_link', {
        p_post_id: postId,
        p_user_id: context.locals.user_id ?? null,
      });
      if (error) console.error("[feed.createShareLink]", error);
      return { shareId: data as string };
    },
  }),

  recordShareVisit: defineAction({
    input: z.object({
      shareId:      z.string().uuid(),
      visitorToken: z.string().min(1),
    }),
    handler: async ({ shareId, visitorToken }) => {
      const { error } = await supabaseAdmin.rpc('record_share_visit', {
        p_share_id:      shareId,
        p_visitor_token: visitorToken,
      });
      if (error) console.error("[feed.recordShareVisit]", error);
      return { ok: !error };
    },
  }),

  createReport: defineAction({
    input: z.object({
      targetType: z.enum(['post', 'comment']),
      targetId:   z.string().uuid(),
      reason:     z.enum(['spam', 'inappropriate', 'harassment', 'misinformation', 'other']),
    }),
    handler: defineProtectedAction(async ({ targetType, targetId, reason }, context) => {
      const { userId } = context;

      const { data, error } = await supabaseAdmin.rpc("create_report", {
        p_user_id:     userId,
        p_target_type: targetType,
        p_target_id:   targetId,
        p_reason:      reason,
      });

      if (error) {
        console.error("[feed.createReport]", error);
        throw new Error("Failed to submit report");
      }

      return { alreadyReported: data?.[0]?.already_reported ?? false };
    }),
  }),
};
