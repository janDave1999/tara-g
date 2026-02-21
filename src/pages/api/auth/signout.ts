import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  console.log('[SIGNOUT] Starting signout...');
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
  cookies.delete("sb-session-id", { path: "/" });
  await supabase.auth.signOut();
  console.log('[SIGNOUT] Completed, redirecting to /signin');
  return redirect("/signin");
};