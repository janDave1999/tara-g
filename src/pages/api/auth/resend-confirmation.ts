// src/pages/api/auth/resend-confirmation.ts
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { sendConfirmationEmail } from "../../../lib/email";
import { randomUUID } from "crypto";

export const POST = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const email = formData.get("email") as string;

  if (!email) {
    return new Response(
      JSON.stringify({ success: false, message: "Email is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Find user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("auth_id, email, confirmation_token, confirmation_token_expires_at")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user is already confirmed
    if (!user.confirmation_token) {
      return new Response(
        JSON.stringify({ success: false, message: "Email is already confirmed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate new token
    const newToken = randomUUID();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Update token in database (use admin to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        confirmation_token: newToken,
        confirmation_token_expires_at: tokenExpiry
      })
      .eq("auth_id", user.auth_id);

    if (updateError) {
      console.error("[Resend] Failed to update token:", updateError);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to resend confirmation email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Send confirmation email via MailerSend
    const result = await sendConfirmationEmail(email, "Traveler", newToken);

    if (!result.success) {
      console.error("[Resend] Failed to send email:", result.error);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to send confirmation email" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Confirmation email resent successfully!" }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Resend] Exception:", error);
    return new Response(
      JSON.stringify({ success: false, message: "An error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
