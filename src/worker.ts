/**
 * Custom Cloudflare Worker entry point.
 *
 * Extends the default Astro handler with a `scheduled` export so that
 * Cloudflare Cron Triggers (defined in wrangler.jsonc `triggers.crons`)
 * actually invoke the appropriate RPC instead of silently doing nothing.
 *
 * Cron dispatch:
 *   "0 9 * * 1"  (weekly, Monday 09:00 UTC) → check_budget_and_notify
 *   everything else (daily 23:xx UTC)        → check_trip_status_and_notify
 *
 * The HTTP side (fetch) is fully delegated to the Astro-generated handler.
 */

import type { SSRManifest } from "astro";
import { createExports as astroCreateExports } from "@astrojs/cloudflare/entrypoints/server.js";
import { createClient } from "@supabase/supabase-js";

const BUDGET_CRON = "0 9 * * 1";

export function createExports(manifest: SSRManifest) {
  const base = astroCreateExports(manifest);

  return {
    ...base,
    default: {
      // Pass all HTTP requests through to Astro unchanged
      ...base.default,

      // Handle Cloudflare Cron Triggers
      async scheduled(
        event: { cron?: string },
        env: Record<string, string>,
        _ctx: unknown,
      ): Promise<void> {
        const isBudgetCron = event?.cron === BUDGET_CRON;
        const rpcName = isBudgetCron
          ? "check_budget_and_notify"
          : "check_trip_status_and_notify";

        console.log(`[cron] ${rpcName} starting… (trigger: ${event?.cron ?? "unknown"})`);

        const supabaseUrl = env.SUPABASE_URL;
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          console.error("[cron] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
          return;
        }

        try {
          const admin = createClient(supabaseUrl, serviceKey);
          const { data, error } = await admin.rpc(rpcName);

          if (error) {
            console.error(`[cron] RPC error (${rpcName}):`, error.message);
          } else {
            console.log(`[cron] Done (${rpcName}):`, data);
          }
        } catch (err) {
          console.error(`[cron] Unhandled error (${rpcName}):`, err);
        }
      },
    },
  };
}
