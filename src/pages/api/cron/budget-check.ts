import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

export const POST: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_budget_and_notify");

    if (error) {
      console.error("[cron] budget-check failed:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cron] budget-check error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
