interface ImportMetaEnv {
  readonly SECRET_ENVIRONMENT_STATUS: "live"|"maintenance";
 
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string
  readonly SITE_URL: string
  readonly PUBLIC_MAPBOX_TOKEN: string
  readonly SUPABASE_SERVICE_ROLE_KEY: string,
  
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    user_id: string | null;
  }
}