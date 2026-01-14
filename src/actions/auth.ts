// src/actions/auth.ts
import { supabase } from "@/lib/supabase";
import { defineAction } from "astro:actions";

export const auth = {
  signout: defineAction({
    handler: async (_, { cookies }) => {
      // Delete the session cookies
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
      await supabase.auth.signOut();
      return { success: true };
    },
  }),
}