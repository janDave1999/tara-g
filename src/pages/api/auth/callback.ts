import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { SITE_URL } from "astro:env/server";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
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
  if (error) {
    return new Response(error.message, {
      status: 500,
      headers: corsHeaders
    });
  }

  const { access_token, refresh_token } = data.session;

  cookies.set("sb-access-token", access_token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: 60 * 60 * 4, // 4 hours
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  // Support a ?next= param so email confirmation can redirect to /onboarding/profile
  const next = url.searchParams.get("next") || "/feeds";
  const safeNext = next.startsWith("/") ? next : "/feeds"; // only allow relative paths

  // Use redirect() from context instead of Response.redirect() to properly handle cookies
  return redirect(`${SITE_URL}${safeNext}`, 302);
};