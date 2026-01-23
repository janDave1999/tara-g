import { createClient } from "@supabase/supabase-js";
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

// WITH USER AUTH CLIENT
export const getSupabaseClient = (cookies: any) => {
  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_ANON_KEY;
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${cookies.get('sb-access-token')?.value}`
      }
    }
  });
};