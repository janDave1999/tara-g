import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import type { Provider } from "@supabase/supabase-js";
import { SITE_URL } from "astro:env/server";
import { v4 } from "uuid";
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const provider = formData.get("provider")?.toString();

  const validProviders = ["google", "facebook"];

  if (provider && validProviders.includes(provider)) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: `${SITE_URL}/api/auth/callback`
      },
    });

    if (error) {
      console.error("signin with oauth error", error);
      return new Response(error.message, { status: 500 });
    }

    return redirect(data.url);
  }

  if (!email || !password) {
    return new Response("Email and password are required", { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("signin with password error", error);
    return new Response(error.message, { status: 500 });
  }

  const { access_token, refresh_token } = data.session;
  cookies.set("sb-access-token", access_token, {
    path: "/",
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
  });
  let sessionId = v4();
  cookies.set("sb-session-id", sessionId, {
    path: "/",
  });
  return redirect("/feeds");
};
