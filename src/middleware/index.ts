import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import micromatch from "micromatch";

/* -------------------- Route Config -------------------- */
const protectedRoutes = ["/dashboard/**", "/feeds/**", "/trips/**"];
const protectedAPIRoutes = ["/api/**"];
const guestOnlyRoutes = ["/signin(|/)", "/register(|/)", "/", "/api/auth/**"];
const ACTION_PREFIX = "/_actions";

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

/* -------------------- Middleware -------------------- */
export const onRequest = defineMiddleware(async (ctx, next) => {
  const { url, cookies, locals, redirect, request } = ctx;
  const pathname = url.pathname;
  const isAction = pathname.startsWith(ACTION_PREFIX);

  /* ---------- NEVER skip auth for POST / actions ---------- */
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
      } else {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data.user) {
          locals.user_id = data.user.id;
          locals.avatar_url = data.user.user_metadata?.avatar_url;

          cookies.set("sb-access-token", data.session!.access_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
          });

          cookies.set("sb-refresh-token", data.session!.refresh_token, {
            path: "/",
            httpOnly: true,
            sameSite: "strict",
            secure: true,
          });
        } else {
          cookies.delete("sb-access-token", { path: "/" });
          cookies.delete("sb-refresh-token", { path: "/" });
        }
      }
    } catch {
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });
    }
  }

  /* -------------------- HARD ACTION GATE -------------------- */
  if (isAction && !locals.user_id) {
    return new Response(
      JSON.stringify({ error: "Unauthorized Action" }),
      { status: 401 }
    );
  }

  /* -------------------- UI Guards -------------------- */
  if (micromatch.isMatch(pathname, protectedRoutes) && !locals.user_id) {
    return redirect("/signin");
  }

  if (
    micromatch.isMatch(pathname, protectedAPIRoutes) &&

    !locals.user_id &&
    !micromatch.isMatch(pathname, "/api/auth/**") &&

    !micromatch.isMatch(pathname, "/api/mapbox-token")
  ) {
    console.log("Unauthorized");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  if (micromatch.isMatch(pathname, guestOnlyRoutes) && locals.user_id) {
    return redirect("/feeds");
  }

  return next();
});
