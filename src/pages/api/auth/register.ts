import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import {
  handleApiError,
  ValidationError,
} from "../../../lib/errorHandler";
import { commonSchemas } from "../../../lib/validation";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";
import { SITE_URL } from "astro:env/server";
import { sendWelcomeEmail, sendConfirmationEmail } from "../../../lib/email";
import { randomUUID } from "crypto";
import { z } from "zod";

const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password
});

// check if email already exists in custom users table
async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error('Database error while checking email');
  }
  return !!data; // true if exists
}

function generateConfirmationToken(): string {
  return randomUUID();
}

export const POST: APIRoute = async ({ request }) => {
  const { allowed } = await checkRateLimit(getClientIp(request));
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const validatedData = registerSchema.parse({ email, password });

    // Check if email already exists
    try {
      const exists = await emailExists(validatedData.email);
      if (exists) {
        throw new ValidationError('Email already exists', { email: 'This email is already registered' });
      }
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      throw new Error('Failed to check email availability');
    }

    // Check if there's an existing unconfirmed user with this email
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("auth_id, confirmation_token")
      .eq("email", validatedData.email)
      .maybeSingle();

    // Generate confirmation token
    const confirmationToken = generateConfirmationToken();
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // If user exists but not confirmed, update their token
    if (existingUser && existingUser.confirmation_token) {
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({
          confirmation_token: confirmationToken,
          confirmation_token_expires_at: tokenExpiry
        })
        .eq("email", validatedData.email);

      if (updateError) {
        console.error("[Register] Failed to update existing user:", updateError);
      } else {
        // Send confirmation email
        sendConfirmationEmail(validatedData.email, "Traveler", confirmationToken).catch((err) => {
          console.error("[Register] Failed to send confirmation email:", err);
        });

        // Redirect to confirmation page
        const headers = new Headers({
          Location: `/register/confirmation?email=${encodeURIComponent(validatedData.email)}`,
        });
        return new Response(null, { status: 302, headers });
      }
    }

    // Create new user in Supabase Auth (auto-confirm disabled)
    // We'll send custom confirmation email via MailerSend
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        confirmation_token: confirmationToken
      }
    });

    if (authError) {
      console.error("[Register] Auth error:", authError);
      if (authError.message.includes('already registered')) {
        throw new ValidationError('Email already exists', { email: 'This email is already registered' });
      }
      throw new Error('Registration failed. Please try again.');
    }

    console.log("[Register] Auth user created:", authData.user.id);

    // Store pending confirmation in users table (use admin to bypass RLS)
    // Username will be set during onboarding
    const { error: userError } = await supabaseAdmin
      .from("users")
      .upsert({
        auth_id: authData.user.id,
        email: validatedData.email,
        username: `user_${authData.user.id.substring(0, 8)}`,
        confirmation_token: confirmationToken,
        confirmation_token_expires_at: tokenExpiry,
        created_at: new Date().toISOString()
      }, { onConflict: 'auth_id', ignoreDuplicates: false });

    if (userError) {
      console.error("[Register] User upsert error:", userError);
      console.log("[Register] Will continue anyway - auth user exists:", authData.user.id);
    } else {
      console.log("[Register] User record created/updated successfully:", authData.user.id);
    }

    // Send confirmation email (wait for it to complete)
    console.log("[Register] Sending confirmation email...");
    const emailResult = await sendConfirmationEmail(validatedData.email, "Traveler", confirmationToken);
    console.log("[Register] Email result:", emailResult);

    if (!emailResult.success) {
      console.error("[Register] Failed to send confirmation email:", emailResult.error);
      // Continue anyway - don't block registration
    }

    // Redirect to confirmation page
    const headers = new Headers({
      Location: `/register/confirmation?email=${encodeURIComponent(validatedData.email)}`,
    });
    return new Response(null, { status: 302, headers });
    
  } catch (error) {
    return handleApiError(error);
  }
};
