import { supabaseAdmin } from './supabase';

export interface RefreshedSession {
  user_id: string;
  avatar_url?: string;
  email?: string;
  access_token: string;
  refresh_token: string;
}

/**
 * Attempts to refresh an expired Supabase session.
 * Returns the refreshed session data, or null if refresh fails.
 */
export async function refreshSession(
  accessToken: string,
  refreshToken: string
): Promise<RefreshedSession | null> {
  const { data, error } = await supabaseAdmin.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.user || !data.session) {
    return null;
  }

  return {
    user_id: data.user.id,
    avatar_url: data.user.user_metadata?.avatar_url,
    email: data.user.email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
