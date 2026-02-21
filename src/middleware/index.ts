import { sequence } from "astro:middleware";
import type { KVNamespace } from "@cloudflare/workers-types";
import { auth } from "./auth";
import { userData } from "./userData";
import { onboarding } from "./onboarding";

export const onRequest = sequence(auth, userData, onboarding);

declare global {
  namespace App {
    interface Locals {
      user_id?: string;
      username?: string;
      avatar_url?: string | null;
      full_name?: string | null;
      email?: string;
      env?: {
        USER_CACHE: KVNamespace;
      };
      onboarding_status?: {
        onboarding_completed: boolean;
        current_step: number;
        profile_completion: number;
        has_username: boolean;
        has_profile: boolean;
        steps: Array<{
          name: string;
          completed: boolean;
          skipped: boolean;
          completed_at: string | null;
        }>;
        next_required_step: string | null;
      };
    }
  }
}
