// src/pages/api/auth/resend-confirmation.ts
import { supabase } from "@/lib/supabase";

export const POST = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email as string,
  });

  return new Response(
    JSON.stringify({
      success: !error,
      message: error ? error.message : "Confirmation email resent successfully!",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
