import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

// check if email already exists in custom users table
async function emailExists(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking email:", error);
    throw new Error(error.message);
  }
  return !!data; // true if exists
}

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString() || "";
  const password = formData.get("password")?.toString() || "";

  if (!email || !password) {
    return new Response("Email and password are required", { status: 400 });
  }

  // ✅ Check if email already exists
  try {
    const exists = await emailExists(email);
    if (exists) {
      return new Response("Email already exists", { status: 409 });
    }
  } catch (err) {
    console.error(err);
    return new Response("Failed to check email", { status: 500 });
  }

  // ✅ Create new user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Supabase signUp error:", error);
    return new Response(error.message, { status: 500 });
  }

  // ✅ Redirect to confirmation page
  const headers = new Headers({
    Location: `/register/confirmation?email=${encodeURIComponent(email)}`,
  });
  return new Response(null, { status: 302, headers });
};
