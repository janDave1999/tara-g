import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { sendWelcomeEmail } from "../../../lib/email";

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

  // Check user email verification status
  const user = data.session?.user;
  const userEmail = user?.email;
  const isEmailVerified = user?.email_confirmed_at !== null;
  const provider = user?.app_metadata?.provider;
  
  console.log("[Callback] User email:", userEmail, "| verified:", isEmailVerified, "| Provider:", provider);

  // For OAuth users - skip confirmation, just send welcome email
  if (provider === 'google' || provider === 'facebook') {
    if (userEmail) {
      console.log("[Callback] Sending welcome email for OAuth");
      sendWelcomeEmail(userEmail, user.user_metadata?.full_name || "Traveler").catch((err) => {
        console.error("[Callback] Failed to send welcome email:", err);
      });
    }
  }
  // Email/password registration requires confirmation (handled in register.ts)

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