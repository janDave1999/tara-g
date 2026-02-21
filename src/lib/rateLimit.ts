/**
 * Distributed IP-based rate limiter using Cloudflare KV.
 * 
 * Works across all Worker instances by using KV for storage.
 * Falls back to in-memory if KV is not available.
 * 
 * For production, also configure Cloudflare Rate Limiting rules
 * at the Cloudflare dashboard level as additional protection.
 */

import type { KVNamespace } from "@cloudflare/workers-types";

const WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const MAX_ATTEMPTS = 10;           // max requests per window per IP

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

let kvStore: KVNamespace | null = null;

export function setRateLimitKV(kv: KVNamespace | null) {
  kvStore = kv;
}

export function getRateLimitKV(): KVNamespace | null {
  return kvStore;
}

async function getFromKV(ip: string): Promise<RateLimitRecord | null> {
  if (!kvStore) return null;
  
  try {
    const data = await kvStore.get(ip, { type: "json" });
    return data as RateLimitRecord | null;
  } catch {
    return null;
  }
}

async function setToKV(ip: string, record: RateLimitRecord, ttlSeconds: number): Promise<void> {
  if (!kvStore) return;
  
  try {
    await kvStore.put(ip, JSON.stringify(record), { expirationTtl: ttlSeconds });
  } catch {
    // Silently fail - will fall back to in-memory
  }
}

const inMemoryStore = new Map<string, RateLimitRecord>();

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const ttlSeconds = Math.ceil(WINDOW_MS / 1000);
  
  // Try KV first (distributed)
  let record = await getFromKV(ip);
  
  // Fall back to in-memory if KV unavailable
  if (!record) {
    record = inMemoryStore.get(ip) || null;
  }
  
  if (!record || now > record.resetAt) {
    const newRecord: RateLimitRecord = { count: 1, resetAt: now + WINDOW_MS };
    
    // Store in both KV and in-memory
    await setToKV(ip, newRecord, ttlSeconds);
    inMemoryStore.set(ip, newRecord);
    
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false };
  }

  record.count++;
  
  // Update both stores
  await setToKV(ip, record, ttlSeconds);
  inMemoryStore.set(ip, record);
  
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  // Use only CF-Connecting-IP (trusted, cannot be spoofed)
  // Do NOT use X-Forwarded-For as it can be spoofed
  return (
    request.headers.get("CF-Connecting-IP") ?? 
    "unknown"
  );
}
