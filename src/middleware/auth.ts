import { defineMiddleware } from "astro:middleware";
import { refreshSession } from "@/lib/refreshSession";
import { supabase } from "@/lib/supabase";
import { setRateLimitKV } from "@/lib/rateLimit";

const COOKIE_OPTS_ACCESS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: import.meta.env.PROD,
  maxAge: 60 * 30, // 30 minutes
} as const;

const COOKIE_OPTS_REFRESH = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 30, // 30 days
} as const;

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
  const { cookies, locals, url, redirect } = ctx;

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
      const payload = decodeJwt(accessToken);
      const now = Math.floor(Date.now() / 1000);
      // Refresh if expired or within 60 s of expiry — skip the getUser() round-trip for known-expired tokens
      const isExpiredOrNearExpiry = !payload.exp || payload.exp - now < 60;

      if (!isExpiredOrNearExpiry) {
        // Token looks valid — verify with Supabase (catches revoked tokens)
        const { data: { user }, error: verifyError } = await supabase.auth.getUser(accessToken);

        if (!verifyError && user) {
          locals.user_id = user.id;
          locals.email = user.email ?? undefined;
          if (user.user_metadata?.username) locals.username = user.user_metadata.username;
          if (user.user_metadata?.avatar_url) locals.avatar_url = user.user_metadata.avatar_url;
          // Fallback to JWT payload for metadata
          if (!locals.username && payload.user_metadata?.username) locals.username = payload.user_metadata.username;
          if (!locals.avatar_url && payload.user_metadata?.avatar_url) locals.avatar_url = payload.user_metadata.avatar_url;
        } else {
          // Verification failed despite not being expired (revoked?) — refresh
          const refreshed = await refreshSession(refreshToken);
          if (refreshed) {
            locals.user_id = refreshed.user_id;
            locals.email = refreshed.email;
            if (refreshed.username) locals.username = refreshed.username;
            if (refreshed.avatar_url) locals.avatar_url = refreshed.avatar_url;
            cookies.set("sb-access-token", refreshed.access_token, COOKIE_OPTS_ACCESS);
            cookies.set("sb-refresh-token", refreshed.refresh_token, COOKIE_OPTS_REFRESH);
          } else {
            cookies.delete("sb-access-token", { path: "/" });
            cookies.delete("sb-refresh-token", { path: "/" });
          }
        }
      } else {
        // Token expired — exchange refresh token for a new pair
        const refreshed = await refreshSession(refreshToken);
        if (refreshed) {
          locals.user_id = refreshed.user_id;
          locals.email = refreshed.email;
          if (refreshed.username) locals.username = refreshed.username;
          if (refreshed.avatar_url) locals.avatar_url = refreshed.avatar_url;
          cookies.set("sb-access-token", refreshed.access_token, COOKIE_OPTS_ACCESS);
          cookies.set("sb-refresh-token", refreshed.refresh_token, COOKIE_OPTS_REFRESH);
        } else {
          cookies.delete("sb-access-token", { path: "/" });
          cookies.delete("sb-refresh-token", { path: "/" });
        }
      }
    } catch (error) {
      console.error('[AUTH_MIDDLEWARE] Token error:', error);
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
    }
  }

  // Route protection: redirect unauthenticated users away from protected routes
  if (!locals.user_id) {
    const pathname = url.pathname;
    
    // Allow public routes without auth
    const publicRoutes = [
      '/',
      '/signin',
      '/register',
      '/about',
      '/discover',
      '/bucket',
      '/blogs',
      '/maps',
      '/404',
      '/500',
      '/api/auth',
      '/api/onboarding',
      '/api/user',
      '/api/mapbox-token',
      '/_actions',
    ];
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname.startsWith(route)
    );
    
    // Allow trips with invite param OR social crawlers
    const hasInviteParam = url.searchParams.has('invite');
    const isTripWithInvite = pathname.startsWith('/trips') && hasInviteParam;
    
    // Check for social crawlers
    const ua = ctx.request.headers.get('user-agent') || '';
    const CRAWLER_AGENTS = [
      // Search engines
      'Googlebot', 'Googlebot-Image', 'Googlebot-Video', 'AdsBot-Google',
      'bingbot', 'Bingbot', 'DuckDuckBot', 'YandexBot', 'Baiduspider',
      'Slurp', // Yahoo
      'ia_archiver', // Wayback Machine
      // Social media
      'facebookexternalhit', 'Facebookexternalhit', 'Facebot', 'FacebookBot', 'facebook.com/2.1', 'FBCURL',
      'Instagram', 'instagram.com',
      'WhatsApp', 'viber', 'Viber',
      'Twitterbot', 'LinkedInBot', 'TelegramBot',
      'Slackbot', 'Discordbot', 'vkShare',
    ];
    const isSocialCrawler = CRAWLER_AGENTS.some(bot => ua.includes(bot));
    const isCrawlerOnTrip = isSocialCrawler && pathname.startsWith('/trips');
    
    if (!isPublicRoute && !isTripWithInvite && !isCrawlerOnTrip) {
      // Check if it's a protected route that needs auth
      const protectedRoutes = ['/dashboard', '/feeds', '/trips', '/project82', '/settings', '/notifications', '/profile'];
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      
      if (isProtectedRoute) {
        const next = encodeURIComponent(pathname + url.search);
        return redirect(`/signin?next=${next}`);
      }
    }
  }

  return next();
});
