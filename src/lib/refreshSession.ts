import { supabaseAdmin } from './supabase';

export interface RefreshedSession {
  user_id: string;
  username?: string;
  avatar_url?: string;
  email?: string;
  access_token: string;
  refresh_token: string;
}

/**
 * Exchanges a refresh token for a new access + refresh token pair.
 * Uses the dedicated refreshSession API (not setSession which doesn't reliably refresh).
 */
export async function refreshSession(
  refreshToken: string
): Promise<RefreshedSession | null> {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.user || !data.session) {
    return null;
  }

  return {
    user_id: data.user.id,
    username: data.user.user_metadata?.username,
    avatar_url: data.user.user_metadata?.avatar_url,
    email: data.user.email,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
