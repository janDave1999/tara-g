import type { APIRoute } from "astro";
import { SITE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "astro:env/server";
import { supabase } from "../../../../lib/supabase";
import { sendWelcomeEmail } from "../../../../lib/email";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  // 1. Read + immediately delete one-time state cookie
  const raw = cookies.get("google-oauth-state")?.value;
  cookies.delete("google-oauth-state", { path: "/" });
  if (!raw) return redirect("/signin?error=session_expired", 302);

  let pkce: { codeVerifier: string; state: string; nonce: string; next: string };
  try {
    pkce = JSON.parse(raw);
  } catch {
    return redirect("/signin?error=invalid_state", 302);
  }

  // 2. Validate state (CSRF protection)
  if (url.searchParams.get("state") !== pkce.state) {
    return redirect("/signin?error=state_mismatch", 302);
  }

  // 3. Check for Google error (e.g. user cancelled)
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return redirect(
      `/signin?error=${oauthError === "access_denied" ? "access_denied" : "oauth_error"}`,
      302
    );
  }

  // 4. Get authorization code
  const code = url.searchParams.get("code");
  if (!code) return redirect("/signin?error=no_code", 302);

  // 5. Exchange code + code_verifier for tokens at Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${SITE_URL}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: pkce.codeVerifier,
    }),
  });

  const tokenData = (await tokenRes.json()) as { id_token?: string; error?: string };
  if (!tokenRes.ok || !tokenData.id_token) {
    console.error("[Google Callback] Token exchange failed:", tokenData.error);
    return redirect("/signin?error=token_exchange_failed", 302);
  }

  // 6. Exchange id_token with Supabase
  // Pass nonce as raw string — Supabase SDK hashes it internally before verifying the JWT claim
  const { data, error: sbError } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenData.id_token,
    nonce: pkce.nonce,
  });

  if (sbError || !data.session) {
    console.error("[Google Callback] Supabase error:", sbError?.message);
    return redirect("/signin?error=supabase_auth_failed", 302);
  }

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

  return redirect(pkce.next.startsWith("/") ? pkce.next : "/feeds", 302);
};
