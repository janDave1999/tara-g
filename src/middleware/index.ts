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

const protectedRoutes = ["/dashboard/**", "/feeds/**", "/trips/**", "/trips/create"];
const redirectRoutes = ["/signin(|/)", "/register(|/)", "/"];
const proptectedAPIRoutes = ["/api/trips/**", "/api/feeds/**"];
const publicRoutes = ["/", "/about", "/legals/**", "/discover", "/blogs/**"];

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    // ✨ Always try to resolve logged-in user (even on public routes)
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
      });

      if (!error) {
        const { data: userData } = await supabase.auth.getUser(
          data?.session?.access_token
        );

        locals.user_id = userData?.user?.id ?? null;
        locals.avatar_url = userData?.user?.user_metadata?.avatar_url ?? null;

        // update cookies silently in the background
        cookies.set("sb-access-token", data.session?.access_token!, {
          sameSite: "strict",
          path: "/",
          secure: true,
        });
        cookies.set("sb-refresh-token", data.session?.refresh_token!, {
          sameSite: "strict",
          path: "/",
          secure: true,
        });
      }
    }

    // 🔒 Protected UI pages
    if (micromatch.isMatch(url.pathname, protectedRoutes)) {
      if (!locals.user_id) {
        return redirect("/signin");
      }
    }

    // 🔒 Protected actions
    if (url.pathname.startsWith("/_actions/")) {
      if (!locals.user_id) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // 🔒 Protected API
    if (micromatch.isMatch(url.pathname, proptectedAPIRoutes)) {
      if (!locals.user_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }
    }

    // 🚫 Redirect if a logged-in user visits /signin or /register
    if (micromatch.isMatch(url.pathname, redirectRoutes)) {
      if (locals.user_id) {
        return redirect("/feeds");
      }
    }

    return next();
  }
);

