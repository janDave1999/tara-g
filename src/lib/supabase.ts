import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "astro:env/server";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            flowType: "pkce",
        },
    },
);

export const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
);

export const getSupabaseClient = async (cookiesOrTokens: any): Promise<SupabaseClient> => {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  
  if (cookiesOrTokens && typeof cookiesOrTokens === 'object') {
    if (cookiesOrTokens.get && cookiesOrTokens.get('sb-access-token')) {
      accessToken = cookiesOrTokens.get('sb-access-token')?.value;
      refreshToken = cookiesOrTokens.get('sb-refresh-token')?.value;
    } else if (cookiesOrTokens.access_token) {
      accessToken = cookiesOrTokens.access_token;
      refreshToken = cookiesOrTokens.refresh_token;
    }
  }
  
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  if (accessToken && refreshToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
  
  return client;
};