import { defineMiddleware } from "astro:middleware";
import { refreshSession } from "@/lib/refreshSession";
import { supabase } from "@/lib/supabase";
import { setRateLimitKV } from "@/lib/rateLimit";

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

export const auth = defineMiddleware(async (ctx, next) => {
  const { cookies, locals } = ctx;

  // Initialize rate limiter with KV store for distributed rate limiting
  const env = locals.runtime?.env as Record<string, unknown> | undefined;
  if (env?.USER_CACHE) {
    setRateLimitKV(env.USER_CACHE as any);
    // Pass env to locals for userData middleware
    locals.env = env.USER_CACHE as any;
  }

  const accessToken = cookies.get("sb-access-token")?.value;
  const refreshToken = cookies.get("sb-refresh-token")?.value;

  if (accessToken && refreshToken) {
    try {
      // First, verify the token cryptographically using Supabase
      const { data: { user }, error: verifyError } = await supabase.auth.getUser(accessToken);

      if (!verifyError && user) {
        // Token is valid - set user context from verified Supabase user
        locals.user_id = user.id;
        locals.email = user.email ?? undefined;
        
        // Extract from user_metadata (set during onboarding or OAuth)
        if (user.user_metadata?.username) locals.username = user.user_metadata.username;
        if (user.user_metadata?.avatar_url) locals.avatar_url = user.user_metadata.avatar_url;
        
        // Also check JWT payload for backwards compatibility
        const payload = decodeJwt(accessToken);
        if (!locals.username && payload.user_metadata?.username) locals.username = payload.user_metadata.username;
        if (!locals.avatar_url && payload.user_metadata?.avatar_url) locals.avatar_url = payload.user_metadata.avatar_url;
      } else {
        // Token verification failed - try to refresh
        const refreshed = await refreshSession(accessToken, refreshToken);

        if (refreshed) {
          locals.user_id = refreshed.user_id;
          locals.email = refreshed.email;
          
          if (refreshed.username) locals.username = refreshed.username;
          if (refreshed.avatar_url) locals.avatar_url = refreshed.avatar_url;

          cookies.set("sb-access-token", refreshed.access_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
            maxAge: 60 * 60 * 4, // 4 hours
          });

          cookies.set("sb-refresh-token", refreshed.refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: import.meta.env.PROD,
            maxAge: 60 * 60 * 24 * 30,
          });
        } else {
          cookies.delete("sb-access-token", { path: "/" });
          cookies.delete("sb-refresh-token", { path: "/" });
        }
      }
    } catch (error) {
      console.error('[AUTH_MIDDLEWARE] Token verification error:', error);
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
    }
  }

  return next();
});
