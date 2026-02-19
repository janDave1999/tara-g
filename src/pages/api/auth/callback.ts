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
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  const response = Response.redirect(`${SITE_URL}/feeds`, 302);
  
  // Add CORS headers to the redirect response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
};