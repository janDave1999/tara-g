/**
 * Custom Cloudflare Worker entry point.
 *
 * Extends the default Astro handler with a `scheduled` export so that
 * Cloudflare Cron Triggers (defined in wrangler.jsonc `triggers.crons`)
 * actually invoke the trip-status RPC instead of silently doing nothing.
 *
 * The HTTP side (fetch) is fully delegated to the Astro-generated handler.
 */

import type { SSRManifest } from "astro";
import { createExports as astroCreateExports } from "@astrojs/cloudflare/entrypoints/server.js";
import { createClient } from "@supabase/supabase-js";

export function createExports(manifest: SSRManifest) {
  const base = astroCreateExports(manifest);

  return {
    ...base,
    default: {
      // Pass all HTTP requests through to Astro unchanged
      ...base.default,

      // Handle Cloudflare Cron Triggers
      async scheduled(
        _event: unknown,
        env: Record<string, string>,
        _ctx: unknown,
      ): Promise<void> {
        console.log("[cron] trip-status-check starting…");

        const supabaseUrl = env.SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          console.error("[cron] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
          return;
        }

        try {
          const admin = createClient(supabaseUrl, serviceKey);
          const { data, error } = await admin.rpc("check_trip_status_and_notify");

          if (error) {
            console.error("[cron] RPC error:", error.message);
          } else {
            console.log("[cron] Done:", data);
          }
        } catch (err) {
          console.error("[cron] Unhandled error:", err);
        }
      },
    },
  };
}
