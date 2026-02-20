import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { SITE_URL } from "astro:env/server";
import { v4 } from "uuid";
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
} from "../../../lib/errorHandler";
import { commonSchemas } from "../../../lib/validation";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";
import { z } from "zod";

const signInSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
  provider: z.enum(['google', 'facebook']).optional()
});

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { allowed } = checkRateLimit(getClientIp(request));
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const provider = formData.get("provider")?.toString();

    if (provider) {
      const validProviders = ["google", "facebook"];
      
      if (!validProviders.includes(provider)) {
        throw new ValidationError('Invalid OAuth provider');
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: `${SITE_URL}/api/auth/callback`
        },
      });
      if (error) {
        throw new AuthenticationError('OAuth authentication failed');
      }
      return Response.redirect(data.url, 302);
    }

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const validatedData = signInSchema.parse({ email, password });

    // Check for login attempt cooldown BEFORE attempting login
    const clientIp = getClientIp(request);
    const { data: cooldownData } = await supabaseAdmin.rpc('check_login_cooldown', {
      p_email: validatedData.email,
      p_ip_address: clientIp
    });

    if (cooldownData && !cooldownData.allowed) {
      const remainingMinutes = Math.ceil(cooldownData.remaining_seconds / 60);
      throw new RateLimitError(
        `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        { remaining_seconds: cooldownData.remaining_seconds }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: password,
    });

    if (error) {
      // Record failed login attempt
      await supabaseAdmin.rpc('record_login_attempt', {
        p_email: validatedData.email,
        p_ip_address: clientIp,
        p_success: false
      });
      
      if (error.message.includes('Invalid login credentials')) {
        throw new AuthenticationError('Invalid email or password');
      }
      
      if (error.message.includes('Email not confirmed')) {
        throw new AuthenticationError('Please check your email and confirm your account before signing in');
      }
      
      if (error.message.includes('Too many requests')) {
        throw new AuthenticationError('Too many login attempts. Please try again later');
      }
      
      if (error.message.includes('User not found')) {
        throw new AuthenticationError('No account found with this email address');
      }
      
      throw new AuthenticationError('Authentication failed. Please check your credentials and try again');
    }

    if (!data.session) {
      throw new AuthenticationError('No session created');
    }

    // Record successful login attempt
    await supabaseAdmin.rpc('record_login_attempt', {
      p_email: validatedData.email,
      p_ip_address: clientIp,
      p_success: true
    });

    const { access_token, refresh_token } = data.session;
    const sessionId = v4();
    
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'strict' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    cookies.set("sb-access-token", access_token, cookieOptions);
    cookies.set("sb-refresh-token", refresh_token, cookieOptions);
    cookies.set("sb-session-id", sessionId, cookieOptions);
    
    return redirect(`${SITE_URL}/feeds`, 302);
    
  } catch (error) {
    const errorResponse = handleApiError(error);
    return errorResponse;
  }
};
