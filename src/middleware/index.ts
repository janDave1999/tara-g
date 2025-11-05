// import { Middleware } from "@/lib/middleware/main";
// import { sequence, defineMiddleware } from "astro/middleware";
// import { CheckIfLive, CheckIfMaintenance } from "./callbacks/maintenance";

// /*|------------------------------------------------------------------------------------------|*/
// /*|               Entry Point                                                                |*/
// /*|------------------------------------------------------------------------------------------|*/
// export const onRequest = sequence(Main());
// function Main(){
//   return defineMiddleware(async (context, next) => {
//     // Middleware logic goes here

//     // Skip if it is an action
//     if(context.url.pathname.startsWith("/_actions")){
//       return next();
//     }
//     //If it is a server island loader
//     if(context.url.pathname.startsWith("/_server-island")){
//       return next();
//     }

//     if(context.url.pathname.startsWith("/api/auth")) {
//       return next();
//     };

//     // Middleware Utility
//     const mid = new Middleware(context, next);

//     // Grouping Example

//     // 1st Group Middleware
//     await mid.group(async(mid)=>{
//       //Check if maintenance
//       await mid.path().except(["/memo/maintenance"], "startend").do(CheckIfMaintenance);
//       await mid.path().select(["/memo/maintenance"], "startend").do(CheckIfLive);

//       return mid.fin(); // to end the group
//     });


//     return await mid.result();
//   });
// }


import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import micromatch from "micromatch";
import type { Locals } from "astro/actions/runtime/utils.js";

const protectedRoutes = ["/dashboard(|/)", "/feeds(|/)"];
const redirectRoutes = ["/signin(|/)", "/register(|/)", "/"];
const proptectedAPIRoutes = ["/api/guestbook(|/)"];
type ExtendedLocals = Locals & { email: string };

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    if (micromatch.isMatch(url.pathname, protectedRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        return redirect("/signin");
      }

      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error) {
        cookies.delete("sb-access-token", {
          path: "/",
        });
        cookies.delete("sb-refresh-token", {
          path: "/",
        });
        return redirect("/signin");
      }



      // locals.email = data.user?.email!;
      cookies.set("sb-access-token", data?.session?.access_token!, {
        sameSite: "strict",
        path: "/",
        secure: true,
      });
      cookies.set("sb-refresh-token", data?.session?.refresh_token!, {
        sameSite: "strict",
        path: "/",
        secure: true,
      });
    }

    if (micromatch.isMatch(url.pathname, redirectRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        return redirect("/feeds");
      }
    }

    if (micromatch.isMatch(url.pathname, proptectedAPIRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      // Check for tokens
      if (!accessToken || !refreshToken) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
          }),
          { status: 401 },
        );
      }

      // Verify the tokens
      const { error } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
      });

      if (error) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
          }),
          { status: 401 },
        );
      }
    }

    return next();
  },
);