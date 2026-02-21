import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { SITE_URL } from "astro:env/server";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";

export const POST: APIRoute = async ({ request }) => {
  const { allowed } = await checkRateLimit(getClientIp(request));
  if (!allowed) {
    return new Response(
      JSON.stringify({ message: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString().trim();

    if (!email) {
      return new Response(
        JSON.stringify({ message: "Email address is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ message: "Please enter a valid email address." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send the reset email. Supabase does not reveal whether the address exists
    // to prevent user enumeration — we always return success to the client.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/api/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error("resetPasswordForEmail error:", error.message);
      // Still return success to avoid leaking whether an email is registered
    }

    return new Response(
      JSON.stringify({ success: true, message: "If an account exists for that email, a reset link has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("forgot-password error:", err);
    return new Response(
      JSON.stringify({ message: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
