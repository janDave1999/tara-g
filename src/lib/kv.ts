import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  USER_CACHE: KVNamespace;
}

declare global {
  namespace App {
    interface Locals {
      env?: Env;
    }
  }
}

export function getUserCacheKey(userId: string): string {
  return `user:${userId}:profile`;
}

export function getOnboardingCacheKey(userId: string): string {
  return `user:${userId}:onboarding`;
}

export async function getFromKV<T>(
  key: string,
  env?: Env
): Promise<T | null> {
  if (!env?.USER_CACHE) {
    return null;
  }

  try {
    const value = await env.USER_CACHE.get(key, { type: "json" });
    return value as T | null;
  } catch {
    return null;
  }
}

export async function setToKV<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  env?: Env
): Promise<void> {
  if (!env?.USER_CACHE) {
    return;
  }

  try {
    await env.USER_CACHE.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    // Silently fail - caching is best-effort
  }
}

export async function deleteFromKV(
  key: string,
  env?: Env
): Promise<void> {
  if (!env?.USER_CACHE) {
    return;
  }

  try {
    await env.USER_CACHE.delete(key);
  } catch {
    // Silently fail - caching is best-effort
  }
}

export async function invalidateUserCache(
  userId: string,
  env?: Env
): Promise<void> {
  await Promise.all([
    deleteFromKV(getUserCacheKey(userId), env),
    deleteFromKV(getOnboardingCacheKey(userId), env),
  ]);
}
