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

async function fetchUserFromDB(userId: string): Promise<CachedUser | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("username, avatar_url, full_name")
    .eq("auth_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    username: data.username,
    avatar_url: data.avatar_url,
    full_name: data.full_name,
  };
}

async function getCachedUser(
  userId: string,
  env?: App.Locals["env"]
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

  const user = await fetchUserFromDB(userId);
  if (user) {
    userCache.set(cacheKey, user);
    await setToKV(cacheKey, user, PROFILE_CACHE_TTL, env);
  }

  return user;
}

export const userData = defineMiddleware(async (ctx, next) => {
  const { locals } = ctx;

  if (locals.user_id) {
    const user = await getCachedUser(locals.user_id, locals.env);

    if (user) {
      locals.username = user.username;
      locals.avatar_url = user.avatar_url ?? undefined;
      locals.full_name = user.full_name ?? undefined;
    }
  }

  return next();
});
