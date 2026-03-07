import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_trip_status_and_notify");
    console.log("[cron] Trip status check result:", { data, error });
    if (error) {
      console.error("[cron] Trip status check failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("[cron] Trip status check completed:", data);
    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("[cron] Trip status check error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
