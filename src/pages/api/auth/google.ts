import type { APIRoute } from "astro";
import { SITE_URL, GOOGLE_CLIENT_ID } from "astro:env/server";

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function sha256(s: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}

function rand(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const next = url.searchParams.get("next") || "/feeds";
  const safeNext = next.startsWith("/") ? next : "/feeds";

  const codeVerifier = rand();
  const codeChallenge = base64url(await sha256(codeVerifier));
  const state = rand();
  const nonce = rand();

  cookies.set(
    "google-oauth-state",
    JSON.stringify({ codeVerifier, state, nonce, next: safeNext }),
    {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    }
  );

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${SITE_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
    nonce,
    access_type: "online",
    prompt: "select_account",
  });

  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
