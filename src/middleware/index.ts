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

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    console.log(`Request: ${url.pathname}`);

    if (micromatch.isMatch(url.pathname, protectedRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        console.log(`Redirecting to /signin due to lack of access and refresh tokens`);
        return redirect("/signin");
      }

      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error) {
        console.log(`Error setting session: ${error.message}`);
        cookies.delete("sb-access-token", { path: "/" });
        cookies.delete("sb-refresh-token", { path: "/" });
        return redirect("/signin");
      }

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

      const { data: userData } = await supabase.auth.getUser(
        data?.session?.access_token
      );
      console.log(`User data: ${JSON.stringify(userData)}`);
      locals.user_id = userData?.user?.id ?? null;
      locals.avatar_url = userData?.user?.user_metadata?.avatar_url ?? null;
    }

    if (micromatch.isMatch(url.pathname, redirectRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        console.log(`Redirecting to /feeds due to presence of access and refresh tokens`);
        return redirect("/feeds");
      }
    }

    if (micromatch.isMatch(url.pathname, proptectedAPIRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        console.log(`Returning 401 Unauthorized due to lack of access and refresh tokens`);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
      });

      if (error) {
        console.log(`Error setting session: ${error.message}`);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        });
      }

      /* Optional for API requests: attach user_id */
      const { data: userData } = await supabase.auth.getUser(accessToken.value);
      console.log(`User data: ${JSON.stringify(userData)}`);
      locals.user_id = userData?.user?.id ?? null;
    }

    return next();
  }
);
