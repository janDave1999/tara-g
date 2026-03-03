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

// GoTrue verifies nonces with: hex(SHA256(raw_nonce)) === JWT nonce claim
// So we must send the hex-encoded hash to Google, not base64url
async function hexSha256(s: string): Promise<string> {
  const buf = await sha256(s);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function rand(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
}

const ORIGIN = SITE_URL.replace(/\/$/, "");

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const next = url.searchParams.get("next") || "/feeds";
  const safeNext = next.startsWith("/") ? next : "/feeds";

  const codeVerifier = rand();
  const codeChallenge = base64url(await sha256(codeVerifier));
  const state = rand();
  const nonce = rand();
  // GoTrue verifies: hex(SHA256(raw_nonce)) === JWT nonce claim
  // So we send the hex hash to Google; Google stores it verbatim in the JWT.
  // signInWithIdToken receives the raw nonce; GoTrue hashes it and compares.
  const hashedNonce = await hexSha256(nonce);

  console.log("[Google Auth] Initiating PKCE flow");
  console.log("[Google Auth] ORIGIN:", ORIGIN);
  console.log("[Google Auth] redirect_uri:", `${ORIGIN}/api/auth/google/callback`);
  console.log("[Google Auth] state (first 8):", state.slice(0, 8));
  console.log("[Google Auth] nonce (raw, first 8):", nonce.slice(0, 8));
  console.log("[Google Auth] hashedNonce hex (first 8):", hashedNonce.slice(0, 8));

  cookies.set(
    "google-oauth-state",
    JSON.stringify({ codeVerifier, state, nonce, next: safeNext }), // raw nonce stored
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
    redirect_uri: `${ORIGIN}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
    nonce: hashedNonce, // send hashed — Google puts this in id_token's nonce claim
    access_type: "online",
    prompt: "select_account",
  });

  console.log("[Google Auth] Redirecting to Google consent screen");
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};
