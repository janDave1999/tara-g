import { defineMiddleware } from "astro:middleware";
import { supabaseAdmin } from "@/lib/supabase";
import micromatch from "micromatch";
import { handleApiError } from "@/lib/errorHandler";
import { userCache } from "@/lib/userCache";
import { getFromKV, setToKV, getOnboardingCacheKey } from "@/lib/kv";

const protectedRoutes = ["/dashboard/**", "/feeds/**", "/trips/**", "/project82/**"];

const protectedAPIRoutes = ["/api/**"];
const guestOnlyRoutes = ["/signin(|/)", "/register(|/)", "/", "/api/auth/**"];
const onboardingRoutes = ["/onboarding/**"];
const onboardingExemptRoutes = [
  "/onboarding/**",
  "/api/onboarding/**",
  "/api/user/**",
  "/settings/**",
  "/help/**",
  "/_actions/**",
];

const ONBOARDING_CACHE_TTL = 600;

async function checkOnboardingStatus(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("get_onboarding_status", {
    p_user_id: userId,
  });

  if (error) {
    return null;
  }

  return data;
}

async function getCachedOnboarding(
  userId: string,
  env?: App.Locals["env"]
) {
  const cacheKey = getOnboardingCacheKey(userId);

  const cached = userCache.get<Awaited<ReturnType<typeof checkOnboardingStatus>>>(cacheKey);
  if (cached) {
    return cached;
  }

  const kvCached = await getFromKV(cacheKey, env);
  if (kvCached) {
    userCache.set(cacheKey, kvCached);
    return kvCached;
  }

  const status = await checkOnboardingStatus(userId);
  if (status) {
    userCache.set(cacheKey, status);
    await setToKV(cacheKey, status, ONBOARDING_CACHE_TTL, env);
  }

  return status;
}

function createErrorResponse(message: string, status: number = 401): Response {
  return handleApiError({
    name: "MiddlewareError",
    message,
    statusCode: status,
  });
}

export const onboarding = defineMiddleware(async (ctx, next) => {
  const { url, locals, redirect, request } = ctx;
  const pathname = url.pathname;

  const isAction = pathname.startsWith("/_actions");

  if (
    request.method === "GET" &&
    pathname.includes(".") &&
    !pathname.endsWith(".html")
  ) {
    return next();
  }

  if (isAction && !locals.user_id) {
    return createErrorResponse("Unauthorized Action", 401);
  }

  if (
    micromatch.isMatch(pathname, protectedAPIRoutes) &&
    !locals.user_id &&
    !micromatch.isMatch(pathname, "/api/auth/**") &&
    !micromatch.isMatch(pathname, "/api/mapbox-token")
  ) {
    return createErrorResponse("Authentication required", 401);
  }

  if (micromatch.isMatch(pathname, guestOnlyRoutes) && locals.user_id) {
    return redirect("/feeds");
  }

  if (locals.user_id) {
    const isExempt = onboardingExemptRoutes.some((route) =>
      micromatch.isMatch(pathname, route)
    );

    if (!isExempt) {
      const onboardingStatus = await getCachedOnboarding(
        locals.user_id,
        locals.env
      );

      if (onboardingStatus) {
        locals.onboarding_status = onboardingStatus;

        if (!onboardingStatus.onboarding_completed) {
          const nextStep = onboardingStatus.next_required_step || "profile";
          if (!micromatch.isMatch(pathname, onboardingRoutes)) {
            return redirect(`/onboarding/${nextStep}`);
          }
        }
      }
    }
  }

  if (locals.user_id && micromatch.isMatch(pathname, onboardingRoutes)) {
    if (!locals.onboarding_status) {
      const onboardingStatus = await getCachedOnboarding(
        locals.user_id,
        locals.env
      );
      locals.onboarding_status = onboardingStatus;
    }

    if (locals.onboarding_status?.onboarding_completed) {
      return redirect("/feeds");
    }
  }

  return next();
});
