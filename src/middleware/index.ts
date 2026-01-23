// ============================================================================
// FILE: src/middleware.ts
// Updated middleware with RPC-based onboarding check
// ============================================================================
import { defineMiddleware } from "astro:middleware";
import { supabaseAdmin } from "@/lib/supabase";
import micromatch from "micromatch";

/* -------------------- Route Config -------------------- */
const protectedRoutes = ["/dashboard/**", "/feeds/**", "/trips/**"];
const protectedAPIRoutes = ["/api/**"];
const guestOnlyRoutes = ["/signin(|/)", "/register(|/)", "/", "/api/auth/**"];
const onboardingRoutes = ["/onboarding/**"];
const ACTION_PREFIX = "/_actions";

// Routes that don't require completed onboarding
const onboardingExemptRoutes = [
  "/onboarding/**",
  "/api/onboarding/**",
  "/api/user/**",
  "/settings/**",
  "/help/**",
  "/_actions/**",
];

/* -------------------- Helpers -------------------- */
const decodeJwt = (token: string) => {
  const base64 = token.split(".")[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return JSON.parse(
    decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    )
  );
};

/* -------------------- Check Onboarding Status (RPC) -------------------- */
async function checkOnboardingStatus(userId: string) {
  console.log(`Checking onboarding status for ${userId}`);
  try {
    const { data, error } = await supabaseAdmin.rpc('get_onboarding_status', {
      p_user_id: userId
    });
    console.log(`Onboarding status: ${JSON.stringify(data)}`);
    console.log(`Onboarding error: ${error}`);
    if (error) {
      console.error('Error fetching onboarding status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception in checkOnboardingStatus:', error);
    return null;
  }
}

/* -------------------- Middleware -------------------- */
export const onRequest = defineMiddleware(async (ctx, next) => {
  const { url, cookies, locals, redirect, request } = ctx;
  const pathname = url.pathname;
  const isAction = pathname.startsWith(ACTION_PREFIX);

  /* ---------- Skip static assets ---------- */
  if (
    request.method === "GET" &&
    pathname.includes(".") &&
    !pathname.endsWith(".html")
  ) {
    return next();
  }

  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  /* -------------------- Auth Resolver -------------------- */
  if (accessToken && refreshToken) {
    try {
      const payload = decodeJwt(accessToken);
      const isExpired = Date.now() >= payload.exp * 1000;

      if (!isExpired) {
        locals.user_id = payload.sub;
        locals.avatar_url = payload.user_metadata?.avatar_url;
        locals.email = payload.email;
      } else {
        // Token expired, try to refresh
        const { data, error } = await supabaseAdmin.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data.user) {
          locals.user_id = data.user.id;
          locals.avatar_url = data.user.user_metadata?.avatar_url;
          locals.email = data.user.email;

          cookies.set("sb-access-token", data.session!.access_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });

          cookies.set("sb-refresh-token", data.session!.refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
            maxAge: 60 * 60 * 24 * 30, // 30 days
          });
        } else {
          // Refresh failed, clear cookies
          cookies.delete("sb-access-token", { path: "/" });
          cookies.delete("sb-refresh-token", { path: "/" });
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
    }
  }

  /* -------------------- HARD ACTION GATE -------------------- */
  if (isAction && !locals.user_id) {
    return new Response(
      JSON.stringify({ error: "Unauthorized Action" }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /* -------------------- Protected Routes Guard -------------------- */
  if (micromatch.isMatch(pathname, protectedRoutes) && !locals.user_id) {
    return redirect("/signin");
  }

  /* -------------------- Protected API Routes Guard -------------------- */
  if (
    micromatch.isMatch(pathname, protectedAPIRoutes) &&
    !locals.user_id &&
    !micromatch.isMatch(pathname, "/api/auth/**") &&
    !micromatch.isMatch(pathname, "/api/mapbox-token")
  ) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /* -------------------- Guest Only Routes -------------------- */
  if (micromatch.isMatch(pathname, guestOnlyRoutes) && locals.user_id) {
    return redirect("/feeds");
  }

  /* -------------------- ONBOARDING CHECK (Using RPC) -------------------- */
  if (locals.user_id ) {
    // Skip onboarding check for exempt routes
    console.log(`Checking onboarding status for ${pathname}`);
    const isExempt = onboardingExemptRoutes.some(route => 
      micromatch.isMatch(pathname, route)
    );
    console.log(
      `Is exempt: ${isExempt}`
    );
    console.log(
      `Onboarding routes: ${onboardingRoutes}`
    );

    if (!isExempt) {
      // Use RPC to get onboarding status
      const onboardingStatus = await checkOnboardingStatus(locals.user_id);
      console.log(`Onboarding status: ${onboardingStatus}`);
      if (onboardingStatus) {
        // Store in locals for use in pages
        locals.onboarding_status = onboardingStatus;
        
        // Redirect to onboarding if not completed
        if (!onboardingStatus.onboarding_completed) {
          const nextStep = onboardingStatus.next_required_step || 'profile';
          console.log(`Redirecting to /onboarding/${nextStep}`);
          // Only redirect if not already on onboarding page
          if (!micromatch.isMatch(pathname, onboardingRoutes)) {
            return redirect(`/onboarding/${nextStep}`);
          }
        }
      }
    }
  }

  /* -------------------- Redirect from onboarding if completed -------------------- */
  if (
    locals.user_id && 
    micromatch.isMatch(pathname, onboardingRoutes)
  ) {
    // Check if onboarding is already completed
    if (!locals.onboarding_status) {
      const onboardingStatus = await checkOnboardingStatus(locals.user_id);
      locals.onboarding_status = onboardingStatus;
    }

    if (locals.onboarding_status?.onboarding_completed) {
      return redirect("/feeds");
    }
  }

  return next();
});

/* -------------------- TypeScript Locals Extension -------------------- */
declare global {
  namespace App {
    interface Locals {
      user_id?: string;
      avatar_url?: string;
      email?: string;
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