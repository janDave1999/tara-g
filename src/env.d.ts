interface ImportMetaEnv {
  readonly SECRET_ENVIRONMENT_STATUS: "live"|"maintenance";
 
  readonly SUPABASE_URL: string
  readonly SUPABASE_ANON_KEY: string
  // readonly MAP_BOX_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}