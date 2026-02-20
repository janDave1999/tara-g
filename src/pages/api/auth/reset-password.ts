import type { APIRoute } from "astro";
import { getSupabaseClient, supabaseAdmin } from "../../../lib/supabase";
import { checkRateLimit, getClientIp } from "../../../lib/rateLimit";

export const POST: APIRoute = async ({ request, cookies }) => {
  const { allowed } = checkRateLimit(getClientIp(request));
  if (!allowed) {
    return new Response(
      JSON.stringify({ message: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const formData = await request.formData();
    const password = formData.get("password")?.toString();

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ message: "Password must be at least 8 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify the user's recovery session using their access token cookie
    const accessToken = cookies.get("sb-access-token")?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ message: "Your reset link has expired. Please request a new one." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the authenticated user from the access token
    const { data: userData, error: userError } = await getSupabaseClient(cookies)
      .auth.getUser(accessToken);

    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ message: "Your reset link has expired. Please request a new one." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update password using admin client (avoids session context issues)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password }
    );

    if (updateError) {
      console.error("updateUserById error:", updateError.message);
      return new Response(
        JSON.stringify({ message: "Failed to update password. Please try again." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Clear auth cookies so the user signs in fresh with their new password
    const clearOptions = {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "strict" as const,
      maxAge: 0,
    };
    cookies.set("sb-access-token", "", clearOptions);
    cookies.set("sb-refresh-token", "", clearOptions);
    cookies.set("sb-session-id", "", clearOptions);

    return new Response(
      JSON.stringify({ success: true, message: "Password updated successfully." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("reset-password error:", err);
    return new Response(
      JSON.stringify({ message: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
