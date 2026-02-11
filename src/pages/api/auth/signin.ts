import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { SITE_URL } from "astro:env/server";
import { v4 } from "uuid";
import { 
  handleApiError, 
  ValidationError, 
  AuthenticationError, 
  createSuccessResponse 
} from "../../../lib/errorHandler";
import { validateBody, commonSchemas } from "../../../lib/validation";
import { z } from "zod";
const signInSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
  provider: z.enum(['google', 'facebook']).optional()
});

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      console.log("Provider", provider)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: `${SITE_URL}/api/auth/callback`
        },
      });
      console.log("ANO NAG ERROR", error)
      if (error) {
        console.error("OAuth signin error:", error);
        throw new AuthenticationError('OAuth authentication failed');
      }
      console.log(data)
      return Response.redirect(data.url, 302);
    }

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const validatedData = signInSchema.parse({ email, password });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      console.error("Password signin error:", error);
      
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

    const { access_token, refresh_token } = data.session;
    const sessionId = v4();
    
    const cookieOptions = {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
    };

    cookies.set("sb-access-token", access_token, cookieOptions);
    cookies.set("sb-refresh-token", refresh_token, cookieOptions);
    cookies.set("sb-session-id", sessionId, cookieOptions);

    const response = Response.redirect(`${SITE_URL}/feeds`, 302);
    
    // Add CORS headers to the redirect response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
    
  } catch (error) {
    const errorResponse = handleApiError(error);
    
    // Add CORS headers to error responses too
    Object.entries(corsHeaders).forEach(([key, value]) => {
      errorResponse.headers.set(key, value);
    });
    
    return errorResponse;
  }
};
