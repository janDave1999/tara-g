import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import {
  handleApiError,
  ValidationError,
} from "../../../lib/errorHandler";
import { commonSchemas } from "../../../lib/validation";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";
import { SITE_URL } from "astro:env/server";
import { z } from "zod";

const registerSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password
});

// check if email already exists in custom users table
async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error('Database error while checking email');
  }
  return !!data; // true if exists
}

export const POST: APIRoute = async ({ request }) => {
  const { allowed } = checkRateLimit(getClientIp(request));
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

    // Create new user in Supabase Auth
    // emailRedirectTo sends confirmed users to onboarding instead of /feeds
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        emailRedirectTo: `${SITE_URL}/api/auth/callback?next=/onboarding/profile`,
      },
    });
    console.log(error)
    if (error) {
      if (error.message.includes('User already registered')) {
        throw new ValidationError('Email already exists', { email: 'This email is already registered' });
      }
      
      throw new Error('Registration failed. Please try again.');
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
