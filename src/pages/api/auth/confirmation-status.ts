import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase";

export const GET: APIRoute = async ({ request, cookies }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return new Response(JSON.stringify({ error: "Missing token or email" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Set up SSE headers
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  console.log('[SSE] New connection request for token:', token?.substring(0, 8), 'email:', email);

  // Create a readable stream for SSE
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ status: "connected" })}\n\n`));

  // Check for confirmation every 2 seconds, for up to 5 minutes (150 checks)
  let checks = 0;
  const maxChecks = 150;

  console.log('[SSE] Starting poll interval, max checks:', maxChecks);

  const checkInterval = setInterval(async () => {
    checks++;

    try {
      // Check if the session has been confirmed
      console.log('[SSE] Check #', checks, 'looking for token:', token?.substring(0, 8));
      const { data: session, error: sessionError } = await supabaseAdmin
        .from("confirmation_sessions")
        .select("used_at, expires_at, user_id")
        .eq("session_token", token)
        .eq("email", email)
        .single();

      console.log('[SSE] Session query result:', session ? 'found' : 'not found', 'error:', sessionError);

      if (!session) {
        // Session not found - might be expired or invalid
        writer.write(encoder.encode(`data: ${JSON.stringify({ status: "expired" })}\n\n`));
        await writer.close();
        clearInterval(checkInterval);
        return;
      }

      // Check if already used (confirmed)
      if (session.used_at) {
        // Get the user and generate tokens
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("auth_id, email")
          .eq("user_id", session.user_id)
          .single();

        if (user) {
          // Generate auth tokens
          const { data: tokens, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
            type: "magiclink",
            email: user.email,
          });

          if (!tokenError && tokens && 'session' in tokens) {
            // Send the tokens to the client
            writer.write(encoder.encode(
              `data: ${JSON.stringify({
                status: "confirmed",
                access_token: (tokens as any).session?.access_token,
                refresh_token: (tokens as any).session?.refresh_token,
              })}\n\n`
            ));
          } else {
            // Fallback: just redirect to sign-in
            writer.write(encoder.encode(`data: ${JSON.stringify({ status: "confirmed_redirect" })}\n\n`));
          }
        } else {
          writer.write(encoder.encode(`data: ${JSON.stringify({ status: "error", message: "User not found" })}\n\n`));
        }
        
        await writer.close();
        clearInterval(checkInterval);
        return;
      }

      // Check if expired
      if (new Date(session.expires_at) < new Date()) {
        writer.write(encoder.encode(`data: ${JSON.stringify({ status: "expired" })}\n\n`));
        await writer.close();
        clearInterval(checkInterval);
        return;
      }

      // Still waiting
      if (checks >= maxChecks) {
        writer.write(encoder.encode(`data: ${JSON.stringify({ status: "timeout" })}\n\n`));
        await writer.close();
        clearInterval(checkInterval);
        return;
      }

    } catch (error) {
      console.error("[SSE] Error checking confirmation:", error);
      writer.write(encoder.encode(`data: ${JSON.stringify({ status: "error", message: "Server error" })}\n\n`));
      await writer.close();
      clearInterval(checkInterval);
    }
  }, 2000);

  // Clean up on connection close
  request.signal.addEventListener("abort", () => {
    clearInterval(checkInterval);
    writer.close();
  });

  return new Response(readable, { headers });
};
