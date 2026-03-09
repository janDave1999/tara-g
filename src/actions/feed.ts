import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { defineProtectedAction } from "./utils";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { deleteFromR2 } from "@/scripts/R2/upload";
import {
  CLOUDFLARE_ACCESS_KEY_ID,
  CLOUDFLARE_SECRET_ACCESS_KEY,
  CLOUDFLARE_SPECIFIC_BUCKET_S3_URL,
} from "astro:env/server";

function sanitizeContent(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, "");
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
const BUCKET_NAME  = "staging-tara-g-assets";

function getS3Client() {
  return new S3Client({
    endpoint: CLOUDFLARE_SPECIFIC_BUCKET_S3_URL,
    region: "auto",
    credentials: {
      accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
    },
  });
}

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

  // Returns short-lived presigned PUT URLs — client uploads directly to R2
  getUploadUrls: defineAction({
    accept: "json",
    input: z.object({
      files: z.array(z.object({
        name: z.string().max(255),
        type: z.string(),
        size: z.number().int().positive(),
      })).min(1).max(20),
    }),
    handler: defineProtectedAction(async ({ files }, context) => {
      const { userId } = context;
      const s3 = getS3Client();

      const results = await Promise.all(files.map(async (f) => {
        const isImage = ALLOWED_IMAGE_TYPES.includes(f.type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(f.type);
        if (!isImage && !isVideo) {
          throw new ActionError({ code: "BAD_REQUEST", message: `Invalid file type: ${f.type}` });
        }
        const maxSize  = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        const maxLabel = isVideo ? "500 MB" : "10 MB";
        if (f.size > maxSize) {
          throw new ActionError({ code: "BAD_REQUEST", message: `"${f.name}" exceeds ${maxLabel}` });
        }

        const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const key = `post/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: f.type,
            ContentLength: f.size,
          }),
          { expiresIn: 600 }, // 10 minutes
        );

        return { key, uploadUrl };
      }));

      return { files: results };
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

      const safeContent = sanitizeContent(content);

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

  updatePost: defineAction({
    accept: "json",
    input: z.object({
      postId:        z.string().uuid(),
      title:         z.string().max(200).optional(),
      content:       z.string().min(1).max(10000),
      hashtags:      z.array(z.string()).max(10).default([]),
      keepMediaKeys: z.array(z.string()).default([]),
      newMediaKeys:  z.array(z.string()).default([]),
    }),
    handler: defineProtectedAction(async ({ postId, title, content, hashtags, keepMediaKeys, newMediaKeys }, context) => {
      const { userId } = context;
      const safeContent = sanitizeContent(content);

      // Resolve internal user id
      const { data: userRow } = await supabaseAdmin
        .from("users").select("user_id").eq("auth_id", userId).single();
      if (!userRow) throw new ActionError({ code: "UNAUTHORIZED", message: "User not found" });

      // Ownership check
      const { data: owned } = await supabaseAdmin
        .from("user_posts").select("post_id")
        .eq("post_id", postId).eq("user_id", userRow.user_id).single();
      if (!owned) throw new ActionError({ code: "FORBIDDEN", message: "Not authorized" });

      // Update post text
      const { error: updateErr } = await supabaseAdmin
        .from("user_posts")
        .update({ title: title || null, content: safeContent, hashtags })
        .eq("post_id", postId);
      if (updateErr) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: updateErr.message });

      // Remove deleted media from post_media + R2
      const { data: existing } = await supabaseAdmin
        .from("post_media").select("url").eq("post_id", postId);
      const toDelete = (existing ?? []).filter((m) => !keepMediaKeys.includes(m.url));
      if (toDelete.length) {
        await Promise.allSettled(toDelete.map((m) => deleteFromR2(m.url)));
        await supabaseAdmin.from("post_media").delete()
          .eq("post_id", postId).in("url", toDelete.map((m) => m.url));
      }

      // Insert newly added media
      if (newMediaKeys.length) {
        await supabaseAdmin.from("post_media").insert(
          newMediaKeys.map((url, i) => ({
            post_id: postId, url, display_order: keepMediaKeys.length + i,
          }))
        );
      }

      return { postId };
    }),
  }),

  deletePost: defineAction({
    accept: "json",
    input: z.object({ postId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ postId }, context) => {
      const { userId } = context;

      const { data: userRow } = await supabaseAdmin
        .from("users").select("user_id").eq("auth_id", userId).single();
      if (!userRow) throw new ActionError({ code: "UNAUTHORIZED", message: "User not found" });

      // Fetch media keys before deletion for R2 cleanup
      const { data: media } = await supabaseAdmin
        .from("post_media").select("url").eq("post_id", postId);

      const { error } = await supabaseAdmin
        .from("user_posts").delete()
        .eq("post_id", postId).eq("user_id", userRow.user_id);
      if (error) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      if (media?.length) {
        await Promise.allSettled(media.map((m) => deleteFromR2(m.url)));
      }

      return { deleted: true };
    }),
  }),
};
