import type { APIContext } from "astro";
import { SECRET_ENVIRONMENT_STATUS } from "astro:env/server";

export async function CheckIfMaintenance(context:APIContext){
  const environment = SECRET_ENVIRONMENT_STATUS;
  if(environment == "maintenance")
    return context.redirect("/memo/maintenance");
}

export async function CheckIfLive(context:APIContext){
  const environment = SECRET_ENVIRONMENT_STATUS;
  if(environment != "maintenance")
    return context.redirect("/");
}