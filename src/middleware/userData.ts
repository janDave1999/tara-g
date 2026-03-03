import { defineMiddleware } from "astro:middleware";
import { supabaseAdmin } from "@/lib/supabase";
import { userCache } from "@/lib/userCache";
import { getFromKV, setToKV, getUserCacheKey } from "@/lib/kv";

export interface CachedUser {
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

const PROFILE_CACHE_TTL = 300;

/** Query public.users — returns DB row or null. Never falls back. */
async function fetchUserFromDB(userId: string): Promise<CachedUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("username, avatar_url, full_name")
    .eq("auth_id", userId)
    .maybeSingle();

  if (error) {
    console.error(`[userData] DB query error for auth_id=${userId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    username: data.username,
    avatar_url: data.avatar_url,
    full_name: data.full_name,
  };
}

/** Fallback: read from Supabase Auth user_metadata. Result is NOT cached. */
async function fetchUserFromAuthMetadata(userId: string): Promise<CachedUser | null> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (authError) {
    console.error(`[userData] auth.admin.getUserById failed for ${userId}:`, authError);
    return null;
  }

  if (authData?.user) {
    const metadata = authData.user.user_metadata;
    const username = metadata?.username;
    const avatar_url = metadata?.avatar_url;
    const full_name = metadata?.full_name;

    if (username || avatar_url || full_name) {
      return {
        username: username ?? 'User',
        avatar_url: avatar_url ?? null,
        full_name: full_name ?? null,
      };
    }
  }

  console.warn(`[userData] Could not resolve profile for auth_id=${userId}`);
  return null;
}

async function getCachedUser(
  userId: string,
  env?: any
): Promise<CachedUser | null> {
  const cacheKey = getUserCacheKey(userId);

  const cached = userCache.get<CachedUser>(cacheKey);
  if (cached) {
    return cached;
  }

  const kvCached = await getFromKV<CachedUser>(cacheKey, env);
  if (kvCached) {
    userCache.set(cacheKey, kvCached);
    return kvCached;
  }

  const dbUser = await fetchUserFromDB(userId);

  if (dbUser) {
    // Only cache confirmed DB results
    userCache.set(cacheKey, dbUser);
    await setToKV(cacheKey, dbUser, PROFILE_CACHE_TTL, env);
    return dbUser;
  }

  // DB miss — try auth metadata as a degraded fallback but do NOT cache it
  return fetchUserFromAuthMetadata(userId);
}

export const userData = defineMiddleware(async (ctx, next) => {
  const { locals } = ctx;

  if (locals.user_id) {
    const user = await getCachedUser(locals.user_id, locals.env as any);

    if (user) {
      locals.username = user.username;
      locals.avatar_url = user.avatar_url ?? undefined;
      locals.full_name = user.full_name ?? undefined;
    }
  }

  return next();
});
