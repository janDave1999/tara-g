import type { APIRoute } from "astro";
import { SITE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "astro:env/server";
import { supabase } from "../../../../lib/supabase";
import { sendWelcomeEmail } from "../../../../lib/email";

const ORIGIN = SITE_URL.replace(/\/$/, "");

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  console.log("[Google Callback] Hit — URL:", url.pathname + url.search.slice(0, 60));

  // 1. Read + immediately delete one-time state cookie
  const raw = cookies.get("google-oauth-state")?.value;
  cookies.delete("google-oauth-state", { path: "/" });
  if (!raw) {
    console.error("[Google Callback] No state cookie found — session expired or cookie stripped");
    return redirect("/signin?error=session_expired", 302);
  }

  let pkce: { codeVerifier: string; state: string; nonce: string; next: string };
  try {
    pkce = JSON.parse(raw);
  } catch {
    console.error("[Google Callback] Failed to parse state cookie");
    return redirect("/signin?error=invalid_state", 302);
  }

  console.log("[Google Callback] Cookie state (first 8):", pkce.state.slice(0, 8));
  console.log("[Google Callback] URL state (first 8):", url.searchParams.get("state")?.slice(0, 8));

  // 2. Validate state (CSRF protection)
  if (url.searchParams.get("state") !== pkce.state) {
    console.error("[Google Callback] State mismatch — possible CSRF");
    return redirect("/signin?error=state_mismatch", 302);
  }

  // 3. Check for Google error (e.g. user cancelled)
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    console.error("[Google Callback] Google returned error:", oauthError);
    return redirect(
      `/signin?error=${oauthError === "access_denied" ? "access_denied" : "oauth_error"}`,
      302
    );
  }

  // 4. Get authorization code
  const code = url.searchParams.get("code");
  if (!code) {
    console.error("[Google Callback] No code in URL");
    return redirect("/signin?error=no_code", 302);
  }
  console.log("[Google Callback] Got authorization code");

  // 5. Exchange code + code_verifier for tokens at Google
  console.log("[Google Callback] Exchanging code at Google token endpoint");
  console.log("[Google Callback] redirect_uri:", `${ORIGIN}/api/auth/google/callback`);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${ORIGIN}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: pkce.codeVerifier,
    }),
  });

  const tokenData = (await tokenRes.json()) as { id_token?: string; error?: string; error_description?: string };
  console.log("[Google Callback] Token exchange status:", tokenRes.status, "has id_token:", !!tokenData.id_token);
  if (!tokenRes.ok || !tokenData.id_token) {
    console.error("[Google Callback] Token exchange failed:", tokenData.error, tokenData.error_description);
    return redirect("/signin?error=token_exchange_failed", 302);
  }

  // 6. Exchange id_token with Supabase
  // Pass nonce as raw string — Supabase SDK hashes it internally before verifying the JWT claim
  console.log("[Google Callback] Calling supabase.auth.signInWithIdToken");
  console.log("[Google Callback] raw nonce (first 8):", pkce.nonce.slice(0, 8));
  const { data, error: sbError } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenData.id_token,
    nonce: pkce.nonce,
  });

  if (sbError || !data.session) {
    console.error("[Google Callback] Supabase error:", sbError?.message);
    return redirect("/signin?error=supabase_auth_failed", 302);
  }

  console.log("[Google Callback] Session created — user:", data.session.user.email);

  // 7. Welcome email for new users (non-blocking)
  const user = data.session.user;
  if (user.created_at === user.last_sign_in_at && user.email) {
    sendWelcomeEmail(
      user.email,
      user.user_metadata?.full_name || "Traveler"
    ).catch(console.error);
  }

  // 8. Set session cookies — same names/options as existing callback.ts
  const base = {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax" as const,
  };
  cookies.set("sb-access-token", data.session.access_token, {
    ...base,
    maxAge: 60 * 60 * 4, // 4 hours
  });
  cookies.set("sb-refresh-token", data.session.refresh_token, {
    ...base,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  console.log("[Google Callback] Done — redirecting to:", pkce.next);
  return redirect(pkce.next.startsWith("/") ? pkce.next : "/feeds", 302);
};
