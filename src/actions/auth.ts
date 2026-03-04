// src/actions/auth.ts
import { supabase, supabaseAdmin, getSupabaseClient } from "@/lib/supabase";
import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";

export const auth = {

  signout: defineAction({
    handler: async (_, { cookies }) => {
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
      cookies.delete("sb-session-id", { path: "/" });
      await supabase.auth.signOut();
      return { success: true };
    },
  }),

  changeEmail: defineAction({
    input: z.object({
      email: z.string().email("Please enter a valid email address"),
    }),
    handler: async ({ email }, { locals, cookies }) => {
      const { user_id } = locals;
      if (!user_id) throw new ActionError({ code: "UNAUTHORIZED", message: "Not authenticated" });

      const userClient = getSupabaseClient(cookies);
      const { error } = await userClient.auth.updateUser({ email });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });

      return { success: true };
    },
  }),

  changePassword: defineAction({
    input: z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    }),
    handler: async ({ currentPassword, newPassword }, { locals }) => {
      const { user_id, email } = locals;
      if (!user_id) throw new ActionError({ code: "UNAUTHORIZED", message: "Not authenticated" });

      // Verify current password for email/password users
      if (currentPassword && email) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (verifyError) {
          throw new ActionError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: newPassword,
        user_metadata: { password_set: true },
      });
      if (error) throw new ActionError({ code: "BAD_REQUEST", message: error.message });

      return { success: true };
    },
  }),

  signOutAll: defineAction({
    handler: async (_, { locals, cookies }) => {
      const { user_id } = locals;
      if (!user_id) throw new ActionError({ code: "UNAUTHORIZED", message: "Not authenticated" });

      const accessToken = cookies.get("sb-access-token")?.value;
      if (accessToken) {
        await supabaseAdmin.auth.admin.signOut(accessToken, "global");
      }

      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
      cookies.delete("sb-session-id", { path: "/" });

      return { success: true };
    },
  }),

  deleteAccount: defineAction({
    handler: async (_, { locals, cookies }) => {
      const { user_id } = locals;
      if (!user_id) throw new ActionError({ code: "UNAUTHORIZED", message: "Not authenticated" });

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
      cookies.delete("sb-session-id", { path: "/" });

      return { success: true };
    },
  }),

};
