import { getUserCacheKey, getOnboardingCacheKey } from "./kv";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class UserCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTtl: number;

  constructor(defaultTtlSeconds: number = 300) {
    this.defaultTtl = defaultTtlSeconds * 1000;
    this.cleanup();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds ?? this.defaultTtl / 1000) * 1000;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateUser(userId: string): void {
    this.delete(getUserCacheKey(userId));
    this.delete(getOnboardingCacheKey(userId));
  }

  private cleanup(): void {
    if (typeof setInterval === "undefined") return;

    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }
}

export const userCache = new UserCache(300);
