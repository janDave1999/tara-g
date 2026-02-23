import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../lib/supabase";

export const GET: APIRoute = async ({ url, redirect }) => {
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    return new Response("Invalid confirmation link", { status: 400 });
  }

  console.log("[Confirm] Looking for user:", { email, token: token.substring(0, 8) + "..." });

  // Find user with matching token (use admin to bypass RLS)
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("auth_id, email, confirmation_token, confirmation_token_expires_at")
    .eq("email", email)
    .eq("confirmation_token", token)
    .maybeSingle();

  if (error) {
    console.error("[Confirm] Database error:", error);
    return new Response("Confirmation failed. Please try again.", { status: 500 });
  }

  if (!user) {
    console.error("[Confirm] User not found or invalid token:", { email, tokenMatch: false });
    return new Response("Invalid or expired confirmation link", { status: 400 });
  }

  console.log("[Confirm] User found:", { email, hasToken: !!user.confirmation_token });

  // Check if token is expired
  if (new Date(user.confirmation_token_expires_at) < new Date()) {
    console.error("[Confirm] Token expired:", { email });
    return new Response("Confirmation link has expired. Please request a new one.", { status: 400 });
  }

  try {
    // Confirm user in Supabase Auth
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      user.auth_id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("[Confirm] Failed to confirm auth user:", confirmError);
      return new Response("Confirmation failed. Please try again.", { status: 500 });
    }

    // Clear confirmation token (user is now confirmed) - use admin to bypass RLS
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        confirmation_token: null,
        confirmation_token_expires_at: null,
        email_confirmed_at: new Date().toISOString()
      })
      .eq("auth_id", user.auth_id);

    if (updateError) {
      console.error("[Confirm] Failed to update user:", updateError);
      // Auth is confirmed, so we can still proceed
    }

    console.log("[Confirm] Email confirmed successfully:", email);
    return redirect("/signin?confirmed=true", 302);

  } catch (err) {
    console.error("[Confirm] Exception:", err);
    return new Response("Confirmation failed. Please try again.", { status: 500 });
  }
};
