import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  // Debug: log import.meta.env.PROD
  console.log("[Callback] import.meta.env.PROD:", import.meta.env.PROD);
  
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const authCode = url.searchParams.get("code");

  if (!authCode) {
    return new Response("No code provided", { 
      status: 400,
      headers: corsHeaders 
    });
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
  
  console.log("[Callback] Session created:", !!data.session, "error:", error?.message);

  if (error) {
    console.error("[Callback] Error:", error);
    return new Response(error.message, {
      status: 500,
      headers: corsHeaders
    });
  }

  const { access_token, refresh_token } = data.session;
  
  console.log("[Callback] Setting cookies - access_token:", !!access_token, "refresh_token:", !!refresh_token);

  cookies.set("sb-access-token", access_token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 4, // 4 hours
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  
  console.log("[Callback] Cookies set successfully");

  // Support a ?next= param so email confirmation can redirect to /onboarding/profile
  const next = url.searchParams.get("next") || "/feeds";
  const safeNext = next.startsWith("/") ? next : "/feeds"; // only allow relative paths

  console.log("[Callback] Redirecting to:", safeNext);

  // Use Astro's redirect helper
  return redirect(safeNext, 302);
};